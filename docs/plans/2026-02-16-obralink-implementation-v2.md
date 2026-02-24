# Agentect MVP — Implementation Plan v2

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Agentect, a SaaS construction project management platform with AI-powered receipt extraction.

**Architecture:** Turborepo monorepo with Next.js App Router (RSC-first), Supabase (PostgreSQL + Storage) backend, Clerk auth, and Claude Vision AI extraction engine. Multi-tenant via RLS policies filtered by organization_id from Clerk JWT.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS 4, Shadcn/ui, Recharts, Clerk, Supabase, Claude Vision API, Turborepo, SWR, Vercel

**Design Document:** `docs/plans/2026-02-16-obralink-design.md`
**Previous Plan:** `docs/plans/2026-02-16-obralink-implementation.md`
**Vercel Best Practices Review:** Applied — fixes for waterfalls, bundle size, RSC usage, data fetching

---

## Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Bootstrap | DONE | Monorepo + shared types |
| Phase 1: Foundation | DONE (partial) | AI + Backend merged. Frontend branch exists but NOT merged (has conflicts) |
| Phase 2: Core Features | PENDING | Updated with Vercel best practices |
| Phase 3: Integration | PENDING | Updated with Vercel best practices |
| Phase 4: Polish | PENDING | Updated with Vercel best practices |

### What exists on master now:
- `packages/shared/` — Enums + types (barrel exports)
- `packages/ai/` — Claude Vision extraction engine + tests
- `packages/db/` — Supabase client + migrations (schema + RLS)
- `apps/web/lib/auth.ts` — Clerk auth context helper
- `apps/web/lib/supabase.ts` — Supabase admin client wrapper
- `apps/web/middleware.ts` — Clerk route protection
- `apps/web/app/api/webhooks/clerk/route.ts` — User/org sync

### What exists on feature/phase-1-frontend (NOT merged):
- Layout shell, sidebar, bottom nav
- Clerk provider integration
- Shadcn/ui components (button, card, input, select, dialog, etc.)
- Base components (page-header, empty-state, kpi-card, status-badge, loading-skeleton)
- Auth pages (sign-in, sign-up)

---

## Pre-Phase 2: Merge Frontend + Apply Fixes

> These tasks must be completed BEFORE Phase 2 begins.

### Task P1: Merge Frontend Branch and Fix Conflicts

**Files:**
- Merge: `feature/phase-1-frontend` into `master`

**Step 1: Merge the frontend branch**

```bash
git merge feature/phase-1-frontend
```

If conflicts in `package.json` or `package-lock.json`, resolve by keeping both sets of dependencies and running `npm install`.

**Step 2: Verify build**

```bash
npx turbo build
```

**Step 3: Commit merge**

```bash
git add -A && git commit -m "merge: integrate Phase 1 Frontend into master"
```

---

### Task P2: Apply Vercel Best Practices — Structural Fixes

**Files:**
- Modify: `packages/shared/package.json` (add subpath exports)
- Modify: `packages/ai/package.json` (add subpath exports)
- Modify: `apps/web/next.config.ts` (add transpilePackages + images)
- Modify: `apps/web/app/layout.tsx` (move ClerkProvider to dashboard layout)
- Modify: `apps/web/app/(dashboard)/layout.tsx` (add ClerkProvider here)
- Create: `apps/web/app/(dashboard)/loading.tsx`
- Create: `apps/web/app/(dashboard)/error.tsx`
- Create: `apps/web/lib/fetcher.ts` (SWR fetcher)

**Step 1: Add subpath exports to shared package**

`packages/shared/package.json` — add exports field:
```json
{
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types.ts",
    "./enums": "./src/enums.ts"
  }
}
```

**Step 2: Add subpath exports to AI package — separate parse from SDK**

`packages/ai/package.json` — add exports field:
```json
{
  "exports": {
    ".": "./src/index.ts",
    "./extract": "./src/extract.ts",
    "./prompt": "./src/prompt.ts"
  }
}
```

**Step 3: Configure Next.js for monorepo + Supabase images**

