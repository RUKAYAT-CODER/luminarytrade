/**
 * CreditScoreMapper.ts
 *
 * Maps RawCreditScoreResponse → CreditScore domain type.
 * Validates every field and throws MappingError on bad data.
 */

import {
  RawCreditScoreFactor,
  RawCreditScoreResponse,
} from "./interfaces/api-response";
import { CreditScore, CreditScoreFactor } from "./interfaces/domain";
import { BaseMapper } from "./interfaces/Mapper.interface";
import {
  optionalDate,
  requireArray,
  requireDate,
  requireNumberInRange,
  requireRiskLevel,
  requireScoreTrend,
  requireString,
} from "./validation/validation";

// ─── Factor mapper ────────────────────────────────────────────────────────────

export class CreditScoreFactorMapper extends BaseMapper<
  RawCreditScoreFactor,
  CreditScoreFactor
> {
  map(raw: RawCreditScoreFactor): CreditScoreFactor {
    return {
      name: requireString(raw.factor_name, "factor_name"),
      impact: requireNumberInRange(raw.impact_score, "impact_score", -100, 100),
      description: requireString(raw.explanation, "explanation"),
    };
  }
}

// ─── Credit score mapper ──────────────────────────────────────────────────────

export class CreditScoreMapper extends BaseMapper<
  RawCreditScoreResponse,
  CreditScore
> {
  private _factorMapper = new CreditScoreFactorMapper();

  map(raw: RawCreditScoreResponse): CreditScore {
    return {
      userId: requireString(raw.user_id, "user_id"),
      score: requireNumberInRange(raw.credit_score, "credit_score", 300, 850),
      riskLevel: requireRiskLevel(raw.risk_level, "risk_level"),
      trend: requireScoreTrend(raw.score_trend, "score_trend"),
      factors: requireArray(raw.score_factors, "score_factors", (item, i) =>
        this._factorMapper.map(item as RawCreditScoreFactor),
      ),
      lastUpdated: requireDate(raw.last_updated_at, "last_updated_at"),
      nextUpdateAt: optionalDate(raw.next_update_at, "next_update_at"),
    };
  }
}

// Singleton for convenience — import this in most cases
export const creditScoreMapper = new CreditScoreMapper();
