export type ArticleLike = {
  title?: string | null;
  snippet?: string | null;
  content?: string | null;
  source?: string | null;
  source_domain?: string | null;
  domain?: string | null;
  url?: string | null;
  published_at?: string | null;
  published_date?: string | null;
};

export type RelevanceConfig = {
  regulationName?: string;
  searchQueries?: string[];
  triggerWords?: string[];
  excludedTerms?: string[];
};

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were', 'has', 'have',
  'been', 'into', 'over', 'under', 'about', 'after', 'before', 'between', 'within', 'without',
  'list', 'update', 'updates', 'regulation', 'regulatory', 'guidance', 'news', 'article', 'report',
  'rule', 'rules', 'new', 'latest', 'echa', 'european', 'commission'
]);

const REGULATORY_SIGNAL_PATTERN =
  /\b(regulation|regulatory|directive|framework|guidance|consultation|amendment|restriction|compliance|ban|prohibit|requirement|enforcement|agency|commission|authority|gazette|federal register|osha|epa|echa|reach|svhc|annex|clp|ghs|chemical|substance|hazard|classification|labeling|labelling|safety data sheet|sds)\b/i;

const GENERIC_NEWS_INDEX_PATTERN =
  /\b(breaking news|u\.?s\.? news|us news|world news|latest news|live updates|today's news|new york times)\b/i;

const EXCLUDED_ARTICLE_URLS = new Set([
  'https://www.wttlonline.com/stories/eu-updates-dual-use-export-control-list,14264',
  'https://pharos.habitablefuture.org/hazard-lists/362',
  'https://www.packagingdigest.com/flexible-packaging/toxic-heavy-metals-found-in-14-percent-of-retail-packaging',
  'https://www.npr.org/2022/01/05/1070212871/usda-bioengineered-food-label-gmo'
]);

const MALAYSIA_OSHA_SOURCE = 'dosh.gov.my';

function normalizeUrlForExclusion(url: string | null | undefined): string {
  return (url ?? '').trim().toLowerCase().replace(/\/+$/, '');
}

export function isExcludedArticleUrl(url: string | null | undefined): boolean {
  return EXCLUDED_ARTICLE_URLS.has(normalizeUrlForExclusion(url));
}

export function isExcludedArticle(article: ArticleLike): boolean {
  if (isExcludedArticleUrl(article.url)) {
    return true;
  }

  const blob = getTitleBlob(article);
  return blob.includes('declaration of compliance') && blob.includes('roechling.com');
}

export function isMalaysiaOshaRegulationName(regulationName: string | null | undefined): boolean {
  const normalized = (regulationName ?? '').trim().toLowerCase();
  return normalized === 'osha' || normalized.includes('occupational safety and health');
}

export function isMalaysiaOshaConfig(config: RelevanceConfig): boolean {
  if (isMalaysiaOshaRegulationName(config.regulationName)) {
    return true;
  }

  return normalizeTerms(config.searchQueries).some(
    term => term === 'osha' || term.includes('occupational safety and health')
  );
}

export function isDoshMalaysiaArticle(article: ArticleLike): boolean {
  return getArticleSearchBlob(article).includes(MALAYSIA_OSHA_SOURCE);
}

export function normalizeTerms(terms: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (terms ?? [])
        .map(term => term.trim().toLowerCase())
        .filter(Boolean)
        .filter(term => term.length >= 3)
    )
  );
}

function deriveTriggerWordsFromQueries(searchQueries: string[]): string[] {
  const derived = new Set<string>();

  for (const query of searchQueries) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) continue;

    derived.add(normalized);

    const tokens = normalized
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .map(token => token.trim())
      .filter(token => token.length >= 4 && !STOP_WORDS.has(token));

    for (const token of tokens) {
      derived.add(token);
    }
  }

  return Array.from(derived);
}

