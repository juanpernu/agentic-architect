# FAB (Floating Action Button) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Material-style speed dial FAB on mobile to give quick access to all creation actions.

**Architecture:** Standalone client component mounted in the dashboard layout. Navigation-only — the FAB navigates to pages with `?create=true` query param, and each page reads it to auto-open its create dialog. No inline dialogs in the FAB itself.

**Tech Stack:** React 19, Next.js 15 (App Router), Tailwind CSS, Lucide icons, `usePathname`/`useSearchParams` from `next/navigation`.

---

### Task 1: Create FloatingActionButton component

**Files:**
- Create: `apps/web/components/floating-action-button.tsx`

**Step 1: Create the component file**

```tsx
'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  Sparkles,
  FolderKanban,
  Calculator,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const FAB_ACTIONS = [
  { label: 'Ingreso', icon: TrendingUp, href: '/administration/incomes?create=true' },
  { label: 'Egreso', icon: TrendingDown, href: '/administration/expenses?create=true' },
  { label: 'Presupuesto', icon: Calculator, href: '/budgets?create=true' },
  { label: 'Proyecto', icon: FolderKanban, href: '/projects?create=true' },
  { label: 'Comprobante', icon: Sparkles, href: '/upload' },
] as const;

const HIDDEN_PATTERNS = ['/upload', '/receipts/', '/settings/billing'];

export function FloatingActionButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isHidden = HIDDEN_PATTERNS.some((p) =>
    p.endsWith('/') ? pathname.startsWith(p) : pathname === p
  );

  if (isHidden) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 md:hidden">
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 -z-10"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Speed dial actions */}
      <div className="flex flex-col-reverse items-end gap-3 mb-3">
        {FAB_ACTIONS.map((action, i) => (
          <Link
            key={action.label}
            href={action.href}
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-3 transition-all duration-200',
              open
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4 pointer-events-none'
            )}
            style={{
              transitionDelay: open ? `${i * 50}ms` : '0ms',
            }}
          >
            <span className="bg-card text-card-foreground text-sm font-medium px-3 py-1.5 rounded-full shadow-lg border border-border whitespace-nowrap">
              {action.label}
            </span>
            <span className="w-10 h-10 rounded-full bg-card text-foreground shadow-lg border border-border flex items-center justify-center shrink-0">
              <action.icon className="h-5 w-5" />
            </span>
          </Link>
        ))}
      </div>

      {/* Main FAB button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg',
          'flex items-center justify-center transition-transform duration-200',
          'hover:shadow-xl active:scale-95',
          open && 'rotate-45'
        )}
        aria-label={open ? 'Cerrar menú rápido' : 'Abrir menú rápido'}
        aria-expanded={open}
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
```

**Step 2: Verify component compiles**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to `floating-action-button.tsx`

**Step 3: Commit**

```bash
git add apps/web/components/floating-action-button.tsx
git commit -m "feat: add FloatingActionButton speed dial component"
```

---

### Task 2: Mount FAB in dashboard layout

**Files:**
- Modify: `apps/web/app/(dashboard)/layout.tsx`

**Step 1: Add FAB import and render it**

Add import at the top (after existing imports):

```tsx
import { FloatingActionButton } from '@/components/floating-action-button';
```

Add `<FloatingActionButton />` inside the outermost `<div>`, after the `<Toaster>`:

```tsx
        <Toaster position="bottom-right" options={{ fill: '#000000' }} />
        <FloatingActionButton />
```

**Note:** `layout.tsx` is a server component, but since `FloatingActionButton` is marked `'use client'`, Next.js will render it as a client component island — no changes needed to the layout's server nature.

**Step 2: Verify build compiles**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/layout.tsx
git commit -m "feat: mount FloatingActionButton in dashboard layout"
```

---

### Task 3: Read `?create=true` in projects page

**Files:**
- Modify: `apps/web/app/(dashboard)/projects/page.tsx`

**Context:** The projects page uses `const [showCreateDialog, setShowCreateDialog] = useState(false);` on line 49. We need to read `?create=true` from the URL and auto-open the dialog.

**Step 1: Add `useSearchParams` and effect**

Add `useSearchParams` to the existing `next/navigation` imports (or add the import if not present):

```tsx
import { useSearchParams } from 'next/navigation';
```

Inside `ProjectsPage()`, after the existing `useState` declarations (after line 49), add:

```tsx
  const searchParams = useSearchParams();

  // Auto-open create dialog from FAB navigation
  useState(() => {
    if (searchParams.get('create') === 'true') {
      setShowCreateDialog(true);
    }
  });
