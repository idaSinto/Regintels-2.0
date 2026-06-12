import type {
  ProductImpactProductGroup,
  ProductImpactRegulationGroup,
  ProductRecord,
  ProductRegulationMatch,
  RegulationLite,
} from './types';
import { buildMatchLabel, scoreProductAgainstRegulation } from './graph';

export function matchProductsToRegulations(
  products: ProductRecord[],
  regulations: RegulationLite[],
): ProductRegulationMatch[] {
  const matches: ProductRegulationMatch[] = [];

  for (const product of products) {
    for (const regulation of regulations) {
      const { matchScore, matchReason, evidence } = scoreProductAgainstRegulation(product, regulation);

      if (matchScore < 40) continue;

      matches.push({
        productItemId: product.itemId,
        productName: product.productName,
        regulationId: regulation.id,
        regulationName: regulation.name,
        matchScore,
        matchReason,
        evidence,
        sharePointUrl: product.webUrl,
      });
    }
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

export function groupMatchesByProduct(matches: ProductRegulationMatch[]): ProductImpactProductGroup[] {
  const grouped = new Map<string, ProductImpactProductGroup>();

  for (const match of matches) {
    const current = grouped.get(match.productItemId);
    if (!current) {
      grouped.set(match.productItemId, {
        itemId: match.productItemId,
        productName: match.productName,
        productFamily: [],
        productGrade: null,
        plant: null,
        matchCount: 1,
        topMatches: [match],
        sharePointUrl: match.sharePointUrl,
      });
      continue;
    }

    current.matchCount += 1;
    current.topMatches = [...current.topMatches, match].sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);
  }

  return Array.from(grouped.values()).sort((a, b) => b.matchCount - a.matchCount);
}

export function groupMatchesByRegulation(matches: ProductRegulationMatch[]): ProductImpactRegulationGroup[] {
  const grouped = new Map<number, ProductImpactRegulationGroup>();

  for (const match of matches) {
    const current = grouped.get(match.regulationId);
    if (!current) {
      grouped.set(match.regulationId, {
        regulationId: match.regulationId,
        regulationName: match.regulationName,
        matchCount: 1,
        topMatches: [match],
      });
      continue;
    }

    current.matchCount += 1;
    current.topMatches = [...current.topMatches, match].sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
  }

  return Array.from(grouped.values()).sort((a, b) => b.matchCount - a.matchCount);
}

export function toRegulationImpactClass(score: number): string {
  return buildMatchLabel(score);
}