`apps/web/next.config.ts`:
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@obralink/shared', '@obralink/db', '@obralink/ai'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default nextConfig;
```

**Step 4: Move ClerkProvider from root to dashboard layout**

`apps/web/app/layout.tsx` — Remove ClerkProvider wrapper, keep it minimal:
```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Agentect',
  description: 'Gestión de obras con IA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

`apps/web/app/(dashboard)/layout.tsx` — Add ClerkProvider here:
```tsx
import { ClerkProvider } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { BottomNav } from '@/components/bottom-nav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <ClerkProvider>
      <div className="min-h-screen">
        <Sidebar />
        <main className="md:pl-64 pb-16 md:pb-0">
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
        <BottomNav />
      </div>
    </ClerkProvider>
  );
}
```

**Step 5: Add loading.tsx and error.tsx for route segments**

`apps/web/app/(dashboard)/loading.tsx`:
```tsx
import { LoadingCards } from '@/components/ui/loading-skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <LoadingCards count={4} />
    </div>
  );
}
```

`apps/web/app/(dashboard)/error.tsx`:
```tsx
'use client';

import { Button } from '@/components/ui/button';

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <h2 className="text-lg font-semibold">Algo salió mal</h2>
      <p className="text-muted-foreground mt-1">{error.message}</p>
      <Button onClick={reset} className="mt-4">Reintentar</Button>
    </div>
  );
}
```

**Step 6: Install SWR**

```bash
cd apps/web && npm install swr
```

**Step 7: Create SWR fetcher helper**

`apps/web/lib/fetcher.ts`:
```typescript
export const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
});
```

**Step 8: Hoist Intl.NumberFormat as shared util**

`apps/web/lib/format.ts`:
```typescript
export const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}
```

**Step 9: Commit**

```bash
git add -A
git commit -m "refactor: apply Vercel React best practices — subpath exports, RSC layout, SWR, error boundaries"
```

---

## Phase 2: Core Features (Parallel — 2 agents)

> **Key changes from v1:** Pages use RSC with Suspense. Client components are thin interactivity wrappers. SWR for client-side fetching. Promise.all for parallel operations. next/image for receipt photos. Dynamic imports for Recharts.

### Task 9: Projects API — Full CRUD (Backend)

**Files:**
- Create: `apps/web/app/api/projects/route.ts`
- Create: `apps/web/app/api/projects/[id]/route.ts`

**Step 1: Create Projects list + create endpoint**

