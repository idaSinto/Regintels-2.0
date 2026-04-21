import { NextResponse } from 'next/server';
import { supabase } from '@/lib/core/database';

// ==========================================
// 1. TYPES & INTERFACES
// ==========================================
type Article = {
  id: number;
  url: string;
  title: string;
  published_at?: string | null;
  source?: string | null;
};

type ArticleResponse = Article & {
  source_domain: string | null;
  is_trusted: boolean;
};

type VerifiedUpdateRow = {
  id: number;
  regulation: string | number;
  deduced_title: string;
  summary_text: string;
  impact_level: 'high' | 'medium' | 'low' | null;
  related_article_ids: number[] | null;
  deduced_published_date: string | null;
  created_at: string;
  anchor?: string | null;
};

type RegulationRow = {
  id: string | number;
  name: string;
};

type RegulationProfileRow = {
  regulation_id: string | number;
  primary_sources: string[] | null;
};

const TRUSTED_SOURCE_DOMAINS = [
  'echa.europa.eu',
  'europa.eu',
  'eur-lex.europa.eu',
  'gov.uk',
  'ec.europa.eu',
  'eurofins.com',
  'chemradar.com'
];

function extractHostname(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return value.toLowerCase().replace(/^https?:\/\//, '').split('/')[0] || null;
  }
}

function isTrustedDomain(domain: string | null): boolean {
  if (!domain) return false;
  return TRUSTED_SOURCE_DOMAINS.some(
    (trusted) => domain === trusted || domain.endsWith(`.${trusted}`)
  );
}

