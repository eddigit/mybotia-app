export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "tenant_unknown"
  | "agent_unknown"
  | "tenant_agent_mismatch"
  | "validation_failed"
  | "conflict"
  | "bridge_error";

const STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  tenant_unknown: 400,
  agent_unknown: 400,
  tenant_agent_mismatch: 403,
  validation_failed: 400,
  conflict: 409,
  bridge_error: 502,
};

export function apiError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
) {
  return Response.json(
    { error: code, message, details: details ?? undefined },
    { status: STATUS[code] }
  );
}
