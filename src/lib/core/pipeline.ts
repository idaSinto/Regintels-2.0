// External Libraries
import * as chrono from 'chrono-node';
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
import { tavilySearch, TavilyArticle as TavilyArticleCore } from './tavily';

// --- Type Definitions ---
export type TavilyArticle = TavilyArticleCore & {
  id?: number;
  published_at?: string;
};

export type RegConfig = {
  id: string;
  searchQueries: string[];
  primarySourceUrl?: string;
  allowedDomains?: string[];
  triggerWords?: string[];
  maxArticles?: number;
};

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

// ---------------------------------------------------------
// Scan and store articles
// ---------------------------------------------------------
export async function scanAndStoreArticles(
  config: { id: string; searchQueries: string[] },
  maxPerQuery = 12
): Promise<number[]> {
  console.log(`Scanning articles for config: ${config.id}`);

  const aggregatedResults: TavilyArticle[] = [];
  const oneYearAgo = dayjs().subtract(1, 'year').startOf('day');

  for (const query of config.searchQueries) {
    try {
      const results = await tavilySearch(query, {
        size: maxPerQuery,
        include_raw_content: true,
        max_results: maxPerQuery,
        include_answer: false
      });

      for (const r of results || []) {
        let publishedDate = r.published_date;

        // Step 1: Extract from article content / HTML
        if (!publishedDate && r.content) {
          const htmlMatch = r.content.match(
            /<meta[^>]*(?:name|property)=["'](?:article:published_time|date)["'][^>]*content=["']([^"']+)["']/i
          );
          if (htmlMatch) publishedDate = htmlMatch[1];
        }

        // Step 2: Fallback to parsing title/snippet text for dates (less noisy than full content)
        if (!publishedDate) {
          const dateProbeText = [r.title, r.snippet].filter(Boolean).join(' ');
          const parsed = chrono.parse(dateProbeText);
          if (parsed.length > 0) {
            publishedDate = parsed[0].date().toISOString();
          }
        }

        // Final check datetime is valid
        if (!publishedDate && r.content) {
          const htmlMatch = r.content.match(
            /<time[^>]*datetime=["']([^"']+)["'][^>]*>/i
          );
          if (htmlMatch) publishedDate = htmlMatch[1];
        }

        // Step 3: Only keep articles from the last year
        if (publishedDate && dayjs(publishedDate).isSameOrAfter(oneYearAgo)) {
          aggregatedResults.push({ ...r, published_at: publishedDate });
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
            published_at: art.published_at ?? null
          })
          .select('id')
          .single();

        if (error) console.error('Insert raw article error:', error);
        if (data?.id) {
          insertedIds.push(data.id);
          console.log('Inserted raw article ID:', data.id);
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
            is_processed: false
          })
          .eq('id', existingRow.id);

        if (updateExistingError) {
          console.error('Update existing raw article error:', updateExistingError);
          continue;
        }

        insertedIds.push(existingRow.id);
        console.log('Queued updated raw article ID:', existingRow.id);
      }
    } catch (err) {
      console.error('Insert article exception', art.url, err);
    }
  }

  return Array.from(new Set(insertedIds));
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

      let parsed: CandidateUpdate;
      try {
        parsed = typeof response === 'string' ? JSON.parse(response) : response;
      } catch {
        console.warn('OpenAI returned non-JSON response, skipping article:', article.url, 'Response:', response);
        continue;
      }

      parsed.article_id = article.id ?? null;
      // Prefer source article published date over model-inferred date.
      parsed.article_published_date = article.published_at ?? parsed.article_published_date ?? null;
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
  const displayMonth = eventMonth !== 'unspecified'
    ? dayjs(`${eventMonth}-01`).format('MMMM YYYY')
    : 'an unspecified date';

  return {
    article_id: article.id ?? null,
    article_published_date: published,
    update_type: inferFallbackUpdateType(sourceText),
    event_month: eventMonth,
    change_scope: inferFallbackChangeScope(sourceText),
    update_summary: `On ${displayMonth}, ${article.title ?? 'the authority announced a regulatory update'}.`
  };
}

function sanitizePublishedDate(dateStr: string | null): string | null {
  if (!dateStr) return null;

  const parsed = dayjs(dateStr);
  const now = dayjs();

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

  // Default fallback (should not happen in normal operation)
  return dayjs().format('YYYY-MM');
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
    .select('*')
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
        primary_sources
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
          searchQueries: profile.search_queries
        }
      });
    }

    await supabase
      .from('regulations')
      .update({ last_scanned_at: new Date().toISOString() })
      .eq('id', regulation.id);
  }
}