`apps/web/app/api/projects/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();

  let query = db
    .from('projects')
    .select('*, architect:users!architect_id(id, full_name)')
    .eq('organization_id', ctx.orgId)
    .order('created_at', { ascending: false });

  if (ctx.role === 'architect') {
    query = query.eq('architect_id', ctx.dbUserId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const body = await req.json();
  const db = getDb();

  const { data, error } = await db
    .from('projects')
    .insert({
      organization_id: ctx.orgId,
      name: body.name,
      address: body.address ?? null,
      status: body.status ?? 'active',
      architect_id: body.architect_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

**NOTE:** Removed the v1 pattern of fetching all receipts just to calculate `total_spend`. Spend aggregation is moved to a dedicated endpoint (Task 11) or computed via DB view.

**Step 2: Create Project detail + update + delete**

`apps/web/app/api/projects/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { id } = await params;
  const db = getDb();

  const { data, error } = await db
    .from('projects')
    .select('*, architect:users!architect_id(id, full_name, email)')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  if (ctx.role === 'supervisor') {
    const { data: project } = await db
      .from('projects')
      .select('architect_id')
      .eq('id', id)
      .single();
    if (project?.architect_id !== ctx.dbUserId) return forbidden();
  }

  const { data, error } = await db
    .from('projects')
    .update({
      ...(body.name && { name: body.name }),
      ...(body.address !== undefined && { address: body.address }),
      ...(body.status && { status: body.status }),
      ...(body.architect_id !== undefined && { architect_id: body.architect_id }),
    })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const { id } = await params;
  const db = getDb();

  const { error } = await db
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
```

**Step 3: Commit**

```bash
git add apps/web/app/api/projects/
git commit -m "feat: add Projects API with full CRUD and role-based access"
```

---

### Task 10: Receipts API — Upload, Extract, CRUD (Backend)

**Files:**
- Create: `apps/web/app/api/receipts/route.ts`
- Create: `apps/web/app/api/receipts/[id]/route.ts`
- Create: `apps/web/app/api/receipts/upload/route.ts`
- Create: `apps/web/app/api/receipts/extract/route.ts`

Same as v1 plan (Tasks 10 from original), no changes needed — API routes are server-only.

**Step 1-4:** Implement upload, extract, list/create, detail/delete endpoints exactly as in v1 plan.

**Step 5: Commit**

```bash
git add apps/web/app/api/receipts/
git commit -m "feat: add Receipts API with upload, AI extraction, and CRUD"
```

---

### Task 11: Dashboard API — With org-scoped queries (Backend)

**Files:**
- Create: `apps/web/app/api/dashboard/stats/route.ts`
- Create: `apps/web/app/api/dashboard/spend-by-project/route.ts`
- Create: `apps/web/app/api/dashboard/spend-trend/route.ts`

**CRITICAL FIX from Vercel review:** All queries MUST filter by organization_id.

**Step 1: Stats endpoint — ALL queries scoped to org**

`apps/web/app/api/dashboard/stats/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfWeek = new Date(now.getTime() - now.getDay() * 86400000).toISOString();

  // ALL queries filtered by organization_id via projects join
  const [projects, monthlySpend, weeklyReceipts, pendingReview] = await Promise.all([
    db.from('projects').select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId).eq('status', 'active'),
    db.from('receipts').select('total_amount, projects!inner(organization_id)')
      .eq('projects.organization_id', ctx.orgId)
      .eq('status', 'confirmed')
      .gte('receipt_date', startOfMonth),
    db.from('receipts').select('id, projects!inner(organization_id)', { count: 'exact', head: true })
      .eq('projects.organization_id', ctx.orgId)
      .gte('created_at', startOfWeek),
    db.from('receipts').select('id, projects!inner(organization_id)', { count: 'exact', head: true })
      .eq('projects.organization_id', ctx.orgId)
      .eq('status', 'pending'),
  ]);

  const totalMonthlySpend = (monthlySpend.data ?? [])
    .reduce((sum, r) => sum + Number(r.total_amount), 0);

  return NextResponse.json({
    active_projects: projects.count ?? 0,
    monthly_spend: totalMonthlySpend,
    weekly_receipts: weeklyReceipts.count ?? 0,
    pending_review: pendingReview.count ?? 0,
  });
}
```

**Step 2-3:** Spend-by-project and spend-trend endpoints (same as v1, already org-scoped).

**Step 4: Commit**

```bash
git add apps/web/app/api/dashboard/
git commit -m "feat: add Dashboard API with org-scoped stats, spend-by-project, and spend-trend"
```

---

### Task 12: Projects Pages — RSC + Suspense (Frontend)

**Files:**
- Create: `apps/web/app/(dashboard)/projects/page.tsx` (Server Component)
- Create: `apps/web/app/(dashboard)/projects/loading.tsx`
- Create: `apps/web/components/projects/projects-list.tsx` (Client — search/filter)
- Create: `apps/web/components/projects/project-card.tsx` (Presentational)

**KEY CHANGE from v1:** Page is a Server Component that fetches data. Client component only handles search interactivity.

**Step 1: Create presentational ProjectCard**

`apps/web/components/projects/project-card.tsx`:
```tsx
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';
import type { Project } from '@obralink/shared';

