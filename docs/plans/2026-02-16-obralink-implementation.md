# Agentect MVP — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Agentect, a SaaS construction project management platform with AI-powered receipt extraction.

**Architecture:** Turborepo monorepo with Next.js App Router frontend, Supabase (PostgreSQL + Storage) backend, Clerk auth, and Claude Vision AI extraction engine. Multi-tenant via RLS policies filtered by organization_id from Clerk JWT.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Shadcn/ui, Recharts, Clerk, Supabase, Claude Vision API, Turborepo, Vercel

**Design Document:** `docs/plans/2026-02-16-obralink-design.md`

---

## Phase 0: Bootstrap (Sequential)

### Task 1: Initialize Turborepo Monorepo

**Files:**
- Create: `package.json` (root)
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `apps/web/` (Next.js app)
- Create: `packages/shared/` (shared types)
- Create: `packages/db/` (Supabase schema)
- Create: `packages/ai/` (AI extraction)

**Step 1: Create Turborepo project**

```bash
npx create-turbo@latest agentect --example basic
cd agentect
```

If that doesn't match our structure, manually init:

```bash
mkdir -p agentect && cd agentect
npm init -y
```

**Step 2: Configure root package.json**

```json
{
  "name": "agentect",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test"
  },
  "devDependencies": {
    "turbo": "^2"
  }
}
```

**Step 3: Configure turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {}
  }
}
```

**Step 4: Create Next.js app**

```bash
npx create-next-app@latest apps/web --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

**Step 5: Create package skeletons**

```bash
mkdir -p packages/shared/src packages/db/src packages/db/migrations packages/ai/src
```

`packages/shared/package.json`:
```json
{
  "name": "@obralink/shared",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint src/",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

`packages/db/package.json`:
```json
{
  "name": "@obralink/db",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint src/",
    "test": "vitest run"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

`packages/ai/package.json`:
```json
{
  "name": "@obralink/ai",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint src/",
    "test": "vitest run"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

**Step 6: Create .env.example**

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=
```

**Step 7: Create .gitignore**

```
node_modules
.next
dist
.env
.env.local
.turbo
.DS_Store
```

**Step 8: Install dependencies and verify**

```bash
npm install
npx turbo build
```

Expected: Build succeeds for all packages.

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: initialize Turborepo monorepo with Next.js, shared, db, and ai packages"
```

---

### Task 2: Define Shared TypeScript Types

**Files:**
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/enums.ts`

**Step 1: Create enums**

`packages/shared/src/enums.ts`:
```typescript
export const UserRole = {
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  ARCHITECT: 'architect',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ProjectStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const ReceiptStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
} as const;
export type ReceiptStatus = (typeof ReceiptStatus)[keyof typeof ReceiptStatus];
```

**Step 2: Create types**

`packages/shared/src/types.ts`:
```typescript
import type { UserRole, ProjectStatus, ReceiptStatus } from './enums';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  clerk_user_id: string;
  organization_id: string;
  role: UserRole;
  full_name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  status: ProjectStatus;
  architect_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Receipt {
  id: string;
  project_id: string;
  uploaded_by: string;
  vendor: string | null;
  total_amount: number;
  receipt_date: string;
  image_url: string;
  ai_raw_response: Record<string, unknown>;
  ai_confidence: number;
  status: ReceiptStatus;
  created_at: string;
  updated_at: string;
}

export interface ReceiptItem {
  id: string;
  receipt_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

// AI Extraction types
export interface ExtractionResult {
  vendor: string | null;
  date: string | null;
  total: number | null;
  items: ExtractionItem[];
  confidence: number;
}

export interface ExtractionItem {
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

// API request/response types
export interface CreateProjectInput {
  name: string;
  address?: string;
  status?: ProjectStatus;
  architect_id?: string;
}

export interface UpdateProjectInput {
  name?: string;
  address?: string;
  status?: ProjectStatus;
  architect_id?: string;
}

export interface ConfirmReceiptInput {
  project_id: string;
  vendor: string | null;
  total_amount: number;
  receipt_date: string;
  image_url: string;
  ai_raw_response: Record<string, unknown>;
  ai_confidence: number;
  items: Omit<ExtractionItem, 'subtotal'>[];
}

// Dashboard types
export interface DashboardStats {
  active_projects: number;
  monthly_spend: number;
  weekly_receipts: number;
  pending_review: number;
}

export interface SpendByProject {
  project_id: string;
  project_name: string;
  total_spend: number;
}

export interface SpendTrend {
  month: string;
  total: number;
}
```

**Step 3: Create barrel export**

`packages/shared/src/index.ts`:
```typescript
export * from './enums';
export * from './types';
```

**Step 4: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared TypeScript types and enums for Agentect domain model"
```

---

## Phase 1: Foundation (Parallel — 3 agents)

> **Parallelism:** Tasks 3-5 (Backend/DB), Tasks 6-8 (Frontend), Tasks 9-10 (AI) can run in parallel.

---

### Task 3: Database Schema and Migrations (Backend/DB)

**Files:**
- Create: `packages/db/migrations/001_initial_schema.sql`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/client.ts`

**Step 1: Write the migration SQL**

`packages/db/migrations/001_initial_schema.sql`:
```sql
-- Enums
CREATE TYPE user_role AS ENUM ('admin', 'supervisor', 'architect');
CREATE TYPE project_status AS ENUM ('active', 'paused', 'completed');
CREATE TYPE receipt_status AS ENUM ('pending', 'confirmed', 'rejected');

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'architect',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_users_clerk_id ON users(clerk_user_id);
CREATE INDEX idx_users_org_id ON users(organization_id);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  status project_status NOT NULL DEFAULT 'active',
  architect_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_projects_org_id ON projects(organization_id);
CREATE INDEX idx_projects_architect_id ON projects(architect_id);

-- Receipts
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  vendor TEXT,
  total_amount DECIMAL(12,2) NOT NULL,
  receipt_date DATE NOT NULL,
  image_url TEXT NOT NULL,
  ai_raw_response JSONB DEFAULT '{}',
  ai_confidence REAL DEFAULT 0,
  status receipt_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_receipts_project_id ON receipts(project_id);
CREATE INDEX idx_receipts_uploaded_by ON receipts(uploaded_by);
CREATE INDEX idx_receipts_status ON receipts(status);

-- Receipt Items
CREATE TABLE receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_receipt_items_receipt_id ON receipt_items(receipt_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_organizations
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_projects
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_receipts
  BEFORE UPDATE ON receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Step 2: Create Supabase client**

`packages/db/src/client.ts`:
```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Missing Supabase environment variables');
    }
    supabaseAdmin = createClient(url, key);
  }
  return supabaseAdmin;
}