function parseDateSafe(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestPublishedDate(articles: ArticleResponse[]): string | null {
  if (articles.length === 0) return null;

  const latest = [...articles].sort(
    (a, b) => parseDateSafe(b.published_at) - parseDateSafe(a.published_at)
  )[0];

  return latest?.published_at ?? null;
}

function toSingleFocusedSummary(summary: string): string {
  const normalized = (summary ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return normalized;

  // Keep first update sentence when legacy rows contain concatenated "On ... . On ..."
  const parts = normalized.split(/(?<=\.)\s+(?=On\s+[A-Z])/);
  return parts[0]?.trim() ?? normalized;
}

function deriveTitleFromSummary(summary: string, fallbackTitle: string): string {
  const focused = toSingleFocusedSummary(summary);
  if (!focused) return fallbackTitle;
  return focused.length > 120 ? `${focused.slice(0, 117)}...` : focused;
}

function extractSummaryMonth(summary: string): { year: number; month: number } | null {
  const match = summary.match(/\b(?:On|In)\s+([A-Za-z]+)\s+(\d{4})\b/i);
  if (!match) return null;

  const parsed = new Date(`${match[1]} 1, ${match[2]}`);
  if (Number.isNaN(parsed.getTime())) return null;

  return { year: parsed.getFullYear(), month: parsed.getMonth() };
}

function pickPublishedDateAlignedWithSummary(
  articles: ArticleResponse[],
  summary: string,
  fallback: string | null
): string | null {
  const targetMonth = extractSummaryMonth(summary);
  if (!targetMonth) return latestPublishedDate(articles) ?? fallback;

  const monthMatched = articles
    .filter((article) => {
      if (!article.published_at) return false;
      const d = new Date(article.published_at);
      return !Number.isNaN(d.getTime())
        && d.getFullYear() === targetMonth.year
        && d.getMonth() === targetMonth.month;
    })
    .sort((a, b) => parseDateSafe(b.published_at) - parseDateSafe(a.published_at));

  if (monthMatched.length > 0) {
    return monthMatched[0].published_at ?? fallback;
  }

  return latestPublishedDate(articles) ?? fallback;
}

// ==========================================
// 2. GET HANDLER (API ROUTE)
// ==========================================
export async function GET() {
  // Fetch one latest card per semantic update anchor (supports multiple cards per regulation)
  const { data, error } = await supabase
    .from('verified_updates')
    .select(`
      id,
      regulation,
      deduced_title,
      summary_text,
      impact_level,
      related_article_ids,
      deduced_published_date,
      created_at,
      anchor
    `)
    .eq('is_latest', true)
    .order('deduced_published_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fetch error:', error);
    return NextResponse.json([], { status: 500 });
  }

  const updateRows = (data ?? []) as VerifiedUpdateRow[];
  const regulationIds = Array.from(
    new Set(updateRows.map((row) => row.regulation).filter(Boolean))
  );

  const { data: regulationsData, error: regulationsError } = regulationIds.length > 0
    ? await supabase
        .from('regulations')
        .select('id, name')
        .in('id', regulationIds)
    : { data: [] as RegulationRow[], error: null };

  if (regulationsError) {
    console.error('Regulations fetch error:', regulationsError);
    return NextResponse.json([], { status: 500 });
  }

  const { data: profilesData, error: profilesError } = regulationIds.length > 0
    ? await supabase
        .from('regulation_search_profiles')
        .select('regulation_id, primary_sources')
        .in('regulation_id', regulationIds)
    : { data: [] as RegulationProfileRow[], error: null };

  if (profilesError) {
    console.error('Regulation profiles fetch error:', profilesError);
    return NextResponse.json([], { status: 500 });
  }

  const regulationNameMap = new Map<string, string>(
    (regulationsData ?? []).map((row) => [String(row.id), row.name])
  );

  const primarySourceMap = new Map<string, string | null>();
  for (const profile of profilesData ?? []) {
    const key = String(profile.regulation_id);
    if (primarySourceMap.has(key)) continue;
    primarySourceMap.set(
      key,
      Array.isArray(profile.primary_sources) && profile.primary_sources.length > 0
        ? profile.primary_sources[0]
        : null
    );
  }

  // Collect all IDs needed to fetch related article details
  const allRelatedIds: number[] = updateRows
    .flatMap((row) => row.related_article_ids ?? []);

  // Fetch article titles/URLs for all collected IDs
  const { data: articlesData, error: articlesError } = allRelatedIds.length > 0
      ? await supabase
        .from('raw_articles')
        .select('id, url, title, published_at, source')
        .in('id', allRelatedIds)
    : { data: [] as Article[], error: null };

  if (articlesError) {
    console.error('Articles fetch error:', articlesError);
    return NextResponse.json([], { status: 500 });
  }

  // Create a Map for quick lookup of article details by ID
  const articlesMap = new Map<number, Article>(
    articlesData?.map((a: Article) => [a.id, a]) ?? []
  );

  // Combine updates with their full related article objects
  const updates = updateRows.map((row) => {
    const focusedSummary = toSingleFocusedSummary(row.summary_text);
    const related_articles: ArticleResponse[] = (row.related_article_ids ?? [])
      .map((id) => articlesMap.get(id))
      .filter((a): a is Article => Boolean(a))
      .map((article) => {
        const sourceDomain = extractHostname(article.source) ?? extractHostname(article.url);
        return {
          ...article,
          source_domain: sourceDomain,
          is_trusted: isTrustedDomain(sourceDomain)
        };
      })
      .sort((a, b) => {
        if (a.is_trusted !== b.is_trusted) {
          return a.is_trusted ? -1 : 1;
        }

        const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
        const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
        return dateB - dateA;
      });

    return {
      id: row.id,
      regulation: row.regulation,
      regulation_name: regulationNameMap.get(String(row.regulation)) ?? String(row.regulation),
      deduced_title: deriveTitleFromSummary(focusedSummary, row.deduced_title),
      summary_text: focusedSummary,
      impact_level: row.impact_level?.toLowerCase() as 'high' | 'medium' | 'low' | undefined,
      primary_source_url: primarySourceMap.get(String(row.regulation)) ?? null,
      related_articles,
      deduced_published_date: pickPublishedDateAlignedWithSummary(
        related_articles,
        focusedSummary,
        row.deduced_published_date
      ),
      created_at: row.created_at,
      anchor: row.anchor ?? null
    };
  });

  return NextResponse.json(updates);
}
