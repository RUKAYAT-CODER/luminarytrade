/**
 * FraudReportMapper.ts
 *
 * Maps RawFraudReportResponse → FraudReport domain type.
 */

import {
  optionalDate,
  optionalString,
  requireArray,
  requireDate,
  requireFraudStatus,
  requireNumberInRange,
  requireRiskLevel,
  requireString,
} from "./validation/validation";
import { BaseMapper } from "./interfaces/Mapper.interface";
import { FraudIndicator, FraudReport } from "./interfaces/domain";
import {
  RawFraudIndicator,
  RawFraudReportResponse,
} from "./interfaces/api-response";

// ─── Indicator mapper ─────────────────────────────────────────────────────────

export class FraudIndicatorMapper extends BaseMapper<
  RawFraudIndicator,
  FraudIndicator
> {
  map(raw: RawFraudIndicator): FraudIndicator {
    return {
      code: requireString(raw.indicator_code, "indicator_code"),
      label: requireString(raw.indicator_label, "indicator_label"),
      severity: requireRiskLevel(raw.severity_level, "severity_level"),
      detectedAt: requireDate(raw.detected_timestamp, "detected_timestamp"),
    };
  }
}

// ─── Fraud report mapper ──────────────────────────────────────────────────────

export class FraudReportMapper extends BaseMapper<
  RawFraudReportResponse,
  FraudReport
> {
  private _indicatorMapper = new FraudIndicatorMapper();

  map(raw: RawFraudReportResponse): FraudReport {
    return {
      reportId: requireString(raw.report_id, "report_id"),
      userId: requireString(raw.user_id, "user_id"),
      status: requireFraudStatus(raw.fraud_status, "fraud_status"),
      riskScore: requireNumberInRange(raw.risk_score, "risk_score", 0, 100),
      indicators: requireArray(
        raw.fraud_indicators,
        "fraud_indicators",
        (item) => this._indicatorMapper.map(item as RawFraudIndicator),
      ),
      reviewedBy: optionalString(raw.reviewed_by, "reviewed_by"),
      createdAt: requireDate(raw.created_at, "created_at"),
      resolvedAt: optionalDate(raw.resolved_at, "resolved_at"),
    };
  }
}

// Singleton for convenience
export const fraudReportMapper = new FraudReportMapper();
