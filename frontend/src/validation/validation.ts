/**
 * validators.ts — Primitive field validators
 *
 * Small, composable guards used inside mapper classes.
 * Each throws MappingError with a precise field path on failure.
 */

import { FraudStatus, RiskLevel, ScoreTrend } from "../interfaces/domain";
import { MappingError } from "../interfaces/Mapper.interface";

// ─── Primitive guards ─────────────────────────────────────────────────────────

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new MappingError(
      field,
      `expected non-empty string, got ${JSON.stringify(value)}`,
      value,
    );
  }
  return value;
}

export function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !isFinite(value)) {
    throw new MappingError(
      field,
      `expected finite number, got ${JSON.stringify(value)}`,
      value,
    );
  }
  return value;
}

export function requireNumberInRange(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number {
  const n = requireNumber(value, field);
  if (n < min || n > max) {
    throw new MappingError(
      field,
      `expected number between ${min} and ${max}, got ${n}`,
      value,
    );
  }
  return n;
}

export function requireArray<T>(
  value: unknown,
  field: string,
  itemValidator: (item: unknown, index: number) => T,
): T[] {
  if (!Array.isArray(value)) {
    throw new MappingError(field, `expected array, got ${typeof value}`, value);
  }
  return value.map((item, i) => itemValidator(item, i));
}

export function requireDate(value: unknown, field: string): Date {
  if (typeof value !== "string" && !(value instanceof Date)) {
    throw new MappingError(
      field,
      `expected ISO date string, got ${typeof value}`,
      value,
    );
  }
  const date = new Date(value as string);
  if (isNaN(date.getTime())) {
    throw new MappingError(field, `"${value}" is not a valid date`, value);
  }
  return date;
}

export function optionalDate(value: unknown, field: string): Date | null {
  if (value === null || value === undefined) return null;
  return requireDate(value, field);
}

export function optionalString(value: unknown, _field: string): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : null;
}

// ─── Enum guards ──────────────────────────────────────────────────────────────

const RISK_LEVELS: Record<string, RiskLevel> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

export function requireRiskLevel(value: unknown, field: string): RiskLevel {
  const str = requireString(value, field).toUpperCase();
  const mapped = RISK_LEVELS[str];
  if (!mapped) {
    throw new MappingError(
      field,
      `expected one of ${Object.keys(RISK_LEVELS).join(", ")}, got "${value}"`,
      value,
    );
  }
  return mapped;
}

const SCORE_TRENDS: Record<string, ScoreTrend> = {
  IMPROVING: "improving",
  DECLINING: "declining",
  STABLE: "stable",
};

export function requireScoreTrend(value: unknown, field: string): ScoreTrend {
  const str = requireString(value, field).toUpperCase();
  const mapped = SCORE_TRENDS[str];
  if (!mapped) {
    throw new MappingError(
      field,
      `expected one of ${Object.keys(SCORE_TRENDS).join(", ")}, got "${value}"`,
      value,
    );
  }
  return mapped;
}

const FRAUD_STATUSES: Record<string, FraudStatus> = {
  CLEAR: "clear",
  FLAGGED: "flagged",
  UNDER_REVIEW: "under_review",
  CONFIRMED: "confirmed",
};

export function requireFraudStatus(value: unknown, field: string): FraudStatus {
  const str = requireString(value, field).toUpperCase().replace(/ /g, "_");
  const mapped = FRAUD_STATUSES[str];
  if (!mapped) {
    throw new MappingError(
      field,
      `expected one of ${Object.keys(FRAUD_STATUSES).join(", ")}, got "${value}"`,
      value,
    );
  }
  return mapped;
}
