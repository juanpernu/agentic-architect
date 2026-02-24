# Landing Page — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up the technical scaffolding for a marketing landing page at `/` with a `(marketing)` route group, auth-aware redirect, and placeholder sections ready for a design agent.

**Architecture:** Create `app/(marketing)/` route group with its own layout (header + footer, light mode only). Move the current dashboard `page.tsx` from `/` to `/dashboard`. Update Clerk middleware to allow `/` as public and redirect authenticated users to `/dashboard`. Landing page has placeholder sections for a design agent to fill in.

**Tech Stack:** Next.js App Router, Tailwind CSS 4, Clerk `auth()` + middleware, Shadcn/ui Button, Lucide React

---

## Context for the implementer

### Copy and voice rules

- **Idioma:** Espanol argentino. Tuteo con "vos" (Carga, Selecciona, Ingresa, Empeza)
- **Tono:** Profesional pero cercano. Directo, concreto. Frases cortas.
- **Usar:** obra, comprobante, tique, factura, rubro, presupuesto, estudio, comitente
- **Evitar:** jerga tech (AI-powered, machine learning), ingles innecesario (dashboard→panel, upload→cargar), terminologia corporativa (stakeholder, pipeline, ROI)

### Pricing data (from `packages/shared/src/plans.ts`)

- **Free:** 1 proyecto, 20 comprobantes/proyecto, 1 usuario. Gratis para siempre.
- **Advance:** 20 proyectos, comprobantes ilimitados, usuarios multiples, administracion, reportes.
- **Enterprise:** Todo ilimitado, soporte prioritario. Contactanos.

### Layout tree (final state)

```
app/layout.tsx  (RootLayout — html/body, Inter font)
  |
  +-- (marketing)/layout.tsx  (ClerkProvider, header + footer, bg-white)
  |     +-- page.tsx  → URL: /  (landing page publica)
  |
  +-- (auth)/layout.tsx  (ClerkProvider)
  |     +-- sign-in/[[...sign-in]]/page.tsx  → /sign-in
  |     +-- sign-up/[[...sign-up]]/page.tsx  → /sign-up
  |
  +-- (dashboard)/layout.tsx  (ClerkProvider + Sidebar + MobileHeader + auth check)
        +-- dashboard/page.tsx  → /dashboard  (ex /)
        +-- projects/...        → /projects
        +-- receipts/...        → /receipts
        +-- upload/...          → /upload
        +-- budgets/...         → /budgets
        +-- reports/...         → /reports
        +-- settings/...        → /settings/*
        +-- administration/...  → /administration/*
```

### Files that must NOT be modified

- `apps/web/app/(dashboard)/layout.tsx`
- `apps/web/app/(auth)/layout.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/next.config.ts`
- Any existing route (`/projects`, `/receipts`, `/budgets`, etc.)
- Any API route

---

### Task 1: Update Clerk middleware — public `/` + auth redirect

**Files:**
- Modify: `apps/web/middleware.ts`

**Step 1: Update middleware with public route and auth redirect**

Replace the entire file with:

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();

  // Authenticated users on landing → redirect to dashboard
  if (request.nextUrl.pathname === '/' && userId) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

Changes from current middleware:
- Added `'/'` to `isPublicRoute` matcher
- Import `NextResponse` from `next/server`
- Call `await auth()` to get `userId` before protecting
- If user is authenticated and on `/`, redirect to `/dashboard`
- Non-public routes still get `auth.protect()` as before

**Why middleware instead of page-level redirect:** The redirect happens before the page renders, which is faster and avoids a flash of landing content for logged-in users.

**Step 2: Verify build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add apps/web/middleware.ts
git commit -m "feat: allow / as public route with auth redirect to /dashboard"
```

---

### Task 2: Move dashboard from `/` to `/dashboard`

Both `(marketing)/page.tsx` and `(dashboard)/page.tsx` would resolve to `/`, causing a Next.js route conflict. We fix this by moving the dashboard to `/dashboard`.

**Files:**
- Move: `apps/web/app/(dashboard)/page.tsx` → `apps/web/app/(dashboard)/dashboard/page.tsx`
- Modify: `apps/web/components/sidebar.tsx`

**Step 1: Move the dashboard page**

```bash
mkdir -p apps/web/app/\(dashboard\)/dashboard
git mv apps/web/app/\(dashboard\)/page.tsx apps/web/app/\(dashboard\)/dashboard/page.tsx
```

The file content stays exactly the same — no edits needed. It now serves `/dashboard` instead of `/`.

**Step 2: Update sidebar navItems**

In `apps/web/components/sidebar.tsx`, change the Dashboard nav item from:

```typescript
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
```

To:

```typescript
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
```

**Step 3: Search for other `/` references**

Run: `grep -rn "href: '/'" apps/web/ --include='*.tsx' --include='*.ts' | grep -v node_modules | grep -v .next`

Expected: No results (sidebar was the only one).

Also check redirects: `grep -rn "redirect('/')" apps/web/ --include='*.tsx' --include='*.ts' | grep -v node_modules | grep -v .next`

Expected: No results.

**Step 4: Verify build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds. `/dashboard` now serves the dashboard page.

**Step 5: Commit**

```bash
git add apps/web/app/\(dashboard\)/dashboard/page.tsx apps/web/components/sidebar.tsx
git rm apps/web/app/\(dashboard\)/page.tsx
git commit -m "refactor: move dashboard from / to /dashboard to free root for landing"
```

---

### Task 3: Create marketing layout with ClerkProvider

**Files:**
- Create: `apps/web/app/(marketing)/layout.tsx`

**Step 1: Create the marketing layout**

Create `apps/web/app/(marketing)/layout.tsx` with:

```tsx
import { ClerkProvider } from '@clerk/nextjs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
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
    </ClerkProvider>
  );
}
```

Key details:
- Server component (no `'use client'`)
- **`ClerkProvider` wraps everything** — needed for Clerk auth state (middleware redirect relies on it)
- Forces `bg-white` (light mode only for marketing)
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
git commit -m "feat: add marketing layout with ClerkProvider, header and footer"
```

