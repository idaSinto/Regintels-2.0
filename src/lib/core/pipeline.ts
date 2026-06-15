// External Libraries
import dayjs from 'dayjs';
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { createHash } from 'node:crypto';

// Library/Module Initialization
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// Internal Modules
import { buildSynthesisPrompt } from "@/lib/core/processors";
import { supabase } from './database';
import { askOpenAI } from './openai';
import type { ArticleSummary } from '@/lib/core/semantic';
import { roughlySameUpdate, semanticClusterSummaries } from '@/lib/core/semantic';
import { tavilyExtract, tavilySearch, TavilyArticle as TavilyArticleCore } from './tavily';

// --- Type Definitions ---
export type TavilyArticle = TavilyArticleCore & {
  id?: number;
  published_at?: string;
};

export type RegConfig = {
  id: string;
  searchQueries: string[];
  primarySourceUrl?: string;
  primarySources?: string[];
  secondarySources?: string[];
  allowedDomains?: string[];
  triggerWords?: string[];
  maxArticles?: number;
};

type sourceType = 'PRIMARY' | 'SECONDARY' | 'UNKNOWN';

function classifySource(
  url: string | null | undefined,
  primarySources: string[],
  secondarySources: string[]
): { sourceType: sourceType; confidence: number } {
  if (!url) return { sourceType: 'UNKNOWN', confidence: 30};

  const hostname = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./,'').toLowerCase();
    } catch {
      return null;
    }
  })();
  if (!hostname) return { sourceType: 'UNKNOWN', confidence: 30 };

  const isPrimary = primarySources.some(d => {
    const norm = d.toLowerCase().replace(/^www\./,'');
    return hostname === norm || hostname.endsWith(`.${norm}`);
  });
  if (isPrimary) { return { sourceType: 'PRIMARY', confidence: 100 }; }

  const isSecondary = secondarySources.some(d => {
    const norm = d.toLowerCase().replace(/^www\./, '');
    return hostname === norm || hostname?.endsWith(`.${norm}`);
  })
  if (isSecondary) { return { sourceType: 'SECONDARY', confidence: 80 }; }

  return { sourceType: 'UNKNOWN', confidence: 30 };
}

export type CandidateUpdate = {
  article_id?: number | null;
  explicit_addition_claim?: boolean;
  impact_level?: 'high' | 'medium' | 'low' | 'none';
  evidence_summary?: string;
  article_published_date?: string | null;
  claims?: any[];
  change_scope?: string;
  [key: string]: any;
};

type ImpactKeyword = {
  keyword: string;
  level: 'high' | 'medium' | 'low';
};

type ExistingLatestUpdate = {
  id: number;
  anchor: string;
  summary_text: string | null;
  deduced_published_date: string | null;
  related_article_ids: number[] | null;
};

type ExistingRawArticle = {
  id: number;
  published_at: string | null;
  title: string | null;
  snippet: string | null;
  content: string | null;
  is_processed: boolean | null;
};

function toIsoFromYmd(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return sanitizePublishedDate(new Date(Date.UTC(year, month - 1, day)).toISOString());
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

function extractExplicitDateFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const normalized = text.replace(/\s+/g, ' ');

  // Publication-style labels first (most reliable for article publish date).
  const pubNumeric = normalized.match(/\b(?:publication|published|posted)\b\s*:?\s*([0-3]?\d)[./-]([01]?\d)[./-](20\d{2})\b/i);
  if (pubNumeric) {
    const day = Number(pubNumeric[1]);
    const month = Number(pubNumeric[2]);
    const year = Number(pubNumeric[3]);
    const iso = toIsoFromYmd(year, month, day);
    if (iso) return iso;
  }

  const pubDmy = normalized.match(/\b(?:publication date|published|posted)\b\s*:?\s*([0-3]?\d)\s+([A-Za-z]{3,9})\s+(20\d{2})\b/i);
  if (pubDmy) {
    const day = Number(pubDmy[1]);
    const month = monthNameToNumber(pubDmy[2]);
    const year = Number(pubDmy[3]);
    if (month) return toIsoFromYmd(year, month, day);
  }

  const pubMdy = normalized.match(/\b(?:publication date|published|posted)\b\s*:?\s*([A-Za-z]{3,9})\s+([0-3]?\d),\s*(20\d{2})\b/i);
  if (pubMdy) {
    const month = monthNameToNumber(pubMdy[1]);
    const day = Number(pubMdy[2]);
    const year = Number(pubMdy[3]);
    if (month) return toIsoFromYmd(year, month, day);
  }

  // e.g. 31 Mar 2026 / 31 March 2026
  const dmy = normalized.match(/\b([0-3]?\d)\s+([A-Za-z]{3,9})\s+(20\d{2})\b/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = monthNameToNumber(dmy[2]);
    const year = Number(dmy[3]);
    if (month) return toIsoFromYmd(year, month, day);
  }

  // e.g. March 31, 2026
  const mdy = normalized.match(/\b([A-Za-z]{3,9})\s+([0-3]?\d),\s*(20\d{2})\b/);
  if (mdy) {
    const month = monthNameToNumber(mdy[1]);
    const day = Number(mdy[2]);
    const year = Number(mdy[3]);
    if (month) return toIsoFromYmd(year, month, day);
  }

  return null;
}

