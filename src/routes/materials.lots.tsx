import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout route: the lots list lives at /materials/lots (index leaf), lineage detail at /materials/lots/$lotId. */
export const Route = createFileRoute("/materials/lots")({
  component: Outlet,
});
