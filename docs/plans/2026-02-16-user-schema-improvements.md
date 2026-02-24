# User Schema Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix user name bugs, add name+role badge to sidebar, add org settings CRUD, user deactivation, and Clerk invitations.

**Architecture:** 3 iterations with increasing scope. Iteration 1 fixes data bugs and sidebar (no DB changes). Iteration 2 adds org settings API/UI and user deactivation (DB migration already applied). Iteration 3 adds Clerk-based invitations. Each iteration is a separate worktree/branch/PR.

**Tech Stack:** Next.js 15 (App Router), Clerk (auth + invitations), Supabase (Postgres + Storage), SWR, shadcn/ui, TypeScript

---

## Iteration 1: Fix User Data + Sidebar

### Task 1: Fix user name resolution in auth.ts bootstrap

**Files:**
- Modify: `apps/web/lib/auth.ts:73-75`

**Context:** The slow-path bootstrap in `getAuthContext()` reads `sessionClaims.name` which doesn't exist in Clerk's token. This causes users to be created with `full_name = 'Usuario'`. Clerk session claims use `firstName` and `lastName` (or the `fullName` field inside the JWT custom claims).

**Step 1: Investigate Clerk session claims structure**

Check what fields are actually available on `sessionClaims`. Clerk's default JWT template includes:
- `sessionClaims.firstName` / `sessionClaims.lastName` (sometimes)
- `sessionClaims.fullName` (sometimes)
- The standard way is via the `name` claim in OIDC, but Clerk may not include it by default

The safest approach: use Clerk's `clerkClient` to fetch the user profile server-side when the session claims don't have the name.

**Step 2: Implement the fix**

Replace lines 73-75 in `apps/web/lib/auth.ts`:

```typescript
// OLD:
const fullName = (sessionClaims as Record<string, unknown>)?.name as string ?? 'Usuario';
const email = (sessionClaims as Record<string, unknown>)?.email as string ?? '';

// NEW:
let fullName = 'Usuario';
let email = '';

// Try session claims first (fastest)
const claims = sessionClaims as Record<string, unknown>;
if (claims?.name && typeof claims.name === 'string' && claims.name.trim()) {
  fullName = claims.name.trim();
} else if (claims?.firstName || claims?.lastName) {
  fullName = `${claims.firstName ?? ''} ${claims.lastName ?? ''}`.trim() || 'Usuario';
}
if (claims?.email && typeof claims.email === 'string') {
  email = claims.email;
}

// If name is still default, fetch from Clerk API (slow but accurate)
if (fullName === 'Usuario') {
  try {
    const { clerkClient } = await import('@clerk/nextjs/server');
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    fullName = `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || 'Usuario';
    email = email || clerkUser.emailAddresses?.[0]?.emailAddress ?? '';
  } catch (e) {
    console.error('Failed to fetch Clerk user for bootstrap:', e);
  }
}
```

**Step 3: Run dev server and verify**

Run: `cd apps/web && npm run dev`
- Sign in and check the browser console/network tab for the `/api/me` call
- Verify no errors in the terminal

**Step 4: Commit**

```bash
git add apps/web/lib/auth.ts
git commit -m "fix: resolve user name from Clerk API when session claims lack name"
```

---

### Task 2: Update useCurrentUser hook to expose fullName

**Files:**
- Modify: `apps/web/lib/use-current-user.ts`

**Context:** The sidebar needs the user's name. The `useCurrentUser()` hook currently only returns role info. We can get the name from Clerk's `useUser()` which is already imported.

**Step 1: Add fullName to the hook return value**

Replace the return block in `apps/web/lib/use-current-user.ts`:

```typescript
// OLD return:
return {
  role,
  isLoaded: isLoaded && (!!clerkRole || !!data),
  isAdmin: role === 'admin',
  isAdminOrSupervisor: role === 'admin' || role === 'supervisor',
};

