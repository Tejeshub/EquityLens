export interface CompanyRequest {
  name: string;
  screener_id?: string;
  sector?: string;
}

export interface EquityResearchRequest {
  companies: CompanyRequest[];
  quarters?: number;
  debate_refinement_threshold?: number;
}

export interface AgentMessage {
  agent: string;
  message: string;
  timestamp: string;
  type: "analysis" | "challenge" | "agreement" | "verdict" | "hallucination_flag";
}

export interface ScoreDimension {
  dimension: string;
  score: number;
  max_score: number;
  confidence: number;
  evidence: string;
  source: string;
  reasoning: AgentMessage[];
}

export interface Scorecard {
  company_name: string;
  dimensions: ScoreDimension[];
  overall_score: number;
  confidence_score: number;
  timestamp: string;
  agents_participated: string[];
}

export interface GuidanceEntry {
  company: string;
  quarter: string;
  metric: string;
  guidance_lower?: number;
  guidance_upper?: number;
  actual?: number;
  deviation_percent?: number;
  source_page?: number;
  confidence: number;
}

export interface PeerComparison {
  metric: string;
  companies: {
    name: string;
    value: number;
    rank: number;
  }[];
  benchmark?: number;
}

export interface EquityResearchResponse {
  scorecards: Scorecard[];
  guidance_tracker: GuidanceEntry[];
  peer_comparisons: PeerComparison[];
  execution_status: "success" | "partial" | "failed";
  error?: string;
}

export interface AskRequest {
  question: string;
  company: string;
  top_k?: number;
}

export interface AskCitation {
  document: string;
  page?: number;
  excerpt?: string;
  source: string;
  table_type?: string;
  index?: number;
}

export interface RetrievedChunk {
  text: string;
  metadata: Record<string, any>;
  distance?: number;
}

export interface AskResponse {
  answer: string;
  citations: AskCitation[];
  retrieved_chunks: RetrievedChunk[];
  retrieval_count: number;
  fallback_used: boolean;
  error?: string;
}
