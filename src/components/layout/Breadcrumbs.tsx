import { Link, useRouterState } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Fragment } from "react";

const LABELS: Record<string, string> = {
  collection: "Collection",
  points: "Collection Points",
  bags: "Collection Bags",
  weighing: "Weighing Events",
  qr: "QR Bag Lookup",
  custody: "Custody Transfers",
  warehouse: "Warehouse",
  receipts: "Warehouse Receipts",
  sorting: "Sorting Records",
  materials: "Materials",
  lots: "Material Lots",
  recycling: "Recycling",
  documents: "Evidence Review",
  epr: "EPR & MRV",
  drafts: "EPR Drafts",
};

export function Breadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((seg, i) => {
    const path = "/" + segments.slice(0, i + 1).join("/");
    const isId = /^[a-z]+_[a-z0-9]+$/.test(seg) || /^BAG-|^LOT-|^RR-|^EPR-/.test(seg);
    const label = isId ? seg : LABELS[seg] ?? seg.replaceAll("-", " ");
    return { path, label };
  });

  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/">Overview</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {crumbs.map((crumb, i) => (
          <Fragment key={crumb.path}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {i === crumbs.length - 1 ? (
                <BreadcrumbPage className="max-w-[240px] truncate">{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={crumb.path}>{crumb.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
