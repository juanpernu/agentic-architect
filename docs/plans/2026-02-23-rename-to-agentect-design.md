# Rename App to Agentect — Design

**Date:** 2026-02-23
**Status:** Approved

## Goal

Rename all user-visible branding and documentation from "ObraLink" / "Architech" to **Agentect**.

## Scope

### What changes

| Area | Files | Change |
|------|-------|--------|
| UI branding | `apps/web/components/sidebar.tsx` | h1 text → "Agentect" |
| Metadata/SEO | `apps/web/app/layout.tsx` | title → "Agentect" |
| Root package name | `package.json` | name → "agentect" |
| Documentation | `docs/CONTEXT.md` + all `docs/plans/*.md` | ObraLink/Architech → Agentect |

### What does NOT change

- npm scope `@architech/*` (shared, ai, db packages)
- All TypeScript imports (`from '@architech/...'`)
- `next.config.ts` transpilePackages
- `package-lock.json` (scope stays @architech)
- Internal package.json name fields

## Replacement Rules

| Pattern | Replacement | Condition |
|---------|------------|-----------|
| `ObraLink` | `Agentect` | All occurrences |
| `obralink` | `agentect` | All occurrences (case-insensitive) |
| `Architech` | `Agentect` | Only when NOT preceded by `@` |
| `architech` | `agentect` | Only in root package.json name field |

## Approach

Find & replace global (Approach A) — single pass replacing all branding references while preserving the `@architech` npm scope.