---

### Task 4: Create landing page with placeholder sections

**Files:**
- Create: `apps/web/app/(marketing)/page.tsx`

**Step 1: Create the landing page**

Create `apps/web/app/(marketing)/page.tsx` with:

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
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
            Placeholder — el agente de diseño completará esta sección con 4 feature cards:
            extracción AI de comprobantes, presupuesto vs ejecución real,
            control de ingresos y egresos, multi-obra multi-rol.
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
            Placeholder — el agente de diseño completará esta sección con 3 columnas
            (Free / Advance / Enterprise). Datos en packages/shared/src/plans.ts.
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
- **Simple server component — no `auth()` call needed.** Auth redirect is handled by middleware (Task 1). This keeps the page simpler and potentially statically renderable.
- 4 sections with IDs: `hero`, `features`, `pricing`, `cta`
- Placeholder text includes guidance for the design agent (what each section should contain)
- Hero has real copy matching the app's value prop in Argentine Spanish
- Uses existing `Button` with `lg` size and `asChild` + `Link`

**Step 2: Verify build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds. `/` serves the landing, `/dashboard` serves the dashboard.

**Step 3: Commit**

```bash
git add apps/web/app/\(marketing\)/page.tsx
git commit -m "feat: add landing page with placeholder sections for design agent"
```

---

### Task 5: Verify Clerk redirect env vars

**Files:**
- Check: `.env.local` (or Vercel environment settings)

**Step 1: Check if Clerk redirect vars exist**

Run: `grep -n "CLERK_AFTER_SIGN" apps/web/.env.local 2>/dev/null || echo "No .env.local or no vars found"`

**Step 2: If vars exist and point to `/`, update them**

If `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/` exists, change to:

```
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

If these vars don't exist, Clerk defaults to `/` which will hit our middleware redirect — this is fine, no action needed.

**Step 3: Note for Vercel deployment**

If deployed on Vercel, check the project environment variables at:
`https://vercel.com/project/settings/environment-variables`

Ensure any `CLERK_AFTER_SIGN_*` vars point to `/dashboard`, not `/`.

This step may be a no-op if no vars are configured. The middleware redirect (Task 1) handles it regardless.

---

### Task 6: Final verification

**Step 1: Full build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 2: Verify route structure in build output**

Check the build output includes:
- `/` — landing page (static, no auth call)
- `/dashboard` — dashboard (dynamic, requires auth)
- `/sign-in` — Clerk sign in
- `/sign-up` — Clerk sign up

**Step 3: Verify no stale `/` references in dashboard code**

Run: `grep -rn "href: '/'" apps/web/ --include='*.tsx' --include='*.ts' | grep -v node_modules | grep -v .next`

Expected: No results — sidebar now uses `/dashboard`.

**Step 4: Verify middleware**

Check `apps/web/middleware.ts`:
- `'/'` is in the `createRouteMatcher` array
- Auth redirect sends to `/dashboard`

**Step 5: Verify marketing layout**

Check `apps/web/app/(marketing)/layout.tsx`:
- Has `ClerkProvider` wrapper
- Has `bg-white` on the root div
- Has sticky header with logo + CTAs

**Step 6: Verify files NOT modified**

Run: `git diff --name-only HEAD~5` and confirm that NONE of these were touched:
- `apps/web/app/(dashboard)/layout.tsx`
- `apps/web/app/(auth)/layout.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/next.config.ts`
- Any file under `apps/web/app/api/`

---

## Files summary

| Action | File | Notes |
|--------|------|-------|
| MODIFY | `apps/web/middleware.ts` | Add `/` to public, auth redirect to `/dashboard` |
| MOVE | `apps/web/app/(dashboard)/page.tsx` → `dashboard/page.tsx` | Dashboard now at `/dashboard` |
| MODIFY | `apps/web/components/sidebar.tsx` | `href: '/'` → `href: '/dashboard'` |
| CREATE | `apps/web/app/(marketing)/layout.tsx` | ClerkProvider + header/footer, bg-white |
| CREATE | `apps/web/app/(marketing)/page.tsx` | Landing with placeholder sections |
| CHECK | `.env.local` / Vercel | Clerk redirect vars if they exist |
