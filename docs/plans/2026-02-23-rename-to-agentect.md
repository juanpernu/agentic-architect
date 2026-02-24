# Rename to Agentect — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all user-visible "ObraLink" and "Architech" branding with "Agentect" across UI, metadata, and documentation.

**Architecture:** Cosmetic rename only — no npm scope changes, no import changes. Two code files change (layout + sidebar), one config (root package.json), and ~15 documentation files get find-and-replace.

**Tech Stack:** Next.js (layout/sidebar), Markdown docs

---

### Task 1: Rename UI branding in sidebar

**Files:**
- Modify: `apps/web/components/sidebar.tsx:42`

**Step 1: Update the h1 text**

Change line 42 from:
```tsx
<h1 className="text-xl font-bold">Architech</h1>
```
to:
```tsx
<h1 className="text-xl font-bold">Agentect</h1>
```

**Step 2: Verify no other "Architech" branding in sidebar**

Run: `grep -n "Architech\|ObraLink" apps/web/components/sidebar.tsx`
Expected: No matches

**Step 3: Commit**

```bash
git add apps/web/components/sidebar.tsx
git commit -m "feat: rename sidebar branding to Agentect"
```

---

### Task 2: Rename metadata in layout

**Files:**
- Modify: `apps/web/app/layout.tsx:13`

**Step 1: Update the metadata title**

Change line 13 from:
```tsx
title: 'Architech',
```
to:
```tsx
title: 'Agentect',
```

**Step 2: Verify no other branding in layout**

Run: `grep -n "Architech\|ObraLink" apps/web/app/layout.tsx`
Expected: No matches

**Step 3: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat: rename page title metadata to Agentect"
```

---

### Task 3: Rename root package.json

**Files:**
- Modify: `package.json:2`

**Step 1: Update the name field**

Change line 2 from:
```json
"name": "architech",
```
to:
```json
"name": "agentect",
```

**Step 2: Commit**

```bash
git add package.json
git commit -m "chore: rename root workspace to agentect"
```

---

### Task 4: Rename in docs/CONTEXT.md

**Files:**
- Modify: `docs/CONTEXT.md`

**Step 1: Replace all occurrences**

Apply these replacements throughout the file:
- `ObraLink (Architech)` → `Agentect`
- `ObraLink` → `Agentect`
- `**Architech**` → `**Agentect**` (only when not preceded by `@`)

**Step 2: Verify**

Run: `grep -n "ObraLink\|[^@]Architech" docs/CONTEXT.md`
Expected: No matches (only `@architech` references should remain, if any)

**Step 3: Commit**

```bash
git add docs/CONTEXT.md
git commit -m "docs: rename ObraLink/Architech to Agentect in CONTEXT.md"
```

---

### Task 5: Rename in all docs/plans/*.md files

**Files (15 files):**
- Modify: `docs/2026-02-16-obralink-mvp-design.md`
- Modify: `docs/plans/2026-02-16-obralink-design.md`
- Modify: `docs/plans/2026-02-16-obralink-implementation.md`
- Modify: `docs/plans/2026-02-16-obralink-implementation-v2.md`
- Modify: `docs/plans/2026-02-16-user-schema-improvements.md`
- Modify: `docs/plans/2026-02-16-ux-polish-design.md`
- Modify: `docs/plans/2026-02-17-bank-accounts-design.md`
- Modify: `docs/plans/2026-02-17-clerk-org-seed-design.md`
- Modify: `docs/plans/2026-02-18-pricing-subscription-design.md`
- Modify: `docs/plans/2026-02-18-pricing-subscription.md`
- Modify: `docs/plans/2026-02-18-reports-cost-center-design.md`
- Modify: `docs/plans/2026-02-19-presupuestos-design.md`
- Modify: `docs/plans/2026-02-19-presupuestos.md`
- Modify: `docs/plans/2026-02-20-administration-module.md`

**Step 1: Replace in all files**

For each file, apply:
- `ObraLink` → `Agentect` (all occurrences)
- `obralink` → `agentect` (all occurrences, case-insensitive)
- `Architech` → `Agentect` (only when NOT preceded by `@`)

Important: Do NOT touch `@architech` in any import or package reference that may appear in code blocks inside docs.

**Step 2: Verify**

Run: `grep -rn "ObraLink" docs/plans/ docs/2026-02-16-obralink-mvp-design.md`
Run: `grep -rn "[^@]Architech" docs/plans/`
Expected: No matches outside of the design doc for this rename itself

**Step 3: Commit**

```bash
git add docs/plans/*.md docs/2026-02-16-obralink-mvp-design.md
git commit -m "docs: rename all ObraLink/Architech references to Agentect in plans"
```

---

### Task 6: Update MEMORY.md

**Files:**
- Modify: `/Users/juanpernu/.claude/projects/-Users-juanpernu-Workspace-agentic-architect/memory/MEMORY.md`

**Step 1: Replace project name**

- `ObraLink` → `Agentect`
- `Architech` → `Agentect` (only standalone, not `@architech`)

**Step 2: Save — no git commit needed (memory dir is outside repo)**

---

### Task 7: Final verification

**Step 1: Search for any remaining ObraLink references**

Run: `grep -rn "ObraLink" --include="*.tsx" --include="*.ts" --include="*.md" --include="*.json" .`
Expected: Only in `package-lock.json` (if any) and the rename design doc itself

**Step 2: Search for standalone Architech references**

Run: `grep -rn "Architech" --include="*.tsx" --include="*.ts" --include="*.md" . | grep -v "@architech" | grep -v "rename-to-agentect"`
Expected: No matches

**Step 3: Verify app builds**

Run: `npm run build`
Expected: Build succeeds