// function extractDateFromUrl(url: string | null | undefined): string | null {
//   if (!url) return null;
//   const match = url.match(/(?:^|\/)(20\d{2})[\/-](0[1-9]|1[0-2])(?:[\/-](0[1-9]|[12]\d|3[01]))?(?:\/|$)/);
//   if (!match) return null;

//   const year = match[1];
//   const month = match[2];
//   const day = match[3] ?? '01';
//   return sanitizePublishedDate(`${year}-${month}-${day}T00:00:00Z`);
// }

function extractDateFromHtmlContent(content: string | null | undefined): string | null {
  if (!content) return null;

  const metaPatterns = [
    /<meta[^>]*(?:name|property)=["']article:published_time["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*(?:name|property)=["']publishdate["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*(?:name|property)=["']pubdate["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*(?:name|property)=["']date["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*(?:name|property)=["']dc\.date["'][^>]*content=["']([^"']+)["']/i
  ];

  for (const pattern of metaPatterns) {
    const match = content.match(pattern);
    const sanitized = sanitizePublishedDate(match?.[1] ?? null);
    if (sanitized) return sanitized;
  }

  const jsonLdPatterns = [
    /"datePublished"\s*:\s*"([^"]+)"/i,
    /"dateCreated"\s*:\s*"([^"]+)"/i
  ];

  for (const pattern of jsonLdPatterns) {
    const match = content.match(pattern);
    const sanitized = sanitizePublishedDate(match?.[1] ?? null);
    if (sanitized) return sanitized;
  }

  const timeMatch = content.match(/<time[^>]*datetime=["']([^"']+)["'][^>]*>/i);
  return sanitizePublishedDate(timeMatch?.[1] ?? null);
}

// ---------------------------------------------------------
// Scan and store articles
// ---------------------------------------------------------
export async function scanAndStoreArticles(
  config: { id: string; searchQueries: string[]; primarySources?: string[]; secondarySources?: string[] },
  maxPerQuery = 12
): Promise<number[]> {

  const primarySources = config.primarySources ?? [];
  const secondarySources = config.secondarySources ?? [];

  console.log(`Scanning articles for config: ${config.id}`);

  const aggregatedResults: TavilyArticle[] = [];
  const now = dayjs();
  const oneYearAgo = now.subtract(1, 'year').startOf('day');

  for (const query of config.searchQueries) {
    try {
      const results = await tavilySearch(query, {
        size: maxPerQuery,
        include_raw_content: true,
        max_results: maxPerQuery,
        include_answer: false
      });
      const fallbackExtractionCache = new Map<string, { publishedDate: string | null; content: string | null }>();
      let fallbackExtractionAttempts = 0;
      const maxFallbackExtractionAttempts = Math.min(6, maxPerQuery);

      for (const r of results || []) {
        const candidate: TavilyArticle = { ...r };

        // Prioritize explicit structured dates; avoid free-text chrono parsing (too noisy).
        let publishedDate = sanitizePublishedDate(candidate.published_date ?? null);
        if (!publishedDate) {
          publishedDate = extractDateFromHtmlContent(candidate.content);
        }
        if (!publishedDate) {
          publishedDate = extractExplicitDateFromText([candidate.title, candidate.snippet, candidate.content].filter(Boolean).join(' '));
        }
        // Intentionally avoid URL-date fallback (often picks non-publication dates).

        // Fallback extraction for results that still have no reliable published date.
        if (!publishedDate && candidate.url && fallbackExtractionAttempts < maxFallbackExtractionAttempts) {
          let extracted = fallbackExtractionCache.get(candidate.url);

          if (!extracted) {
            fallbackExtractionAttempts += 1;
            try {
              const extraction = await tavilyExtract(candidate.url);
              const extractedText = [extraction.rawContent, extraction.markdownContent]
                .filter(Boolean)
                .join('\n');
              const extractedPublished =
                extractDateFromHtmlContent(extractedText)
                ?? extractExplicitDateFromText(extractedText);

              extracted = {
                publishedDate: extractedPublished,
                content: extractedText || null
              };
              fallbackExtractionCache.set(candidate.url, extracted);
            } catch (extractErr) {
              console.warn('Tavily extract fallback failed:', candidate.url, extractErr);
              fallbackExtractionCache.set(candidate.url, { publishedDate: null, content: null });
              extracted = { publishedDate: null, content: null };
            }
          }

          if (extracted?.publishedDate) {
            publishedDate = extracted.publishedDate;
          }
          if (!candidate.content && extracted?.content) {
            candidate.content = extracted.content;
          }
        }

        // Step 3: Keep only articles from the last year and reject future dates.
        const sanitizedPublished = sanitizePublishedDate(publishedDate ?? null);
        if (sanitizedPublished) {
          const parsedPublished = dayjs(sanitizedPublished);
          if (parsedPublished.isSameOrAfter(oneYearAgo) && parsedPublished.isSameOrBefore(now)) {
            aggregatedResults.push({ ...candidate, published_at: sanitizedPublished });
          }
        }
      }

      console.log(
        `Found ${aggregatedResults.length} recent articles for query "${query}" (raw: ${results.length})`
      );
    } catch (err) {
      console.error('Tavily search error', query, err);
    }
  }

  // Sort articles by published date descending (newest first)
  aggregatedResults.sort((a, b) => {
    const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
    const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
    return dateB - dateA; // newest first
  });


  // Insert deduped articles into database
  const insertedIds: number[] = [];
  for (const art of aggregatedResults) {
    const { sourceType, confidence } = classifySource(art.url, primarySources, secondarySources);

    try {
      const { data: existing } = await supabase
        .from('raw_articles')
        .select('id, published_at, title, snippet, content, is_processed')
        .eq('url', art.url)
        .limit(1);

      const existingRow = (existing?.[0] ?? null) as ExistingRawArticle | null;

      if (!existingRow) {
        const { data, error } = await supabase
          .from('raw_articles')
          .insert({
            url: art.url,
            title: art.title ?? null,
            snippet: art.snippet ?? null,
            content: art.content ?? null,
            source: art.source ?? art.domain ?? null,
            regulation: config.id,
            is_processed: false,
            published_at: art.published_at ?? null,
            source_type: sourceType,
            confidence_score: confidence
          })
          .select('id')
          .single();

        if (error) console.error('Insert raw article error:', error);
        if (data?.id) {
          insertedIds.push(data.id);
          console.log(`Inserted raw article ID: ${data.id} [${sourceType}/${confidence}]`);
        }
        continue;
      }

      // Re-process same URL if the authority updated publish date/content/title/snippet.
      if (shouldReprocessExistingRawArticle(existingRow, art)) {
        const { error: updateExistingError } = await supabase
          .from('raw_articles')
          .update({
            title: art.title ?? existingRow.title,
            snippet: art.snippet ?? existingRow.snippet,
            content: art.content ?? existingRow.content,
            source: art.source ?? art.domain ?? null,
            published_at: art.published_at ?? existingRow.published_at,
            source_type: sourceType,
            confidence_score: confidence,
            is_processed: false
          })
          .eq('id', existingRow.id);

        if (updateExistingError) {
          console.error('Update existing raw article error:', updateExistingError);
          continue;
        }

        insertedIds.push(existingRow.id);
        console.log(`Queued updated raw article ID: ${existingRow.id} [${sourceType}/${confidence}]`);
      }
    } catch (err) {
      console.error('Insert article exception', art.url, err);
    }
  }

  return Array.from(new Set(insertedIds));
}

function parseModelJson(response: unknown): CandidateUpdate | null {
  if (response && typeof response === 'object') return response as CandidateUpdate;
  if (typeof response !== 'string') return null;

  let text = response.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) text = fenced[1].trim();

  try {
    return JSON.parse(text) as CandidateUpdate;
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as CandidateUpdate;
      } catch {
        return null;
      }
    }
    return null; 
  }
}

