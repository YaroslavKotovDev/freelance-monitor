export interface JobInput {
  source: string;
  external_id: string;
  canonical_url: string;
  title: string;
  description: string;
  budget_text: string | null;
  location: string | null;
  source_published_at: string | null; // ISO string
  content_hash: string;
  raw_data: Record<string, unknown>;
}

export interface AiScore {
  relevanceScore: number;
  summary: string;
  recommendation: string;
  risks: string[];
  stackFit: string;
}