interface ProjectCardProps {
  project: Project & { total_spend?: number; architect?: { full_name: string } | null };
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold">{project.name}</CardTitle>
          <StatusBadge status={project.status} />
        </CardHeader>
        <CardContent>
          {project.address ? (
            <p className="text-sm text-muted-foreground mb-1">{project.address}</p>
          ) : null}
          {project.architect ? (
            <p className="text-sm text-muted-foreground mb-2">Arq. {project.architect.full_name}</p>
          ) : null}
          {project.total_spend != null ? (
            <p className="text-lg font-bold">{formatCurrency(project.total_spend)}</p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
```

**NOTE:** Uses ternary `? :` instead of `&&` (Vercel rule: `rendering-conditional-render`). Uses hoisted `formatCurrency` instead of inline `new Intl.NumberFormat`.

**Step 2: Create client-side search wrapper**

`apps/web/components/projects/projects-list.tsx`:
```tsx
'use client';

import { useMemo, useState } from 'react';
import { Plus, FolderKanban } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { ProjectCard } from '@/components/projects/project-card';
import type { Project } from '@obralink/shared';

type ProjectWithMeta = Project & { total_spend?: number; architect?: { full_name: string } | null };

export function ProjectsList({ projects }: { projects: ProjectWithMeta[] }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => projects.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.address?.toLowerCase().includes(search.toLowerCase())
    ),
    [projects, search]
  );

  return (
    <>
      <Input
        placeholder="Buscar proyectos..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-6 max-w-sm"
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Sin proyectos"
          description="Creá tu primer proyecto para empezar a trackear gastos."
          action={
            <Link href="/projects/new">
              <Button><Plus className="h-4 w-4 mr-2" />Nuevo Proyecto</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </>
  );
}
```

**NOTE:** Filter uses `useMemo` (Vercel rule: `rerender-memo`).

**Step 3: Create RSC page that fetches data server-side**

`apps/web/app/(dashboard)/projects/page.tsx`:
```tsx
import { Suspense } from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingCards } from '@/components/ui/loading-skeleton';
import { ProjectsList } from '@/components/projects/projects-list';
import { getAuthContext } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

async function ProjectsData() {
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const db = getDb();

  let query = db
    .from('projects')
    .select('*, architect:users!architect_id(id, full_name)')
    .eq('organization_id', ctx.orgId)
    .order('created_at', { ascending: false });

  if (ctx.role === 'architect') {
    query = query.eq('architect_id', ctx.dbUserId);
  }

  const { data } = await query;
  return <ProjectsList projects={data ?? []} />;
}

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Proyectos"
        description="Gestioná tus obras y proyectos"
        action={
          <Link href="/projects/new">
            <Button><Plus className="h-4 w-4 mr-2" />Nuevo Proyecto</Button>
          </Link>
        }
      />
      <Suspense fallback={<LoadingCards count={6} />}>
        <ProjectsData />
      </Suspense>
    </>
  );
}
```

**KEY PATTERN:** Server Component fetches data directly (no API round-trip). Suspense boundary streams content. Client component only handles search.

**Step 4: Add loading.tsx**

`apps/web/app/(dashboard)/projects/loading.tsx`:
```tsx
import { LoadingCards } from '@/components/ui/loading-skeleton';

export default function ProjectsLoading() {
  return <LoadingCards count={6} />;
}
```

**Step 5: Commit**

```bash
git add apps/web/app/\(dashboard\)/projects/ apps/web/components/projects/
git commit -m "feat: add Projects pages with RSC data fetching and Suspense boundaries"
```

---

### Task 13: Project Create/Edit Form (Frontend)

Same structure as v1 plan — forms are inherently client components. No changes needed.

**Files:**
- Create: `apps/web/app/(dashboard)/projects/new/page.tsx`
- Create: `apps/web/app/(dashboard)/projects/[id]/edit/page.tsx`
- Create: `apps/web/components/projects/project-form.tsx`

**Changes from v1:**
- Use `useTransition` for form submission instead of manual `loading` state (Vercel rule: `rendering-usetransition-loading`)
- Use `mutate` from SWR to invalidate project list cache after create/edit

**Step 1-4:** Implement as in v1, with these modifications to project-form.tsx:

```tsx
// Replace useState(false) loading pattern with:
const [isPending, startTransition] = useTransition();

// Replace handleSubmit:
startTransition(async () => {
  const res = await fetch(url, { method, headers: {...}, body: JSON.stringify(body) });
  if (res.ok) {
    const data = await res.json();
    router.push(`/projects/${data.id}`);
    router.refresh(); // Invalidate RSC cache
  }
});

