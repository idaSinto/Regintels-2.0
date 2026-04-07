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
  const latestDate = group
    .map(g => g.published_date)
    .filter(Boolean)
    .map(d => dayjs(d))
    .filter(d => !d.isAfter(now))
    .sort((a, b) => b.valueOf() - a.valueOf())[0]
    ?.toISOString() ?? null;

  return {
    mergedSummary: group.map(g => g.summary).join(' '),
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
  const n = summaries.length;

  // Step 1: Build similarity matrix
  const similarity: boolean[][] = Array.from({ length: n }, () =>
    Array(n).fill(false)
  );

  for (let i = 0; i < n; i++) {
    similarity[i][i] = true; // Each summary is similar to itself

    for (let j = i + 1; j < n; j++) {
      const isSame = await roughlySameUpdate(summaries[i].summary, summaries[j].summary);
      similarity[i][j] = isSame;
      similarity[j][i] = isSame; // Symmetric
    }
}

  // Step 2: Find connected components (clusters) using DFS
  const visited = Array(n).fill(false);
  const clusters: ArticleSummary[][] = [];

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;

    const stack = [i];
    const component: ArticleSummary[] = [];
    visited[i] = true;

    while (stack.length > 0) {
      const current = stack.pop()!;
      component.push(summaries[current]);
    
      for (let j = 0; j < n; j++) {
        if(!visited[j] && similarity[current][j]) {
          visited[j] = true;
          stack.push(j);
        }
      }
    }
    clusters.push(component);
  }

  // Step 3: Convert to SemanticCluster and sort by size
  return clusters
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
