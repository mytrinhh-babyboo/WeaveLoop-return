import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout route: the bags list lives at /collection/bags (index leaf), detail at /collection/bags/$bagId. */
export const Route = createFileRoute("/collection/bags")({
  component: Outlet,
});
