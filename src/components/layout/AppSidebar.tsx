import { Link, useRouterState } from "@tanstack/react-router";
import {
  ClipboardList,
  Factory,
  LayoutDashboard,
  Package,
  PackageSearch,
  QrCode,
  Recycle,
  Scale,
  ScanSearch,
  Truck,
  Warehouse,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const NAV: Array<{
  label: string;
  items: Array<{ title: string; to: string; icon: typeof LayoutDashboard }>;
}> = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", to: "/", icon: LayoutDashboard }],
  },
  {
    label: "Collection Operations",
    items: [
      { title: "Collection Points", to: "/collection/points", icon: Factory },
      { title: "Collection Bags", to: "/collection/bags", icon: Package },
      { title: "Weighing Events", to: "/collection/weighing", icon: Scale },
      { title: "QR Bag Lookup", to: "/collection/qr", icon: QrCode },
    ],
  },
  {
    label: "Logistics & Custody",
    items: [{ title: "Custody Transfers", to: "/custody", icon: Truck }],
  },
  {
    label: "Warehouse & Sorting",
    items: [
      { title: "Warehouse Receipts", to: "/warehouse/receipts", icon: Warehouse },
      { title: "Sorting Records", to: "/warehouse/sorting", icon: ScanSearch },
    ],
  },
  {
    label: "Materials",
    items: [{ title: "Material Lots", to: "/materials/lots", icon: PackageSearch }],
  },
  {
    label: "Recycling",
    items: [
      { title: "Recycler Receipts", to: "/recycling/receipts", icon: Recycle },
      { title: "Evidence Review", to: "/recycling/documents", icon: ClipboardList },
    ],
  },
  {
    label: "EPR & MRV",
    items: [{ title: "EPR Drafts", to: "/epr/drafts", icon: ClipboardList }],
  },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="p-4">
        <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
            WL
          </span>
          <span className="group-data-[collapsible=icon]:hidden">
            <span className="block text-sm font-semibold leading-tight text-sidebar-accent-foreground">WeaveLoop</span>
            <span className="block text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Operations</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {NAV.map((group) => {
          const isExpanded = group.items.some((item) => pathname === item.to || pathname.startsWith(item.to + "/") || (item.to !== "/" && pathname.startsWith(item.to)));
          return (
            <SidebarGroup key={group.label}>

              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active = item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(item.to + "/");
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                          <Link to={item.to} onClick={() => { if (isMobile) setOpenMobile(false); }}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
