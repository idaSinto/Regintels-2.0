import type {
  ProductAdditiveDetail,
  ProductRecord,
  RegulationLite,
  SharePointListFields,
  SharePointListItem,
} from './types';

type TokenCache = {
  accessToken: string;
  expiresAt: number;
} | null;

type GraphListItemsResponse = {
  '@odata.nextLink'?: string;
  value: Array<{
    id: string;
    webUrl?: string;
    lastModifiedDateTime?: string;
    fields?: SharePointListFields;
  }>;
};

let cachedToken: TokenCache = null;

const SHAREPOINT_AUTH_ENV_VARS = ['MS_TENANT_ID', 'MS_CLIENT_ID', 'MS_CLIENT_SECRET'] as const;
const SHAREPOINT_LIST_ENV_VARS = [
  'MS_SHAREPOINT_SITE_ID',
  'MS_SHAREPOINT_LIST_PRODUCTS_ID',
  'MS_SHAREPOINT_LIST_ADDITIVES_ID',
] as const;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getMissingEnvVars(names: readonly string[]): string[] {
  return names.filter((name) => !process.env[name]?.trim());
}

function assertSharePointAuthConfig(): void {
  const missing = getMissingEnvVars(SHAREPOINT_AUTH_ENV_VARS);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function assertSharePointListConfig(): void {
  const missing = getMissingEnvVars(SHAREPOINT_LIST_ENV_VARS);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getFieldValue(fields: SharePointListFields, candidates: string[]): unknown {
  const normalizedCandidates = new Set(candidates.map(normalizeKey));

  for (const [key, value] of Object.entries(fields)) {
    if (normalizedCandidates.has(normalizeKey(key))) {
      return value;
    }
  }

  return undefined;
}


function asString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  const text = asString(value);
  if (!text) return [];
  return text
    .split(/[,;|/]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildSearchBlob(parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function graphFetch<T>(path: string, accessToken: string): Promise<T> {
  const url = path.startsWith('https://') ? path : `https://graph.microsoft.com/v1.0${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft Graph request failed (${res.status}): ${text}`);
  }

  return (await res.json()) as T;
}

export async function getSharePointToken(): Promise<string> {
  assertSharePointAuthConfig();

  const tenantId = requireEnv('MS_TENANT_ID');
  const clientId = requireEnv('MS_CLIENT_ID');
  const clientSecret = requireEnv('MS_CLIENT_SECRET');

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'https://graph.microsoft.com/.default',
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Failed to get SharePoint token (${tokenRes.status}): ${text}`);
  }

  const payload = (await tokenRes.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };

  return payload.access_token;
}

export async function queryProductsByCategory(options?: {
  category?: string;
  limit?: number;
  itemId?: string;
}): Promise<SharePointListItem[]> {
  assertSharePointListConfig();

  const siteId = requireEnv('MS_SHAREPOINT_SITE_ID');
  const listId = requireEnv('MS_SHAREPOINT_LIST_PRODUCTS_ID');
  const accessToken = await getSharePointToken();
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 200);

  if (options?.itemId) {
    const item = await graphFetch<{
      id: string;
      webUrl?: string;
      lastModifiedDateTime?: string;
      fields?: SharePointListFields;
    }>(
      `/sites/${siteId}/lists/${listId}/items/${options.itemId}?expand=fields`,
      accessToken,
    );

    return [{
      id: item.id,
      webUrl: item.webUrl ?? null,
      lastModifiedDateTime: item.lastModifiedDateTime ?? null,
      fields: item.fields ?? {},
    }];
  }

  const query = options?.category?.trim().toLowerCase();
  const pageSize = query ? 200 : limit;
  const items: SharePointListItem[] = [];
  let nextPath: string | null =
    `/sites/${siteId}/lists/${listId}/items?expand=fields&$top=${pageSize}`;
  let scanned = 0;

  while (nextPath && items.length < limit && scanned < 1000) {
    const data: GraphListItemsResponse = await graphFetch<GraphListItemsResponse>(nextPath, accessToken);

    scanned += data.value.length;

    const pageItems = data.value.map((item) => ({
      id: item.id,
      webUrl: item.webUrl ?? null,
      lastModifiedDateTime: item.lastModifiedDateTime ?? null,
      fields: item.fields ?? {},
    }));

    if (!query) {
      items.push(...pageItems);
      break;
    }

    items.push(...pageItems.filter((item) => productMatchesQuery(item.fields, query)));
    nextPath = data['@odata.nextLink'] ?? null;
  }

  return items.slice(0, limit);
}

function productMatchesQuery(fields: SharePointListFields, query: string): boolean {
  const family = asStringArray(getFieldValue(fields, [
    'Product family',
    'ProductFamily',
    'family',
    'category',
    'Category',
    'field_5',
  ]));
  const grade = asString(getFieldValue(fields, [
    'Product grade',
    'ProductGrade',
    'grade',
    'Tagging for PS-EO, Economics and LP Tools',
    'field_6',
  ]));
  const productCas = asString(getFieldValue(fields, [
    'Title',
    'Product CAS',
    'ProductCas',
    'CAS',
    'CAS number',
  ]));
  const plant = asString(getFieldValue(fields, ['Plant', 'Plants', 'Site', 'location', 'field_3']));
  const licensor = asString(getFieldValue(fields, [
    'Licensor Nomenclature (Original)',
    'Licensor Nomenclature',
    'Licensor',
    'field_7',
  ]));
  const additivePackage = asString(getFieldValue(fields, ['Additive Package', 'field_10']));

  const haystack = buildSearchBlob([
    productCas,
    grade,
    plant,
    licensor,
    additivePackage,
    ...family,
  ]);

  return haystack.includes(query);
}

function cleanAdditiveValue(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed === '–' || trimmed.toLowerCase() === 'na') return null;
  return trimmed;
}

function buildAdditiveDetails(item: SharePointListItem): ProductAdditiveDetail[] {
  const fields = item.fields;
  const licensor = cleanAdditiveValue(asString(getFieldValue(fields, ['Title', 'Licensor'])));
  const productCas = cleanAdditiveValue(asString(getFieldValue(fields, ['Licensor', 'Product CAS'])));
  const additivePairs = [
    {
      type: 'Neutraliser',
      cas: asString(getFieldValue(fields, ['Neutraliser CAS', 'NeutraliserCAS'])),
      ppm: asString(getFieldValue(fields, ['Neutraliser PPM', 'NeutraliserPPM'])),
    },
    {
      type: 'Primary Antioxidant',
      cas: asString(getFieldValue(fields, ['Primary Antioxidant CAS', 'PrimaryAntioxidantCAS'])),
      ppm: asString(getFieldValue(fields, ['Primary Antioxidant PPM', 'PrimaryAntioxidantPPM'])),
    },
    {
      type: 'Secondary Antioxidant',
      cas: asString(getFieldValue(fields, ['Second Antioxidant CAS', 'SecondAntioxidantCAS'])),
      ppm: asString(getFieldValue(fields, ['Second Antioxidant PPM', 'SecondAntioxidantPPM'])),
    },
    {
      type: 'Slip Agent',
      cas: asString(getFieldValue(fields, ['Slip Agent CAS', 'SlipAgentCAS'])),
      ppm: asString(getFieldValue(fields, ['Slip Agent PPM', 'SlipAgentPPM'])),
    },
  ];

  return additivePairs
    .map((additive) => ({
      itemId: item.id,
      licensor,
      productCas,
      type: additive.type,
      additiveCas: cleanAdditiveValue(additive.cas),
      levelPpm: cleanAdditiveValue(additive.ppm),
    }))
    .filter((additive) => additive.additiveCas || additive.levelPpm);
}

export async function queryAdditivesByProductCas(productCasValues: string[]): Promise<Map<string, ProductAdditiveDetail[]>> {
  assertSharePointListConfig();

  const normalizedCasValues = new Set(productCasValues.map((value) => value.trim()).filter(Boolean));
  const additivesByCas = new Map<string, ProductAdditiveDetail[]>();
  if (normalizedCasValues.size === 0) return additivesByCas;

  const siteId = requireEnv('MS_SHAREPOINT_SITE_ID');
  const listId = requireEnv('MS_SHAREPOINT_LIST_ADDITIVES_ID');
  const accessToken = await getSharePointToken();
  let nextPath: string | null =
    `/sites/${siteId}/lists/${listId}/items?expand=fields&$top=200`;
  let scanned = 0;

  while (nextPath && scanned < 1000) {
    const data: GraphListItemsResponse = await graphFetch<GraphListItemsResponse>(nextPath, accessToken);
    scanned += data.value.length;

    for (const rawItem of data.value) {
      const item: SharePointListItem = {
        id: rawItem.id,
        webUrl: rawItem.webUrl ?? null,
        lastModifiedDateTime: rawItem.lastModifiedDateTime ?? null,
        fields: rawItem.fields ?? {},
      };
      const productCas = cleanAdditiveValue(asString(getFieldValue(item.fields, ['Licensor', 'Product CAS'])));
      if (!productCas || !normalizedCasValues.has(productCas)) continue;

      const current = additivesByCas.get(productCas) ?? [];
      current.push(...buildAdditiveDetails(item));
      additivesByCas.set(productCas, current);
    }

    nextPath = data['@odata.nextLink'] ?? null;
  }

  return additivesByCas;
}

export function normalizeSharePointItemToProduct(item: SharePointListItem): ProductRecord {
  const fields = item.fields;
  const productCas = asString(getFieldValue(fields, [
    'Title',
    'Product CAS',
    'ProductCas',
    'CAS',
    'CAS number',
  ]));
  const productName =
    productCas ??
    asString(getFieldValue(fields, ['Product name', 'ProductName', 'name'])) ??
    `Item ${item.id}`;
  const productFamily = asStringArray(
    getFieldValue(fields, ['Product family', 'ProductFamily', 'family', 'category', 'Category', 'field_5']),
  );
  const productGrade = asString(getFieldValue(fields, [
    'Product grade',
    'ProductGrade',
    'grade',
    'Tagging for PS-EO, Economics and LP Tools',
    'field_6',
  ]));
  const plant = asString(getFieldValue(fields, ['Plant', 'Plants', 'Site', 'location', 'field_3']));
  const meltIndex = asString(getFieldValue(fields, [
    'Melt Index',
    'field_8',
  ]));
  const density = asString(getFieldValue(fields, ['Density Annealed, kg/m3', 'Density', 'field_9']));
  const additivePackage = asString(getFieldValue(fields, ['Additive Package', 'field_10']));
  const prefchemPrimeRev3 = asString(getFieldValue(fields, ['PRefChem Prime Rev 3', 'field_11']));
  const prefchemPrimeRev33 = asString(getFieldValue(fields, ['PRefChem Prime Rev 33', 'field_12']));
  const prefchemPrimeRev34 = asString(getFieldValue(fields, ['PRefChem Prime Rev 34', 'field_13']));
  const ethyleneContent = asString(getFieldValue(fields, ['Ethylene content  (in %)', 'field_32']));
  const propyleneContent = asString(getFieldValue(fields, ['Propylene content (in %)', 'field_33']));
  const buteneContent = asString(getFieldValue(fields, ['1-butene content (in %)', 'field_34']));
  const hexeneContent = asString(getFieldValue(fields, ['1-hexene content (in %)', 'field_35']));
  const application = asString(getFieldValue(fields, [
    'Application',
    'Use',
    'purpose',
    'Additive Package',
    'field_10',
  ]));
  const licensorNomenclature = asString(getFieldValue(fields, [
    'Licensor Nomenclature (Original)',
    'Licensor Nomenclature',
    'Licensor',
    'field_7',
  ]));
  const sourceSheet = asString(getFieldValue(fields, [
    'Source sheet',
    'SourceSheet',
    'sheet',
  ]));
  const confidentiality = asString(getFieldValue(fields, ['Confidentiality', 'Classification', 'security']));

  return {
    itemId: item.id,
    webUrl: item.webUrl,
    productName,
    productCas,
    productFamily,
    productGrade,
    plant,
    meltIndex,
    density,
    additivePackage,
    prefchemPrimeRev3,
    prefchemPrimeRev33,
    prefchemPrimeRev34,
    ethyleneContent,
    propyleneContent,
    buteneContent,
    hexeneContent,
    application,
    sourceSheet,
    licensorNomenclature,
    confidentiality,
    additives: [],
    searchBlob: buildSearchBlob([
      productName,
      productCas,
      productGrade,
      plant,
      meltIndex,
      density,
      application,
      sourceSheet,
      licensorNomenclature,
      additivePackage,
      confidentiality,
      ...productFamily,
    ]),
  };
}

export function scoreProductAgainstRegulation(
  product: ProductRecord,
  regulation: RegulationLite,
): { matchScore: number; matchReason: string; evidence: string[] } {
  const regulationBlob = buildSearchBlob([
    regulation.name,
    ...regulation.searchQueries,
  ]);

  const productTokens = new Set(
    product.searchBlob
      .split(' ')
      .filter((token) => token.length >= 3),
  );

  const regulationTokens = new Set(
    regulationBlob
      .split(' ')
      .filter((token) => token.length >= 3),
  );

  const matchedTokens: string[] = [];
  for (const token of regulationTokens) {
    if (productTokens.has(token) || product.searchBlob.includes(token)) {
      matchedTokens.push(token);
    }
  }

  const familyHits = product.productFamily.filter((family) =>
    regulationBlob.includes(family.toLowerCase()),
  );

  const gradeHit = product.productGrade && regulationBlob.includes(product.productGrade.toLowerCase());
  const productNameHit = regulationBlob.includes(product.productName.toLowerCase());

  let score = matchedTokens.length * 12 + familyHits.length * 18 + (gradeHit ? 22 : 0) + (productNameHit ? 16 : 0);
  score = Math.max(0, Math.min(100, score));

  const evidence = Array.from(new Set([
    ...matchedTokens.slice(0, 6),
    ...familyHits,
    ...(gradeHit && product.productGrade ? [product.productGrade] : []),
  ]));

  const matchReason =
    score >= 80
      ? 'Strong lexical match between product metadata and regulation terms.'
      : score >= 50
        ? 'Moderate overlap between product metadata and regulation search terms.'
        : 'Weak overlap; review manually.';

  return { matchScore: score, matchReason, evidence };
}

export function buildMatchLabel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}
