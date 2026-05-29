import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── Error codes ───────────────────────────────────────────────────────────────
// String codes your RN api.ts can switch on without relying on status codes alone.

export type ErrorCode =
  | "UNAUTHORIZED" // 401 — missing or invalid session/token
  | "FORBIDDEN" // 403 — authenticated but not allowed
  | "NOT_FOUND" // 404 — resource doesn't exist
  | "VALIDATION_ERROR" // 400 — bad input
  | "CONFLICT" // 409 — state conflict (e.g. plan already active)
  | "INTERNAL_ERROR"; // 500 — unexpected server error

// ── Helpers ───────────────────────────────────────────────────────────────────

export function apiSuccess<T>(
  data: T,
  status = 200,
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(
  status: number,
  code: ErrorCode,
  message: string,
): NextResponse<ApiError> {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status },
  );
}

// ── Convenience shorthands ────────────────────────────────────────────────────

export const unauthorized = (message = "Authentication required") =>
  apiError(401, "UNAUTHORIZED", message);

export const forbidden = (message = "You do not have permission to do this") =>
  apiError(403, "FORBIDDEN", message);

export const notFound = (resource = "Resource") =>
  apiError(404, "NOT_FOUND", `${resource} not found`);

export const validationError = (message: string) =>
  apiError(400, "VALIDATION_ERROR", message);

export function internalError(
  err?: unknown,
  message = "An unexpected error occurred",
): NextResponse<ApiError> {
  if (err) Sentry.captureException(err);
  return apiError(500, "INTERNAL_ERROR", message);
}