// Button: disabled={isPending} instead of disabled={loading}
```

**Step 5: Commit**

---

### Task 14: Project Detail Page — RSC with Suspense (Frontend)

**Files:**
- Create: `apps/web/app/(dashboard)/projects/[id]/page.tsx` (Server Component)
- Create: `apps/web/components/projects/project-receipts.tsx` (Presentational)

**KEY CHANGE from v1:** Server Component with parallel data fetching via `Promise.all`.

**Step 1: Create RSC page with parallel fetches**

`apps/web/app/(dashboard)/projects/[id]/page.tsx`:
```tsx
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Edit, Trash2, Upload, Receipt as ReceiptIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import { formatCurrency } from '@/lib/format';
import { getAuthContext } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { ProjectReceipts } from '@/components/projects/project-receipts';
import { DeleteProjectButton } from '@/components/projects/delete-project-button';

async function ReceiptsSection({ projectId }: { projectId: string }) {
  const db = getDb();
  const { data: receipts } = await db
    .from('receipts')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  return <ProjectReceipts receipts={receipts ?? []} projectId={projectId} />;
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const db = getDb();

  // Parallel fetch: project info + total spend
  const [projectResult, spendResult] = await Promise.all([
    db.from('projects')
      .select('*, architect:users!architect_id(id, full_name, email)')
      .eq('id', id)
      .eq('organization_id', ctx.orgId)
      .single(),
    db.from('receipts')
      .select('total_amount')
      .eq('project_id', id)
      .eq('status', 'confirmed'),
  ]);

  if (projectResult.error || !projectResult.data) notFound();
  const project = projectResult.data;
  const totalSpend = (spendResult.data ?? []).reduce((sum, r) => sum + Number(r.total_amount), 0);

  return (
    <>
      <PageHeader
        title={project.name}
        action={
          <div className="flex gap-2">
            <Link href={`/upload?project=${id}`}>
              <Button><Upload className="h-4 w-4 mr-2" />Cargar Comprobante</Button>
            </Link>
            <Link href={`/projects/${id}/edit`}>
              <Button variant="outline"><Edit className="h-4 w-4" /></Button>
            </Link>
            {ctx.role === 'admin' ? <DeleteProjectButton projectId={id} /> : null}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Estado</CardTitle></CardHeader>
          <CardContent><StatusBadge status={project.status} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Gasto Total</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(totalSpend)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Arquitecto</CardTitle></CardHeader>
          <CardContent><p>{project.architect?.full_name ?? 'Sin asignar'}</p></CardContent>
        </Card>
      </div>

      <h2 className="text-lg font-semibold mb-4">Comprobantes</h2>
      <Suspense fallback={<LoadingTable rows={5} />}>
        <ReceiptsSection projectId={id} />
      </Suspense>
    </>
  );
}
```

**NOTE:** Uses `Promise.all` for parallel fetching (Vercel rule: `async-parallel`). Receipts list in `<Suspense>` boundary. Delete button only for admin (ternary, not `&&`).

**Step 2-3:** Create ProjectReceipts and DeleteProjectButton components.

**Step 4: Commit**

---

### Task 15: Upload Receipt Flow — Parallel Upload + Extract (Frontend)

**Files:**
- Create: `apps/web/app/(dashboard)/upload/page.tsx`
- Create: `apps/web/components/receipts/camera-capture.tsx`

**CRITICAL FIX from Vercel review:** Upload to Supabase and AI extraction run in parallel with `Promise.all`.

**Step 1-2:** Camera capture component (same as v1).

**Step 3: Upload page with parallel operations**

```tsx
// KEY CHANGE: Promise.all for upload + extract
const [uploadResult, extraction] = await Promise.all([
  fetch('/api/receipts/upload', { method: 'POST', body: formData }).then(r => r.json()),
  fetch('/api/receipts/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: base64, mime_type: file.type }),
  }).then(r => r.json()),
]);