// ---------------------------------------------------------
// Synthesize articles using OpenAI 
// ---------------------------------------------------------
export async function synthesizeArticles(
  config: RegConfig,
  articles: TavilyArticle[],
  promptBuilder: (article: TavilyArticle, config: RegConfig) => string = buildSynthesisPrompt
): Promise<CandidateUpdate[]> {

  if (!articles || articles.length === 0) {
    console.log('No recent articles to summarize. Skipping OpenAI synthesis.');
    return [];
  }

  const results: CandidateUpdate[] = [];

  for (const article of articles) {
    const prompt = promptBuilder(article, config);

    try {
      const response = await askOpenAI([
        { role: 'system', content: 'You are an expert regulatory analyst.' },
        { role: 'user', content: prompt }
      ]);

      const parsed = parseModelJson(response);
      if (!parsed) {
        console.warn('OpenAI returned non-JSON response, skipping article:', article.url, 'Response:', response);
        continue;
      }

      parsed.article_id = article.id ?? null;
      // Prefer source article published date over model-inferred date.
      parsed.article_published_date = article.published_at ?? parsed.article_published_date ?? null;
      parsed.event_month = normalizeEventMonth(parsed.event_month, parsed.article_published_date);
      parsed.update_summary = normalizeGeneratedSummary(
        parsed.update_summary,
        parsed.event_month,
        parsed.article_published_date
      );
      results.push(parsed);

    } catch (err) {
      console.error('OpenAI article synthesis failed', article.url, err);
      results.push(buildFallbackCandidate(article));
    }
  }

  return results;
}