export function getSupabaseClient(supabaseAccessToken?: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(url, anonKey, {
    global: {
      headers: supabaseAccessToken
        ? { Authorization: `Bearer ${supabaseAccessToken}` }
        : {},
    },
  });
}
```

**Step 3: Create barrel export**

`packages/db/src/index.ts`:
```typescript
export { getSupabaseAdmin, getSupabaseClient } from './client';
```

**Step 4: Run migration in Supabase dashboard or CLI**

```bash
npx supabase db push
```

**Step 5: Commit**

```bash
git add packages/db/
git commit -m "feat: add database schema, migrations, and Supabase client"
```

---

### Task 4: RLS Policies (Backend/DB)

**Files:**
- Create: `packages/db/migrations/002_rls_policies.sql`

**Step 1: Write RLS policies**

`packages/db/migrations/002_rls_policies.sql`:
```sql
-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's org_id from JWT
CREATE OR REPLACE FUNCTION auth.get_org_id()
RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::UUID;
$$ LANGUAGE sql STABLE;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE clerk_user_id = auth.uid()::TEXT;
$$ LANGUAGE sql STABLE;

-- Organizations: users can only see their own org
CREATE POLICY "Users can view own organization"
  ON organizations FOR SELECT
  USING (id = auth.get_org_id());

-- Users: can see users in same org
CREATE POLICY "Users can view org members"
  ON users FOR SELECT
  USING (organization_id = auth.get_org_id());

-- Users: only admin can insert/update/delete
CREATE POLICY "Admin can manage users"
  ON users FOR ALL
  USING (
    organization_id = auth.get_org_id()
    AND auth.get_user_role() = 'admin'
  );

-- Projects: org-scoped read (admin/supervisor see all, architect sees assigned)
CREATE POLICY "View projects by role"
  ON projects FOR SELECT
  USING (
    organization_id = auth.get_org_id()
    AND (
      auth.get_user_role() IN ('admin', 'supervisor')
      OR architect_id = (SELECT id FROM users WHERE clerk_user_id = auth.uid()::TEXT)
    )
  );

-- Projects: admin and supervisor can create
CREATE POLICY "Admin and supervisor can create projects"
  ON projects FOR INSERT
  WITH CHECK (
    organization_id = auth.get_org_id()
    AND auth.get_user_role() IN ('admin', 'supervisor')
  );

-- Projects: admin can update any, supervisor can update own
CREATE POLICY "Update projects by role"
  ON projects FOR UPDATE
  USING (
    organization_id = auth.get_org_id()
    AND (
      auth.get_user_role() = 'admin'
      OR (auth.get_user_role() = 'supervisor'
          AND architect_id = (SELECT id FROM users WHERE clerk_user_id = auth.uid()::TEXT))
    )
  );

-- Projects: only admin can delete
CREATE POLICY "Admin can delete projects"
  ON projects FOR DELETE
  USING (
    organization_id = auth.get_org_id()
    AND auth.get_user_role() = 'admin'
  );

-- Receipts: org-scoped via project
CREATE POLICY "View receipts by role"
  ON receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = receipts.project_id
      AND projects.organization_id = auth.get_org_id()
    )
    AND (
      auth.get_user_role() IN ('admin', 'supervisor')
      OR uploaded_by = (SELECT id FROM users WHERE clerk_user_id = auth.uid()::TEXT)
    )
  );

-- Receipts: any authenticated user in org can insert
CREATE POLICY "Org members can upload receipts"
  ON receipts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = receipts.project_id
      AND projects.organization_id = auth.get_org_id()
    )
  );

-- Receipts: only admin can delete
CREATE POLICY "Admin can delete receipts"
  ON receipts FOR DELETE
  USING (
    auth.get_user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = receipts.project_id
      AND projects.organization_id = auth.get_org_id()
    )
  );

-- Receipt Items: inherit access from parent receipt
CREATE POLICY "View receipt items via receipt access"
  ON receipt_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM receipts
      WHERE receipts.id = receipt_items.receipt_id
    )
  );

CREATE POLICY "Insert receipt items with receipt"
  ON receipt_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM receipts
      WHERE receipts.id = receipt_items.receipt_id
    )
  );

-- Supabase Storage bucket for receipt images
-- Run in Supabase dashboard:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);
```

**Step 2: Apply migration**

```bash
npx supabase db push
```

**Step 3: Commit**

```bash
git add packages/db/migrations/002_rls_policies.sql
git commit -m "feat: add RLS policies for multi-tenant data isolation"
```

---

### Task 5: Clerk Webhook Handler + API Auth Middleware (Backend/DB)

**Files:**
- Create: `apps/web/app/api/webhooks/clerk/route.ts`
- Create: `apps/web/lib/auth.ts`
- Create: `apps/web/lib/supabase.ts`

**Step 1: Install Clerk dependencies in apps/web**

```bash
cd apps/web && npm install @clerk/nextjs svix
```

**Step 2: Create auth helper**

`apps/web/lib/auth.ts`:
```typescript
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { UserRole } from '@obralink/shared';

export interface AuthContext {
  userId: string;
  orgId: string;
  role: UserRole;
  dbUserId: string;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const { userId, orgId, sessionClaims } = await auth();
  if (!userId || !orgId) return null;

  const metadata = sessionClaims?.metadata as Record<string, string> | undefined;
  return {
    userId,
    orgId,
    role: (metadata?.role as UserRole) ?? 'architect',
    dbUserId: metadata?.db_user_id ?? '',
  };
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Step 3: Create Supabase server helper**

`apps/web/lib/supabase.ts`:
```typescript
import { getSupabaseAdmin } from '@obralink/db';

export function getDb() {
  return getSupabaseAdmin();
}
```

**Step 4: Create Clerk webhook handler**

`apps/web/app/api/webhooks/clerk/route.ts`:
```typescript
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/supabase';

interface ClerkWebhookEvent {
  type: string;
  data: Record<string, unknown>;
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing webhook secret' }, { status: 500 });
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);
  const wh = new Webhook(WEBHOOK_SECRET);

  let event: ClerkWebhookEvent;
  try {
    event = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as ClerkWebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const db = getDb();

  switch (event.type) {
    case 'user.created':
    case 'user.updated': {
      const data = event.data;
      const orgMemberships = data.organization_memberships as Array<{
        organization: { id: string; name: string; slug: string };
        role: string;
      }> | undefined;

      const org = orgMemberships?.[0]?.organization;
      if (!org) break;

      // Upsert organization
      await db.from('organizations').upsert({
        id: org.id,
        name: org.name,
        slug: org.slug,
      }, { onConflict: 'id' });

      // Upsert user
      const roleMap: Record<string, string> = {
        'org:admin': 'admin',
        'org:member': 'architect',
      };

      await db.from('users').upsert({
        clerk_user_id: data.id as string,
        organization_id: org.id,
        role: roleMap[orgMemberships![0].role] ?? 'architect',
        full_name: `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim(),
        email: (data.email_addresses as Array<{ email_address: string }>)?.[0]?.email_address ?? '',
        avatar_url: data.image_url as string ?? null,
      }, { onConflict: 'clerk_user_id' });

      break;
    }

    case 'organizationMembership.created':
    case 'organizationMembership.updated': {
      // Handle role changes
      const data = event.data;
      const orgData = data.organization as { id: string; name: string; slug: string };
      const userData = data.public_user_data as { user_id: string };
      const role = data.role as string;

      const roleMap: Record<string, string> = {
        'org:admin': 'admin',
        'org:member': 'architect',
      };

      await db.from('users')
        .update({ role: roleMap[role] ?? 'architect' })
        .eq('clerk_user_id', userData.user_id)
        .eq('organization_id', orgData.id);

      break;
    }
  }

  return NextResponse.json({ received: true });
}
```

**Step 5: Commit**

```bash
git add apps/web/lib/ apps/web/app/api/webhooks/
git commit -m "feat: add Clerk webhook handler and auth middleware"
```

---

### Task 6: App Layout Shell + Navigation (Frontend)

**Files:**
- Create: `apps/web/app/(dashboard)/layout.tsx`
- Create: `apps/web/components/sidebar.tsx`
- Create: `apps/web/components/bottom-nav.tsx`
- Modify: `apps/web/app/layout.tsx`

**Step 1: Install Clerk + Shadcn in apps/web**

```bash
cd apps/web
npm install @clerk/nextjs
npx shadcn@latest init -d
npx shadcn@latest add button card input label select dialog sheet avatar badge separator dropdown-menu toast tabs table
```

**Step 2: Setup Clerk provider in root layout**

`apps/web/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Agentect',
  description: 'Construction project management with AI-powered receipt tracking',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="es">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