// NEW return:
const fullName = user
  ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Usuario'
  : 'Usuario';

return {
  role,
  fullName,
  isLoaded: isLoaded && (!!clerkRole || !!data),
  isAdmin: role === 'admin',
  isAdminOrSupervisor: role === 'admin' || role === 'supervisor',
};
```

**Step 2: Commit**

```bash
git add apps/web/lib/use-current-user.ts
git commit -m "feat: expose fullName from useCurrentUser hook"
```

---

### Task 3: Add name + role badge to sidebar

**Files:**
- Modify: `apps/web/components/sidebar.tsx`

**Context:** Currently the sidebar footer only shows `<UserButton />` (Clerk's avatar button). We need to add the user's full name and a role badge next to it.

The `Badge` component already exists at `apps/web/components/ui/badge.tsx`. The `ROLE_LABELS` and `ROLE_COLORS` maps exist in `apps/web/app/(dashboard)/settings/page.tsx` but are local. We'll define minimal inline versions in the sidebar to avoid coupling.

**Step 1: Update the sidebar component**

Replace the full file `apps/web/components/sidebar.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, Receipt, Upload, Settings } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/use-current-user';
import { Badge } from '@/components/ui/badge';
import type { UserRole } from '@architech/shared';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Proyectos', icon: FolderKanban },
  { href: '/receipts', label: 'Comprobantes', icon: Receipt },
  { href: '/upload', label: 'Cargar', icon: Upload },
  { href: '/settings', label: 'Ajustes', icon: Settings },
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  architect: 'Arquitecto',
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  supervisor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  architect: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin, role, fullName } = useCurrentUser();

  const visibleNavItems = navItems.filter(
    (item) => item.href !== '/settings' || isAdmin
  );

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-background">
      <div className="flex h-16 items-center px-6 border-b">
        <h1 className="text-xl font-bold">Agentect</h1>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
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
            <span className="text-sm font-medium truncate">{fullName}</span>
            <Badge
              variant="secondary"
              className={cn('w-fit text-xs', ROLE_COLORS[role])}
            >
              {ROLE_LABELS[role]}
            </Badge>
          </div>
        </div>
      </div>
    </aside>
  );
}
```

**Step 2: Verify visually**

Run: `cd apps/web && npm run dev`
- Open the app in browser
- Verify the sidebar footer shows: avatar | name (truncated if long) | role badge
- Verify the badge color matches the role

**Step 3: Commit**

```bash
git add apps/web/components/sidebar.tsx
git commit -m "feat: show user name and role badge in sidebar"
```

---

### Task 4: Fix existing users with 'Usuario' full_name (retroactive)

**Context:** The user already has records with `full_name = 'Usuario'` in Supabase. The webhook handler (`apps/web/app/api/webhooks/clerk/route.ts:123`) correctly reads `data.first_name`/`data.last_name`, so future webhook events will fix names. But existing records need a manual fix.

**Step 1: Run SQL in Supabase dashboard**

The user should run this SQL manually in Supabase to fix existing records. Provide it as documentation:

```sql
-- Check which users have the default name
SELECT id, clerk_user_id, full_name, email FROM users WHERE full_name = 'Usuario';
```

Then update them manually based on the Clerk dashboard data, or trigger a user.updated webhook by editing the user in Clerk dashboard (which will re-fire the webhook and update the name correctly).

**Step 2: Document in commit**

No code change needed — the fix from Task 1 prevents future occurrences, and the webhook already handles updates. Add a note as a commit message.

```bash
git commit --allow-empty -m "docs: retroactive user name fix via Clerk webhook re-trigger"
```

---

### Task 5: Create PR for Iteration 1

**Step 1: Push branch and create PR**

```bash
git push -u origin fix/user-data-sidebar
gh pr create --title "fix: user name resolution + sidebar name/role badge" --body "$(cat <<'EOF'
## Summary
- Fix user name resolution in auth.ts bootstrap (was always defaulting to 'Usuario')
- Add fullName to useCurrentUser() hook
- Show user name + role badge in sidebar footer
- Retroactive fix: re-trigger Clerk webhooks for existing users

