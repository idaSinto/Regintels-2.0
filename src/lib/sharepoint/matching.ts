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
        productCas: product.productCas,
        productFamily: product.productFamily,
        productGrade: product.productGrade,
        plant: product.plant,
        licensorNomenclature: product.licensorNomenclature,
        meltIndex: product.meltIndex,
        density: product.density,
        additivePackage: product.additivePackage,
        additives: product.additives,
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
        productCas: match.productCas,
        productFamily: match.productFamily,
        productGrade: match.productGrade,
        plant: match.plant,
        licensorNomenclature: match.licensorNomenclature,
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

export function groupProductsWithMatches(
  products: ProductRecord[],
  matches: ProductRegulationMatch[],
): ProductImpactProductGroup[] {
  const matchesByProduct = new Map<string, ProductRegulationMatch[]>();

  for (const match of matches) {
    const current = matchesByProduct.get(match.productItemId) ?? [];
    current.push(match);
    matchesByProduct.set(match.productItemId, current);
  }

  return products.map((product) => {
    const productMatches = (matchesByProduct.get(product.itemId) ?? [])
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);

    return {
      itemId: product.itemId,
      productName: product.productName,
      productCas: product.productCas,
      productFamily: product.productFamily,
      productGrade: product.productGrade,
      plant: product.plant,
      licensorNomenclature: product.licensorNomenclature,
      meltIndex: product.meltIndex,
      density: product.density,
      additivePackage: product.additivePackage,
      prefchemPrimeRev3: product.prefchemPrimeRev3,
      prefchemPrimeRev33: product.prefchemPrimeRev33,
      prefchemPrimeRev34: product.prefchemPrimeRev34,
      ethyleneContent: product.ethyleneContent,
      propyleneContent: product.propyleneContent,
      buteneContent: product.buteneContent,
      hexeneContent: product.hexeneContent,
      additives: product.additives,
      matchCount: matchesByProduct.get(product.itemId)?.length ?? 0,
      topMatches: productMatches,
      sharePointUrl: product.webUrl,
    };
  });
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
