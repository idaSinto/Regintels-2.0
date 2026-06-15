export type SourceType = 'PRIMARY' | 'SECONDARY' | 'UNKNOWN';

export type RawArticle = {
  id: number;
  created_at: string;
  url: string;
  title?: string;
  snippet?: string;
  source?: string;
  is_processed: boolean;
  source_type?: SourceType;
  confidence_score?: number;
};

export type VerifiedUpdate = {
  id: number;
  created_at: string;
  deduced_title: string;
  summary_text: string;
  impact_level: 'high'|'medium'|'low';
  primary_source_url?: string;
  related_article_ids?: number[];
  verification_status: boolean;
  confidence_score?: number;
  has_primary_source?: boolean;
};
