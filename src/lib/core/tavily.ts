import { tavily } from '@tavily/core';

export type TavilyArticle = {
  url: string;
  title?: string | null;
  snippet?: string | null;
  source?: string | null;
  domain?: string | null;
  content?: string | null;
  published_date?: string | null;
};

export async function tavilySearch(
  query: string,
  opts: Record<string, any> = {}
): Promise<TavilyArticle[]> {
  const size = opts.size ?? opts.maxResults ?? 20;
  const res = await tavily().search(query, {
    maxResults: size,
    searchDepth: opts.searchDepth ?? 'advanced',
    topic: opts.topic ?? 'news',
    days: opts.days,
    includeDomains: opts.includeDomains,
    excludeDomains: opts.excludeDomains,
    includeAnswer: opts.includeAnswer ?? false,
    includeRawContent: opts.includeRawContent ?? 'text'
  }); 

  if (!res?.results || !Array.isArray(res.results)) return [];

  return res.results.map((r: any) => {
    let hostname: string | null = null;
    try {
      hostname = new URL(r.url).hostname;
    } catch {}

    return {
      url: r.url,
      title: r.title ?? null,
      snippet: r.content ?? r.rawContent ?? null,
      content: r.rawContent ?? r.content ?? null,
      published_date: r.publishedDate ?? r.published_date ?? null,
      source: hostname,
      domain: hostname,
    };
  });
}

export async function tavilyExtract(
  url: string
): Promise<{ rawContent: string; markdownContent: string }> {
  const res = await tavily().extract([url]);
  const item = res?.results?.[0] as any;

  return {
    rawContent: item?.rawContent ?? '',
    markdownContent: item?.markdownContent ?? item?.rawContent ?? ''
  };
}
