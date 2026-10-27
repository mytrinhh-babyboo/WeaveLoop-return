# AGENTS.md

## Architecture

- **API layer**: `src/lib/api/` is the only place that talks to the backend. `config.ts` resolves `VITE_API_BASE_URL` (fallback `/api` proxy), `client.ts` is the typed fetch wrapper (cookie sessions via `credentials: "include"`, optional bearer, org context header), `services.ts` maps domain operations to real endpoints, `mock/` holds the demo dataset + mock handlers. Why: the platform targets an external NestJS backend that may be offline; `VITE_USE_MOCK_API=true` keeps the whole UI browsable while keeping real HTTP one toggle away.
- **Weights**: stored/transmitted in exact grams (integers). Display converts in `lib/api/formatters.ts` only — never round before sending. Why: Master Prompt requirement for operational accuracy.
- **Routes**: TanStack Start file-based routes in `src/routes/`, one file per view; AppShell (sidebar/topbar/org switcher) wraps everything in `__root.tsx`. Why: enterprise IA per Master Prompt §5.
- **Session**: `src/lib/app-session.tsx` mounts demo identity only in mock mode; live mode blocks operational views until the NestJS identity and membership contract is verified. Why: demo permissions must never masquerade as an authenticated session. Never store JWTs in localStorage.
- **API safety**: bearer support accepts runtime user tokens only, not VITE environment secrets; successful non-JSON responses fail explicitly. Why: build-time environment values are public and a missing proxy may return frontend HTML instead of API data.
- **Data provenance**: `DataModeBadge` in the topbar always shows whether the user sees demo data or live API data; dashboard footers repeat the source, range and generation time. Why: honest reporting is a core product principle.
- **Compliance wording**: internal review decisions must never be labeled as regulatory approval; infected documents can never be accepted as evidence. Enforced in mock handlers and mirrored in UI copy.
- **Bundling**: Preserve source execution order with Rolldown `strictExecutionOrder`. Why: shared query/session/API chunks form a production cycle that otherwise initializes query observer subclasses before their base class.

## Notes

- The uploaded Master Prompt references a Next.js frontend in the original repository; this workspace is TanStack Start by platform constraint, so the domain/feature architecture is preserved but the framework layer differs.
- `mem://` project memory: business rules (grams, roles, review restrictions) are recorded in code comments and tests; revisit if the user states new operational rules.