export function getArticleSearchBlob(article: ArticleLike): string {
  return [
    article.title,
    article.snippet,
    article.content,
    article.source,
    article.source_domain,
    article.domain,
    article.url
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getTitleBlob(article: ArticleLike): string {
  return [
    article.title,
    article.snippet,
    article.source,
    article.source_domain,
    article.domain,
    article.url
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function buildRelevantTerms(config: RelevanceConfig) {
  const searchQueries = normalizeTerms(config.searchQueries);
  const triggerWords = normalizeTerms(config.triggerWords);
  const excludedTerms = normalizeTerms(config.excludedTerms);
  const effectiveTriggers = triggerWords.length > 0 ? triggerWords : deriveTriggerWordsFromQueries(searchQueries);

  return {
    searchQueries,
    triggerWords: effectiveTriggers,
    excludedTerms
  };
}

export function isGenericNewsIndexArticle(article: ArticleLike): boolean {
  const titleBlob = getTitleBlob(article);
  return GENERIC_NEWS_INDEX_PATTERN.test(titleBlob) && !REGULATORY_SIGNAL_PATTERN.test(titleBlob);
}

export function isRelevantArticle(article: ArticleLike, config: RelevanceConfig): boolean {
  if (isExcludedArticle(article)) {
    return false;
  }

  if (isGenericNewsIndexArticle(article)) {
    return false;
  }

  const blob = getArticleSearchBlob(article);
  const { searchQueries, triggerWords, excludedTerms } = buildRelevantTerms(config);
  const queryText = searchQueries.join(' ');
  const wantsCandidateList = queryText.includes('candidate list') || triggerWords.some(term => term.includes('candidate list') || term.includes('svhc'));

  if (isMalaysiaOshaConfig(config) && !blob.includes(MALAYSIA_OSHA_SOURCE)) {
    return false;
  }

  if (excludedTerms.some(term => blob.includes(term))) {
    return false;
  }

  if (wantsCandidateList) {
    return blob.includes('candidate list') || blob.includes('svhc');
  }

  const positiveTerms = [...triggerWords, ...searchQueries];
  if (positiveTerms.length === 0) {
    return REGULATORY_SIGNAL_PATTERN.test(blob);
  }

  const exactMatches = positiveTerms.filter(term => blob.includes(term));
  if (exactMatches.length > 0) {
    return true;
  }

  const tokenHits = new Set(
    positiveTerms
      .flatMap(term => term.split(/\s+/))
      .map(token => token.trim())
      .filter(token => token.length >= 4 && !STOP_WORDS.has(token))
      .filter(token => blob.includes(token))
  );

  return tokenHits.size >= 2 && REGULATORY_SIGNAL_PATTERN.test(blob);
}

export function scoreArticleRelevance(article: ArticleLike, config: RelevanceConfig): number {
  if (isExcludedArticle(article)) {
    return -1000;
  }

  if (isGenericNewsIndexArticle(article)) {
    return -1000;
  }

  const blob = getArticleSearchBlob(article);
  const { searchQueries, triggerWords, excludedTerms } = buildRelevantTerms(config);
  const queryText = searchQueries.join(' ');
  const wantsCandidateList = queryText.includes('candidate list') || triggerWords.some(term => term.includes('candidate list') || term.includes('svhc'));
  let score = 0;

  if (isMalaysiaOshaConfig(config)) {
    if (!blob.includes(MALAYSIA_OSHA_SOURCE)) return -1000;
    score += 50;
  }

  if (excludedTerms.some(term => blob.includes(term))) {
    return -1000;
  }

  if (wantsCandidateList) {
    if (blob.includes('candidate list')) score += 50;
    if (blob.includes('svhc')) score += 20;
    if (blob.includes('annex xvii')) score -= 10;
    return score;
  }

  for (const term of searchQueries) {
    if (blob.includes(term)) score += 6;
  }

  for (const term of triggerWords) {
    if (blob.includes(term)) score += 4;
  }

  if (searchQueries.some(term => term.includes('candidate list')) && blob.includes('candidate list')) {
    score += 12;
  }

  if (searchQueries.some(term => term.includes('annex xvii')) && blob.includes('annex xvii')) {
    score += 12;
  }

  if (REGULATORY_SIGNAL_PATTERN.test(blob)) score += 3;
  if (blob.includes('svhc')) score += 2;
  if (blob.includes('echa')) score += 1;

  return score;
}
