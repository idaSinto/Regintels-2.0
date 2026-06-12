import { NextResponse } from 'next/server';
import { supabase } from '@/lib/core/database';
import {
  normalizeSharePointItemToProduct,
  queryProductsByCategory,
} from '@/lib/sharepoint/graph';
import {
  groupMatchesByProduct,
  groupMatchesByRegulation,
  matchProductsToRegulations,
} from '@/lib/sharepoint/matching';
import type { ProductViewMode, RegulationLite } from '@/lib/sharepoint/types';

export const runtime = 'nodejs';

async function loadRegulations(): Promise<RegulationLite[]> {
  const { data, error } = await supabase
    .from('regulations')
    .select(`
      id,
      name,
      regulation_search_profiles (
        search_queries
      )
    `)
    .eq('is_active', true);

  if (error) throw error;

  return (data ?? [])
    .map((reg) => {
      const profile = Array.isArray(reg.regulation_search_profiles)
        ? reg.regulation_search_profiles[0]
        : reg.regulation_search_profiles;

      return {
        id: reg.id,
        name: reg.name,
        searchQueries: Array.isArray(profile?.search_queries) ? profile.search_queries : [],
      };
    })
    .filter((reg): reg is RegulationLite => Boolean(reg.id && reg.name));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category') ?? undefined;
    const view = (url.searchParams.get('view') ?? 'by_regulation') as ProductViewMode;
    const limit = Number(url.searchParams.get('limit') ?? '20');
    const itemId = url.searchParams.get('itemId') ?? undefined;

    const items = await queryProductsByCategory({ category, limit, itemId });
    const products = items.map(normalizeSharePointItemToProduct);
    const regulations = await loadRegulations();
    const matches = matchProductsToRegulations(products, regulations);

    const payload =
      view === 'by_product'
        ? {
            view,
            category: category ?? null,
            count: matches.length,
            results: groupMatchesByProduct(matches),
          }
        : {
            view,
            category: category ?? null,
            count: matches.length,
            results: groupMatchesByRegulation(matches),
          };

    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      ...payload,
    });
  } catch (error) {
    console.error('SharePoint product-impact route failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to load SharePoint products.';
    const missingSharePointEnv = message.startsWith('Missing required environment variables:')
      ? message.replace('Missing required environment variables:', '').split(',').map((part) => part.trim()).filter(Boolean)
      : [];

    return NextResponse.json(
      {
        ok: false,
        error: message,
        missingSharePointEnv,
      },
      { status: missingSharePointEnv.length > 0 ? 503 : 500 },
    );
  }
}
