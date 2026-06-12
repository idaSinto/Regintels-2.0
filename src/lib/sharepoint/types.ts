export type SharePointFieldValue = string | number | boolean | string[] | null | undefined;

export type SharePointListFields = Record<string, SharePointFieldValue>;

export type SharePointListItem = {
  id: string;
  webUrl: string | null;
  lastModifiedDateTime: string | null;
  fields: SharePointListFields;
};

export type ProductViewMode = 'by_regulation' | 'by_product';

export type ProductRecord = {
  itemId: string;
  webUrl: string | null;
  productName: string;
  productFamily: string[];
  productGrade: string | null;
  plant: string | null;
  application: string | null;
  sourceSheet: string | null;
  confidentiality: string | null;
  searchBlob: string;
};

export type RegulationLite = {
  id: number;
  name: string;
  searchQueries: string[];
};

export type ProductRegulationMatch = {
  productItemId: string;
  productName: string;
  regulationId: number;
  regulationName: string;
  matchScore: number;
  matchReason: string;
  evidence: string[];
  sharePointUrl: string | null;
};

export type ProductImpactProductGroup = {
  itemId: string;
  productName: string;
  productFamily: string[];
  productGrade: string | null;
  plant: string | null;
  matchCount: number;
  topMatches: ProductRegulationMatch[];
  sharePointUrl: string | null;
};

export type ProductImpactRegulationGroup = {
  regulationId: number;
  regulationName: string;
  matchCount: number;
  topMatches: ProductRegulationMatch[];
};