## Test plan
- [ ] Sign in and verify sidebar shows correct name + role badge
- [ ] Create a new user and verify name is correctly saved in Supabase
- [ ] Verify role badge colors match (Admin=violet, Supervisor=blue, Arquitecto=green)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Iteration 2: Organization Settings + User Management

### Task 6: Add Organization type fields to shared types

**Files:**
- Modify: `packages/shared/src/types.ts:3-9`

**Context:** The `Organization` interface needs new fields matching the DB migration already applied. The `User` interface needs `is_active`.

**Step 1: Update the Organization interface**

In `packages/shared/src/types.ts`, replace the Organization interface:

```typescript
export interface Organization {
  id: string;
  name: string;
  slug: string;
  address_street: string | null;
  address_locality: string | null;
  address_province: string | null;
  address_postal_code: string | null;
  phone: string | null;
  logo_url: string | null;
  website: string | null;
  contact_email: string | null;
  social_instagram: string | null;
  social_linkedin: string | null;
  created_at: string;
  updated_at: string;
}
```

**Step 2: Add is_active to User interface**

In the same file, add `is_active` to the User interface:

```typescript
export interface User {
  id: string;
  clerk_user_id: string;
  organization_id: string;
  role: UserRole;
  full_name: string;
  email: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}
```

**Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: expand Organization and User types for settings and deactivation"
```

---

### Task 7: Create Organization Settings API

**Files:**
- Create: `apps/web/app/api/organization/route.ts`

**Step 1: Implement GET and PATCH**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();
  const { data, error } = await db
    .from('organizations')
    .select('*')
    .eq('id', ctx.orgId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only allow updating specific fields
  const allowedFields = [
    'name', 'address_street', 'address_locality', 'address_province',
    'address_postal_code', 'phone', 'logo_url', 'website',
    'contact_email', 'social_instagram', 'social_linkedin',
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('organizations')
    .update(updates)
    .eq('id', ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

**Step 2: Commit**

```bash
git add apps/web/app/api/organization/route.ts
git commit -m "feat: add GET/PATCH API for organization settings"
```

---

### Task 8: Create Organization Logo Upload API

**Files:**
- Create: `apps/web/app/api/organization/logo/route.ts`

**Context:** Reuse the same Supabase Storage pattern from `apps/web/app/api/receipts/upload/route.ts`. Use a separate bucket or path prefix `org-logos/`.

**Step 1: Implement POST endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { randomUUID } from 'crypto';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File must be an image (JPEG, PNG, WebP, SVG)' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File size must be under 2MB' }, { status: 400 });
  }

  const db = getDb();
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? 'png';
  const path = `org-logos/${ctx.orgId}/${randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await db.storage
    .from('receipts')
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  // Save logo path to organization
  const { data, error: updateError } = await db
    .from('organizations')
    .update({ logo_url: path })
    .eq('id', ctx.orgId)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Generate signed URL for immediate preview
  const { data: signedData } = await db.storage
    .from('receipts')
    .createSignedUrl(path, 3600);

  return NextResponse.json({
    logo_url: path,
    signed_url: signedData?.signedUrl ?? null,
    organization: data,
  });
}
```

**Step 2: Commit**

```bash
git add apps/web/app/api/organization/logo/route.ts
git commit -m "feat: add organization logo upload endpoint"
```

---

### Task 9: Create Organization Settings UI

**Files:**
- Create: `apps/web/components/org-settings-form.tsx`
- Modify: `apps/web/app/(dashboard)/settings/page.tsx`

**Context:** Add a new section above the user table in Settings. Use shadcn/ui form components (Input, Label, Button). The org settings form should be a separate component for clean separation.

**Step 1: Create the org settings form component**

Create `apps/web/components/org-settings-form.tsx`:

```typescript
'use client';

