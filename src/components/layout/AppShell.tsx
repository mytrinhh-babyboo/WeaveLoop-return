import { Outlet } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "./AppSidebar";
import { OrgSwitcher } from "./OrgSwitcher";
import { Breadcrumbs } from "./Breadcrumbs";
import { DataModeBadge } from "@/components/shared/DataModeBadge";
import { AppSessionProvider } from "@/lib/app-session";

export function AppShell() {
  return (
    <AppSessionProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <SidebarTrigger aria-label="Toggle navigation sidebar" />
            <Separator orientation="vertical" className="h-5" />
            <Breadcrumbs />
            <div className="ml-auto flex items-center gap-2">
              <DataModeBadge />
              <OrgSwitcher />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AppSessionProvider>
  );
}