// Store in sessionStorage instead of URL params (avoids URL length limits)
sessionStorage.setItem('pendingReceipt', JSON.stringify({
  image_url: uploadResult.image_url,
  extraction,
  project: preselectedProject,
}));
router.push('/upload/review');
```

**NOTE:** Data passed via `sessionStorage` instead of URL search params (Vercel review finding P-architecture-3.8).

**Step 4: Commit**

---

### Task 16: AI Review & Confirm Screen (Frontend)

Same as v1 with these changes:
- Read data from `sessionStorage` instead of URL params
- Use `useTransition` for confirm submission
- Use `next/image` for receipt photo display
- Use functional `setState` for item updates (Vercel rule: `rerender-functional-setstate`)

**Step 1-3:** Implement with corrections applied.

**Step 4: Commit**

---

### Task 17: Receipts List + Detail Pages — RSC (Frontend)

**Files:**
- Create: `apps/web/app/(dashboard)/receipts/page.tsx` (Server Component)
- Create: `apps/web/app/(dashboard)/receipts/[id]/page.tsx` (Server Component)
- Create: `apps/web/components/receipts/receipts-list.tsx` (Client — search)

**KEY CHANGE:** Same RSC + Suspense pattern as Projects (Task 12). Server component fetches data, client handles search.

**Step 1: RSC page**

```tsx
// app/(dashboard)/receipts/page.tsx — Server Component
import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import { ReceiptsList } from '@/components/receipts/receipts-list';
import { getAuthContext } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

async function ReceiptsData() {
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const db = getDb();
  const { data } = await db
    .from('receipts')
    .select('*, project:projects!project_id(id, name), uploader:users!uploaded_by(id, full_name)')
    .order('created_at', { ascending: false });

  return <ReceiptsList receipts={data ?? []} />;
}

export default function ReceiptsPage() {
  return (
    <>
      <PageHeader title="Comprobantes" description="Todos los comprobantes cargados" />
      <Suspense fallback={<LoadingTable rows={8} />}>
        <ReceiptsData />
      </Suspense>
    </>
  );
}
```

**Step 2: Receipt detail page — same RSC pattern with `next/image`**

Use `<Image>` from `next/image` for receipt photo display instead of raw `<img>`.

**Step 3: Commit**

---

## Phase 3: Integration (Semi-Parallel)

### Task 18: Dashboard — RSC + Suspense + Dynamic Recharts (Frontend)

**Files:**
- Create: `apps/web/app/(dashboard)/page.tsx` (Server Component)
- Create: `apps/web/components/dashboard/spend-chart.tsx`
- Create: `apps/web/components/dashboard/trend-chart.tsx`
- Create: `apps/web/components/dashboard/recent-receipts.tsx`
- Create: `apps/web/components/dashboard/dashboard-kpis.tsx`

**CRITICAL CHANGES from v1:**
1. Dashboard is RSC with 3 independent Suspense boundaries
2. Recharts loaded via `next/dynamic` with `ssr: false`
3. Each section fetches data independently and streams

**Step 1: Install Recharts**

```bash
cd apps/web && npm install recharts
```

**Step 2: Create chart components with dynamic import**

```tsx
// apps/web/components/dashboard/charts.tsx
'use client';

import dynamic from 'next/dynamic';
import { LoadingCards } from '@/components/ui/loading-skeleton';

export const SpendChart = dynamic(
  () => import('./spend-chart-inner').then(m => m.SpendChartInner),
  { ssr: false, loading: () => <LoadingCards count={1} /> }
);

export const TrendChart = dynamic(
  () => import('./trend-chart-inner').then(m => m.TrendChartInner),
  { ssr: false, loading: () => <LoadingCards count={1} /> }
);
```

`spend-chart-inner.tsx` and `trend-chart-inner.tsx` contain the actual Recharts components (same as v1 but without the dynamic wrapper).

**Step 3: Create RSC dashboard page with Suspense boundaries**

```tsx
// apps/web/app/(dashboard)/page.tsx — Server Component
import { Suspense } from 'react';
import { LoadingCards } from '@/components/ui/loading-skeleton';
import { DashboardKPIs } from '@/components/dashboard/dashboard-kpis';
import { SpendChart, TrendChart } from '@/components/dashboard/charts';
import { RecentReceipts } from '@/components/dashboard/recent-receipts';
import { getAuthContext } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

