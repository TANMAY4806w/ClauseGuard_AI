export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';

export interface Citation {
  section: string;
  page: number;
  verbatim_text: string;
}

export interface ClauseAuditItem {
  risk_id: string;
  clause_category: string;
  risk_level: RiskLevel;
  headline: string;
  danger_summary: string;
  recommended_counter_term: string;
  statutory_compliance_note?: string | null;
  negotiation_advice?: string | null;
  citation: Citation;
}

export interface ContractAnalysisResponse {
  doc_id: string;
  contract_name: string;
  overall_contract_risk_score: number;
  total_clauses_analyzed: int_or_number;
  flagged_risks_count: number;
  risk_summary_breakdown: Record<string, number>;
  findings: ClauseAuditItem[];
  audit_timestamp: string;
}

type int_or_number = number;

export interface UploadResponse {
  doc_id: string;
  filename: string;
  sha256_hash: string;
  status: string;
  estimated_seconds: number;
  check_status_url: string;
}

export interface JobStatusResponse {
  doc_id: string;
  current_stage: 'PARSING' | 'EMBEDDING' | 'AUDITING' | 'COMPLETED' | 'FAILED' | string;
  progress_percent: number;
  is_completed: boolean;
  error?: string | null;
}

export interface VoiceTokenResponse {
  token: string;
  expires_in_seconds: number;
  websocket_url: string;
}

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ContractChatRequest {
  message: string;
  history?: ChatMessage[];
  client_context?: string;
}

export interface ContractChatResponse {
  doc_id: string;
  reply: string;
  referenced_sections: string[];
  suggested_followups: string[];
}