```

**Important:** We use `useState` with an initializer (not `useEffect`) so it runs once on mount synchronously without needing a dependency array. This avoids a flash. Alternative: use `useEffect` with empty deps.

Actually, let's use the simpler and cleaner approach — initialize the state from the search param directly:

Replace line 49:
```tsx
  const [showCreateDialog, setShowCreateDialog] = useState(false);
```

With:
```tsx
  const searchParams = useSearchParams();
  const [showCreateDialog, setShowCreateDialog] = useState(
    searchParams.get('create') === 'true'
  );
```

**Step 2: Verify build compiles**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/projects/page.tsx
git commit -m "feat: auto-open create dialog from ?create=true on projects page"
```

---

### Task 4: Read `?create=true` in budgets page

**Files:**
- Modify: `apps/web/app/(dashboard)/budgets/page.tsx`

**Context:** The budgets page uses `const [showCreateDialog, setShowCreateDialog] = useState(false);` on line 30.

**Step 1: Add `useSearchParams` and initialize state from it**

Add import:
```tsx
import { useSearchParams } from 'next/navigation';
```

Note: `useRouter` is already imported from `next/navigation` on line 3, so just add `useSearchParams` to that import:
```tsx
import { useRouter, useSearchParams } from 'next/navigation';
```

Replace line 30:
```tsx
  const [showCreateDialog, setShowCreateDialog] = useState(false);
```

With:
```tsx
  const searchParams = useSearchParams();
  const [showCreateDialog, setShowCreateDialog] = useState(
    searchParams.get('create') === 'true'
  );
```

**Step 2: Verify build compiles**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/budgets/page.tsx
git commit -m "feat: auto-open create dialog from ?create=true on budgets page"
```

---

### Task 5: Read `?create=true` in expenses page

**Files:**
- Modify: `apps/web/app/(dashboard)/administration/expenses/page.tsx`

**Context:** The expenses page uses `const [formOpen, setFormOpen] = useState(false);` on line 45. Note the different variable name (`formOpen` not `showCreateDialog`).

**Step 1: Add `useSearchParams` and initialize state from it**

Add import:
```tsx
import { useSearchParams } from 'next/navigation';
```

Replace line 45:
```tsx
  const [formOpen, setFormOpen] = useState(false);
```

With:
```tsx
  const searchParams = useSearchParams();
  const [formOpen, setFormOpen] = useState(
    searchParams.get('create') === 'true'
  );
```

**Step 2: Verify build compiles**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/administration/expenses/page.tsx
git commit -m "feat: auto-open create dialog from ?create=true on expenses page"
```

---

### Task 6: Read `?create=true` in incomes page

**Files:**
- Modify: `apps/web/app/(dashboard)/administration/incomes/page.tsx`

**Context:** The incomes page uses `const [formOpen, setFormOpen] = useState(false);` on line 42. Same pattern as expenses.

**Step 1: Add `useSearchParams` and initialize state from it**

Add import:
```tsx
import { useSearchParams } from 'next/navigation';
```

Replace line 42:
```tsx
  const [formOpen, setFormOpen] = useState(false);
```

With:
```tsx
  const searchParams = useSearchParams();
  const [formOpen, setFormOpen] = useState(
    searchParams.get('create') === 'true'
  );
```

**Step 2: Verify build compiles**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/administration/incomes/page.tsx
git commit -m "feat: auto-open create dialog from ?create=true on incomes page"
```

---

### Task 7: Final verification

**Step 1: Run full TypeScript check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

**Step 2: Run build**

Run: `cd apps/web && npm run build`
Expected: Build succeeds

**Step 3: Commit any remaining changes (if any)**

If clean, no commit needed.
