import { NextResponse } from 'next/server';
import { supabase } from '@/lib/core/database';

// ==========================================
// 1. TYPES & INTERFACES
// ==========================================
type Article = {
  id: number;
  url: string;
  title: string;
  snippet?: string | null;
  published_at?: string | null;
  source?: string | null;
};

type ArticleResponse = Article & {
  source_domain: string | null;
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

const PRIMARY_WINDOW_YEARS = 1;
const EXTENDED_WINDOW_YEARS = 2;
const FALLBACK_WINDOW_YEARS = 5;
const BLOCKED_SOURCE_DOMAINS = ['youtube.com', 'youtu.be', 'wikipedia.org', 'wikidata.org', 'wikimedia.org'];
const STRICT_PUBLICATION_DATE_DOMAINS = ['single-market-economy.ec.europa.eu'];

function yearsToDays(years: number): number {
  return years * 365;
}

function extractHostname(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return value.toLowerCase().replace(/^https?:\/\//, '').split('/')[0] || null;
  }
}

function normalizePathLocale(pathname: string): string {
  // Collapse locale prefixes such as /en-us/, /en-kg/, /en/ to reduce duplicate regional mirrors.
  return pathname.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/|$)/i, '');
}

function canonicalizeArticleUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = normalizePathLocale(parsed.pathname).replace(/\/+$/, '') || '/';
    return `${host}${path}`;
  } catch {
    const cleaned = url.trim().toLowerCase().replace(/^https?:\/\//, '');
    const [hostAndPath] = cleaned.split(/[?#]/);
    if (!hostAndPath) return null;
    const firstSlash = hostAndPath.indexOf('/');
    if (firstSlash < 0) return hostAndPath.replace(/\/+$/, '');
    const host = hostAndPath.slice(0, firstSlash);
    const rawPath = hostAndPath.slice(firstSlash) || '/';
    const path = normalizePathLocale(rawPath).replace(/\/+$/, '') || '/';
    return `${host}${path}`;
  }
}

function normalizeUrlForDedup(url: string | null | undefined): string | null {
  const canonical = canonicalizeArticleUrl(url);
  if (!canonical) return null;
  try {
    return decodeURIComponent(canonical).replace(/\/+$/, '') || '/';
  } catch {
    return canonical.replace(/\/+$/, '') || '/';
  }
}

function isBlockedSourceDomain(domain: string | null): boolean {
  if (!domain) return false;
  return BLOCKED_SOURCE_DOMAINS.some(
    (blocked) => domain === blocked || domain.endsWith(`.${blocked}`)
  );
}

function isDocumentLikeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const normalized = url.toLowerCase();
  return /\.(pdf|doc|docx)(?:$|[?#])/.test(normalized) || /\/doc(s|ument)?(?:\/|$)/.test(normalized);
}

function isStrictPublicationDateDomain(domain: string | null): boolean {
  if (!domain) return false;
  return STRICT_PUBLICATION_DATE_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

function inferPublicationDateOnlyFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const normalized = text.replace(/\s+/g, ' ');

  const pubDmy = normalized.match(/\bpublication date\b\s*:?\s*([0-3]?\d)\s+([A-Za-z]{3,9})\s+(20\d{2})\b/i);
  if (pubDmy) {
    const month = monthNameToNumber(pubDmy[2]);
    const day = Number(pubDmy[1]);
    const year = Number(pubDmy[3]);
    if (month && day >= 1 && day <= 31) {
      return sanitizeDate(new Date(Date.UTC(year, month - 1, day)).toISOString());
    }
  }

  const pubMdy = normalized.match(/\bpublication date\b\s*:?\s*([A-Za-z]{3,9})\s+([0-3]?\d),?\s+(20\d{2})\b/i);
  if (pubMdy) {
    const month = monthNameToNumber(pubMdy[1]);
    const day = Number(pubMdy[2]);
    const year = Number(pubMdy[3]);
    if (month && day >= 1 && day <= 31) {
      return sanitizeDate(new Date(Date.UTC(year, month - 1, day)).toISOString());
    }
  }

  return null;
}

function sanitizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getTime() > Date.now()) return null;
  return parsed.toISOString();
}

function monthNameToNumber(month: string): number | null {
  const map: Record<string, number> = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12
  };
  return map[month.toLowerCase()] ?? null;
}

function inferDateFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const normalized = text.replace(/\s+/g, ' ');
  const toIso = (year: number, month: number, day: number): string | null => {
    if (!month || day < 1 || day > 31) return null;
    return sanitizeDate(new Date(Date.UTC(year, month - 1, day)).toISOString());
  };

  // 1) Highest priority: explicit publication label.
  const pubDmy = normalized.match(/\bpublication date\b\s*:?\s*([0-3]?\d)\s+([A-Za-z]{3,9})\s+(20\d{2})\b/i);
  if (pubDmy) {
    const iso = toIso(Number(pubDmy[3]), monthNameToNumber(pubDmy[2]) ?? 0, Number(pubDmy[1]));
    if (iso) return iso;
  }
  const pubMdy = normalized.match(/\bpublication date\b\s*:?\s*([A-Za-z]{3,9})\s+([0-3]?\d),?\s+(20\d{2})\b/i);
  if (pubMdy) {
    const iso = toIso(Number(pubMdy[3]), monthNameToNumber(pubMdy[1]) ?? 0, Number(pubMdy[2]));
    if (iso) return iso;
  }

  // 1b) Publication label with numeric date formats, e.g. 10.06.2025 / 10-06-2025 / 10/06/2025
  const pubNumeric = normalized.match(/\b(?:publication|published|posted)\b\s*:?\s*([0-3]?\d)[./-]([01]?\d)[./-](20\d{2})\b/i);
  if (pubNumeric) {
    const day = Number(pubNumeric[1]);
    const month = Number(pubNumeric[2]);
    const year = Number(pubNumeric[3]);
    const iso = toIso(year, month, day);
    if (iso) return iso;
  }

  // 2) Rank date candidates by nearby context to prefer true publication dates.
  const scoreByContext = (index: number, matchText: string): number => {
    const start = Math.max(0, index - 80);
    const end = Math.min(normalized.length, index + matchText.length + 80);
    const context = normalized.slice(start, end).toLowerCase();

    let score = 0;
    if (/\b(publication|published|posted|news article|news)\b/.test(context)) score += 6;
    if (/\b(updated|last updated|effective|entry into force|appl(?:y|ies|ying)|from)\b/.test(context)) score -= 4;
    if (/\b(regulation|directive|annex|entry|article|clp|reach|eu)\b/.test(context)) score -= 2;
    // Slightly prefer earlier dates near headline/byline area.
    if (index < 500) score += 2;
    return score;
  };

  const candidates: Array<{ iso: string; index: number; score: number }> = [];

  const mdyRegex = /\b([A-Za-z]{3,9})\s+([0-3]?\d),?\s+(20\d{2})\b/g;
  for (const match of normalized.matchAll(mdyRegex)) {
    const iso = toIso(Number(match[3]), monthNameToNumber(match[1]) ?? 0, Number(match[2]));
    if (iso) {
      const idx = match.index ?? Number.MAX_SAFE_INTEGER;
      candidates.push({ iso, index: idx, score: scoreByContext(idx, match[0]) });
    }
  }

  const dmyRegex = /\b([0-3]?\d)\s+([A-Za-z]{3,9})\s+(20\d{2})\b/g;
  for (const match of normalized.matchAll(dmyRegex)) {
    const iso = toIso(Number(match[3]), monthNameToNumber(match[2]) ?? 0, Number(match[1]));
    if (iso) {
      const idx = match.index ?? Number.MAX_SAFE_INTEGER;
      candidates.push({ iso, index: idx, score: scoreByContext(idx, match[0]) });
    }
  }

  const numericRegex = /\b([0-3]?\d)[./-]([01]?\d)[./-](20\d{2})\b/g;
  for (const match of normalized.matchAll(numericRegex)) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const iso = toIso(year, month, day);
    if (iso) {
      const idx = match.index ?? Number.MAX_SAFE_INTEGER;
      candidates.push({ iso, index: idx, score: scoreByContext(idx, match[0]) });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });
  return candidates[0].iso;
}

function normalizeArticlePublishedAt(
  value: string | null | undefined,
  url: string | null | undefined,
  title?: string | null,
  snippet?: string | null
): string | null {
  void url;
  void title;
  void snippet;

  // Prefer stored published_at from source record when valid.
  if (!value) return null;
  const raw = String(value).trim();
  const datePart = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (datePart) {
    return `${datePart[1]}-${datePart[2]}-${datePart[3]}T00:00:00.000Z`;
  }
  const stored = sanitizeDate(raw);
  if (stored) return stored;
  return null;
}

