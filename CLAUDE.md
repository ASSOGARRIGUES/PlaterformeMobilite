# Context

## What this project is

**Plateforme Mobilité** is a vehicle fleet management tool originally for social association **Garrigues**.

**Garrigues** supports vulnerable populations and runs solidarity garages offering free/subsidised repairs and vocational training in auto mechanics and lend vehicles to beneficiaries.

This platform manages that lending: tracking the fleet, beneficiary records, rental contracts, and payments, with PDF generation for rental contracts and bills.

Stack: Django 5 + DRF backend, React 18 + TypeScript + Refine + Mantine frontend, PostgreSQL in production. See `README.md` for dev commands.

## Architecture

### Multi-tenancy via "Actions"

The central concept is the **Action** model (`core/models.py`). An Action represents an organizational unit (e.g., "Garrigues", "En Chemin"). Every user belongs to one or more Actions and has a `current_action` (active context). Every Vehicle, Beneficiary, and Contract is scoped to an Action.

All API querysets filter by `request.user.current_action` — a user only sees data for their currently selected action. The frontend (`context/UserActionsProvider.tsx`) stores the active action and invalidates all resource caches when the user switches.

### Backend (`backend/`)

- **`core/`** — Custom `User` model (email as username) and the `Action` model.
- **`api/`** — Main business logic: `Vehicle`, `Beneficiary`, `Contract`, `Payment`, `Parking` models and DRF viewsets.
- **`bugtracker/`** — In-app bug/feature reporting. New bugs email admins; closed bugs email the reporter.
- **`inappcom/`** — `InAppBroadcast` messages shown to all users on login via a modal.

**`ArchivableModelViewSet`** (`api/views.py`) is the base for Vehicle, Beneficiary, and Contract viewsets. It adds `archive`/`unarchive`/`get_archived` actions, filters archived records from list views by default, and cascades archiving to related objects. Each subclass implements `validate_archived()` for business rules (e.g., can't archive a vehicle with unpaid contracts).

**Serializer split**: mutation actions (create/update) use `Mutation*Serializer` with writable FK IDs; read actions use richer serializers with nested objects.

**PDF generation**: `Contract` and `Payment` have `render_*_pdf()` methods using `xhtml2pdf`. Template selection branches on `action.name` — separate templates exist for "Garrigues" vs "En Chemin" (suffixed `_garrigues` / `_en_route`).

**Payments are nested** under contracts: `/api/contract/{contract_pk}/payment/`. After any payment change, `contract.updateIfPaid()` auto-transitions status to `payed` when payments cover the price.

**Contracts can only be deleted within 15 minutes** of creation (`ContractViewSet.destroy()`).

### Frontend (`frontend/src/`)

- **`providers/`** — JWT auth (localStorage), axios data provider (handles token refresh on 401), Refine resource bindings.
- **`context/`** — `UserActionsProvider` (active Action state), `BugReporterProvider` (captures console logs for bug reports).
- **`constants.ts`** — `API_URL` from `BASE_URL` build-time env var; all enum label maps.
- **`types/schema.d.ts`** — Auto-generated from the backend OpenAPI schema. Do not edit manually.

## Dev tools
There is a .venv folder in the root of the project. Use it when running any command in the project.


# Reflection guidelines

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.