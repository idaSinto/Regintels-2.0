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

export type SemanticCluster = SemanticResult & {
  size: number;
};

function buildSemanticResult(group: ArticleSummary[]): SemanticCluster {
  const now = dayjs();
  const sortedByDate = [...group].sort((a, b) => {
    const dateA = a.published_date ? dayjs(a.published_date).valueOf() : 0;
    const dateB = b.published_date ? dayjs(b.published_date).valueOf() : 0;
    return dateB - dateA;
  });

  const latestDate = group
    .map(g => g.published_date)
    .filter(Boolean)
    .map(d => dayjs(d))
    .filter(d => !d.isAfter(now))
    .sort((a, b) => b.valueOf() - a.valueOf())[0]
    ?.toISOString() ?? null;

  return {
    // Keep one focused summary for the cluster (newest supporting article),
    // instead of concatenating one sentence per source.
    mergedSummary: sortedByDate[0]?.summary ?? group[0]?.summary ?? '',
    articleIds: group.map(g => g.id),
    latestDate,
    size: group.length,
  };
}

// PREVIOUS function semanticClusterSummaries() - Clusters summaries into groups of semantically similar updates.
// export async function semanticClusterSummaries(
//   summaries: ArticleSummary[]
// ): Promise<SemanticCluster[]> {
//   if (summaries.length === 0) return [];

//   const groups: ArticleSummary[][] = [];

//   for (const summary of summaries) {
//     let addedToGroup = false;

//     for (const group of groups) {
//       const isSame = await Promise.all(
//         group.map(g => roughlySameUpdate(g.summary, summary.summary))
//       ).then(results => results.some(r => r));

//       if (isSame) {
//         group.push(summary);
//         addedToGroup = true;
//         break;
//       }
//     }

//     if (!addedToGroup) {
//       groups.push([summary]);
//     }
//   }

//   return groups
//     .map(buildSemanticResult)
//     .sort((a, b) => b.size - a.size);
// }

export async function semanticClusterSummaries(
  summaries: ArticleSummary[]
): Promise<SemanticCluster[]> {
  if (summaries.length === 0) return [];
  const similarityCache = new Map<string, boolean>();
  const groups: ArticleSummary[][] = [];

  const compareWithCache = async (a: string, b: string): Promise<boolean> => {
    const left = a.trim();
    const right = b.trim();
    const key = left < right ? `${left}::${right}` : `${right}::${left}`;

    if (similarityCache.has(key)) return similarityCache.get(key)!;
    const isSame = await roughlySameUpdate(left, right);
    similarityCache.set(key, isSame);
    return isSame;
  };

  // Strict clustering: a summary joins a group only if it matches the group's
  // representative (oldest/newest first item), avoiding transitive over-merge.
  for (const summary of summaries) {
    let addedToGroup = false;

    for (const group of groups) {
      const representative = group[0];
      const isSame = await compareWithCache(representative.summary, summary.summary);

      if (isSame) {
        group.push(summary);
        addedToGroup = true;
        break;
      }
    }

    if (!addedToGroup) {
      groups.push([summary]);
    }
  }

  return groups
    .map(buildSemanticResult)
    .sort((a, b) => b.size - a.size);
}

/**PREVIOUS function semanticGroupSummaries() - Groups summaries into a single summary representing the most supported regulatory update.
 * Groups semantically similar articles together.
 * Returns the largest cluster (most supporting articles).
 */
// export async function semanticGroupSummaries(
//   summaries: ArticleSummary[]
// ): Promise<SemanticResult | null> {
//   const clusters = await semanticClusterSummaries(summaries);
//   const largestCluster = clusters[0];

//   if (!largestCluster || largestCluster.size < 2) {
//     return null;
//   }

//   return {
//     mergedSummary: largestCluster.mergedSummary,
//     articleIds: largestCluster.articleIds,
//     latestDate: largestCluster.latestDate,
//   };
// }

/**
 * Uses OpenAI to determine if two summaries describe the same regulatory update.
 */
export async function roughlySameUpdate(a: string, b: string): Promise<boolean> {
  try {
    const response = await askOpenAI([
      {
        role: 'system',
        content: 'You decide whether two summaries describe the same regulatory update, even if wording differs, details are reordered, or languages differ.'
      },
      {
        role: 'user',
        content: `
Summary A:
${a}

Summary B:
${b}

Consider them the same when they refer to the same authority action/event/timeline.
Answer only YES or NO.
      `
      }
    ]);

    // Normalize response safely
    return response.replace(/\W/g, '').toUpperCase() === 'YES';
  } catch {
    const normalize = (text: string) =>
      text
        .toLowerCase()
        .replace(/^on\s+[a-z]+\s+\d{4},\s*/i, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 3);

    const tokensA = new Set(normalize(a));
    const tokensB = new Set(normalize(b));

    if (tokensA.size === 0 || tokensB.size === 0) return false;

    let overlap = 0;
    for (const token of tokensA) {
      if (tokensB.has(token)) overlap++;
    }

    const denominator = Math.min(tokensA.size, tokensB.size);
    return denominator > 0 && overlap / denominator >= 0.5;
  }
}
