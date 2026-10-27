/**
 * WeaveLoop API configuration.
 *
 * The platform targets the existing NestJS backend. All configuration is
 * resolved lazily from environment variables — never at module scope — so the
 * same bundle works in dev, preview and production.
 */
export interface ApiConfig {
  /** Absolute base URL of the NestJS API, without trailing slash. */
  baseUrl: string;
  /** Serve the in-browser demo dataset instead of real HTTP calls. */
  useMock: boolean;
  /**
   * Credentials mode for fetch. The backend uses HttpOnly cookie sessions,
   * so credentialed requests are required for cross-origin deployments.
   */
  credentials: RequestCredentials;
  /** Optional short-lived user token supplied at runtime, never a VITE secret. */
  bearerToken?: string;
  /** Organization context header sent with tenanted requests. */
  orgHeaderName: string;
}

export function getApiConfig(): ApiConfig {
  const env = import.meta.env as Record<string, string | undefined>;
  const rawBase = env["VITE_API_BASE_URL"]?.trim();
  const useProxy = rawBase === "" || rawBase === "/api";
  const baseUrl = rawBase
    ? useProxy
      ? "/api" // same-origin proxy path
      : rawBase.replace(/\/+$/, "")
    : "http://localhost:4000/api";

  return {
    baseUrl,
    useMock: env["VITE_USE_MOCK_API"] === "true" || !rawBase,
    credentials: "include",
    orgHeaderName: "X-Organization-Id",
  };

}

/** Human-readable summary shown in the UI data-provenance badge. */
export function describeApiMode(config: ApiConfig): "live" | "mock" {
  return config.useMock ? "mock" : "live";
}