**Step 3: Create Sidebar (desktop)**

`apps/web/components/sidebar.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, Receipt, Upload, Settings } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Proyectos', icon: FolderKanban },
  { href: '/receipts', label: 'Comprobantes', icon: Receipt },
  { href: '/upload', label: 'Cargar', icon: Upload },
  { href: '/settings', label: 'Ajustes', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-background">
      <div className="flex h-16 items-center px-6 border-b">
        <h1 className="text-xl font-bold">Agentect</h1>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === item.href
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
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </aside>
  );
}
```

**Step 4: Create Bottom Nav (mobile)**

`apps/web/components/bottom-nav.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, Upload, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Inicio', icon: LayoutDashboard },
  { href: '/projects', label: 'Proyectos', icon: FolderKanban },
  { href: '/upload', label: 'Cargar', icon: Upload },
  { href: '/settings', label: 'Ajustes', icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background z-50">
      <div className="flex justify-around py-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-1 text-xs',
              pathname === item.href
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
```

**Step 5: Create dashboard layout**

`apps/web/app/(dashboard)/layout.tsx`:
```tsx
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { BottomNav } from '@/components/bottom-nav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="md:pl-64 pb-16 md:pb-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
```

**Step 6: Create auth pages**

`apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx`:
```tsx
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
```

`apps/web/app/(auth)/sign-up/[[...sign-up]]/page.tsx`:
```tsx
import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}
```

**Step 7: Create middleware.ts for Clerk**

`apps/web/middleware.ts`:
```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
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

**Step 8: Commit**

```bash
git add apps/web/
git commit -m "feat: add app layout shell with sidebar, bottom nav, and Clerk auth"
```

---

### Task 7: Base UI Components (Frontend)

**Files:**
- Create: `apps/web/components/ui/page-header.tsx`
- Create: `apps/web/components/ui/empty-state.tsx`
- Create: `apps/web/components/ui/loading-skeleton.tsx`
- Create: `apps/web/components/ui/kpi-card.tsx`
- Create: `apps/web/components/ui/status-badge.tsx`

**Step 1: Create components**

`apps/web/components/ui/page-header.tsx`:
```tsx
interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
```

`apps/web/components/ui/empty-state.tsx`:
```tsx
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="text-muted-foreground mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

`apps/web/components/ui/loading-skeleton.tsx`:
```tsx
import { Skeleton } from '@/components/ui/skeleton';

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border p-6 space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      ))}
    </div>
  );
}

export function LoadingTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
```

`apps/web/components/ui/kpi-card.tsx`:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
}

export function KPICard({ title, value, icon: Icon, description }: KPICardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}
```

`apps/web/components/ui/status-badge.tsx`:
```tsx
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  paused: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed: 'bg-blue-100 text-blue-800 border-blue-200',
  pending: 'bg-orange-100 text-orange-800 border-orange-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

const statusLabels: Record<string, string> = {
  active: 'Activo',
  paused: 'Pausado',
  completed: 'Completado',
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  rejected: 'Rechazado',
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn('text-xs', statusStyles[status])}>
      {statusLabels[status] ?? status}
    </Badge>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/components/
git commit -m "feat: add base UI components (PageHeader, EmptyState, LoadingSkeleton, KPICard, StatusBadge)"
```

---

### Task 8: AI Extraction Engine (AI Agent)

**Files:**
- Create: `packages/ai/src/index.ts`
- Create: `packages/ai/src/extract.ts`
- Create: `packages/ai/src/prompt.ts`
- Create: `packages/ai/src/__tests__/extract.test.ts`

**Step 1: Write the failing test**

`packages/ai/src/__tests__/extract.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { parseExtractionResponse, validateExtractionResult } from '../extract';
import type { ExtractionResult } from '@obralink/shared';

describe('parseExtractionResponse', () => {
  it('parses valid JSON extraction response', () => {
    const raw = JSON.stringify({
      vendor: 'Ferretería López',
      date: '2026-01-15',
      total: 45000.50,
      items: [
        { description: 'Cemento x 50kg', quantity: 10, unit_price: 3500, subtotal: 35000 },
        { description: 'Arena x m3', quantity: 2, unit_price: 5000.25, subtotal: 10000.50 },
      ],
      confidence: 0.92,
    });

    const result = parseExtractionResponse(raw);
    expect(result.vendor).toBe('Ferretería López');
    expect(result.total).toBe(45000.50);
    expect(result.items).toHaveLength(2);
    expect(result.confidence).toBe(0.92);
  });

  it('handles response with null fields', () => {
    const raw = JSON.stringify({
      vendor: null,
      date: null,
      total: 1000,
      items: [],
      confidence: 0.3,
    });

    const result = parseExtractionResponse(raw);
    expect(result.vendor).toBeNull();
    expect(result.date).toBeNull();
    expect(result.confidence).toBe(0.3);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseExtractionResponse('not json')).toThrow();
  });
});

