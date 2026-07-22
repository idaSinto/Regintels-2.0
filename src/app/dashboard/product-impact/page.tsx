'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ExternalLink, Eye, Lock, RefreshCw, Search } from 'lucide-react';

type ProductRegulationMatch = {
  productItemId: string;
  productName: string;
  productCas: string | null;
  productFamily: string[];
  productGrade: string | null;
  plant: string | null;
  licensorNomenclature: string | null;
  regulationId: number;
  regulationName: string;
  matchScore: number;
  matchReason: string;
  evidence: string[];
  sharePointUrl: string | null;
};

type ProductGroup = {
  itemId: string;
  productName: string;
  productCas: string | null;
  productFamily: string[];
  productGrade: string | null;
  plant: string | null;
  licensorNomenclature: string | null;
  matchCount: number;
  topMatches: ProductRegulationMatch[];
  sharePointUrl: string | null;
};

type RegulationGroup = {
  regulationId: number;
  regulationName: string;
  matchCount: number;
  topMatches: ProductRegulationMatch[];
};

type ResponseShape =
  | {
      ok: true;
      view: 'by_product';
      category: string | null;
      count: number;
      results: ProductGroup[];
      syncedAt: string;
    }
  | {
      ok: true;
      view: 'by_regulation';
      category: string | null;
      count: number;
      results: RegulationGroup[];
      syncedAt: string;
    }
  | {
      ok: false;
      error: string;
      missingSharePointEnv?: string[];
    };

function scoreClass(score: number) {
  if (score >= 80) return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300';
  if (score >= 50) return 'bg-amber-500/15 text-amber-600 dark:text-amber-300';
  return 'bg-rose-500/15 text-rose-600 dark:text-rose-300';
}

