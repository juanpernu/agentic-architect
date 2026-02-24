# Mobile Navigation Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the bottom tab navigation on mobile with a hamburger menu top bar + slide-in sidebar using Shadcn Sheet.

**Architecture:** Extract sidebar nav content into a shared `SidebarContent` component. Create a new `MobileHeader` client component with a sticky top bar (hamburger + dynamic title + Clerk UserButton) that opens a Sheet with the shared sidebar content. Remove BottomNav entirely and update the dashboard layout.

**Tech Stack:** Next.js App Router, Tailwind CSS, Shadcn/ui Sheet, Clerk UserButton, Lucide icons

---

### Task 1: Extract SidebarContent from Sidebar

**Files:**
- Modify: `apps/web/components/sidebar.tsx`

**Step 1: Extract the nav items array and SidebarContent**

Refactor `sidebar.tsx` to export the `navItems` array and a new `SidebarContent` component that renders the nav links and user section. The existing `Sidebar` component wraps `SidebarContent` in the desktop `<aside>`.

Replace the entire file with:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, Sparkles, Calculator, BarChart3, Landmark, Settings } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/use-current-user';
import { usePlan } from '@/lib/use-plan';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/role-constants';
import { Badge } from '@/components/ui/badge';

export const navItems: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
}> = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Proyectos', icon: FolderKanban },
  { href: '/upload', label: 'Escanear comprobante', icon: Sparkles },
  { href: '/budgets', label: 'Presupuestos', icon: Calculator },
  { href: '/administration', label: 'Administración', icon: Landmark, roles: ['admin', 'supervisor'] },
  { href: '/reports', label: 'Reportes', icon: BarChart3, roles: ['admin', 'supervisor'] },
  { href: '/settings', label: 'Ajustes', icon: Settings },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { role, fullName } = useCurrentUser();
  const { isFreePlan } = usePlan();

  const visibleNavItems = navItems.filter((item) => {
    if (item.href === '/reports' && isFreePlan) return false;
    if (item.roles && !item.roles.includes(role)) return false;
    return true;
  });

  return (
    <>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <UserButton />
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-sm font-medium truncate" title={fullName}>{fullName}</span>
            <Badge
              variant="secondary"
              className={cn('w-fit text-xs', ROLE_COLORS[role])}
            >
              {ROLE_LABELS[role]}
            </Badge>
          </div>
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-background">
      <div className="flex h-16 items-center px-6 border-b">
        <h1 className="text-xl font-bold">Agentect</h1>
      </div>
      <SidebarContent />
    </aside>
  );
}
```

Key changes:
- `navItems` is now exported (needed by MobileHeader for title mapping)
- `SidebarContent` is a new exported component with optional `onNavigate` callback
- `onNavigate` is called on every Link click (used by Sheet to auto-close)
- `Sidebar` now wraps `SidebarContent` — no behavior change on desktop

**Step 2: Verify build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add apps/web/components/sidebar.tsx
git commit -m "refactor: extract SidebarContent for reuse in mobile nav"
```

---

### Task 2: Create MobileHeader component

**Files:**
- Create: `apps/web/components/mobile-header.tsx`

**Step 1: Create the MobileHeader component**

Create `apps/web/components/mobile-header.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { SidebarContent, navItems } from '@/components/sidebar';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

function usePageTitle() {
  const pathname = usePathname();
  const match = navItems.find(
    (item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
  );
  return match?.label ?? 'Agentect';
}

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const title = usePageTitle();

  return (
    <div className="sticky top-0 z-40 flex items-center gap-4 border-b bg-background px-4 py-3 md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="-m-2 p-2 text-muted-foreground"
        aria-label="Abrir menú"
      >
        <Menu className="h-6 w-6" />
      </button>

      <div className="flex-1 text-sm font-semibold">{title}</div>

      <UserButton />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" showCloseButton={true} className="w-72 p-0">
          <VisuallyHidden>
            <SheetTitle>Menú de navegación</SheetTitle>
          </VisuallyHidden>
          <div className="flex h-16 items-center px-6 border-b">
            <h1 className="text-xl font-bold">Agentect</h1>
          </div>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

Key details:
- `usePageTitle()` hook maps current pathname to nav item label, falls back to "Agentect"
- `Sheet` with `side="left"` slides sidebar in from the left
- `onNavigate={() => setOpen(false)}` closes the sheet when a link is clicked
- `VisuallyHidden` wraps `SheetTitle` for accessibility (Radix requires a title)
- `md:hidden` hides the entire header on desktop
- Hamburger button has `aria-label` for accessibility
- `UserButton` from Clerk shows the user avatar on the right

**Step 2: Verify build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/components/mobile-header.tsx
git commit -m "feat: add MobileHeader with hamburger menu and sidebar sheet"
```

---

### Task 3: Update dashboard layout and remove BottomNav

**Files:**
- Modify: `apps/web/app/(dashboard)/layout.tsx`
- Delete: `apps/web/components/bottom-nav.tsx`

**Step 1: Update the dashboard layout**

Replace `apps/web/app/(dashboard)/layout.tsx` with:

```tsx
import { ClerkProvider } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { MobileHeader } from '@/components/mobile-header';
import { Toaster } from 'sileo';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <ClerkProvider>
      <div className="min-h-screen">
        <Sidebar />
        <MobileHeader />
        <main className="md:pl-64 min-h-screen bg-slate-50/50 dark:bg-background">
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
        <Toaster position="bottom-right" options={{ fill: '#000000' }} />
      </div>
    </ClerkProvider>
  );
}
```

Changes:
- Replaced `BottomNav` import with `MobileHeader` import
- Replaced `<BottomNav />` with `<MobileHeader />`
- Removed `pb-16 md:pb-0` from `<main>` (no more bottom nav padding needed)

**Step 2: Delete bottom-nav.tsx**

Delete the file `apps/web/components/bottom-nav.tsx` — it is no longer used anywhere.

**Step 3: Verify no other imports of BottomNav**

Run: `grep -rn "bottom-nav\|BottomNav" apps/web/`
Expected: No matches

**Step 4: Verify build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add apps/web/app/\(dashboard\)/layout.tsx apps/web/components/mobile-header.tsx
git rm apps/web/components/bottom-nav.tsx
git commit -m "feat: replace bottom nav with mobile header hamburger menu"
```

---

### Task 4: Final verification

**Step 1: Full build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 2: Verify no dead imports**

Run: `grep -rn "bottom-nav\|BottomNav" apps/web/`
Expected: No matches

**Step 3: Verify mobile header is only visible on mobile**

Check that `mobile-header.tsx` has `md:hidden` on its root element.
Check that `sidebar.tsx` still has `hidden md:flex` on the `<aside>`.