import { useState, useRef } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Building2, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Organization } from '@architech/shared';

export function OrgSettingsForm() {
  const { data: org, mutate } = useSWR<Organization>('/api/organization', fetcher);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!org) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const updates: Record<string, string | null> = {};

    for (const [key, value] of formData.entries()) {
      updates[key] = (value as string).trim() || null;
    }

    try {
      const res = await fetch('/api/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar');
      }

      const updated = await res.json();
      mutate(updated, false);
      toast.success('Configuración guardada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/organization/logo', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al subir logo');
      }

      const result = await res.json();
      setLogoPreview(result.signed_url);
      mutate(result.organization, false);
      toast.success('Logo actualizado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir logo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6 mb-8">
      <h2 className="text-lg font-semibold mb-4">Organización</h2>

      {/* Logo */}
      <div className="flex items-center gap-4 mb-6">
        <Avatar className="h-16 w-16">
          <AvatarImage src={logoPreview ?? undefined} alt={org.name} />
          <AvatarFallback><Building2 className="h-8 w-8" /></AvatarFallback>
        </Avatar>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            {uploading ? 'Subiendo...' : 'Cambiar logo'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleLogoUpload}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" defaultValue={org.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_email">Email de contacto</Label>
            <Input id="contact_email" name="contact_email" type="email" defaultValue={org.contact_email ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" name="phone" defaultValue={org.phone ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input id="website" name="website" defaultValue={org.website ?? ''} />
          </div>
        </div>

        <h3 className="text-sm font-medium text-muted-foreground pt-2">Dirección</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="address_street">Calle</Label>
            <Input id="address_street" name="address_street" defaultValue={org.address_street ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_locality">Localidad</Label>
            <Input id="address_locality" name="address_locality" defaultValue={org.address_locality ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_province">Provincia</Label>
            <Input id="address_province" name="address_province" defaultValue={org.address_province ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_postal_code">Código Postal</Label>
            <Input id="address_postal_code" name="address_postal_code" defaultValue={org.address_postal_code ?? ''} />
          </div>
        </div>

        <h3 className="text-sm font-medium text-muted-foreground pt-2">Redes sociales</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="social_instagram">Instagram</Label>
            <Input id="social_instagram" name="social_instagram" placeholder="@usuario" defaultValue={org.social_instagram ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="social_linkedin">LinkedIn</Label>
            <Input id="social_linkedin" name="social_linkedin" placeholder="URL o nombre" defaultValue={org.social_linkedin ?? ''} />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

**Step 2: Add OrgSettingsForm to settings page**

In `apps/web/app/(dashboard)/settings/page.tsx`, add the import and render it above the users table:

Add import at top:
```typescript
import { OrgSettingsForm } from '@/components/org-settings-form';
```

In the main return block (after `<PageHeader>`, before the table `<div>`), add:
```tsx
<OrgSettingsForm />
```

**Step 3: Verify**

Run: `cd apps/web && npm run dev`
- Go to Settings page
- Verify the org settings form renders above the user table
- Try updating fields and saving
- Try uploading a logo

**Step 4: Commit**

```bash
git add apps/web/components/org-settings-form.tsx apps/web/app/\(dashboard\)/settings/page.tsx
git commit -m "feat: add organization settings form with logo upload"
```

---

### Task 10: Add user deactivation API

**Files:**
- Create: `apps/web/app/api/users/[id]/status/route.ts`
- Modify: `apps/web/lib/auth.ts` (add is_active check)

**Step 1: Create the status toggle endpoint**

Create `apps/web/app/api/users/[id]/status/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const { id } = await params;

  // Prevent deactivating yourself
  if (id === ctx.dbUserId) {
    return NextResponse.json(
      { error: 'No podés desactivar tu propio usuario' },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (typeof body.is_active !== 'boolean') {
    return NextResponse.json(
      { error: 'is_active debe ser true o false' },
      { status: 400 }
    );
  }

  const db = getDb();
  const { data, error } = await db
    .from('users')
    .update({ is_active: body.is_active })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  return NextResponse.json(data);
}
```

**Step 2: Add is_active check to getAuthContext()**

In `apps/web/lib/auth.ts`, after finding an existing user (line 41-48), add an `is_active` check:

After `if (existingUser) {`, before the return, add:

```typescript
if (existingUser) {
  // Check if user is deactivated
  if (existingUser.is_active === false) {
    return null;
  }

  return {
    userId,
    orgId,
    role: existingUser.role as UserRole,
    dbUserId: existingUser.id,
  };
}
```

Also update the select to include `is_active`:
```typescript
.select('id, role, is_active')
```

**Step 3: Commit**

```bash
git add apps/web/app/api/users/\[id\]/status/route.ts apps/web/lib/auth.ts
git commit -m "feat: add user deactivation API and auth gate"
```

---

### Task 11: Add deactivation toggle to Settings UI

**Files:**
- Modify: `apps/web/app/(dashboard)/settings/page.tsx`

**Context:** Add a toggle switch (or button) in the user table to activate/deactivate users. Import the `Switch` component from shadcn/ui.

**Step 1: Add switch column to user table**

In `apps/web/app/(dashboard)/settings/page.tsx`:

Add import:
```typescript
import { Switch } from '@/components/ui/switch';
```

Add a new state for tracking status updates:
```typescript
const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
```

Add handler function:
```typescript
const handleStatusToggle = async (userId: string, newStatus: boolean) => {
  setTogglingUserId(userId);
  try {
    const response = await fetch(`/api/users/${userId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: newStatus }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al actualizar el estado');
    }

    const updatedUser = await response.json();
    mutate(
      users?.map((u) => (u.id === userId ? updatedUser : u)),
      false
    );

    toast.success(newStatus ? 'Usuario activado' : 'Usuario desactivado');
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Error al actualizar el estado');
    mutate();
  } finally {
    setTogglingUserId(null);
  }
};
```

Add a new column header after "Fecha de registro":
```tsx
<TableHead className="w-[80px]">Activo</TableHead>
```

Add a new cell in the row after the date cell:
```tsx
<TableCell>
  <Switch
    checked={user.is_active !== false}
    onCheckedChange={(checked) => handleStatusToggle(user.id, checked)}
    disabled={togglingUserId === user.id || isCurrentUser}
  />
</TableCell>
```

**Step 2: Check if Switch component exists**

Run: `ls apps/web/components/ui/switch.tsx`

If it doesn't exist, install it:
```bash
cd apps/web && npx shadcn@latest add switch
```

**Step 3: Verify**

Run: `cd apps/web && npm run dev`
- Go to Settings
- Verify the switch appears for each user
- Try toggling a non-current user
- Verify the switch for yourself is disabled

**Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings/page.tsx apps/web/components/ui/switch.tsx
git commit -m "feat: add user active/inactive toggle in settings"
```

---

### Task 12: Update GET /api/users to include is_active

**Files:**
- Modify: `apps/web/app/api/users/route.ts`

**Step 1: Add is_active to the select**

In `apps/web/app/api/users/route.ts`, update the select:

```typescript
// OLD:
.select('id, clerk_user_id, organization_id, role, full_name, email, avatar_url, created_at')

// NEW:
.select('id, clerk_user_id, organization_id, role, full_name, email, avatar_url, is_active, created_at')
```

**Step 2: Commit**

```bash
git add apps/web/app/api/users/route.ts
git commit -m "feat: include is_active in user list API response"
```

---

### Task 13: Create PR for Iteration 2

**Step 1: Push branch and create PR**

```bash
git push -u origin feat/org-settings-user-mgmt
gh pr create --title "feat: organization settings and user deactivation" --body "$(cat <<'EOF'
## Summary
- Expand Organization and User shared types
- GET/PATCH API for organization settings (admin-only)
- Logo upload via Supabase Storage
- Organization settings form in Settings page
- User deactivation API + auth gate
- Active/inactive toggle in user table

## Test plan
- [ ] Update org name, address, contact info — verify persistence
- [ ] Upload org logo — verify preview and persistence
- [ ] Toggle user active/inactive — verify auth blocks deactivated users
- [ ] Verify admin cannot deactivate themselves
- [ ] Verify non-admin cannot access org settings API

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Iteration 3: Invitations

### Task 14: Create Invitations API

**Files:**
- Create: `apps/web/app/api/invitations/route.ts`

**Step 1: Implement GET and POST**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';

const VALID_ROLES = ['org:admin', 'org:member'] as const;
const ROLE_MAP: Record<string, string> = {
  admin: 'org:admin',
  supervisor: 'org:member',
  architect: 'org:member',
};

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  try {
    const client = await clerkClient();
    const invitations = await client.organizations.getOrganizationInvitationList({
      organizationId: ctx.orgId,
    });

    return NextResponse.json(invitations.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch invitations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email, role } = body;

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email es requerido' }, { status: 400 });
  }

  const clerkRole = ROLE_MAP[role as string] ?? 'org:member';

  try {
    const client = await clerkClient();
    const invitation = await client.organizations.createOrganizationInvitation({
      organizationId: ctx.orgId,
      emailAddress: email,
      role: clerkRole,
      inviterUserId: ctx.userId,
    });

    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send invitation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add apps/web/app/api/invitations/route.ts
git commit -m "feat: add invitations API via Clerk organizations"
```

---

### Task 15: Create Invitation UI in Settings

**Files:**
- Create: `apps/web/components/invite-user-dialog.tsx`
- Modify: `apps/web/app/(dashboard)/settings/page.tsx`

**Step 1: Create the invite dialog component**

Create `apps/web/components/invite-user-dialog.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('architect');
  const [sending, setSending] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) return;

    setSending(true);
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al enviar invitación');
      }

      toast.success(`Invitación enviada a ${email}`);
      setEmail('');
      setRole('architect');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar invitación');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Invitar usuario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar usuario</DialogTitle>
          <DialogDescription>
            Se enviará un email de invitación a la organización.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="usuario@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Rol</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="architect">Arquitecto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleInvite} disabled={sending || !email.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {sending ? 'Enviando...' : 'Enviar invitación'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Add to settings page**

In `apps/web/app/(dashboard)/settings/page.tsx`:

Add import:
```typescript
import { InviteUserDialog } from '@/components/invite-user-dialog';
```

Add the button next to the PageHeader or above the table. In the main return block, change `<PageHeader>` to include an action:

```tsx
<div className="flex items-center justify-between">
  <PageHeader title="Ajustes" description="Gestiona tu equipo y configuración" />
  <InviteUserDialog />
</div>
```

**Step 3: Verify**

Run: `cd apps/web && npm run dev`
- Go to Settings
- Click "Invitar usuario"
- Fill in email and role
- Submit (will call Clerk API)

**Step 4: Commit**

```bash
git add apps/web/components/invite-user-dialog.tsx apps/web/app/\(dashboard\)/settings/page.tsx
git commit -m "feat: add invite user dialog in settings"
```

---

### Task 16: Create PR for Iteration 3

**Step 1: Push branch and create PR**

```bash
git push -u origin feat/user-invitations
gh pr create --title "feat: user invitations via Clerk" --body "$(cat <<'EOF'
## Summary
- POST/GET API for organization invitations via Clerk
- Invite user dialog in Settings page with email + role selection

## Test plan
- [ ] Open invite dialog, fill email and role, send invitation
- [ ] Verify email is received by invited user
- [ ] Verify invited user can join the organization
- [ ] Verify non-admin cannot access invitation API

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