export default function ProductImpactPage() {
  const [view, setView] = useState<'by_regulation' | 'by_product'>('by_regulation');
  const [category, setCategory] = useState('LLDPE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingSharePointEnv, setMissingSharePointEnv] = useState<string[]>([]);
  const [data, setData] = useState<ResponseShape | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductGroup | null>(null);

  const results = useMemo(() => {
    if (!data || !data.ok) return [];
    return data.results;
  }, [data]);

  const fetchImpact = async () => {
    setLoading(true);
    setError(null);
    setMissingSharePointEnv([]);

    try {
      const res = await fetch(
        `/api/sharepoint/product-impact?view=${view}&category=${encodeURIComponent(category)}&limit=20`,
      );
      const payload = (await res.json()) as ResponseShape;

      if (!res.ok || !payload.ok) {
        if (!payload.ok && payload.missingSharePointEnv?.length) {
          setMissingSharePointEnv(payload.missingSharePointEnv);
        }
        throw new Error(!payload.ok ? payload.error : 'Failed to load product impact data.');
      }

      setData(payload);
      setSelectedProduct(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product impact data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchImpact();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  return (
    <div className="w-full">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <section className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-500">
            <span className="mr-2 flex h-2 w-2 rounded-full bg-emerald-500" />
            Live SharePoint Only
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-6xl">
            Product Impact Explorer
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--foreground)]/70">
            Product details are fetched live from SharePoint.
          </p>
        </section>

        <section className="mb-6 rounded-2xl border border-gray-200/50 bg-white/60 p-4 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/60">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1 flex items-center gap-2 rounded-xl border border-gray-300 bg-white/50 px-4 py-3 dark:border-gray-600 dark:bg-gray-800/50">
              <Search className="h-4 w-4 text-[var(--foreground)]/60" />
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="CAS Number/ licensor..."
                className="w-full bg-transparent text-[var(--foreground)] focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setView('by_regulation')}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  view === 'by_regulation'
                    ? 'bg-[var(--accent)] text-white'
                    : 'border border-gray-300 bg-white/50 text-[var(--foreground)] hover:bg-white/80 dark:border-gray-600 dark:bg-gray-800/50'
                }`}
              >
                By Regulation
              </button>
              <button
                type="button"
                onClick={() => setView('by_product')}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  view === 'by_product'
                    ? 'bg-[var(--accent)] text-white'
                    : 'border border-gray-300 bg-white/50 text-[var(--foreground)] hover:bg-white/80 dark:border-gray-600 dark:bg-gray-800/50'
                }`}
              >
                By Product
              </button>
              <button
                type="button"
                onClick={fetchImpact}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white/50 px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/80 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800/50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Live Fetch
              </button>
            </div>
          </div>
        </section>

        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <Lock className="h-4 w-4" />
          Product details stay in SharePoint. Regintels only displays live-fetched rows and match results.
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4" />
            <div className="space-y-1">
              <p>{error}</p>
              {missingSharePointEnv.length > 0 && (
                <p className="text-xs text-rose-700/80 dark:text-rose-300/80">
                  Missing: {missingSharePointEnv.join(', ')}. Add these Microsoft Graph values to `.env.local`
                  and restart the dev server.
                  Product details stay live in SharePoint and are never stored in Supabase.
                </p>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200/50 bg-white/60 py-20 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/60">
            <div className="h-14 w-14 animate-spin rounded-full border-t-2 border-b-2 border-[var(--accent)]" />
            <p className="mt-4 text-[var(--foreground)]/70">Fetching SharePoint rows live...</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="rounded-2xl border border-gray-200/50 bg-white/60 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/60">
              <div className="border-b border-gray-200/50 px-5 py-4 dark:border-gray-700/50">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  {view === 'by_regulation' ? 'Regulations with product exposure' : 'Products with regulation exposure'}
                </h2>
                <p className="text-sm text-[var(--foreground)]/60">
                  {data?.ok
                    ? `${data.count} ${view === 'by_product' ? 'products returned' : 'matches returned'}`
                    : 'No data yet'}
                </p>
              </div>

              <div className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
                {!error && results.length === 0 && (
                  <div className="p-5 text-sm text-[var(--foreground)]/60">
                    {view === 'by_product'
                      ? 'No SharePoint products found for this search. Try a Product CAS, licensor, category, or click Live Fetch.'
                      : 'No live regulation matches yet. Try another product family or click Live Fetch.'}
                  </div>
                )}
                {view === 'by_regulation'
                  ? ((results as RegulationGroup[]) ?? []).map((group) => (
                      <button
                        key={group.regulationId}
                        type="button"
                        className="w-full p-5 text-left transition hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-semibold text-[var(--foreground)]">{group.regulationName}</h3>
                            <p className="text-sm text-[var(--foreground)]/60">{group.matchCount} product matches</p>
                          </div>
                          <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                            Regulation
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {group.topMatches.slice(0, 3).map((match) => (
                            <span
                              key={`${group.regulationId}-${match.productItemId}`}
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${scoreClass(match.matchScore)}`}
                            >
                              {match.productName} - {match.matchScore}%
                            </span>
                          ))}
                        </div>
                      </button>
                    ))
                  : ((results as ProductGroup[]) ?? []).map((group) => (
                      <button
                        key={group.itemId}
                        type="button"
                        onClick={() => setSelectedProduct(group)}
                        className="w-full p-5 text-left transition hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-semibold text-[var(--foreground)]">{group.productName}</h3>
                            <p className="text-sm text-[var(--foreground)]/60">
                              {group.productGrade || 'No tagging'}{group.plant ? ` - ${group.plant}` : ''}
                            </p>
                            <p className="mt-1 text-xs text-[var(--foreground)]/50">
                              CAS: {group.productCas || 'N/A'}
                              {group.licensorNomenclature ? ` - Licensor: ${group.licensorNomenclature}` : ''}
                            </p>
                          </div>
                          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                            {group.matchCount} matches
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {group.topMatches.slice(0, 3).map((match) => (
                            <span
                              key={`${group.itemId}-${match.regulationId}`}
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${scoreClass(match.matchScore)}`}
                            >
                              {match.regulationName} - {match.matchScore}%
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200/50 bg-white/60 p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/60">
              <div className="mb-4 flex items-center gap-2">
                <Eye className="h-4 w-4 text-[var(--accent)]" />
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Live detail panel</h2>
              </div>

              {selectedProduct ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-[var(--foreground)]">{selectedProduct.productName}</h3>
                    <p className="text-sm text-[var(--foreground)]/60">
                      SharePoint item {selectedProduct.itemId}
                    </p>
                    <p className="mt-1 text-sm text-[var(--foreground)]/60">
                      CAS: {selectedProduct.productCas || 'N/A'}
                    </p>
                    {selectedProduct.licensorNomenclature && (
                      <p className="text-sm text-[var(--foreground)]/60">
                        Licensor: {selectedProduct.licensorNomenclature}
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl bg-white/50 p-4 dark:bg-gray-900/40">
                    <p className="text-sm text-[var(--foreground)]/60">Open live source</p>
                    {selectedProduct.sharePointUrl ? (
                      <a
                        href={selectedProduct.sharePointUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Open SharePoint row
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--foreground)]/60">No SharePoint link available.</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    {selectedProduct.topMatches.length === 0 && (
                      <div className="rounded-xl border border-gray-200/50 p-4 text-sm text-[var(--foreground)]/60 dark:border-gray-700/50">
                        This SharePoint product was found, but no active regulation matched it above the current score threshold.
                      </div>
                    )}
                    {selectedProduct.topMatches.map((match) => (
                      <div key={`${selectedProduct.itemId}-${match.regulationId}`} className="rounded-xl border border-gray-200/50 p-4 dark:border-gray-700/50">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold text-[var(--foreground)]">{match.regulationName}</p>
                            <p className="text-xs text-[var(--foreground)]/60">{match.matchReason}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${scoreClass(match.matchScore)}`}>
                            {match.matchScore}%
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {match.evidence.map((item) => (
                            <span
                              key={item}
                              className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-medium text-[var(--accent)]"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-[var(--foreground)]/60 dark:border-gray-600">
                  Click a product row to inspect its regulation matches. Product details remain live in SharePoint only.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
