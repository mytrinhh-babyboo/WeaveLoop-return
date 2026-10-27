import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "@/lib/api/client";
import { getApiConfig } from "@/lib/api/config";

afterEach(() => vi.unstubAllGlobals());

describe("external API integration safeguards", () => {
  it("does not load a bearer secret from public build configuration", () => {
    vi.stubEnv("VITE_API_BEARER_TOKEN", "unsafe-build-time-token");
    try {
      expect(getApiConfig().bearerToken).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("rejects a missing proxy's HTML rather than fabricating API success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<!DOCTYPE html><html></html>", { status: 200 })));
    const client = createApiClient({ baseUrl: "/api", useMock: false, credentials: "include", orgHeaderName: "X-Organization-Id" });
    await expect(client.get("/collection-bags")).rejects.toMatchObject({ code: "server_error" });
  });

  it("preserves credentialed requests, organization context and exact grams", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ weightGrams: 12453 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient({ baseUrl: "https://api.example.test/api", useMock: false, credentials: "include", orgHeaderName: "X-Organization-Id", bearerToken: "runtime-user-token" });
    await expect(client.post("/weighing-events", { body: { weightGrams: 12453 }, organizationId: "org_0001", idempotencyKey: "reading-1" })).resolves.toEqual({ weightGrams: 12453 });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/api/weighing-events", expect.objectContaining({
      credentials: "include", body: '{"weightGrams":12453}',
      headers: expect.objectContaining({ "X-Organization-Id": "org_0001", "Idempotency-Key": "reading-1", Authorization: "Bearer runtime-user-token" }),
    }));
  });

  it("allows absolute API URLs without evaluating browser globals", async () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 })));
    const client = createApiClient({ baseUrl: "https://api.example.test/api", useMock: false, credentials: "include", orgHeaderName: "X-Organization-Id" });
    await expect(client.get("/health")).resolves.toEqual({ ok: true });
  });
});