import { NextResponse } from 'next/server';
import { supabase } from '@/lib/core/database';
import { runRegulationPipeline } from '@/lib/core/pipeline';
import { buildSynthesisPrompt } from '@/lib/core/processors';

// ==========================================
// PIPELINE TRIGGER HANDLER
// ==========================================
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const regIdParam = url.searchParams.get('regulationId'); // e.g., "39" or "39,42"

    let query = supabase
      .from('regulations')
      .select(`
        id,
        name,
        regulation_search_profiles (
          authority,
          search_queries,
          primary_sources,
          secondary_sources
        )
      `)
      .eq('is_active', true);

    // ✅ If regulationId is provided, filter by the IDs
    if (regIdParam) {
      const ids = regIdParam
        .split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id));
      if (ids.length > 0) query = query.in('id', ids);
    }

    const { data: regulations, error } = await query;

    if (error) {
      console.error('Error fetching regulations:', error);
      return NextResponse.json({ ok: false, error: 'Failed to fetch regulations.' }, { status: 500 });
    }

    if (!regulations || regulations.length === 0) {
      return NextResponse.json({ ok: true, message: 'No regulations found' });
    }

    const results: any[] = [];

    for (const reg of regulations) {
      const profiles = Array.isArray(reg.regulation_search_profiles)
        ? reg.regulation_search_profiles
        : reg.regulation_search_profiles
        ? [reg.regulation_search_profiles]
        : [];

      if (profiles.length === 0) {
        console.warn(`Skipping regulation "${reg.name}" — no profiles`);
        continue;
      }

      let scannedSuccessfully = false;

      for (const profile of profiles) {
        const searchQueries = Array.isArray(profile.search_queries) ? profile.search_queries : [];
        const primarySources = Array.isArray(profile.primary_sources) ? profile.primary_sources : [];
        const secondarySources = Array.isArray(profile.secondary_sources) ? profile.secondary_sources : [];

        const config = {
          id: String(reg.id),
          regulationName: reg.name,
          searchQueries,
          primarySourceUrl: primarySources[0] ?? undefined,
          primarySources,
          secondarySources
        };

        try {
          console.log(`Running pipeline for: ${reg.name}`);
          const res = await runRegulationPipeline({
            config,
            synthesisPromptBuilder: buildSynthesisPrompt,
            maxSearchPerQuery: 1,
            skipScan: true,
          });
          results.push({ regulation: reg.name, result: res });

          scannedSuccessfully = true; // mark as successful

        } catch (err) {
          console.error(`Pipeline failed for regulation ${reg.name}:`, err);
          results.push({
            regulation: reg.name,
            result: 'failed',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // ✅ Update last_scanned_at only once per regulation after successful scan
      if (scannedSuccessfully) {
        const { error: updateError } = await supabase
          .from('regulations')
          .update({ last_scanned_at: new Date().toISOString() })
          .eq('id', reg.id);

        if (updateError) {
          console.error(`Failed to update last_scanned_at for regulation ${reg.name}:`, updateError);
        }
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error('Unhandled pipeline route error:', err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Unexpected pipeline error.',
      },
      { status: 500 }
    );
  }
}