function parseDateSafe(value: string | null | undefined): number {
  const sanitized = sanitizeDate(value);
  if (!sanitized) return 0;
  return new Date(sanitized).getTime();
}

function latestPublishedDate(articles: ArticleResponse[]): string | null {
  const validArticles = articles.filter((article) => Boolean(sanitizeDate(article.published_at)));
  if (validArticles.length === 0) return null;

  const latest = [...validArticles].sort(
    (a, b) => parseDateSafe(b.published_at) - parseDateSafe(a.published_at)
  )[0];

  return sanitizeDate(latest?.published_at) ?? null;
}

function ensureSentence(text: string): string {
  const trimmed = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function stripLeadingDatePrefix(text: string): string {
  return text
    .replace(/^On\s+(?:[A-Za-z]+\s+\d{4}|(?:an?\s+)?unspecified(?:\s+date)?)\s*,?\s*/i, '')
    .trim();
}

function monthYearFromDate(value: string | null | undefined): string | null {
  const sanitized = sanitizeDate(value);
  if (!sanitized) return null;
  const date = new Date(sanitized);
  const month = date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  return `${month} ${date.getUTCFullYear()}`;
}

function normalizeSummaryText(summary: string, fallbackDate: string | null): string {
  const normalized = (summary ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return normalized;

  if (/^On\s+(?:an?\s+)?unspecified(?:\s+date)?\b/i.test(normalized)) {
    const remainder = stripLeadingDatePrefix(normalized);
    const displayMonth = monthYearFromDate(fallbackDate);
    if (displayMonth) {
      return `On ${displayMonth}, ${ensureSentence(remainder)}`;
    }
    return ensureSentence(remainder);
  }

  if (/^On\s+[A-Za-z]+\s+\d{4}\b/i.test(normalized)) {
    return normalized.replace(/^On\s+([A-Za-z]+\s+\d{4})\s*\.\s*/i, 'On $1, ');
  }

  return normalized;
}

function toSingleFocusedSummary(summary: string): string {
  const normalized = (summary ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return normalized;

  // Keep first update sentence when legacy rows contain concatenated "On ... . On ..."
  const parts = normalized.split(/(?<=\.)\s+(?=On\s+[A-Z])/);
  return parts[0]?.trim() ?? normalized;
}

function deriveTitleFromSummary(summary: string, fallbackTitle: string): string {
  const focused = stripLeadingDatePrefix(toSingleFocusedSummary(summary));
  const fallback = stripLeadingDatePrefix((fallbackTitle ?? '').trim()) || fallbackTitle;
  if (!focused) return fallback;
  return focused.length > 120 ? `${focused.slice(0, 117)}...` : focused;
}

function extractSummaryMonth(summary: string): { year: number; month: number } | null {
  const match = summary.match(/\b(?:On|In)\s+([A-Za-z]+)\s+(\d{4})\b/i);
  if (!match) return null;

  const parsed = new Date(`${match[1]} 1, ${match[2]}`);
  if (Number.isNaN(parsed.getTime())) return null;

  return { year: parsed.getFullYear(), month: parsed.getMonth() };
}

function extractSummaryYear(summary: string): number | null {
  const monthMatch = extractSummaryMonth(summary);
  if (monthMatch) return monthMatch.year;

  const looseYear = summary.match(/\b(19|20)\d{2}\b/);
  if (!looseYear) return null;
  const parsedYear = Number(looseYear[0]);
  return Number.isFinite(parsedYear) ? parsedYear : null;
}

function normalizeSummaryForCardKey(summary: string): string {
  return stripLeadingDatePrefix(summary)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isRecentEnough(value: string | null, maxAgeDays: number): boolean {
  const safe = sanitizeDate(value);
  if (!safe) return false;
  const ageMs = Date.now() - new Date(safe).getTime();
  return ageMs <= maxAgeDays * 24 * 60 * 60 * 1000;
}

function pruneRelatedArticles(articles: ArticleResponse[], cardDate: string | null): ArticleResponse[] {
  const safeCardDate = sanitizeDate(cardDate);
  const refTs = safeCardDate ? new Date(safeCardDate).getTime() : Date.now();

  const dated = articles.filter((article) => Boolean(sanitizeDate(article.published_at)));
  const undated = articles.filter((article) => !sanitizeDate(article.published_at));

  const withinDays = (maxDays: number) => dated.filter((article) => {
    const safePublished = sanitizeDate(article.published_at);
    if (!safePublished) return false;
    const articleTs = new Date(safePublished).getTime();
    if (articleTs > refTs) return false;
    const ageDays = (refTs - articleTs) / (24 * 60 * 60 * 1000);
    return ageDays <= maxDays;
  });

  // Related articles must be recent enough to support the update card's published date
  // Prefer more recent article first, preferably within 1 year
  const within1Year = withinDays(yearsToDays(PRIMARY_WINDOW_YEARS));
  if (within1Year.length > 0) return within1Year;

  // If no recent articles, keep those within 2 years to support updated related articles
  const within2Years = withinDays(yearsToDays(EXTENDED_WINDOW_YEARS));
  if (within2Years.length > 0) return within2Years;

  // If no articles within 2 years, allow a few past years 
  const withinFewYears = withinDays(yearsToDays(FALLBACK_WINDOW_YEARS));
  if (withinFewYears.length > 0) return withinFewYears;

  // Keep undated relevant articles so card is still visible (UI will show "No date available").
  return undated;
}

function keepRelevantArticlesForTopic(
  articles: ArticleResponse[],
  summary: string,
  cardDate: string | null
): ArticleResponse[] {
  const normalizedSummary = normalizeSummaryForCardKey(summary);
  const summaryTokens = new Set(
    normalizedSummary
      .split(/\s+/)
      .filter((token) =>
        token.length >= 4
        && !['that', 'with', 'from', 'this', 'have', 'will', 'were', 'been', 'into', 'their', 'about'].includes(token)
      )
  );

  const recencyFiltered = pruneRelatedArticles(articles, cardDate);
  const sourceFiltered = recencyFiltered.filter((article) => {
    const sourceDomain = article.source_domain ?? extractHostname(article.url);
    if (isBlockedSourceDomain(sourceDomain)) return false;
    if (isDocumentLikeUrl(article.url)) return false;

    const articleText = `${article.title ?? ''} ${article.snippet ?? ''}`.toLowerCase();
    if (!articleText.trim()) return false;

    // If there are no usable summary keywords, keep the time-filtered article.
    if (summaryTokens.size === 0) return true;

    let overlap = 0;
    for (const token of summaryTokens) {
      if (articleText.includes(token)) overlap += 1;
      if (overlap >= 1) return true;
    }
    return false;
  });

  // If only one (or none) matched by strict topic keywords,
  // broaden to source-vetted recent supports for better coverage.
  if (sourceFiltered.length <= 1) {
    const broadened = recencyFiltered.filter((article) => {
      const sourceDomain = article.source_domain ?? extractHostname(article.url);
      if (isBlockedSourceDomain(sourceDomain)) return false;
      if (isDocumentLikeUrl(article.url)) return false;
      return true;
    });

    const dedupedBroadened = dedupeRelatedArticles(broadened).sort(
      (a, b) => parseDateSafe(b.published_at) - parseDateSafe(a.published_at)
    );
    return dedupedBroadened;
  }

  return sourceFiltered;
}

function shouldSkipCard(
  summary: string,
  deducedPublishedDate: string | null,
  relatedArticles: ArticleResponse[]
): boolean {
  if (!relatedArticles || relatedArticles.length === 0) return true;
  const hasValidCardDate = Boolean(sanitizeDate(deducedPublishedDate));

  const hasRecentSupport = relatedArticles.some((article) =>
    isRecentEnough(article.published_at ?? null, yearsToDays(PRIMARY_WINDOW_YEARS))
  );
  const hasExtendedSupport = relatedArticles.some((article) =>
    isRecentEnough(article.published_at ?? null, yearsToDays(EXTENDED_WINDOW_YEARS))
  );
  const hasFallbackSupport = relatedArticles.some((article) =>
    isRecentEnough(article.published_at ?? null, yearsToDays(FALLBACK_WINDOW_YEARS))
  );

  if (hasValidCardDate && !isRecentEnough(deducedPublishedDate, yearsToDays(PRIMARY_WINDOW_YEARS)) && !hasRecentSupport && !hasExtendedSupport && !hasFallbackSupport) {
    return true;
  }

  // Extra guardrail for stale legacy summaries (e.g. "On January 2015, ...").
  const summaryYear = extractSummaryYear(summary);
  if (summaryYear) {
    const currentYear = new Date().getUTCFullYear();
    if (summaryYear < currentYear - 2) return true;
  }

  return false;
}

function pickNewerDate(a: string | null, b: string | null): string | null {
  const safeA = sanitizeDate(a);
  const safeB = sanitizeDate(b);
  const tsA = parseDateSafe(safeA);
  const tsB = parseDateSafe(safeB);
  if (tsA === 0 && tsB === 0) return null;
  return tsB > tsA ? safeB : safeA;
}

function pickPublishedDateAlignedWithSummary(
  articles: ArticleResponse[],
  summary: string,
  fallback: string | null
): string | null {
  const safeFallback = sanitizeDate(fallback);
  const targetMonth = extractSummaryMonth(summary);
  if (!targetMonth) return latestPublishedDate(articles) ?? safeFallback;

  const monthMatched = articles
    .filter((article) => {
      const safePublished = sanitizeDate(article.published_at);
      if (!safePublished) return false;
      const d = new Date(safePublished);
      return !Number.isNaN(d.getTime())
        && d.getFullYear() === targetMonth.year
        && d.getMonth() === targetMonth.month;
    })
    .sort((a, b) => parseDateSafe(b.published_at) - parseDateSafe(a.published_at));

  if (monthMatched.length > 0) {
    return sanitizeDate(monthMatched[0].published_at) ?? safeFallback;
  }

  return latestPublishedDate(articles) ?? safeFallback;
}

function dedupeRelatedArticles(articles: ArticleResponse[]): ArticleResponse[] {
  const deduped = new Map<string, ArticleResponse>();

  for (const article of articles) {
    const canonical = normalizeUrlForDedup(article.url)
      ?? `${article.id}:${article.url}`;
    const existing = deduped.get(canonical);

    if (!existing) {
      deduped.set(canonical, article);
      continue;
    }

    const existingDate = parseDateSafe(existing.published_at);
    const incomingDate = parseDateSafe(article.published_at);

    if (incomingDate > existingDate) {
      deduped.set(canonical, article);
    }
  }

  return Array.from(deduped.values());
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

  const regulationNameMap = new Map<string, string>(
    (regulationsData ?? []).map((row) => [String(row.id), row.name])
  );

  // Collect all IDs needed to fetch related article details
  const allRelatedIds: number[] = updateRows
    .flatMap((row) => row.related_article_ids ?? []);

  // Fetch article titles/URLs for all collected IDs
  const { data: articlesData, error: articlesError } = allRelatedIds.length > 0
      ? await supabase
        .from('raw_articles')
        .select('id, url, title, snippet, published_at, source')
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
  const mappedUpdates = updateRows.map((row) => {
    const relatedArticlesRaw: ArticleResponse[] = (row.related_article_ids ?? [])
      .map((id) => articlesMap.get(id))
      .filter((a): a is Article => Boolean(a))
      .map((article) => {
        const sourceDomain = extractHostname(article.source) ?? extractHostname(article.url);
        return {
          ...article,
          published_at: normalizeArticlePublishedAt(
            article.published_at,
            article.url,
            article.title,
            article.snippet
          ),
          source_domain: sourceDomain
        };
      })
      .sort((a, b) => {
        const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
        const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
        return dateB - dateA;
      });

    const relatedArticlesDeduped = dedupeRelatedArticles(relatedArticlesRaw).sort((a, b) => {
      const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
      const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
      return dateB - dateA;
    });

    const alignedDate = pickPublishedDateAlignedWithSummary(
      relatedArticlesDeduped,
      row.summary_text,
      row.deduced_published_date
    );
    const focusedSummary = toSingleFocusedSummary(normalizeSummaryText(row.summary_text, alignedDate));
    const related_articles = keepRelevantArticlesForTopic(
      relatedArticlesDeduped,
      focusedSummary,
      alignedDate
    );
    const cardPublishedDate = latestPublishedDate(related_articles) ?? alignedDate;

    return {
      id: row.id,
      regulation: row.regulation,
      regulation_name: regulationNameMap.get(String(row.regulation)) ?? String(row.regulation),
      deduced_title: deriveTitleFromSummary(focusedSummary, row.deduced_title),
      summary_text: focusedSummary,
      impact_level: row.impact_level?.toLowerCase() as 'high' | 'medium' | 'low' | undefined,
      primary_source_url: null,
      related_articles,
      deduced_published_date: cardPublishedDate,
      created_at: row.created_at,
      anchor: row.anchor ?? null
    };
  });

  const filteredUpdates = mappedUpdates.filter((item) =>
    !shouldSkipCard(item.summary_text, item.deduced_published_date, item.related_articles)
  );

  // Keep one card per regulation + semantic summary (same content),
  // while merging related sources from duplicates into that single card.
  const dedupedByContent = new Map<string, (typeof filteredUpdates)[number]>();
  for (const item of filteredUpdates) {
    const summaryKey = normalizeSummaryForCardKey(item.summary_text);
    // Prefer anchor to preserve distinct update content; fallback to summary key.
    const dedupeKey = `${String(item.regulation)}::${item.anchor || summaryKey || item.id}`;
    const existing = dedupedByContent.get(dedupeKey);

    if (!existing) {
      dedupedByContent.set(dedupeKey, item);
      continue;
    }

    const itemDate = parseDateSafe(item.deduced_published_date);
    const existingDate = parseDateSafe(existing.deduced_published_date);
    const keepIncoming =
      itemDate > existingDate
      || (itemDate === existingDate && item.created_at > existing.created_at);

    const preferred = keepIncoming ? item : existing;
    const mergedRawRelated = dedupeRelatedArticles([
      ...(existing.related_articles ?? []),
      ...(item.related_articles ?? [])
    ]).sort((a, b) => {
      return parseDateSafe(b.published_at) - parseDateSafe(a.published_at);
    });

    const mergedDateBase = pickNewerDate(
      existing.deduced_published_date,
      item.deduced_published_date
    );
    const mergedRelated = keepRelevantArticlesForTopic(
      mergedRawRelated,
      preferred.summary_text,
      mergedDateBase
    );
    const mergedDate = latestPublishedDate(mergedRelated) ?? mergedDateBase;

    dedupedByContent.set(dedupeKey, {
      ...preferred,
      deduced_published_date: mergedDate,
      related_articles: mergedRelated
    });
  }

  const updates = Array.from(dedupedByContent.values()).sort((a, b) => {
    const dateDiff = parseDateSafe(b.deduced_published_date) - parseDateSafe(a.deduced_published_date);
    if (dateDiff !== 0) return dateDiff;
    return b.created_at.localeCompare(a.created_at);
  });

  // Final guardrail: only one topic card per regulation, and it must be article-supported.
  const onePerRegulation = new Map<string, (typeof updates)[number]>();
  for (const card of updates) {
    if (!card.related_articles || card.related_articles.length === 0) continue;

    const key = String(card.regulation);
    const existing = onePerRegulation.get(key);
    // Keep the first valid card in current sorted order (latest first).
    if (!existing) {
      onePerRegulation.set(key, card);
      continue;
    }

    // Merge supporting articles from all valid cards under the same regulation.
    const merged = dedupeRelatedArticles([
      ...(existing.related_articles ?? []),
      ...(card.related_articles ?? [])
    ]).sort((a, b) => {
      return parseDateSafe(b.published_at) - parseDateSafe(a.published_at);
    });

    const mergedDateBase = pickNewerDate(
      existing.deduced_published_date,
      card.deduced_published_date
    );

    const existingTs = parseDateSafe(existing.deduced_published_date);
    const incomingTs = parseDateSafe(card.deduced_published_date);
    const pickIncomingMeta =
      incomingTs > existingTs
      || (incomingTs === existingTs && card.created_at > existing.created_at);
    const latestMeta = pickIncomingMeta ? card : existing;

    const mergedRelated = keepRelevantArticlesForTopic(
      merged,
      latestMeta.summary_text,
      mergedDateBase
    );
    const mergedDate = latestPublishedDate(mergedRelated) ?? mergedDateBase;

    onePerRegulation.set(key, {
      ...latestMeta,
      deduced_published_date: mergedDate,
      related_articles: mergedRelated
    });
  }

  const finalUpdates = Array.from(onePerRegulation.values()).sort((a, b) => {
    const dateDiff = parseDateSafe(b.deduced_published_date) - parseDateSafe(a.deduced_published_date);
    if (dateDiff !== 0) return dateDiff;
    return b.created_at.localeCompare(a.created_at);
  });

  return NextResponse.json(finalUpdates);
}
