# Landing Page — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up the technical scaffolding for a marketing landing page at `/` with a `(marketing)` route group, auth-aware redirect, and placeholder sections ready for a design agent.

**Architecture:** Create `app/(marketing)/` route group with its own layout (header + footer, light mode only). The landing `page.tsx` is a server component that redirects authenticated users to `/home`. Move the current dashboard `page.tsx` from `/` to `/home` to avoid route conflict. Update Clerk middleware to allow `/` as public.

**Tech Stack:** Next.js App Router, Tailwind CSS 4, Clerk `auth()`, Shadcn/ui Button

---

### Task 1: Update Clerk middleware to allow `/` as public

**Files:**
- Modify: `apps/web/middleware.ts`

**Step 1: Add `/` to the public route matcher**

Replace the entire file with:

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

Only change: added `'/'` as the first entry in the `createRouteMatcher` array.

**Step 2: Verify build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add apps/web/middleware.ts
git commit -m "feat: allow / as public route in Clerk middleware"
```

---

### Task 2: Move dashboard home to `/home`

Both `(marketing)/page.tsx` and `(dashboard)/page.tsx` would resolve to `/`, causing a Next.js route conflict. We fix this by moving the dashboard to `/home`.

**Files:**
- Move: `apps/web/app/(dashboard)/page.tsx` → `apps/web/app/(dashboard)/home/page.tsx`
- Modify: `apps/web/components/sidebar.tsx`

**Step 1: Move the dashboard page**

```bash
mkdir -p apps/web/app/\(dashboard\)/home
git mv apps/web/app/\(dashboard\)/page.tsx apps/web/app/\(dashboard\)/home/page.tsx
```

The file content stays exactly the same — no edits needed. It now serves `/home` instead of `/`.

**Step 2: Update sidebar navItems**

In `apps/web/components/sidebar.tsx`, change the Dashboard nav item from:

```typescript
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
```

To:

```typescript
  { href: '/home', label: 'Dashboard', icon: LayoutDashboard },
```

**Step 3: Search for other `/` references**

Run: `grep -rn "href: '/'" apps/web/ --include='*.tsx' --include='*.ts' | grep -v node_modules | grep -v .next`

Expected: No results (sidebar was the only one).

Also check redirects: `grep -rn "redirect('/')" apps/web/ --include='*.tsx' --include='*.ts' | grep -v node_modules | grep -v .next`

Expected: No results.

**Step 4: Verify build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds. `/home` now serves the dashboard.

**Step 5: Commit**

```bash
git add apps/web/app/\(dashboard\)/home/page.tsx apps/web/components/sidebar.tsx
git rm apps/web/app/\(dashboard\)/page.tsx
git commit -m "refactor: move dashboard from / to /home to free root for landing"
```

---

### Task 3: Create marketing layout

**Files:**
- Create: `apps/web/app/(marketing)/layout.tsx`

**Step 1: Create the marketing layout**

Create `apps/web/app/(marketing)/layout.tsx` with:

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-foreground">
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="text-xl font-bold">
            Agentect
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sign-in">Iniciar sesión</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/sign-up">Empezar gratis</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Agentect. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
```

Key details:
- Server component (no `'use client'`)
- Forces white background (light mode only for marketing)
- Sticky header with backdrop blur, logo + two CTA buttons using existing Shadcn Button
- `Button` with `asChild` + `Link` for proper Next.js routing
- Footer with dynamic copyright year
- `flex flex-col min-h-screen` ensures footer stays at bottom

**Step 2: Verify build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/app/\(marketing\)/layout.tsx
git commit -m "feat: add marketing layout with header and footer"
```

---

### Task 4: Create landing page with auth redirect

**Files:**
- Create: `apps/web/app/(marketing)/page.tsx`

**Step 1: Create the landing page**

Create `apps/web/app/(marketing)/page.tsx` with:

```tsx
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect('/home');

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section id="hero" className="py-20 md:py-32">
        <div className="mx-auto max-w-7xl px-4 md:px-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Gestión de obras con IA
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Cargá comprobantes, armá presupuestos y controlá gastos de tus proyectos de construcción. Todo en un solo lugar.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/sign-up">Empezar gratis</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/sign-in">Iniciar sesión</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features — placeholder for design agent */}
      <section id="features" className="border-t py-20 md:py-32 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-center">
            Todo lo que necesitás para gestionar tus obras
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            Placeholder — el agente de diseño completará esta sección.
          </p>
        </div>
      </section>

      {/* Pricing — placeholder for design agent */}
      <section id="pricing" className="border-t py-20 md:py-32">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-center">
            Planes y precios
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            Placeholder — el agente de diseño completará esta sección.
          </p>
        </div>
      </section>

      {/* CTA — placeholder for design agent */}
      <section id="cta" className="border-t py-20 md:py-32 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 md:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Empezá a gestionar tus obras hoy
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Placeholder — el agente de diseño completará esta sección.
          </p>
          <div className="mt-10">
            <Button size="lg" asChild>
              <Link href="/sign-up">Crear cuenta gratis</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
```

Key details:
- Server component — uses `auth()` from Clerk server SDK
- If authenticated → redirects to `/home` (the dashboard)
- 4 sections with IDs: `hero`, `features`, `pricing`, `cta`
- `features`, `pricing`, `cta` are placeholders for the design agent
- Hero has real copy matching the app's value prop
- Uses existing `Button` with `lg` size and `asChild` + `Link`

**Step 2: Verify build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds. `/` serves the landing, `/home` serves the dashboard.

**Step 3: Commit**

```bash
git add apps/web/app/\(marketing\)/page.tsx
git commit -m "feat: add landing page with auth redirect and placeholder sections"
```

---

### Task 5: Final verification

**Step 1: Full build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 2: Verify route structure in build output**

Check the build output includes:
- `/` — landing page (dynamic, due to `auth()` call)
- `/home` — dashboard (dynamic, requires auth)
- `/sign-in` — Clerk sign in
- `/sign-up` — Clerk sign up

**Step 3: Verify no stale `/` references in dashboard code**

Run: `grep -rn "href: '/'" apps/web/ --include='*.tsx' --include='*.ts' | grep -v node_modules | grep -v .next`

Expected: No results — sidebar now uses `/home`.

**Step 4: Verify middleware has `/` as public**

Check `apps/web/middleware.ts` includes `'/'` in the `createRouteMatcher` array.

**Step 5: Verify marketing layout has white background**

Check `apps/web/app/(marketing)/layout.tsx` has `bg-white` on the root div.
