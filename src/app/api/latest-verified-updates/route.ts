import { NextResponse } from 'next/server';
import { supabase } from '@/lib/core/database';

// ==========================================
// 1. TYPES & INTERFACES
// ==========================================
type Article = {
  id: number;
  url: string;
  title: string;
};

type LatestVerifiedRow = {
  id: number;
  regulation: string;
  regulation_name: string;
  deduced_title: string;
  summary_text: string;
  impact_level: 'high' | 'medium' | 'low' | null;
  primary_source_url: string | null;
  related_article_ids: number[] | null; 
  deduced_published_date: string | null;
  created_at: string;
};

// ==========================================
// 2. GET HANDLER (API ROUTE)
// ==========================================
export async function GET() {
  // Fetch main regulatory updates from Supabase
  const { data, error } = await supabase
    .from('latest_verified_updates')
    .select(`
      id,
      regulation,
      regulation_name,
      deduced_title,
      summary_text,
      impact_level,
      primary_source_url,
      related_article_ids,
      deduced_published_date,
      created_at
    `);

  if (error) {
    console.error('Fetch error:', error);
    return NextResponse.json([], { status: 500 });
  }

  // Collect all IDs needed to fetch related article details
  const allRelatedIds: number[] = data
    ?.flatMap((row: LatestVerifiedRow) => row.related_article_ids ?? []) ?? [];

  // Fetch article titles/URLs for all collected IDs
  const { data: articlesData, error: articlesError } = allRelatedIds.length > 0
    ? await supabase
        .from('raw_articles')
        .select('id, url, title')
        .in('id', allRelatedIds)
    : { data: [] as Article[], error: null };

  if (articlesError) {
    console.error('Articles fetch error:', articlesError);
    return NextResponse.json([], { status: 500 });
  }

  // Create a Map for quick lookup of article details by ID
  const articlesMap = new Map<number, Article>(
    articlesData?.map((a: Article) => [a.id, a]) ?? []
  );

  // Combine updates with their full related article objects
  const updates = (data ?? []).map((row: LatestVerifiedRow) => {
    const related_articles: Article[] = (row.related_article_ids ?? [])
      .map((id) => articlesMap.get(id))
      .filter((a): a is Article => Boolean(a)) // Remove any undefined lookups
      .sort((a, b) => a.id - b.id);

    return {
      id: row.id,
      regulation: row.regulation,
      regulation_name: row.regulation_name,
      deduced_title: row.deduced_title,
      summary_text: row.summary_text,
      impact_level: row.impact_level?.toLowerCase() as 'high' | 'medium' | 'low' | undefined,
      primary_source_url: row.primary_source_url,
      related_articles,
      deduced_published_date: row.deduced_published_date,
      created_at: row.created_at,
    };
  });

  return NextResponse.json(updates);
}