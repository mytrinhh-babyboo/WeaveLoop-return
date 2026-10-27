import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppSessionProvider, useAppSession } from "@/lib/app-session";

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

function IdentityProbe() {
  const { user, role, activeOrgId } = useAppSession();
  return <output data-testid="identity">{user.fullName}|{role}|{activeOrgId}</output>;
}

describe("session provenance", () => {
  it("retains existing demo identity only in explicit demo mode", () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");
    render(<AppSessionProvider><IdentityProbe /></AppSessionProvider>);
    expect(screen.getByTestId("identity")).toHaveTextContent("ADMIN|org_0001");
  });

  it("never grants demo ADMIN identity when configured for live data", () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/api");
    render(<AppSessionProvider><IdentityProbe /></AppSessionProvider>);
    expect(screen.queryByTestId("identity")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});