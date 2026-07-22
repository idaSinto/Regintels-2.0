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
  productCas: string | null;
  productFamily: string[];
  productGrade: string | null;
  plant: string | null;
  meltIndex: string | null;
  density: string | null;
  additivePackage: string | null;
  prefchemPrimeRev3: string | null;
  prefchemPrimeRev33: string | null;
  prefchemPrimeRev34: string | null;
  ethyleneContent: string | null;
  propyleneContent: string | null;
  buteneContent: string | null;
  hexeneContent: string | null;
  application: string | null;
  sourceSheet: string | null;
  licensorNomenclature: string | null;
  confidentiality: string | null;
  additives: ProductAdditiveDetail[];
  searchBlob: string;
};

export type ProductAdditiveDetail = {
  itemId: string;
  licensor: string | null;
  productCas: string | null;
  type: string;
  additiveCas: string | null;
  levelPpm: string | null;
};

export type RegulationLite = {
  id: number;
  name: string;
  searchQueries: string[];
};

export type ProductRegulationMatch = {
  productItemId: string;
  productName: string;
  productCas: string | null;
  productFamily: string[];
  productGrade: string | null;
  plant: string | null;
  licensorNomenclature: string | null;
  meltIndex: string | null;
  density: string | null;
  additivePackage: string | null;
  additives: ProductAdditiveDetail[];
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
  productCas: string | null;
  productFamily: string[];
  productGrade: string | null;
  plant: string | null;
  licensorNomenclature: string | null;
  meltIndex: string | null;
  density: string | null;
  additivePackage: string | null;
  prefchemPrimeRev3: string | null;
  prefchemPrimeRev33: string | null;
  prefchemPrimeRev34: string | null;
  ethyleneContent: string | null;
  propyleneContent: string | null;
  buteneContent: string | null;
  hexeneContent: string | null;
  additives: ProductAdditiveDetail[];
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
