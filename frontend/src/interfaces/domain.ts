/**
 * domain.ts — Frontend domain types
 *
 * These are the canonical shapes components work with.
 * They are deliberately separate from raw API shapes so that
 * API contract changes only require updating the mapper layer.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type FraudStatus = "clear" | "flagged" | "under_review" | "confirmed";

export type ScoreTrend = "improving" | "declining" | "stable";

// ─── Credit Score ─────────────────────────────────────────────────────────────

export interface CreditScoreFactor {
  /** Human-readable factor name, e.g. "Payment History" */
  name: string;
  /** Positive or negative impact score (-100 to +100) */
  impact: number;
  /** Short explanation shown in UI */
  description: string;
}

export interface CreditScore {
  userId: string;
  score: number; // 300–850
  riskLevel: RiskLevel;
  trend: ScoreTrend;
  factors: CreditScoreFactor[];
  lastUpdated: Date;
  nextUpdateAt: Date | null;
}

// ─── Fraud Report ─────────────────────────────────────────────────────────────

export interface FraudIndicator {
  code: string;
  label: string;
  severity: RiskLevel;
  detectedAt: Date;
}

export interface FraudReport {
  reportId: string;
  userId: string;
  status: FraudStatus;
  riskScore: number; // 0–100
  indicators: FraudIndicator[];
  reviewedBy: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}
