import { supabase } from '@/lib/core/database';

export interface Article {
  id: number;
  title: string;
  summary_text: string;
  link?: string; 
  regulation?: string;
}

export async function fetchUpdates(): Promise<Article[]> {
  const { data, error } = await supabase
    .from('latest_verified_updates')
    .select(`
      regulation_id,
      deduced_published_date,
      verified_updates:verified_update_id(*)
    `)
    .order('deduced_published_date', { ascending: false });

  if (error) {
    console.error('Failed to fetch updates:', error);
    return [];
  }

  return (data ?? []).map((item: Record<string, unknown>) => ({
    id: (item as { verified_updates?: { id?: number } }).verified_updates?.id ?? 0,
    title: (item as { verified_updates?: { deduced_title?: string } }).verified_updates?.deduced_title ?? '',
    summary_text: (item as { verified_updates?: { summary_text?: string } }).verified_updates?.summary_text ?? '',
    link: (item as { verified_updates?: { primary_source_url?: string } }).verified_updates?.primary_source_url ?? '#',
    regulation: String((item as { regulation_id?: unknown }).regulation_id ?? ''),
  }));
}
