/**
 * WeaveLoop API layer — public surface.
 *
 * Usage:
 *   import { collection, custody, isMockMode } from "@/lib/api";
 *
 * Formatting helpers for weights and identifiers live in "@/lib/formatters".
 */
export { ApiError, createApiClient, type ApiClient } from "./client";
export { getApiConfig, describeApiMode, type ApiConfig } from "./config";
export { mockSession } from "./mock/mock-api";
export { isMockMode, mockSession as session, apiConfig } from "./services";
export * from "./services";
export * from "./types";
export * from "./formatters";
