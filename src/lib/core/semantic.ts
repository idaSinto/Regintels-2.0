import dayjs from 'dayjs';
import { askOpenAI } from '@/lib/core/openai';

export type ArticleSummary = {
  id: number;
  summary: string;
  published_date: string | null;
};

export type SemanticResult = {
  mergedSummary: string;
  articleIds: number[];
  latestDate: string | null;
};

/**
 * Groups semantically similar articles together.
 * Returns the largest cluster (most supporting articles).
 */
export async function semanticGroupSummaries(
  summaries: ArticleSummary[]
): Promise<SemanticResult | null> {
  if (summaries.length < 2) return null;

  const groups: ArticleSummary[][] = [];

  for (const summary of summaries) {
    let addedToGroup = false;

    for (const group of groups) {
      // Check if summary matches any article already in the group
      const isSame = await Promise.all(
        group.map(g => roughlySameUpdate(g.summary, summary.summary))
      ).then(results => results.some(r => r));

      if (isSame) {
        group.push(summary);
        addedToGroup = true;
        break;
      }
    }

    if (!addedToGroup) {
      // Start a new group
      groups.push([summary]);
    }
  }

  // Pick the largest group (most supporting articles)
  const largestGroup = groups.sort((a, b) => b.length - a.length)[0];

  if (largestGroup.length < 2) return null;

  // Calculate latest date safely
  const now = dayjs();
  const latestDate = largestGroup
    .map(g => g.published_date)
    .filter(Boolean)
    .map(d => dayjs(d))
    .filter(d => !d.isAfter(now)) // discard future dates
    .sort((a, b) => b.valueOf() - a.valueOf())[0]
    ?.toISOString() ?? null;

  return {
    mergedSummary: largestGroup.map(g => g.summary).join(' '),
    articleIds: largestGroup.map(g => g.id),
    latestDate,
  };
}

/**
 * Uses OpenAI to determine if two summaries describe the same regulatory update.
 */
async function roughlySameUpdate(a: string, b: string): Promise<boolean> {
  const response = await askOpenAI([
    {
      role: 'system',
      content: 'You decide whether two summaries describe the same regulatory update.'
    },
    {
      role: 'user',
      content: `
Summary A:
${a}

Summary B:
${b}

Answer only YES or NO.
      `
    }
  ]);

  // Normalize response safely
  return response.replace(/\W/g, '').toUpperCase() === 'YES';
}
