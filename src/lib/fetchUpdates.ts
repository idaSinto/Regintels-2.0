// D:\Regintels\my-regintel\src\lib\fetchUpdates.ts
export interface Article {
  id: number;
  title: string;
  summary_text: string;
  link?: string; 
  regulation?: string;
}

export async function fetchUpdates(): Promise<Article[]> {
  const res = await fetch('http://localhost:3000/api/latest-verified-updates'); 
  if (!res.ok) {
    console.error('Failed to fetch updates');
    return [];
  }
  const data = await res.json();

  // Map to newsletter-friendly structure
  return data.map((item: any) => ({
    id: item.id,
    title: item.deduced_title,
    summary_text: item.summary_text,
    link: item.primary_source_url || '#', 
    regulation: item.regulation,
  }));
}