async function getImpactKeywords(): Promise<ImpactKeyword[]> {
  const { data, error } = await supabase
    .from("impact_keywords")
    .select("keyword, level");

  if (error || !data) return [];
  return data as ImpactKeyword[];
}


// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------
export async function inferImpactLevel(
  text: string
): Promise<'high' | 'medium' | 'low'> {

  text = text.toLowerCase();

  // fetch from DB
  const keywords = await getImpactKeywords();

  // if DB has values → use them
  if (keywords.length > 0) {

    // priority order: high → medium → low
    for (const level of ['high', 'medium', 'low'] as const) {
      if (
        keywords
          .filter(k => k.level === level)
          .some(k => text.includes(k.keyword.toLowerCase()))
      ) {
        return level;
      }
    }

    return 'low';
  }

  // fallback when database empty
  if (/ban|mandatory|require|prohibit|enforce/i.test(text)) return 'high';
  if (/amend|update|revise|consultation/i.test(text)) return 'medium';
  return 'low';
}


function buildAnchor(candidate: CandidateUpdate, regulationId: string) {
  const updateType = candidate.update_type ?? 'unspecified';
  const eventMonth = normalizeEventMonth(candidate.event_month, candidate.article_published_date);
  const changeScope = candidate.change_scope ?? 'unspecified';
  const clusterSuffix = candidate.anchor_suffix ? `::${candidate.anchor_suffix}` : '';

  return `${regulationId}::${updateType}::${eventMonth}::${changeScope}${clusterSuffix}`;
}

function buildSemanticGroupingKey(candidate: CandidateUpdate, regulationId: string) {
  const updateType = candidate.update_type ?? 'unspecified';
  return `${regulationId}::${updateType}`;
}

