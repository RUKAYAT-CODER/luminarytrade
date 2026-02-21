/**
 * api-responses.ts — Raw API response shapes
 *
 * These mirror the actual JSON the server returns — snake_case fields,
 * string dates, numeric enums, etc. Components must NEVER consume these
 * directly; they go through the mapper layer first.
 */

// ─── Raw Credit Score ─────────────────────────────────────────────────────────

export interface RawCreditScoreFactor {
  factor_name: string;
  impact_score: number;
  explanation: string;
}

export interface RawCreditScoreResponse {
  user_id: string;
  credit_score: number;
  risk_level: string; // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  score_trend: string; // "IMPROVING" | "DECLINING" | "STABLE"
  score_factors: RawCreditScoreFactor[];
  last_updated_at: string; // ISO-8601 string
  next_update_at: string | null;
}

// ─── Raw Fraud Report ─────────────────────────────────────────────────────────

export interface RawFraudIndicator {
  indicator_code: string;
  indicator_label: string;
  severity_level: string; // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  detected_timestamp: string; // ISO-8601 string
}

export interface RawFraudReportResponse {
  report_id: string;
  user_id: string;
  fraud_status: string; // "CLEAR" | "FLAGGED" | "UNDER_REVIEW" | "CONFIRMED"
  risk_score: number;
  fraud_indicators: RawFraudIndicator[];
  reviewed_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

// ─── Generic API wrapper ──────────────────────────────────────────────────────

/** What the HTTP layer returns before any mapping */
export interface RawApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    error_code: string;
    error_message: string;
    error_details?: Record<string, unknown>;
  };
  meta?: {
    request_id: string;
    timestamp: string;
  };
}
