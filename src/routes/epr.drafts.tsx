import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout route: the drafts list lives at /epr/drafts (index leaf), draft detail at /epr/drafts/$draftId. */
export const Route = createFileRoute("/epr/drafts")({
  component: Outlet,
});
