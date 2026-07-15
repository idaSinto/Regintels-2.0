// External Libraries
import * as chrono from 'chrono-node';
import dayjs from 'dayjs';
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

// Library/Module Initialization
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// Internal Modules
import { buildSynthesisPrompt, inferRegulationFocus } from "@/lib/core/processors";
import { isMalaysiaOshaConfig, isRelevantArticle, scoreArticleRelevance } from '@/lib/core/articleRelevance';
import { supabase } from './database';
import { askOpenAI } from './openai';
import type { ArticleSummary } from '@/lib/core/semantic';
import { semanticGroupSummaries } from '@/lib/core/semantic';
import { tavilySearch, TavilyArticle as TavilyArticleCore } from './tavily';

// --- Type Definitions ---
export type TavilyArticle = TavilyArticleCore & {
  id?: number;
  published_at?: string;
};

export type RegConfig = {
  id: string;
  regulationName?: string;
  searchQueries: string[];
  primarySourceUrl?: string;
  primarySources?: string[];
  secondarySources?: string[];
  allowedDomains?: string[];
  triggerWords?: string[];
  excludedTerms?: string[];
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

function normalizeSourceDomains(sources: string[] | undefined): string[] {
  return Array.from(new Set((sources ?? []).map(s => s.trim()).filter(Boolean)));
}

function buildPrimarySources(config: RegConfig): string[] {
  const sources = normalizeSourceDomains(config.primarySources);

  if (isMalaysiaOshaConfig(config) && !sources.some(source => source.toLowerCase().includes('dosh.gov.my'))) {
    return ['dosh.gov.my', ...sources];
  }

  return sources;
}

// ---------------------------------------------------------
// Scan and store articles
// ---------------------------------------------------------
export async function scanAndStoreArticles(
  config: RegConfig,
  maxPerQuery = 3
): Promise<number[]> {
  console.log(`Scanning articles for config: ${config.id}`);

  const aggregatedResults: TavilyArticle[] = [];
  const oneYearAgo = dayjs().subtract(1, 'year').startOf('day');
  const primarySources = buildPrimarySources(config);
  const secondarySources = normalizeSourceDomains(config.secondarySources);
  const knownSources = Array.from(new Set([...primarySources, ...secondarySources]));
  const mainScopes = [
    { label: 'primary', includeDomains: primarySources, excludeDomains: [] as string[] },
    { label: 'secondary', includeDomains: secondarySources, excludeDomains: [] as string[] }
  ];
  const supportScopes = [
    { label: 'unknown', includeDomains: [] as string[], excludeDomains: knownSources }
  ];
  const seenUrls = new Set<string>();

  for (const query of config.searchQueries) {
    const hasMainScopes = mainScopes.some(scope => scope.includeDomains.length > 0);

    for (const scope of mainScopes) {
      if (aggregatedResults.length >= maxPerQuery) break;

      try {
        const results = await tavilySearch(query, {
          size: maxPerQuery,
          maxResults: maxPerQuery,
          includeAnswer: false,
          includeRawContent: 'text',
          searchDepth: 'advanced',
          topic: 'news',
          includeDomains: scope.includeDomains.length ? scope.includeDomains : undefined,
          excludeDomains: scope.excludeDomains.length ? scope.excludeDomains : undefined
        });

        for (const r of results || []) {
          if (seenUrls.has(r.url)) continue;

          let publishedDate = r.published_date;

          if (!publishedDate && r.content) {
            const htmlMatch = r.content.match(
              /<meta[^>]*(?:name|property)=["'](?:article:published_time|date)["'][^>]*content=["']([^"']+)["']/i
            );
            if (htmlMatch) publishedDate = htmlMatch[1];
          }

          if (!publishedDate && r.content) {
            const parsed = chrono.parse(r.content);
            if (parsed.length > 0) {
              publishedDate = parsed[0].date().toISOString();
            }
          }

          if (publishedDate && dayjs(publishedDate).isSameOrAfter(oneYearAgo)) {
            if (!isRelevantArticle({ ...r, published_at: publishedDate }, config)) {
              continue;
            }

            seenUrls.add(r.url);
            aggregatedResults.push({ ...r, published_at: publishedDate });
          }
        }

        console.log(
          `Found ${aggregatedResults.length} recent articles for query "${query}" [${scope.label}] (raw: ${results.length})`
        );
      } catch (err) {
        console.error('Tavily search error', query, scope.label, err);
      }
    }

    if (aggregatedResults.length >= maxPerQuery || hasMainScopes) {
      continue;
    }

    for (const scope of supportScopes) {
      if (aggregatedResults.length >= maxPerQuery) break;

      try {
        const supportMaxResults = Math.max(2, Math.min(3, maxPerQuery));
        const results = await tavilySearch(query, {
          size: supportMaxResults,
          maxResults: supportMaxResults,
          includeAnswer: false,
          includeRawContent: 'text',
          searchDepth: 'basic',
          topic: 'news',
          includeDomains: scope.includeDomains.length ? scope.includeDomains : undefined,
          excludeDomains: scope.excludeDomains.length ? scope.excludeDomains : undefined
        });

        for (const r of results || []) {
          if (seenUrls.has(r.url)) continue;

          let publishedDate = r.published_date;

          if (!publishedDate && r.content) {
            const htmlMatch = r.content.match(
              /<meta[^>]*(?:name|property)=["'](?:article:published_time|date)["'][^>]*content=["']([^"']+)["']/i
            );
            if (htmlMatch) publishedDate = htmlMatch[1];
          }

          if (!publishedDate && r.content) {
            const parsed = chrono.parse(r.content);
            if (parsed.length > 0) {
              publishedDate = parsed[0].date().toISOString();
            }
          }

          if (publishedDate && dayjs(publishedDate).isSameOrAfter(oneYearAgo)) {
            if (!isRelevantArticle({ ...r, published_at: publishedDate }, config)) {
              continue;
            }

            seenUrls.add(r.url);
            aggregatedResults.push({ ...r, published_at: publishedDate });
          }
        }

        console.log(
          `Found ${aggregatedResults.length} recent articles for query "${query}" [${scope.label}] (raw: ${results.length})`
        );
      } catch (err) {
        console.error('Tavily search error', query, scope.label, err);
      }
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
        .select('id')
        .eq('url', art.url)
        .limit(1);

      if (!existing || existing.length === 0) {
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
      }
    } catch (err) {
      console.error('Insert article exception', art.url, err);
    }
  }

  return insertedIds;
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
  const regulationFocus = inferRegulationFocus(config);

  for (const article of articles) {
    if (!isRelevantArticle(article, config)) {
      console.log('Skipping off-topic article before synthesis:', article.url);
      continue;
    }

    const prompt = promptBuilder(article, config);
    console.log('Synthesizing article:', {
      regulation: config.id,
      articleId: article.id ?? null,
      title: article.title ?? null,
      url: article.url
    });

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

      if (!parsed.update_summary) {
        console.warn('Parsed response missing update_summary, skipping article:', article.url, parsed);
        continue;
      }

      if (regulationFocus === 'svhc_candidate_list') {
        const summary = String(parsed.update_summary ?? '').toLowerCase();
        const mentionsCandidateList = summary.includes('candidate list') || summary.includes('svhc');
        const mentionsAnnexXvii = summary.includes('annex xvii');

        if (mentionsAnnexXvii && !mentionsCandidateList) {
          console.warn(
            'Skipping likely misclassified Annex XVII summary for SVHC candidate-list focus:',
            article.url,
            parsed.update_summary
          );
          continue;
        }
      }

      parsed.article_id = article.id ?? null;
      results.push(parsed);

    } catch (err) {
      console.error('OpenAI article synthesis failed', article.url, err);
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
  const eventMonth = candidate.article_published_date
    ? dayjs(candidate.article_published_date).format('YYYY-MM')
    : 'unspecified';
  const changeScope = candidate.change_scope ?? 'unspecified';

  return `${regulationId}::${updateType}::${eventMonth}::${changeScope}`;
}

function sanitizePublishedDate(dateStr: string | null): string | null {
  if (!dateStr) return null;

  const parsed = dayjs(dateStr);
  const now = dayjs();

  // If parsed date is in the future, discard it
  if (parsed.isAfter(now)) return null;

  return parsed.toISOString();
}


// ---------------------------------------------------------
// Run pipeline for a single regulation
// ---------------------------------------------------------
export async function runRegulationPipeline({
  config,
  synthesisPromptBuilder = buildSynthesisPrompt,
  maxSearchPerQuery = 3,
  skipScan = false
}: {
  config: RegConfig;
  synthesisPromptBuilder?: (article: TavilyArticle, config: RegConfig) => string;
  maxSearchPerQuery?: number;
  skipScan?: boolean;
}) {
  console.log('Pipeline started for config:', config.id);

  // 1️⃣ Scan + store new articles unless scan is disabled
  if (!skipScan) {
    await scanAndStoreArticles(config, maxSearchPerQuery);
  }

  // 2️⃣ Fetch all unprocessed articles for this regulation
  const { data: rawRows } = await supabase
    .from('raw_articles')
    .select('*')
    .eq('regulation', config.id)
    .eq('is_processed', false)
    .order('published_at', { ascending: false });

  const articles: TavilyArticle[] = (rawRows ?? [])
    .slice()
    .sort((a, b) => scoreArticleRelevance(b, config) - scoreArticleRelevance(a, config));
  console.log('Pipeline raw article count:', {
    regulation: config.id,
    fetched: rawRows?.length ?? 0,
    candidateOrder: articles.length
  });
  if (articles.length === 0) {
    console.log('No unprocessed raw articles found for regulation:', config.id);
    return { ok: true, consensus: false };
  }

  // 3️⃣ Synthesize articles
  const candidates = await synthesizeArticles(config, articles, synthesisPromptBuilder);
  console.log('Pipeline synthesized candidate count:', {
    regulation: config.id,
    count: candidates.length
  });
  if (candidates.length === 0) {
    console.log('No candidates survived synthesis for regulation:', config.id);
    return { ok: true, consensus: false };
  }

  // 4️⃣ Deduplicate / merge with semantic consensus
  const candidateAnchors: Record<string, CandidateUpdate[]> = {};
  for (const c of candidates) {
    const anchor = buildAnchor(c, config.id);
    if (!candidateAnchors[anchor]) candidateAnchors[anchor] = [];
    candidateAnchors[anchor].push(c);
  }

  const finalCandidates: CandidateUpdate[] = [];

  for (const anchor in candidateAnchors) {
    const group = candidateAnchors[anchor];

    if (group.length === 1) {
      const single = group[0];
      if (!single.update_summary || !single.article_id) continue;
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

    const consensus = await semanticGroupSummaries(summariesForSemantic);

    if (consensus) {
      finalCandidates.push({
        ...group[0],
        update_summary: consensus.mergedSummary,
        article_published_date: consensus.latestDate,
        merged_article_ids: consensus.articleIds
      });
    } else {
      group.forEach(c => {
        if (!c.update_summary || !c.article_id) return;
        c.merged_article_ids = [c.article_id];
        finalCandidates.push(c);
      });
    }
  }

    // 5️⃣ Insert into verified_updates and latest_verified_updates

  for (const candidate of finalCandidates) {
  if (!candidate.update_summary || !candidate.merged_article_ids?.length) continue;

  const impact_level = await inferImpactLevel(candidate.update_summary);
  const anchor = buildAnchor(candidate, config.id);

  // Use candidate.event_month if available, else fallback to article date
  const deducedPublishedDateRaw =
    candidate.event_month && candidate.event_month !== 'unspecified'
      ? `${candidate.event_month}-01`
      : candidate.article_published_date ?? null;

  // ✅ Sanitize to avoid future dates
  const deducedPublishedDate = sanitizePublishedDate(deducedPublishedDateRaw);

  const newDate = deducedPublishedDate ? dayjs(deducedPublishedDate) : dayjs();

  // Fetch current latest for this regulation + anchor
  const { data: currentLatest } = await supabase
    .from('verified_updates')
    .select('id, deduced_published_date')
    .eq('regulation', config.id)
    .eq('anchor', anchor)
    .eq('is_latest', true)
    .limit(1)
    .single();

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
      related_article_ids: candidate.merged_article_ids,
      deduced_published_date: deducedPublishedDate, // ← use this!
      is_latest: isNewer,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('Insert verified_update error:', error);
    continue;
  }

  // Mark contributing raw articles as processed
  await supabase
    .from('raw_articles')
    .update({ is_processed: true })
    .in('id', candidate.merged_article_ids);
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
    const profiles = Array.isArray(regulation.regulation_search_profiles)
      ? regulation.regulation_search_profiles
      : regulation.regulation_search_profiles
      ? [regulation.regulation_search_profiles]
      : [];

    for (const profile of profiles) {
      await runRegulationPipeline({
        config: {
          id: String(regulation.id),
          regulationName: regulation.name,
          searchQueries: profile.search_queries,
          primarySources: profile.primary_sources ?? [],
          secondarySources: profile.secondary_sources ?? []
        }
      });
    }

    await supabase
      .from('regulations')
      .update({ last_scanned_at: new Date().toISOString() })
      .eq('id', regulation.id);
  }
}
