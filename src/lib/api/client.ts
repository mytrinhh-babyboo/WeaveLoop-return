/**
 * Typed HTTP client for the WeaveLoop NestJS API.
 *
 * - Sends credentialed requests (HttpOnly cookie sessions).
 * - Never stores or reads JWTs from localStorage.
 * - Sends the organization context header on tenanted requests; the org ID
 *   is always validated server-side — the client value is a hint, not trust.
 * - Raises typed ApiError instances so UI layers can distinguish
 *   validation, auth, permission and network failures.
 */
import { getApiConfig, type ApiConfig } from "./config";

export type ApiErrorCode =
  | "network_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "conflict"
  | "server_error"
  | "unknown";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  /** Field-level validation messages, keyed by DTO property when available. */
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, code: ApiErrorCode, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Sent as Idempotency-Key for operations that must not double-fire. */
  idempotencyKey?: string;
  organizationId?: string;
  signal?: AbortSignal;
}

function classifyStatus(status: number): ApiErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409 || status === 422) return "conflict";
  if (status === 400) return "validation_error";
  if (status >= 500) return "server_error";
  return "unknown";
}

interface ErrorBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
  [key: string]: unknown;
}

function extractMessage(body: ErrorBody | null): { message: string; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  const raw = body?.message;
  if (Array.isArray(raw)) {
    // NestJS class-validator style: ["field must be longer than..."] — map when parseable.
    for (const entry of raw) {
      if (typeof entry !== "string") continue;
      const match = entry.match(/^([A-Za-z0-9_.]+)\s+(.*)$/);
      if (match && match[1]) fieldErrors[match[1]] = entry;
    }

    return { message: raw.filter((m) => typeof m === "string").join("; ") || "Request failed", fieldErrors };
  }
  if (typeof raw === "string" && raw) return { message: raw, fieldErrors };
  return { message: body?.error || "Request failed", fieldErrors };
}

export interface ApiClient {
  config: ApiConfig;
  request<T>(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, options?: RequestOptions): Promise<T>;
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, options?: RequestOptions): Promise<T>;
}

export function createApiClient(config: ApiConfig = getApiConfig()): ApiClient {
  async function request<T>(
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const target = `${config.baseUrl}${path}`;
    if (typeof window === "undefined" && !/^https?:\/\//i.test(target)) {
      throw new ApiError(0, "network_error", "A same-origin API request requires a browser or a verified server forwarding origin.");
    }
    const url = typeof window === "undefined" ? new URL(target) : new URL(target, window.location.origin);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
    if (options.organizationId) headers[config.orgHeaderName] = options.organizationId;
    if (config.bearerToken) headers["Authorization"] = `Bearer ${config.bearerToken}`;

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers,
        credentials: config.credentials,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
      });
    } catch (error) {
      throw new ApiError(0, "network_error", error instanceof Error ? error.message : "Network request failed");
    }

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }

    if (!response.ok) {
      const body = (parsed && typeof parsed === "object" ? parsed : null) as ErrorBody | null;
      const { message, fieldErrors } = extractMessage(body);
      throw new ApiError(response.status, classifyStatus(response.status), message, fieldErrors);
    }

    if (!text || parsed === null) {
      throw new ApiError(response.status, "server_error", "The API returned no valid JSON data. Check the API address and forwarding configuration.");
    }

    return parsed as T;
  }

  return {
    config,
    request,
    get: (path, options) => request("GET", path, options),
    post: (path, options) => request("POST", path, options),
  };
}
