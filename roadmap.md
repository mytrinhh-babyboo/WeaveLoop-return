# WeaveLoop Build Roadmap

Source of truth: uploaded Master Prompt (`MASTER_PROMPT_-_WEAVELOOP_PLATFORM_pasted.md`).
Scope for this workspace: WeaveLoop frontend operations platform in Lovable (TanStack Start), with a
typed API client targeting the existing NestJS backend and a clearly-labeled mock fallback mode.

## Stage 1 — Repository audit
- [x] Audit attempt on `mytrinhh-babyboo/WeaveLoop` (staging) — **blocked**: repo returns HTTP 404 (private/renamed). Waiting on repo access or an archive export from the user.

## Stage 2 — Foundation (done)
- [x] Environment config & typed API client (`src/lib/api/`): base URL via `VITE_API_BASE_URL`, credentials: 'include', bearer support, domain services, `VITE_USE_MOCK_API=true` mock fallback
- [x] Realistic demo dataset (clearly labeled demo) matching documented schema/enum values
- [x] Design tokens in `src/styles.css` (teal #0F766E primary, slate secondary, 8px spacing, Inter font, dark sidebar)
- [x] AppShell: responsive Sidebar, Topbar (org switcher, breadcrumbs, demo/live data badge)
- [x] Reusable components: StatCard, DataTable, StatusBadge, WeightDisplay, EvidenceViewer, Timeline, MassBalance, QRDisplay, EmptyState/ErrorState, PermissionGate, DataModeBadge

## Stage 3 — Primary operational views (done)
- [x] Operations Dashboard: KPI cards (distinct stage metrics), action center, material flow, collection volume chart, date range, data provenance line
- [x] Collection Operations: Collection Points (+create), Collection Bags (+issue), Bag detail (QR, timelines, transfer initiation), Weighing Events (+record with idempotency + gram precision), QR Bag Lookup (lookup-only)
- [x] Custody & Transfers: list + filters, detail sheet with timeline, acknowledge accept/reject (note required on reject)
- [x] Warehouse Intake & Sorting: receipts (+record, one per bag, custody must be accepted), sorting records (+record, exact mass balance), mass-balance visualization, unsorted-receipt warnings
- [x] Material Lots & Lineage: lot table (+split/+merge with exact conservation), lineage graph (zoom/pan/select), mass conservation per operation
- [x] EPR Drafts & Evidence Review: drafts (+create with eligibility rules), draft detail (MRV trace view, mass consistency, evidence hygiene, review history), review form with separation-of-duties, Evidence Review center (scan vs human review separation)

## Stage 4 — Quality (done)
- [x] Business-rule tests: weight formatting, tenant isolation, weighing idempotency, mass balance, EPR validation, separation of duties, infected-document rule (`src/test/api-mock.test.ts`) — 16/16 passing
- [x] Typecheck clean, production build OK
- [x] Playwright verification: dashboard, all list pages, bag detail + QR, weighing flow (validation toast + successful recording on active bag), custody sheet, lot lineage detail, EPR draft detail (MRV trace, mass consistency, evidence hygiene), evidence review — no page errors
- [x] Integration report delivered in chat

## Recovery — October 27, 2026
- [x] Continue: add source-order initialization safeguard for the confirmed circular client chunk error; automated build and 22 tests pass. Preview opens without page errors; also correct material-flow bar colors.
- [ ] Verify the startup safeguard on the published site — requires publishing the updated version; existing published version still reports the error.
- [x] Recover prior conversation and inspect the existing checkpoint without resetting completed work
- [x] Fix confirmed integration safeguards: no demo session in live mode, no build-time bearer secret, explicit invalid-JSON errors, SSR-safe absolute request URLs
- [x] Re-run all tests (22 passing), verify point creation and organization isolation in demo, check operational pages and mobile navigation; automated build OK
- [x] Complete leaf-page sharing metadata and close the mobile drawer after navigation


## Deferred (backend-gated, per Master Prompt)
- [ ] Real NestJS connection — needs reachable backend URL (`VITE_API_BASE_URL`) and repo access to verify exact endpoint/DTO contracts; blocked by the 404 above
- [ ] Live login/session, memberships, partners management and logout — blocked by missing verified identity/API contracts; live operational views intentionally withheld rather than using demo permissions
- [ ] MRV manifest persistence (backend feature under active development — UI panel reserved)
- [ ] Trust & Intelligence module (future; must be labeled prototype)
- [ ] Scanner admin page (admin-only, endpoints not exposed)
- [ ] GitHub PR into `staging` (git push unavailable here; deliver source instead)
