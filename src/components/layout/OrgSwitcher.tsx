import { Check, ChevronsUpDown, LogOut, Settings, UserCircle2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppSession } from "@/lib/app-session";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  OPERATOR: "Operator",
  AUDITOR: "Auditor",
  VIEWER: "Viewer",
};

export function OrgSwitcher() {
  const { memberships, activeOrg, activeOrgId, setActiveOrgId, user } = useAppSession();


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm font-medium hover:bg-accent"
          aria-label="Switch organization"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded bg-primary-soft text-primary-dark text-[10px] font-bold">
            {activeOrg?.organization.code.slice(0, 3) ?? "—"}
          </span>
          <span className="hidden max-w-[200px] truncate sm:block">{activeOrg?.organization.name ?? "No organization"}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => (
          <DropdownMenuItem key={m.organizationId} onClick={() => setActiveOrgId(m.organizationId)} className="gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary-soft text-primary-dark text-[10px] font-bold">
              {m.organization.code.slice(0, 3)}
            </span>
            <span className="flex-1 truncate">{m.organization.name}</span>
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", m.organizationId === activeOrgId ? "bg-primary-soft text-primary-dark" : "bg-muted text-muted-foreground")}>
              {ROLE_LABEL[m.role]}
            </span>
            {m.organizationId === activeOrgId ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2 font-normal">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-secondary text-secondary-foreground text-[10px]">
              {user.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserCircle2 className="mr-2 h-4 w-4" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Settings className="mr-2 h-4 w-4" /> Organization settings
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
