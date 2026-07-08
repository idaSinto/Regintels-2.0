import type {
  ProductRecord,
  RegulationLite,
  SharePointListFields,
  SharePointListItem,
} from './types';

type TokenCache = {
  accessToken: string;
  expiresAt: number;
} | null;

let cachedToken: TokenCache = null;

const SHAREPOINT_AUTH_ENV_VARS = ['MS_TENANT_ID', 'MS_CLIENT_ID', 'MS_CLIENT_SECRET'] as const;
const SHAREPOINT_LIST_ENV_VARS = ['MS_SHAREPOINT_SITE_ID', 'MS_SHAREPOINT_LIST_PRODUCTS_ID'] as const;

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
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
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

  const data = await graphFetch<{
    value: Array<{
      id: string;
      webUrl?: string;
      lastModifiedDateTime?: string;
      fields?: SharePointListFields;
    }>;
  }>(
    `/sites/${siteId}/lists/${listId}/items?expand=fields&$top=${limit}`,
    accessToken,
  );

  const items = data.value.map((item) => ({
    id: item.id,
    webUrl: item.webUrl ?? null,
    lastModifiedDateTime: item.lastModifiedDateTime ?? null,
    fields: item.fields ?? {},
  }));

  if (!options?.category) {
    return items;
  }

  const needle = options.category.trim().toLowerCase();

  return items.filter((item) => {
    const fields = item.fields;
    const family = asStringArray(getFieldValue(fields, ['Product family', 'ProductFamily', 'family', 'category']));
    const grade = asString(getFieldValue(fields, ['Product grade', 'ProductGrade', 'grade']));
    const productName = asString(getFieldValue(fields, ['Title', 'Product name', 'ProductName', 'name'])) ?? '';

    const haystack = buildSearchBlob([productName, grade, ...family]);
    return haystack.includes(needle);
  });
}

export function normalizeSharePointItemToProduct(item: SharePointListItem): ProductRecord {
  const fields = item.fields;
  const productName =
    asString(getFieldValue(fields, ['Title', 'Product name', 'ProductName', 'name'])) ??
    `Item ${item.id}`;
  const productFamily = asStringArray(
    getFieldValue(fields, ['Product family', 'ProductFamily', 'family', 'category']),
  );
  const productGrade = asString(getFieldValue(fields, ['Product grade', 'ProductGrade', 'grade']));
  const plant = asString(getFieldValue(fields, ['Plant', 'Site', 'location']));
  const application = asString(getFieldValue(fields, ['Application', 'Use', 'purpose']));
  const sourceSheet = asString(getFieldValue(fields, ['Source sheet', 'SourceSheet', 'sheet']));
  const confidentiality = asString(getFieldValue(fields, ['Confidentiality', 'Classification', 'security']));

  return {
    itemId: item.id,
    webUrl: item.webUrl,
    productName,
    productFamily,
    productGrade,
    plant,
    application,
    sourceSheet,
    confidentiality,
    searchBlob: buildSearchBlob([
      productName,
      productGrade,
      plant,
      application,
      sourceSheet,
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
