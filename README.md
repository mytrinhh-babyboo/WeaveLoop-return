# Weave Loop Return

Build the WeaveLoop circular packaging reverse-logistics frontend operations platform based on the uploaded Master Prompt.

Set up:
1. Environment configuration and typed API client architecture (`lib/api/`):
   - Configurable base URL defaulting to `VITE_API_BASE_URL` (with fallback to `http://localhost:4000/api` or `/api` via proxy)
   - Support for credentialed requests (`credentials: 'include'` for HttpOnly cookies) and bearer token support when configured
   - Modular typed API services matching WeaveLoop domains: Auth & Organizations, Collection Points & Bags, Weighing, Custody Transfers, Warehouse & Sorting, Material Lots & Lineage, Recycler Receipts, Evidence & Reviews, EPR Drafts & MRV
   - Realistic mock fallback mode (`VITE_USE_MOCK_API=true` toggle) so the entire platform is immediately browsable and interactive when the external NestJS instance is offline, while switching cleanly to real HTTP calls when connected.
2. Enterprise design system & layout (AppShell, responsive Sidebar, Topbar with Org Switcher, Breadcrumbs, StatCard, DataTable, StatusBadge, EvidenceViewer, WeightDisplay).
3. Primary operational views:
   - Operations Dashboard with KPI cards, action center, and material flow
   - Collection Operations (Collection Points, Bags, Weighing Events, QR scanning flow)
   - Custody & Transfers
   - Warehouse Intake & Sorting
   - Material Lots & Lineage
   - EPR Drafts & Evidence Review center

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://weave-loop-return.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1c92ad9d-a3f6-41d4-88d6-fd7103a279f9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
