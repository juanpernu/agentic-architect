# Unified Zod Validation — Design

**Date:** 2026-02-18
**Status:** Implemented

## Goal

Unify client and API validation using shared Zod schemas. Eliminate duplicated manual validation from API routes, centralize enums/constants, and add missing schemas (bank accounts).

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Approach | Schema-first (shared Zod schemas) | Single source of truth, eliminates duplication |
| Schema location | `apps/web/lib/schemas/` | Already exists, no structural change |
| Constants location | `packages/shared/src/enums.ts` | Already has enums, add missing constants |
| API error language | English | Standard technical pattern |
| Client error language | Spanish | UI-facing, matches app language |

## Architecture

### 1. `validateBody` helper (`apps/web/lib/validate.ts`)

Generic helper that parses JSON and validates against a Zod schema. Returns typed data or a 400 response. Replaces the repetitive try-catch + manual check pattern in every API route.

### 2. Centralized constants

Move duplicated constants to `packages/shared/src/enums.ts`:
- `PROJECT_COLORS` array (currently in `lib/project-colors.ts` and API routes)
- `VALID_CURRENCIES` array (`['ARS', 'USD']`)
- Existing enums (`UserRole`, `ProjectStatus`, `ReceiptStatus`) already cover roles and statuses

### 3. Schemas per entity

Each entity gets create and update schemas in `lib/schemas/`. Update schemas use `.partial()`. Form schemas reuse or extend the create schema.

| Entity | Create Schema | Update Schema | Form Schema |
|--------|--------------|---------------|-------------|
| Organization | — | `organizationUpdateSchema` | `organizationSchema` (exists) |
| Project | `projectCreateSchema` | `projectUpdateSchema` | `projectSchema` (exists) |
| Cost Center | `costCenterCreateSchema` | `costCenterUpdateSchema` | `costCenterSchema` (exists) |
| Bank Account | `bankAccountCreateSchema` | `bankAccountUpdateSchema` | `bankAccountSchema` (NEW) |
| Invitation | `inviteCreateSchema` | — | `inviteSchema` (exists) |
| Receipt | `receiptCreateSchema` | — | `receiptReviewSchema` (exists) |

### 4. API route migration

Each API route replaces inline validation with `validateBody(schema, req)`. Auth checks remain unchanged.

### 5. No changes

- `useFormValidation` hook
- Field UI component
- Client-side error display pattern
- Auth middleware

## Scope

- 1 new file: `lib/validate.ts`
- 1 new schema file: `lib/schemas/bank-account.ts`
- ~6 schema files updated (add create/update variants)
- ~8 API routes migrated
- `packages/shared/src/enums.ts` updated with constants
- `lib/project-colors.ts` removed (moved to shared)
