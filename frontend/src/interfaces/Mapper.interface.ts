/**
 * Mapper.interface.ts  (or MapperInterface.ts — same content either way)
 *
 * Fully self-contained: declares ApiSuccess / ApiFailure / ApiResult here
 * so there is NO import from domain.ts and no circular dependency.
 */

// ─── API Result envelope ──────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

// ─── Mapper Result ────────────────────────────────────────────────────────────

export interface MapSuccess<O> {
  ok: true;
  value: O;
}

export interface MapFailure {
  ok: false;
  error: MappingError;
}

export type MapResult<O> = MapSuccess<O> | MapFailure;

// ─── MappingError ─────────────────────────────────────────────────────────────

export class MappingError extends Error {
  constructor(
    public readonly field: string,
    public readonly reason: string,
    public readonly rawValue?: unknown,
  ) {
    super(`[Mapper] Invalid field "${field}": ${reason}`);
    this.name = "MappingError";
  }
}

// ─── MapperInterface ──────────────────────────────────────────────────────────

export interface MapperInterface<I, O> {
  map(input: I): O;
  tryMap(input: I): MapResult<O>;
}

// ─── BaseMapper ───────────────────────────────────────────────────────────────

export abstract class BaseMapper<I, O> implements MapperInterface<I, O> {
  abstract map(input: I): O;

  tryMap(input: I): MapResult<O> {
    try {
      return { ok: true, value: this.map(input) };
    } catch (err) {
      const error =
        err instanceof MappingError
          ? err
          : new MappingError(
              "unknown",
              err instanceof Error ? err.message : String(err),
            );
      return { ok: false, error };
    }
  }
}

// ─── mapEnvelope helper ───────────────────────────────────────────────────────

export function mapEnvelope<I, O>(
  raw: {
    success: boolean;
    data?: I;
    error?: {
      error_code: string;
      error_message: string;
      error_details?: Record<string, unknown>;
    };
  },
  mapper: MapperInterface<I, O>,
): ApiResult<O> {
  if (!raw.success || !raw.data) {
    const failure: ApiFailure = {
      ok: false,
      error: {
        code: raw.error?.error_code ?? "UNKNOWN_ERROR",
        message: raw.error?.error_message ?? "An unknown error occurred",
        details: raw.error?.error_details,
      },
    };
    return failure;
  }

  const result = mapper.tryMap(raw.data);

  if (!result.ok) {
    const failure: ApiFailure = {
      ok: false,
      error: {
        code: "MAPPING_ERROR",
        message: result.error.message,
        details: { field: result.error.field, rawValue: result.error.rawValue },
      },
    };
    return failure;
  }

  return { ok: true, data: result.value };
}
