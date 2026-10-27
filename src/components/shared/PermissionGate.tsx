import type { ReactNode } from "react";
import { useAppSession } from "@/lib/app-session";
import type { Role } from "@/lib/api/types";

const WRITE_ROLES: Role[] = ["OWNER", "ADMIN", "OPERATOR"];
const REVIEW_ROLES: Role[] = ["OWNER", "ADMIN", "AUDITOR"];

export type Capability = "view" | "write" | "review";

export function can(capability: Capability, role: Role): boolean {
  if (role === "VIEWER") return capability === "view";
  if (capability === "view") return true;
  if (capability === "write") return WRITE_ROLES.includes(role);
  return REVIEW_ROLES.includes(role);
}

/**
 * PermissionGate renders children only when the active role permits the
 * capability. Frontend gating is UX, not authorization — the backend enforces
 * the same rules.
 */
export function PermissionGate({
  capability,
  fallback = null,
  children,
}: {
  capability: Capability;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { role } = useAppSession();
  if (!can(capability, role)) return <>{fallback}</>;
  return <>{children}</>;
}

export function DisabledWithReason({ capability, children }: { capability: Capability; children: ReactNode }) {
  const { role } = useAppSession();
  if (can(capability, role)) return <>{children}</>;
  return (
    <span title={`Your role (${role}) is not permitted to perform this action`} className="cursor-not-allowed">
      {children}
    </span>
  );
}