describe('validateExtractionResult', () => {
  it('returns valid for complete extraction', () => {
    const result: ExtractionResult = {
      vendor: 'Test',
      date: '2026-01-01',
      total: 1000,
      items: [{ description: 'Item', quantity: 1, unit_price: 1000, subtotal: 1000 }],
      confidence: 0.9,
    };
    expect(validateExtractionResult(result).valid).toBe(true);
  });

  it('returns invalid when total is null', () => {
    const result: ExtractionResult = {
      vendor: 'Test',
      date: '2026-01-01',
      total: null,
      items: [],
      confidence: 0.1,
    };
    expect(validateExtractionResult(result).valid).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/ai && npx vitest run
```

Expected: FAIL — `parseExtractionResponse` and `validateExtractionResult` not found.

**Step 3: Write the prompt**

`packages/ai/src/prompt.ts`:
```typescript
export const EXTRACTION_PROMPT = `You are a receipt/invoice data extractor for construction and architecture projects in Argentina.

Analyze this image and extract:
- vendor: string (business name, razón social, or CUIT if name is unreadable)
- date: string (YYYY-MM-DD format)
- total: number (total amount in ARS, use the final total including taxes)
- items: array of { description: string, quantity: number, unit_price: number, subtotal: number }
- confidence: number (0 to 1, your confidence in the overall extraction accuracy)

Rules:
- If a field is completely unreadable, set it to null
- If there are no itemized lines, return an empty items array
- For items without explicit quantity, assume quantity = 1
- Lower confidence for each null field or uncertain value
- Return ONLY valid JSON, no markdown, no explanation

Output format:
{
  "vendor": "string or null",
  "date": "YYYY-MM-DD or null",
  "total": number or null,
  "items": [{"description": "string", "quantity": number, "unit_price": number, "subtotal": number}],
  "confidence": number
}`;
```

**Step 4: Write the extraction logic**

`packages/ai/src/extract.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { ExtractionResult } from '@obralink/shared';
import { EXTRACTION_PROMPT } from './prompt';

export function parseExtractionResponse(raw: string): ExtractionResult {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    vendor: parsed.vendor ?? null,
    date: parsed.date ?? null,
    total: parsed.total ?? null,
    items: (parsed.items ?? []).map((item: Record<string, unknown>) => ({
      description: String(item.description ?? ''),
      quantity: Number(item.quantity ?? 1),
      unit_price: Number(item.unit_price ?? 0),
      subtotal: Number(item.subtotal ?? 0),
    })),
    confidence: Number(parsed.confidence ?? 0),
  };
}

export function validateExtractionResult(result: ExtractionResult): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (result.total === null || result.total === undefined) {
    errors.push('Total amount is required');
  }
  if (result.confidence < 0 || result.confidence > 1) {
    errors.push('Confidence must be between 0 and 1');
  }
  return { valid: errors.length === 0, errors };
}

export async function extractReceiptData(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<ExtractionResult> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          { type: 'text', text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude Vision');
  }

  return parseExtractionResponse(textBlock.text);
}
```

**Step 5: Create barrel export**

`packages/ai/src/index.ts`:
```typescript
export { extractReceiptData, parseExtractionResponse, validateExtractionResult } from './extract';
export { EXTRACTION_PROMPT } from './prompt';
```

**Step 6: Run tests to verify they pass**

```bash
cd packages/ai && npx vitest run
```

Expected: All tests PASS.

**Step 7: Commit**

```bash
git add packages/ai/
git commit -m "feat: add AI extraction engine with Claude Vision, parser, and tests"
```

---

## Phase 2: Core Features (Parallel — 3 agents)

> **Parallelism:** Tasks 9-11 (Backend API), Tasks 12-16 (Frontend pages), Task 17 (AI refinement) can run in parallel.

---

### Task 9: Projects API — Full CRUD (Backend/DB)

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
    .select('*, architect:users!architect_id(id, full_name), receipts(total_amount)')
    .eq('organization_id', ctx.orgId)
    .order('created_at', { ascending: false });

  // Architects only see their assigned projects
  if (ctx.role === 'architect') {
    query = query.eq('architect_id', ctx.dbUserId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Calculate total_spend per project
  const projects = (data ?? []).map((p) => ({
    ...p,
    total_spend: (p.receipts as Array<{ total_amount: number }>)
      ?.reduce((sum: number, r: { total_amount: number }) => sum + Number(r.total_amount), 0) ?? 0,
    receipts: undefined,
  }));

  return NextResponse.json(projects);
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

**Step 2: Create Project detail + update + delete endpoint**

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

  // Supervisors can only update their own projects
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

### Task 10: Receipts API — Upload, Extract, CRUD (Backend/DB)

**Files:**
- Create: `apps/web/app/api/receipts/route.ts`
- Create: `apps/web/app/api/receipts/[id]/route.ts`
- Create: `apps/web/app/api/receipts/upload/route.ts`
- Create: `apps/web/app/api/receipts/extract/route.ts`

**Step 1: Upload endpoint (image → Supabase Storage)**

`apps/web/app/api/receipts/upload/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const db = getDb();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${ctx.orgId}/${randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await db.storage
    .from('receipts')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: urlData } = db.storage.from('receipts').getPublicUrl(path);

  return NextResponse.json({
    image_url: urlData.publicUrl,
    storage_path: path,
  });
}
```

**Step 2: Extract endpoint (image → Claude Vision)**

`apps/web/app/api/receipts/extract/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { extractReceiptData } from '@obralink/ai';

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const body = await req.json();
  const { image_base64, mime_type } = body;

  if (!image_base64) {
    return NextResponse.json({ error: 'image_base64 is required' }, { status: 400 });
  }

  try {
    const result = await extractReceiptData(image_base64, mime_type ?? 'image/jpeg');
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Extraction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 3: Receipts CRUD**

`apps/web/app/api/receipts/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id');
  const status = searchParams.get('status');

  const db = getDb();

  let query = db
    .from('receipts')
    .select('*, project:projects!project_id(id, name), uploader:users!uploaded_by(id, full_name)')
    .order('created_at', { ascending: false });

  // Filter by org via projects
  query = query.eq('project.organization_id', ctx.orgId);

  if (projectId) query = query.eq('project_id', projectId);
  if (status) query = query.eq('status', status);

  // Architects only see own receipts
  if (ctx.role === 'architect') {
    query = query.eq('uploaded_by', ctx.dbUserId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const body = await req.json();
  const db = getDb();

  // Insert receipt
  const { data: receipt, error: receiptError } = await db
    .from('receipts')
    .insert({
      project_id: body.project_id,
      uploaded_by: ctx.dbUserId,
      vendor: body.vendor,
      total_amount: body.total_amount,
      receipt_date: body.receipt_date,
      image_url: body.image_url,
      ai_raw_response: body.ai_raw_response ?? {},
      ai_confidence: body.ai_confidence ?? 0,
      status: 'confirmed',
    })
    .select()
    .single();

  if (receiptError) return NextResponse.json({ error: receiptError.message }, { status: 500 });

  // Insert receipt items if provided
  if (body.items?.length > 0) {
    const items = body.items.map((item: { description: string; quantity: number; unit_price: number }) => ({
      receipt_id: receipt.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    const { error: itemsError } = await db.from('receipt_items').insert(items);
    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json(receipt, { status: 201 });
}
```

`apps/web/app/api/receipts/[id]/route.ts`:
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
    .from('receipts')
    .select('*, project:projects!project_id(id, name), uploader:users!uploaded_by(id, full_name), receipt_items(*)')
    .eq('id', id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const { id } = await params;
  const db = getDb();

  const { error } = await db.from('receipts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
```

**Step 4: Commit**

```bash
git add apps/web/app/api/receipts/
git commit -m "feat: add Receipts API with upload, AI extraction, and CRUD"
```

---

### Task 11: Dashboard API (Backend/DB)

**Files:**
- Create: `apps/web/app/api/dashboard/stats/route.ts`
- Create: `apps/web/app/api/dashboard/spend-by-project/route.ts`
- Create: `apps/web/app/api/dashboard/spend-trend/route.ts`

**Step 1: Stats endpoint**

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
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).toISOString();

  const [projects, monthlySpend, weeklyReceipts, pendingReview] = await Promise.all([
    db.from('projects').select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId).eq('status', 'active'),
    db.from('receipts').select('total_amount, projects!inner(organization_id)')
      .eq('projects.organization_id', ctx.orgId)
      .eq('status', 'confirmed')
      .gte('receipt_date', startOfMonth),
    db.from('receipts').select('id', { count: 'exact', head: true })
      .gte('created_at', startOfWeek),
    db.from('receipts').select('id', { count: 'exact', head: true })
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

**Step 2: Spend by project endpoint**

`apps/web/app/api/dashboard/spend-by-project/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();

  const { data, error } = await db
    .from('projects')
    .select('id, name, receipts(total_amount)')
    .eq('organization_id', ctx.orgId)
    .eq('status', 'active');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = (data ?? []).map((p) => ({
    project_id: p.id,
    project_name: p.name,
    total_spend: (p.receipts as Array<{ total_amount: number }>)
      ?.reduce((sum: number, r: { total_amount: number }) => sum + Number(r.total_amount), 0) ?? 0,
  }));

  return NextResponse.json(result);
}
```

**Step 3: Spend trend endpoint**

`apps/web/app/api/dashboard/spend-trend/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();

  // Last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data, error } = await db
    .from('receipts')
    .select('total_amount, receipt_date, projects!inner(organization_id)')
    .eq('projects.organization_id', ctx.orgId)
    .eq('status', 'confirmed')
    .gte('receipt_date', sixMonthsAgo.toISOString().split('T')[0]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by month
  const monthMap = new Map<string, number>();
  for (const receipt of data ?? []) {
    const month = receipt.receipt_date.substring(0, 7); // YYYY-MM
    monthMap.set(month, (monthMap.get(month) ?? 0) + Number(receipt.total_amount));
  }

  const result = Array.from(monthMap.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return NextResponse.json(result);
}
```

**Step 4: Commit**

```bash
git add apps/web/app/api/dashboard/
git commit -m "feat: add Dashboard API with stats, spend-by-project, and spend-trend"
```

---

### Task 12: Projects List Page (Frontend)

**Files:**
- Create: `apps/web/app/(dashboard)/projects/page.tsx`
- Create: `apps/web/components/projects/project-card.tsx`

**Step 1: Create ProjectCard component**

`apps/web/components/projects/project-card.tsx`:
```tsx
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Project } from '@obralink/shared';

interface ProjectCardProps {
  project: Project & { total_spend: number; architect?: { full_name: string } | null };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold">{project.name}</CardTitle>
          <StatusBadge status={project.status} />
        </CardHeader>
        <CardContent>
          {project.address && (
            <p className="text-sm text-muted-foreground mb-1">{project.address}</p>
          )}
          {project.architect && (
            <p className="text-sm text-muted-foreground mb-2">Arq. {project.architect.full_name}</p>
          )}
          <p className="text-lg font-bold">{formatter.format(project.total_spend)}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
```

**Step 2: Create Projects list page**

`apps/web/app/(dashboard)/projects/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { Plus, FolderKanban } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingCards } from '@/components/ui/loading-skeleton';
import { ProjectCard } from '@/components/projects/project-card';
import type { Project } from '@obralink/shared';

type ProjectWithMeta = Project & { total_spend: number; architect?: { full_name: string } | null };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.address?.toLowerCase().includes(search.toLowerCase())
  );

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

      <Input
        placeholder="Buscar proyectos..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-6 max-w-sm"
      />

      {loading ? (
        <LoadingCards count={6} />
      ) : filtered.length === 0 ? (
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

**Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/projects/ apps/web/components/projects/
git commit -m "feat: add Projects list page with search and project cards"
```

---

### Task 13: Project Create/Edit Form (Frontend)

**Files:**
- Create: `apps/web/app/(dashboard)/projects/new/page.tsx`
- Create: `apps/web/app/(dashboard)/projects/[id]/edit/page.tsx`
- Create: `apps/web/components/projects/project-form.tsx`

**Step 1: Create shared form component**

`apps/web/components/projects/project-form.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Project, CreateProjectInput } from '@obralink/shared';

interface ProjectFormProps {
  project?: Project;
  architects?: Array<{ id: string; full_name: string }>;
}

export function ProjectForm({ project, architects = [] }: ProjectFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const isEdit = !!project;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const body: CreateProjectInput = {
      name: formData.get('name') as string,
      address: (formData.get('address') as string) || undefined,
      status: (formData.get('status') as CreateProjectInput['status']) || undefined,
      architect_id: (formData.get('architect_id') as string) || undefined,
    };

    const url = isEdit ? `/api/projects/${project.id}` : '/api/projects';
    const method = isEdit ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/projects/${data.id}`);
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre del proyecto *</Label>
        <Input id="name" name="name" defaultValue={project?.name} required placeholder="Ej: Amenábar 3821" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Dirección</Label>
        <Input id="address" name="address" defaultValue={project?.address ?? ''} placeholder="Dirección de la obra" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Estado</Label>
        <Select name="status" defaultValue={project?.status ?? 'active'}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="paused">Pausado</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {architects.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="architect_id">Arquitecto asignado</Label>
          <Select name="architect_id" defaultValue={project?.architect_id ?? ''}>
            <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
            <SelectContent>
              {architects.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear proyecto'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
      </div>
    </form>
  );
}
```

**Step 2: Create new project page**

`apps/web/app/(dashboard)/projects/new/page.tsx`:
```tsx
import { PageHeader } from '@/components/ui/page-header';
import { ProjectForm } from '@/components/projects/project-form';

export default function NewProjectPage() {
  return (
    <>
      <PageHeader title="Nuevo Proyecto" />
      <ProjectForm />
    </>
  );
}
```

**Step 3: Create edit project page**

`apps/web/app/(dashboard)/projects/[id]/edit/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { ProjectForm } from '@/components/projects/project-form';
import type { Project } from '@obralink/shared';

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((res) => res.json())
      .then(setProject);
  }, [id]);

  if (!project) return <div>Cargando...</div>;

  return (
    <>
      <PageHeader title="Editar Proyecto" />
      <ProjectForm project={project} />
    </>
  );
}
```

**Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/projects/ apps/web/components/projects/
git commit -m "feat: add project create/edit form with shared component"
```

---

### Task 14: Project Detail Page (Frontend)

**Files:**
- Create: `apps/web/app/(dashboard)/projects/[id]/page.tsx`

**Step 1: Create project detail page**

`apps/web/app/(dashboard)/projects/[id]/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Edit, Trash2, Upload, Receipt as ReceiptIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import type { Project, Receipt } from '@obralink/shared';

type ProjectDetail = Project & { architect?: { id: string; full_name: string; email: string } | null };

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  useEffect(() => {
    fetch(`/api/projects/${id}`).then((r) => r.json()).then(setProject);
    fetch(`/api/receipts?project_id=${id}`).then((r) => r.json()).then(setReceipts);
  }, [id]);

  if (!project) return <div>Cargando...</div>;

  const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
  const totalSpend = receipts.reduce((sum, r) => sum + Number(r.total_amount), 0);

  async function handleDelete() {
    if (!confirm('¿Estás seguro de eliminar este proyecto?')) return;
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/projects');
  }

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
            <Button variant="outline" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
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
          <CardContent><p className="text-2xl font-bold">{formatter.format(totalSpend)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Arquitecto</CardTitle></CardHeader>
          <CardContent><p>{project.architect?.full_name ?? 'Sin asignar'}</p></CardContent>
        </Card>
      </div>

      <h2 className="text-lg font-semibold mb-4">Comprobantes ({receipts.length})</h2>

      {receipts.length === 0 ? (
        <EmptyState
          icon={ReceiptIcon}
          title="Sin comprobantes"
          description="Cargá el primer comprobante para este proyecto."
          action={
            <Link href={`/upload?project=${id}`}>
              <Button><Upload className="h-4 w-4 mr-2" />Cargar Comprobante</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {receipts.map((receipt) => (
            <Link key={receipt.id} href={`/receipts/${receipt.id}`}>
              <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{receipt.vendor ?? 'Sin proveedor'}</p>
                    <p className="text-sm text-muted-foreground">{receipt.receipt_date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatter.format(receipt.total_amount)}</p>
                    <StatusBadge status={receipt.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/app/\(dashboard\)/projects/
git commit -m "feat: add project detail page with receipts list and actions"
```

---

### Task 15: Upload Receipt Flow (Frontend)

**Files:**
- Create: `apps/web/app/(dashboard)/upload/page.tsx`
- Create: `apps/web/components/receipts/camera-capture.tsx`

**Step 1: Create camera capture component**

`apps/web/components/receipts/camera-capture.tsx`:
```tsx
'use client';

import { useRef, useState, useCallback } from 'react';
import { Camera, Upload as UploadIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraCaptureProps {
  onCapture: (file: File, base64: string) => void;
}

export function CameraCapture({ onCapture }: CameraCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      setPreview(reader.result as string);
      onCapture(file, base64);
    };
    reader.readAsDataURL(file);
  }, [onCapture]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  if (preview) {
    return (
      <div className="relative">
        <img src={preview} alt="Preview" className="w-full max-h-96 object-contain rounded-lg border" />
        <Button
          variant="outline"
          size="icon"
          className="absolute top-2 right-2"
          onClick={() => setPreview(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="border-2 border-dashed rounded-lg p-8 text-center">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-3">
          <Button onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.setAttribute('capture', 'environment');
              fileInputRef.current.click();
            }
          }}>
            <Camera className="h-4 w-4 mr-2" />Tomar foto
          </Button>
          <Button variant="outline" onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.removeAttribute('capture');
              fileInputRef.current.click();
            }
          }}>
            <UploadIcon className="h-4 w-4 mr-2" />Elegir archivo
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Tomá una foto del comprobante o seleccioná una imagen</p>
      </div>
    </div>
  );
}
```

**Step 2: Create upload page**

`apps/web/app/(dashboard)/upload/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { CameraCapture } from '@/components/receipts/camera-capture';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { ExtractionResult } from '@obralink/shared';

export default function UploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProject = searchParams.get('project');

  const [file, setFile] = useState<File | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  async function handleExtract() {
    if (!base64 || !file) return;
    setExtracting(true);

    try {
      // Upload image first
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/receipts/upload', { method: 'POST', body: formData });
      const { image_url } = await uploadRes.json();

      // Extract with AI
      const extractRes = await fetch('/api/receipts/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64, mime_type: file.type }),
      });
      const extraction: ExtractionResult = await extractRes.json();

      // Navigate to review page with data
      const params = new URLSearchParams({
        image_url,
        extraction: JSON.stringify(extraction),
        ...(preselectedProject ? { project: preselectedProject } : {}),
      });
      router.push(`/upload/review?${params.toString()}`);
    } catch {
      alert('Error al procesar la imagen');
    } finally {
      setExtracting(false);
    }
  }

  return (
    <>
      <PageHeader title="Cargar Comprobante" description="Tomá una foto o subí una imagen del comprobante" />

      <div className="max-w-lg mx-auto space-y-6">
        <CameraCapture onCapture={(f, b64) => { setFile(f); setBase64(b64); }} />

        {file && (
          <Button onClick={handleExtract} disabled={extracting} className="w-full">
            {extracting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Procesando con IA...</>
            ) : (
              'Extraer datos con IA'
            )}
          </Button>
        )}
      </div>
    </>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/upload/ apps/web/components/receipts/
git commit -m "feat: add receipt upload flow with camera capture and AI extraction"
```

---

### Task 16: AI Review & Confirm Screen (Frontend)

**Files:**
- Create: `apps/web/app/(dashboard)/upload/review/page.tsx`
- Create: `apps/web/components/receipts/inline-edit-field.tsx`

**Step 1: Create InlineEditField component**

`apps/web/components/receipts/inline-edit-field.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineEditFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'date';
  lowConfidence?: boolean;
}

export function InlineEditField({ label, value, onChange, type = 'text', lowConfidence }: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function save() {
    onChange(draft);
    setEditing(false);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground w-24">{label}</span>
        <Input
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
        />
        <Button size="icon" variant="ghost" onClick={save}><Check className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={cancel}><X className="h-4 w-4" /></Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50 transition-colors',
        lowConfidence && 'bg-yellow-50 border border-yellow-200'
      )}
      onClick={() => setEditing(true)}
    >
      <span className="text-sm text-muted-foreground w-24">{label}</span>
      <span className="flex-1 font-medium">{value || '—'}</span>
      <Pencil className="h-3 w-3 text-muted-foreground" />
    </div>
  );
}
```

**Step 2: Create review page**

`apps/web/app/(dashboard)/upload/review/page.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/ui/page-header';
import { InlineEditField } from '@/components/receipts/inline-edit-field';
import type { ExtractionResult, Project } from '@obralink/shared';
import { cn } from '@/lib/utils';

export default function ReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const imageUrl = searchParams.get('image_url') ?? '';
  const extractionRaw = searchParams.get('extraction') ?? '{}';
  const preselectedProject = searchParams.get('project') ?? '';

  const initialExtraction: ExtractionResult = JSON.parse(extractionRaw);

  const [vendor, setVendor] = useState(initialExtraction.vendor ?? '');
  const [date, setDate] = useState(initialExtraction.date ?? '');
  const [total, setTotal] = useState(String(initialExtraction.total ?? ''));
  const [items, setItems] = useState(initialExtraction.items ?? []);
  const [projectId, setProjectId] = useState(preselectedProject);
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);

  const confidence = initialExtraction.confidence ?? 0;

  useEffect(() => {
    fetch('/api/projects').then((r) => r.json()).then(setProjects);
  }, []);

  const confidenceColor = confidence > 0.85 ? 'bg-green-100 text-green-800' :
    confidence > 0.6 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';

  async function handleConfirm() {
    if (!projectId) { alert('Seleccioná un proyecto'); return; }
    setSaving(true);

    const res = await fetch('/api/receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        vendor: vendor || null,
        total_amount: Number(total),
        receipt_date: date,
        image_url: imageUrl,
        ai_raw_response: initialExtraction,
        ai_confidence: confidence,
        items: items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      }),
    });

    if (res.ok) {
      router.push(`/projects/${projectId}`);
    }
    setSaving(false);
  }

  return (
    <>
      <PageHeader title="Revisar Comprobante" />

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Confidence badge */}
        <Badge className={cn('text-sm', confidenceColor)}>
          Confianza IA: {Math.round(confidence * 100)}%
        </Badge>
        {confidence < 0.6 && (
          <p className="text-sm text-red-600">Revisá todos los campos, la extracción tiene baja confianza.</p>
        )}

        {/* Image preview */}
        <img src={imageUrl} alt="Receipt" className="w-full max-h-64 object-contain rounded-lg border" />

        {/* Extracted fields */}
        <Card>
          <CardHeader><CardTitle className="text-base">Datos extraídos</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <InlineEditField label="Proveedor" value={vendor} onChange={setVendor} lowConfidence={confidence < 0.6} />
            <InlineEditField label="Fecha" value={date} onChange={setDate} type="date" lowConfidence={confidence < 0.6} />
            <InlineEditField label="Total" value={total} onChange={setTotal} type="number" lowConfidence={confidence < 0.6} />
          </CardContent>
        </Card>

        {/* Items */}
        {items.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Items ({items.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="border rounded p-3 space-y-1">
                  <InlineEditField label="Descripción" value={item.description}
                    onChange={(v) => { const copy = [...items]; copy[i] = { ...copy[i], description: v }; setItems(copy); }} />
                  <InlineEditField label="Cantidad" value={String(item.quantity)} type="number"
                    onChange={(v) => { const copy = [...items]; copy[i] = { ...copy[i], quantity: Number(v), subtotal: Number(v) * copy[i].unit_price }; setItems(copy); }} />
                  <InlineEditField label="Precio unit." value={String(item.unit_price)} type="number"
                    onChange={(v) => { const copy = [...items]; copy[i] = { ...copy[i], unit_price: Number(v), subtotal: copy[i].quantity * Number(v) }; setItems(copy); }} />
                  <p className="text-sm text-right text-muted-foreground">Subtotal: ${item.subtotal.toFixed(2)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Project selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Proyecto *</label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger><SelectValue placeholder="Seleccioná un proyecto" /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={handleConfirm} disabled={saving} className="flex-1">
            {saving ? 'Guardando...' : 'Confirmar'}
          </Button>
          <Button variant="outline" onClick={() => router.back()}>Descartar</Button>
        </div>
      </div>
    </>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/upload/review/ apps/web/components/receipts/
git commit -m "feat: add AI review & confirm screen with inline tap-to-edit"
```

---

### Task 17: Receipts List + Detail Pages (Frontend)

**Files:**
- Create: `apps/web/app/(dashboard)/receipts/page.tsx`
- Create: `apps/web/app/(dashboard)/receipts/[id]/page.tsx`

**Step 1: Create receipts list page**

`apps/web/app/(dashboard)/receipts/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Receipt as ReceiptIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Receipt } from '@obralink/shared';

type ReceiptWithMeta = Receipt & {
  project?: { id: string; name: string };
  uploader?: { id: string; full_name: string };
};

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/receipts')
      .then((r) => r.json())
      .then(setReceipts)
      .finally(() => setLoading(false));
  }, []);

  const filtered = receipts.filter((r) =>
    r.vendor?.toLowerCase().includes(search.toLowerCase()) ||
    r.project?.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

  return (
    <>
      <PageHeader title="Comprobantes" description="Todos los comprobantes cargados" />
      <Input
        placeholder="Buscar por proveedor o proyecto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-6 max-w-sm"
      />
      {loading ? (
        <LoadingTable rows={8} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ReceiptIcon} title="Sin comprobantes" description="Cargá tu primer comprobante desde un proyecto." />
      ) : (
        <div className="space-y-2">
          {filtered.map((receipt) => (
            <Link key={receipt.id} href={`/receipts/${receipt.id}`}>
              <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{receipt.vendor ?? 'Sin proveedor'}</p>
                    <p className="text-sm text-muted-foreground">
                      {receipt.project?.name} &middot; {receipt.receipt_date}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatter.format(receipt.total_amount)}</p>
                    <StatusBadge status={receipt.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
```

**Step 2: Create receipt detail page**

`apps/web/app/(dashboard)/receipts/[id]/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import type { Receipt, ReceiptItem } from '@obralink/shared';
import { cn } from '@/lib/utils';

type ReceiptDetail = Receipt & {
  project?: { id: string; name: string };
  uploader?: { id: string; full_name: string };
  receipt_items: ReceiptItem[];
};

export default function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);

  useEffect(() => {
    fetch(`/api/receipts/${id}`).then((r) => r.json()).then(setReceipt);
  }, [id]);

  if (!receipt) return <div>Cargando...</div>;

  const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
  const confidence = receipt.ai_confidence;
  const confidenceColor = confidence > 0.85 ? 'bg-green-100 text-green-800' :
    confidence > 0.6 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';

  return (
    <>
      <PageHeader title={receipt.vendor ?? 'Comprobante'} />

      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex gap-2">
          <StatusBadge status={receipt.status} />
          <Badge className={cn('text-xs', confidenceColor)}>
            IA: {Math.round(confidence * 100)}%
          </Badge>
        </div>

        <img src={receipt.image_url} alt="Receipt" className="w-full max-h-96 object-contain rounded-lg border" />

        <Card>
          <CardHeader><CardTitle className="text-base">Datos</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Proveedor</span><span>{receipt.vendor ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Fecha</span><span>{receipt.receipt_date}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold text-lg">{formatter.format(receipt.total_amount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Proyecto</span><span>{receipt.project?.name ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Cargado por</span><span>{receipt.uploader?.full_name ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Fecha de carga</span><span>{new Date(receipt.created_at).toLocaleDateString('es-AR')}</span></div>
          </CardContent>
        </Card>

        {receipt.receipt_items.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Items</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2">Descripcion</th>
                    <th className="text-right py-2">Cant.</th>
                    <th className="text-right py-2">P. Unit.</th>
                    <th className="text-right py-2">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.receipt_items.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-2">{item.description}</td>
                      <td className="text-right py-2">{item.quantity}</td>
                      <td className="text-right py-2">{formatter.format(item.unit_price)}</td>
                      <td className="text-right py-2">{formatter.format(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/receipts/
git commit -m "feat: add receipts list and detail pages"
```

---

## Phase 3: Integration (Semi-Parallel)

### Task 18: Dashboard Page with Recharts (Frontend)

**Files:**
- Create: `apps/web/app/(dashboard)/page.tsx`
- Create: `apps/web/components/dashboard/spend-chart.tsx`
- Create: `apps/web/components/dashboard/trend-chart.tsx`
- Create: `apps/web/components/dashboard/recent-receipts.tsx`

**Step 1: Install Recharts**

```bash
cd apps/web && npm install recharts
```

**Step 2: Create spend-by-project chart**

`apps/web/components/dashboard/spend-chart.tsx`:
```tsx
'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SpendByProject } from '@obralink/shared';

export function SpendChart({ data }: { data: SpendByProject[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Gasto por Proyecto</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="project_name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => [`$${v.toLocaleString('es-AR')}`, 'Gasto']} />
            <Bar dataKey="total_spend" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Create trend chart**

`apps/web/components/dashboard/trend-chart.tsx`:
```tsx
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SpendTrend } from '@obralink/shared';

export function TrendChart({ data }: { data: SpendTrend[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Tendencia Mensual</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => [`$${v.toLocaleString('es-AR')}`, 'Total']} />
            <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Create recent receipts component**

`apps/web/components/dashboard/recent-receipts.tsx`:
```tsx
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Receipt } from '@obralink/shared';

type ReceiptWithProject = Receipt & { project?: { name: string } };

export function RecentReceipts({ receipts }: { receipts: ReceiptWithProject[] }) {
  const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Comprobantes Recientes</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {receipts.slice(0, 5).map((r) => (
          <Link key={r.id} href={`/receipts/${r.id}`} className="flex justify-between items-center p-2 rounded hover:bg-muted/50">
            <div>
              <p className="text-sm font-medium">{r.vendor ?? 'Sin proveedor'}</p>
              <p className="text-xs text-muted-foreground">{r.project?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{formatter.format(r.total_amount)}</p>
              <StatusBadge status={r.status} />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
```

**Step 5: Create dashboard page**

`apps/web/app/(dashboard)/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { FolderKanban, DollarSign, Receipt, AlertCircle } from 'lucide-react';
import { KPICard } from '@/components/ui/kpi-card';
import { SpendChart } from '@/components/dashboard/spend-chart';
import { TrendChart } from '@/components/dashboard/trend-chart';
import { RecentReceipts } from '@/components/dashboard/recent-receipts';
import type { DashboardStats, SpendByProject, SpendTrend } from '@obralink/shared';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [spendByProject, setSpendByProject] = useState<SpendByProject[]>([]);
  const [trend, setTrend] = useState<SpendTrend[]>([]);
  const [receipts, setReceipts] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/stats').then((r) => r.json()),
      fetch('/api/dashboard/spend-by-project').then((r) => r.json()),
      fetch('/api/dashboard/spend-trend').then((r) => r.json()),
      fetch('/api/receipts').then((r) => r.json()),
    ]).then(([s, sp, t, rc]) => {
      setStats(s);
      setSpendByProject(sp);
      setTrend(t);
      setReceipts(rc);
    });
  }, []);

  const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Proyectos Activos" value={stats?.active_projects ?? '—'} icon={FolderKanban} />
        <KPICard title="Gasto Mensual" value={stats ? formatter.format(stats.monthly_spend) : '—'} icon={DollarSign} />
        <KPICard title="Comprobantes (semana)" value={stats?.weekly_receipts ?? '—'} icon={Receipt} />
        <KPICard title="Pendientes de revisión" value={stats?.pending_review ?? '—'} icon={AlertCircle} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SpendChart data={spendByProject} />
        <TrendChart data={trend} />
      </div>

      <RecentReceipts receipts={receipts} />
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add apps/web/app/\(dashboard\)/page.tsx apps/web/components/dashboard/
git commit -m "feat: add dashboard page with KPIs, spend chart, trend chart, and recent receipts"
```

---

### Task 19: Settings Page — User Management (Frontend)

**Files:**
- Create: `apps/web/app/(dashboard)/settings/page.tsx`

**Step 1: Create settings page**

`apps/web/app/(dashboard)/settings/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { User } from '@obralink/shared';

export default function SettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Create /api/users endpoint
    setLoading(false);
  }, []);

  const roleLabels: Record<string, string> = {
    admin: 'Admin',
    supervisor: 'Supervisor',
    architect: 'Arquitecto',
  };

  return (
    <>
      <PageHeader title="Ajustes" description="Gestioná tu equipo y roles" />

      <Card>
        <CardHeader><CardTitle className="text-base">Miembros del equipo</CardTitle></CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Los miembros del equipo se sincronizan desde Clerk.</p>
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={user.avatar_url ?? undefined} />
                      <AvatarFallback>{user.full_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.full_name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{roleLabels[user.role] ?? user.role}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings/
git commit -m "feat: add settings page with team member list"
```

---

## Phase 4: Polish + QA (Sequential)

### Task 20: Mobile Responsiveness + Loading/Error States

**Files:**
- Modify: All page components to verify mobile layout
- Modify: All data-fetching pages to add proper error handling

**Step 1: Add error boundaries and loading states**

Review each page and ensure:
- Every `fetch` has `.catch()` with error state display
- Loading states use the `LoadingCards` or `LoadingTable` components
- All layouts are tested at 375px width
- Bottom nav doesn't overlap content (pb-16 on mobile)
- Sidebar hides on mobile (already done with `hidden md:flex`)

**Step 2: Add Toaster for notifications**

Add to `apps/web/app/layout.tsx`:
```tsx
import { Toaster } from '@/components/ui/toaster';
// ... add <Toaster /> before closing </body>
```

**Step 3: Commit**

```bash
git add -A
git commit -m "fix: improve mobile responsiveness, loading states, and error handling"
```

---

### Task 21: Role-Based Navigation Visibility + Final Polish

**Files:**
- Modify: `apps/web/components/sidebar.tsx`
- Modify: `apps/web/components/bottom-nav.tsx`

**Step 1: Filter nav items by role**

Update sidebar and bottom-nav to accept user role and conditionally show Settings (admin only).

**Step 2: Create README.md**

Create root-level README with:
- Project description
- Tech stack
- Setup instructions (env vars, Supabase, Clerk)
- Development commands

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: add role-based nav visibility, README, and final polish"
```

---

## Summary

| Phase | Tasks | Parallelism | Key Deliverables |
|-------|-------|-------------|------------------|
| 0 | 1-2 | Sequential | Monorepo, shared types |
| 1 | 3-8 | Full parallel (3 agents) | DB schema, RLS, webhook, layout, UI components, AI engine |
| 2 | 9-17 | Full parallel (3 agents) | All API routes, all frontend pages, AI refinement |
| 3 | 18-19 | Semi-parallel | Dashboard with charts, settings page |
| 4 | 20-21 | Sequential | Mobile polish, role nav, README |

**Total tasks:** 21
**Parallel tracks:** Backend/DB, Frontend, AI Agent
