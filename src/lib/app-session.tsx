/**
 * Application session state.
 *
 * The mock session carries a fixed demo identity with two memberships to
 * demonstrate organization switching and role differences. Live mode is
 * blocked until the external backend's identity contract is verified; it must
 * never reuse demo identity or permissions as a real session.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { mockSession } from "@/lib/api/mock/mock-api";
import type { Membership, Role } from "@/lib/api/types";
import { getApiConfig } from "@/lib/api/config";
import { ShieldAlert } from "lucide-react";

interface AppSessionValue {
  user: { id: string; fullName: string; email: string };
  memberships: Membership[];
  activeOrgId: string;
  activeOrg: Membership | undefined;
  setActiveOrgId: (orgId: string) => void;
  role: Role;
}

const AppSessionContext = createContext<AppSessionValue | null>(null);

export function AppSessionProvider({ children }: { children: ReactNode }) {
  if (!getApiConfig().useMock) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div role="alert" className="max-w-lg space-y-3 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-warning" aria-hidden />
          <h1 className="text-xl font-semibold text-foreground">Live sign-in is not connected</h1>
          <p className="text-sm text-muted-foreground">
            WeaveLoop must verify your account and organization with the existing backend before showing operational records.
            Demo identity and permissions are not used in live mode.
          </p>
        </div>
      </main>
    );
  }
  return <DemoSessionProvider>{children}</DemoSessionProvider>;
}

function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [memberships] = useState<Membership[]>(() => mockApiMemberships());
  const [activeOrgId, setActiveOrgId] = useState<string>(mockSession.activeOrgId);

  const value = useMemo<AppSessionValue>(() => {
    const activeOrg = memberships.find((m) => m.organizationId === activeOrgId);
    return {
      user: { id: mockSession.userId, fullName: mockSession.fullName, email: mockSession.email },
      memberships,
      activeOrgId,
      activeOrg,
      setActiveOrgId,
      role: activeOrg?.role ?? "VIEWER",
    };
  }, [memberships, activeOrgId]);

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

function mockApiMemberships(): Membership[] {
  return mockSessionMembershipCache();
}

let cache: Membership[] | undefined;
function mockSessionMembershipCache(): Membership[] {
  if (!cache) cache = buildMemberships();
  return cache;
}

function buildMemberships(): Membership[] {
  return [
    {
      id: "mem_0001",
      organizationId: "org_0001",
      role: "ADMIN",
      isActive: true,
      createdAt: new Date().toISOString(),
      organization: {
        id: "org_0001",
        name: "Saigon Circular Packaging Co-op",
        code: "SGN-CPC",
        country: "VN",
        createdAt: new Date().toISOString(),
      },
    },
    {
      id: "mem_0002",
      organizationId: "org_0002",
      role: "OPERATOR",
      isActive: true,
      createdAt: new Date().toISOString(),
      organization: {
        id: "org_0002",
        name: "Hanoi Green Loop Collectives",
        code: "HNI-GLC",
        country: "VN",
        createdAt: new Date().toISOString(),
      },
    },
  ];
}

export function useAppSession(): AppSessionValue {
  const ctx = useContext(AppSessionContext);
  if (!ctx) throw new Error("useAppSession must be used within AppSessionProvider");
  return ctx;
}