async function KPIsSection() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const db = getDb();
  // fetch stats...
  return <DashboardKPIs stats={stats} />;
}

async function SpendChartSection() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const db = getDb();
  // fetch spend-by-project...
  return <SpendChart data={data} />;
}

async function TrendChartSection() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const db = getDb();
  // fetch trend...
  return <TrendChart data={data} />;
}

async function RecentReceiptsSection() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const db = getDb();
  // fetch recent receipts...
  return <RecentReceipts receipts={receipts} />;
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <Suspense fallback={<LoadingCards count={4} />}>
        <KPIsSection />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<LoadingCards count={1} />}>
          <SpendChartSection />
        </Suspense>
        <Suspense fallback={<LoadingCards count={1} />}>
          <TrendChartSection />
        </Suspense>
      </div>

      <Suspense fallback={<LoadingCards count={1} />}>
        <RecentReceiptsSection />
      </Suspense>
    </div>
  );
}
```

**NOTE:** 4 independent Suspense boundaries. KPIs stream first, charts load dynamically (not in initial bundle). Each section fetches independently — fast sections appear immediately, slow ones stream in.

**Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/page.tsx apps/web/components/dashboard/
git commit -m "feat: add dashboard with RSC streaming, Suspense boundaries, and dynamic Recharts"
```

---

### Task 19: Settings Page (Frontend)

Same as v1. Admin-only page, simple list of team members from Clerk.

**Step 1-2:** Implement as in v1.

**Step 3: Commit**

---

## Phase 4: Polish + QA (Sequential)

### Task 20: Mobile Responsiveness + Error States

Same as v1, plus:
- Verify all `<Suspense>` boundaries render proper skeletons on mobile
- Add `not-found.tsx` for projects and receipts routes
- Verify `error.tsx` catches API failures gracefully

**Step 1-3:** Implement and commit.

---

### Task 21: Role-Based Navigation + Final Polish

Same as v1, plus:
- Update `apps/web/app/layout.tsx` metadata to "Agentect"
- Remove default create-next-app page content
- Ensure `next/image` used for all receipt images
- Verify SWR/mutation invalidation works for all CRUD flows

**Step 1-3:** Implement and commit.

---

## Summary of Changes from v1

| Issue | v1 (Original) | v2 (Fixed) |
|-------|---------------|------------|
| Data fetching | `useEffect` + `fetch` in client components | RSC server-side fetch + Suspense streaming |
| Suspense boundaries | None | 1 per independent data section |
| Recharts bundle | Static import (~400KB) | `next/dynamic` with `ssr: false` |
| Barrel exports | `export *` only | Subpath exports in package.json |
| ClerkProvider | Root layout (all pages) | Dashboard layout only |
| Upload + Extract | Sequential awaits | `Promise.all` parallel |
| Dashboard stats | Cross-tenant data leak | All queries org-scoped |
| Search filtering | Inline on every render | `useMemo` |
| Currency formatting | `new Intl.NumberFormat` per render | Hoisted module-level constant |
| Conditional rendering | `&&` operator | Ternary `? : null` |
| Form loading states | `useState(false)` manual | `useTransition` |
| Receipt images | Raw `<img>` | `next/image` |
| Extraction data passing | URL search params | `sessionStorage` |
| Error handling | None | `error.tsx` + `not-found.tsx` per route |
| Route loading | None | `loading.tsx` per route segment |

## Task Summary

| Phase | Tasks | Parallelism |
|-------|-------|-------------|
| Pre-2: Fixes | P1 (merge FE), P2 (Vercel fixes) | Sequential |
| 2: Core Features | 9-11 (Backend), 12-17 (Frontend) | Parallel (2 agents) |
| 3: Integration | 18 (Dashboard), 19 (Settings) | Semi-parallel |
| 4: Polish | 20-21 | Sequential |

**Total remaining tasks:** 13 (2 pre-phase + 9 Phase 2 + 2 Phase 3 + 2 Phase 4)