function normalizeSummaryForFingerprint(summary: string): string {
  return summary
    .replace(/^On\s+[A-Za-z]+\s+\d{4},\s*/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function ensureSentence(text: string): string {
  const trimmed = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function normalizeGeneratedSummary(
  summary: string | null | undefined,
  eventMonth: unknown,
  fallbackPublishedDate?: string | null
): string {
  const normalized = (summary ?? '').replace(/\s+/g, ' ').trim();
  const normalizedEventMonth = normalizeEventMonth(eventMonth, fallbackPublishedDate);
  const displayMonth = normalizedEventMonth !== 'unspecified'
    ? dayjs(`${normalizedEventMonth}-01`).format('MMMM YYYY')
    : null;

  if (!normalized) {
    return displayMonth
      ? `On ${displayMonth}, the authority announced a regulatory update.`
      : 'The authority announced a regulatory update.';
  }

  if (/^On\s+(?:an?\s+)?unspecified(?:\s+date)?\b/i.test(normalized)) {
    const remainder = normalized.replace(/^On\s+(?:an?\s+)?unspecified(?:\s+date)?\s*,?\s*/i, '');
    return displayMonth
      ? `On ${displayMonth}, ${ensureSentence(remainder)}`
      : ensureSentence(remainder);
  }

  if (/^On\s+[A-Za-z]+\s+\d{4}\b/i.test(normalized)) {
    return normalized.replace(/^On\s+([A-Za-z]+\s+\d{4})\s*\.\s*/i, 'On $1, ');
  }

  return displayMonth
    ? `On ${displayMonth}, ${ensureSentence(normalized)}`
    : ensureSentence(normalized);
}

function normalizeComparableText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function shouldReprocessExistingRawArticle(existing: ExistingRawArticle, incoming: TavilyArticle): boolean {
  const incomingPublished = incoming.published_at ? dayjs(incoming.published_at) : null;
  const existingPublished = existing.published_at ? dayjs(existing.published_at) : null;

  const incomingIsNewer = Boolean(
    incomingPublished?.isValid() &&
      (!existingPublished?.isValid() || incomingPublished.isAfter(existingPublished))
  );

  const titleChanged = normalizeComparableText(existing.title) !== normalizeComparableText(incoming.title ?? null);
  const snippetChanged = normalizeComparableText(existing.snippet) !== normalizeComparableText(incoming.snippet ?? null);
  const contentChanged = normalizeComparableText(existing.content) !== normalizeComparableText(incoming.content ?? null);

  return incomingIsNewer || titleChanged || snippetChanged || contentChanged;
}

function buildClusterSuffixFromSummary(summary: string): string {
  const normalized = normalizeSummaryForFingerprint(summary) || 'unspecified';
  return createHash('sha1').update(normalized).digest('hex').slice(0, 12);
}

function summariesLikelySameUpdate(a: string, b: string): boolean {
  const normalizedA = normalizeSummaryForFingerprint(a);
  const normalizedB = normalizeSummaryForFingerprint(b);

  if (!normalizedA || !normalizedB) return false;
  return normalizedA === normalizedB;
}

function parseCandidateDate(candidate: CandidateUpdate): dayjs.Dayjs | null {
  const candidates = [
    candidate.article_published_date,
    candidate.event_month && candidate.event_month !== 'unspecified'
      ? `${candidate.event_month}-01`
      : null
  ];

  for (const value of candidates) {
    if (!value) continue;
    const parsed = dayjs(value);
    if (parsed.isValid()) return parsed;
  }

  return null;
}

function parseMaybeDate(value: string | null | undefined): dayjs.Dayjs | null {
  if (!value) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
}

function isTemporallyCompatible(
  leftDate: dayjs.Dayjs | null,
  rightDate: dayjs.Dayjs | null,
  maxMonthGap = 18
): boolean {
  if (!leftDate || !rightDate) return true;
  return Math.abs(leftDate.diff(rightDate, 'month')) <= maxMonthGap;
}

function inferFallbackUpdateType(text: string): 'addition' | 'revision' | 'announcement' | 'guidance' {
  if (/guidance|faq|q&a|clarif/i.test(text)) return 'guidance';
  if (/amend|revise|revision|update|expand|reopen/i.test(text)) return 'revision';
  if (/add|addition|include|list|mandate|adopt|approve|restrict|prohibit|ban/i.test(text)) return 'addition';
  return 'announcement';
}

function inferFallbackChangeScope(text: string): string {
  const countMatch = text.match(/\b(one|two|three|four|\d+)\b/i);
  if (countMatch) {
    const raw = countMatch[1].toLowerCase();
    if (raw === 'one' || raw === '1') return 'count_1';
    if (raw === 'two' || raw === '2') return 'count_2';
    return 'count_3+';
  }

  if (/deadline|timeline|effective|within\s+\w+\s+(day|month|year)/i.test(text)) {
    return 'timeline';
  }

  if (/process|submission|register|registration|pre registration|pathway|procedure/i.test(text)) {
    return 'process';
  }

  return 'unspecified';

  // 
}

function buildFallbackCandidate(article: TavilyArticle): CandidateUpdate {
  const sourceText = [article.title, article.snippet, article.content].filter(Boolean).join(' ');
  const published = article.published_at ?? article.published_date ?? null;
  const eventMonth = published && dayjs(published).isValid()
    ? dayjs(published).format('YYYY-MM')
    : 'unspecified';
  const baseSummary = article.title ?? 'the authority announced a regulatory update';

  return {
    article_id: article.id ?? null,
    article_published_date: published,
    update_type: inferFallbackUpdateType(sourceText),
    event_month: eventMonth,
    change_scope: inferFallbackChangeScope(sourceText),
    update_summary: normalizeGeneratedSummary(baseSummary, eventMonth, published)
  };
}

function sanitizePublishedDate(dateStr: string | null): string | null {
  if (!dateStr) return null;

  const parsed = dayjs(dateStr);
  const now = dayjs();
  if (!parsed.isValid()) return null;

  // If parsed date is in the future, discard it
  if (parsed.isAfter(now)) return null;

  return parsed.toISOString();
}

function normalizeEventMonth(eventMonth: unknown, fallbackPublishedDate?: string | null): string {
  if (typeof eventMonth === 'string') {
    const trimmed = eventMonth.trim();
    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }

  // Fallback to the provided published date
  if (fallbackPublishedDate) {
    const parsed = dayjs(fallbackPublishedDate);
    if (parsed.isValid()) {
      return parsed.format('YYYY-MM');
    }
  }

  // Keep unknown values explicit instead of inventing a current month.
  return 'unspecified';
}


async function getCurrentLatestCandidate(regulationId: string, anchor: string) {
  const { data } = await supabase
    .from('verified_updates')
    .select(`
      id,
      deduced_published_date,
      related_article_ids
    `)
    .eq('regulation', regulationId)
    .eq('anchor', anchor)
    .eq('is_latest', true)
    .single();

  return data ?? null;
}

async function getLatestCandidatesByUpdateType(regulationId: string, updateType: string) {
  const { data } = await supabase
    .from('verified_updates')
    .select(`
      id,
      anchor,
      summary_text,
      deduced_published_date,
      related_article_ids
    `)
    .eq('regulation', regulationId)
    .eq('is_latest', true)
    .like('anchor', `${regulationId}::${updateType}::%`)
    .order('deduced_published_date', { ascending: false, nullsFirst: false });

  return (data ?? []) as ExistingLatestUpdate[];
}

async function findMatchingLatestAnchor(candidate: CandidateUpdate, regulationId: string) {
  const updateType = candidate.update_type ?? 'unspecified';
  const existingCandidates = await getLatestCandidatesByUpdateType(regulationId, updateType);
  const candidateDate = parseCandidateDate(candidate);

  for (const existing of existingCandidates) {
    if (!existing.summary_text || !candidate.update_summary) continue;
    const existingDate = parseMaybeDate(existing.deduced_published_date);

    // Prevent matching across clearly different timeline windows.
    if (!isTemporallyCompatible(candidateDate, existingDate)) continue;

    if (summariesLikelySameUpdate(candidate.update_summary, existing.summary_text)) {
      return existing;
    }

    const isSame = await roughlySameUpdate(candidate.update_summary, existing.summary_text);
    if (isSame) {
      return existing;
    }
  }

  return null;
}

async function expandSupportingArticleIds(
  finalCandidates: CandidateUpdate[],
  allCandidates: CandidateUpdate[]
) {
  const supportPool = allCandidates.filter(
    (candidate): candidate is CandidateUpdate & { article_id: number; update_summary: string } =>
      typeof candidate.article_id === 'number' && typeof candidate.update_summary === 'string'
  );

  for (const finalCandidate of finalCandidates) {
    if (!finalCandidate.update_summary || !finalCandidate.merged_article_ids?.length) continue;
    const finalDate = parseCandidateDate(finalCandidate);

    const expandedArticleIds = new Set(finalCandidate.merged_article_ids);

    for (const supportCandidate of supportPool) {
      if (expandedArticleIds.has(supportCandidate.article_id)) continue;
      if (
        finalCandidate.update_type &&
        supportCandidate.update_type &&
        finalCandidate.update_type !== supportCandidate.update_type
      ) {
        continue;
      }

      const supportDate = parseCandidateDate(supportCandidate);
      if (!isTemporallyCompatible(finalDate, supportDate)) continue;

      const isSame = await roughlySameUpdate(
        finalCandidate.update_summary,
        supportCandidate.update_summary
      );

      if (isSame) {
        expandedArticleIds.add(supportCandidate.article_id);
      }
    }

    finalCandidate.merged_article_ids = Array.from(expandedArticleIds);
  }
}

async function getLatestPublishedDateFromArticles(articleIds: number[]): Promise<string | null> {
  if (!articleIds.length) return null;

  const { data } = await supabase
    .from('raw_articles')
    .select('published_at')
    .in('id', articleIds);

  const latest = (data ?? [])
    .map((row) => row.published_at as string | null)
    .filter((date): date is string => Boolean(date))
    .map((date) => dayjs(date))
    .filter((date) => date.isValid() && !date.isAfter(dayjs()))
    .sort((a, b) => b.valueOf() - a.valueOf())[0];

  return latest?.toISOString() ?? null;
}


// ---------------------------------------------------------
// Run pipeline for a single regulation
// ---------------------------------------------------------
export async function runRegulationPipeline({
  config,
  synthesisPromptBuilder = buildSynthesisPrompt,
  maxSearchPerQuery = 5,
  minClusterSize = 2
}: {
  config: RegConfig;
  synthesisPromptBuilder?: (article: TavilyArticle, config: RegConfig) => string;
  maxSearchPerQuery?: number;
  minClusterSize?: number;
}) {
  console.log('Pipeline started for config:', config.id);

  // 1️⃣ Scan + store new articles
  const insertedIds = await scanAndStoreArticles(config, maxSearchPerQuery);
  if (!insertedIds.length) return { ok: true, consensus: false };

  // 2️⃣ Fetch newly inserted articles
  const { data: rawRows } = await supabase
    .from('raw_articles')
    .select('*, source_type, confidence_score')
    .in('id', insertedIds)
    .order('published_at', { ascending: false });

  const articles: TavilyArticle[] = rawRows ?? [];
  if (articles.length === 0) return { ok: true, consensus: false };

  // 3️⃣ Synthesize articles
  const candidates = await synthesizeArticles(config, articles, synthesisPromptBuilder);
  if (candidates.length === 0) return { ok: true, consensus: false };

  // 4️⃣ Deduplicate / merge with semantic consensus
  const candidateAnchors: Record<string, CandidateUpdate[]> = {};
  for (const c of candidates) {
    const groupKey = buildSemanticGroupingKey(c, config.id);
    if (!candidateAnchors[groupKey]) candidateAnchors[groupKey] = [];
    candidateAnchors[groupKey].push(c);
  }

  const finalCandidates: CandidateUpdate[] = [];

  for (const anchor in candidateAnchors) {
    const group = candidateAnchors[anchor];

    if (group.length === 1) {
      const single = group[0];
      if (!single.update_summary || !single.article_id) continue;
      single.anchor_suffix = buildClusterSuffixFromSummary(single.update_summary);
      single.merged_article_ids = [single.article_id];
      finalCandidates.push(single);
      continue;
    }

    const summariesForSemantic: ArticleSummary[] = group
      .filter(c => c.update_summary && c.article_id)
      .map(c => ({
        id: c.article_id!,
        summary: c.update_summary!,
        published_date: c.article_published_date ?? null
      }));

    const clusters = await semanticClusterSummaries(summariesForSemantic);
    const candidateByArticleId = new Map<number, CandidateUpdate>(
      group
        .filter((c): c is CandidateUpdate & { article_id: number } => typeof c.article_id === 'number')
        .map(c => [c.article_id, c])
    );

    for (const cluster of clusters) {
      if (cluster.articleIds.length >= minClusterSize) {
        const representative = candidateByArticleId.get(cluster.articleIds[0]);
        if (!representative) continue;

        finalCandidates.push({
          ...representative,
          anchor_suffix: buildClusterSuffixFromSummary(representative.update_summary ?? cluster.mergedSummary),
          update_summary: cluster.mergedSummary,
          article_published_date: cluster.latestDate,
          merged_article_ids: cluster.articleIds
        });
        continue;
      }

      const singleCandidate = candidateByArticleId.get(cluster.articleIds[0]);
      if (!singleCandidate || !singleCandidate.update_summary || !singleCandidate.article_id) {
        continue;
      }

      singleCandidate.anchor_suffix = buildClusterSuffixFromSummary(singleCandidate.update_summary);
      singleCandidate.merged_article_ids = [singleCandidate.article_id];
      finalCandidates.push(singleCandidate);
    }
  }

  // 5️⃣ Insert into verified_updates and latest_verified_updates

  await expandSupportingArticleIds(finalCandidates, candidates);

  for (const candidate of finalCandidates) {
    if (!candidate.update_summary || !candidate.merged_article_ids?.length) continue;

    const impact_level = await inferImpactLevel(candidate.update_summary);
    const matchedLatest = await findMatchingLatestAnchor(candidate, config.id);
    const anchor = matchedLatest?.anchor ?? buildAnchor(candidate, config.id);
    const currentLatest = await getCurrentLatestCandidate(config.id, anchor);
    const mergedArticleIds = Array.from(
      new Set([
        ...(currentLatest?.related_article_ids ?? []),
        ...candidate.merged_article_ids
      ])
    );

    const latestRelatedPublishedDate = await getLatestPublishedDateFromArticles(mergedArticleIds);

    // Card date should follow source article publish date, not scan date/event inference.
    const deducedPublishedDateRaw =
      latestRelatedPublishedDate
      ?? candidate.article_published_date
      ?? (
        candidate.event_month && candidate.event_month !== 'unspecified'
          ? `${candidate.event_month}-01`
          : null
      );

    // ✅ Sanitize to avoid future dates
    const deducedPublishedDate = sanitizePublishedDate(deducedPublishedDateRaw);

    const newDate = deducedPublishedDate ? dayjs(deducedPublishedDate) : dayjs();

    const currentDate = currentLatest?.deduced_published_date
      ? dayjs(currentLatest.deduced_published_date)
      : null;

    const isNewer = !currentDate || newDate.isAfter(currentDate);

    console.log({
      anchor,
      deducedPublishedDate,
      newDate: newDate.format(),
      currentDate: currentDate?.format(),
      isNewer
    });

    // If newer, demote old latest
    if (isNewer && currentLatest?.id) {
      await supabase
        .from('verified_updates')
        .update({ is_latest: false })
        .eq('id', currentLatest.id);
    }

    // After mergedArticleIds is assembled, before the verified_updates insert
    const { data: mergedArticlesRows } = await supabase
      .from('raw_articles')
      .select('confidence_score, source_type')
      .in('id', mergedArticleIds);

    const scores = (mergedArticlesRows ??  [])
      .map((r) => r.confidence_score as number)
      .filter((s): s is number => typeof s === 'number');

    // Use the highest confidence score among all supporting articles
    const maxConfidence = scores.length ? Math.max(...scores) : 30;
    const hasPrimarySource = (mergedArticlesRows ?? []).some(r => r.source_type === 'PRIMARY');

    // Insert new verified update
    const { error } = await supabase
      .from('verified_updates')
      .insert({
        regulation: config.id,
        anchor,
        deduced_title: candidate.update_summary.slice(0, 100),
        summary_text: candidate.update_summary,
        impact_level,
        related_article_ids: mergedArticleIds,
        deduced_published_date: deducedPublishedDate, // ← use this!
        is_latest: isNewer,
        confidence_score: maxConfidence,
        has_primary_source: hasPrimarySource,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Insert verified_update error:', error);
      continue;
    }

    if (!isNewer && currentLatest?.id && mergedArticleIds.length !== (currentLatest.related_article_ids?.length ?? 0)) {
      const { error: updateLatestError } = await supabase
        .from('verified_updates')
        .update({ related_article_ids: mergedArticleIds })
        .eq('id', currentLatest.id);

      if (updateLatestError) {
        console.error('Update latest verified_update article ids error:', updateLatestError);
      }
    }

    // Mark contributing raw articles as processed
    await supabase
      .from('raw_articles')
      .update({ is_processed: true })
      .in('id', mergedArticleIds);
  }

  console.log('Pipeline finished for config:', config.id);
  return { ok: true, consensus: true };

}

// ---------------------------------------------------------
// Run all regulations (21 regs) sequentially
// ---------------------------------------------------------
export async function runAllRegulationsPipeline() {
  const { data: regulations, error } = await supabase
    .from('regulations')
    .select(`
      id,
      name,
      regulation_search_profiles (
        authority,
        search_queries,
        primary_sources, 
        secondary_sources
      )
    `);

  if (error) {
    console.error('Error fetching regulations', error);
    return;
  }

  for (const regulation of regulations || []) {
    for (const profile of regulation.regulation_search_profiles) {
      await runRegulationPipeline({
        config: {
          id: regulation.id,
          searchQueries: profile.search_queries,
          primarySources: profile.primary_sources ?? [],
          secondarySources: profile.secondary_sources ?? []
        },
        synthesisPromptBuilder: buildSynthesisPrompt,
        maxSearchPerQuery: 20
      });
    }

    await supabase
      .from('regulations')
      .update({ last_scanned_at: new Date().toISOString() })
      .eq('id', regulation.id);
  }
}
