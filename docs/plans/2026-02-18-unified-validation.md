# Unified Zod Validation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace manual inline validation in all API routes with shared Zod schemas and a `validateBody` helper.

**Architecture:** Each entity has create/update Zod schemas in `apps/web/lib/schemas/`. A `validateBody(schema, req)` helper handles JSON parsing + validation in one call. Shared constants (colors, currencies) move to `packages/shared/src/enums.ts`. API routes become thin wrappers: auth → validate → DB.

**Tech Stack:** Zod, Next.js API routes, TypeScript

---

### Task 1: Add shared constants to `packages/shared`

**Files:**
- Modify: `packages/shared/src/enums.ts`
- Modify: `packages/shared/src/index.ts` (if needed for new exports)

**Step 1: Add PROJECT_COLORS and VALID_CURRENCIES to enums.ts**

Append to the end of `packages/shared/src/enums.ts`:

```typescript
export const PROJECT_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal'] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];

export const CURRENCIES = ['ARS', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];
```

Note: `ProjectColor` type already exists in `packages/shared/src/types.ts` as a string union. Replace that with the const-derived type. Check if `ProjectColor` is exported from `types.ts` and remove the duplicate.

**Step 2: Verify shared package exports**

Check that `packages/shared/src/index.ts` exports from `enums.ts`. It should already.

**Step 3: Commit**

```bash
git add packages/shared/src/enums.ts packages/shared/src/types.ts
git commit -m "feat: add PROJECT_COLORS and CURRENCIES constants to shared enums

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Create `validateBody` helper

**Files:**
- Create: `apps/web/lib/validate.ts`

**Step 1: Write the helper**

```typescript
import type { ZodSchema } from 'zod';
import { NextResponse } from 'next/server';

type ValidationSuccess<T> = { data: T };
type ValidationError = { error: NextResponse };
type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

export async function validateBody<T>(
  schema: ZodSchema<T>,
  req: Request
): Promise<ValidationResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.');
      if (key && !fields[key]) fields[key] = issue.message;
    }
    return {
      error: NextResponse.json({ error: 'Validation failed', fields }, { status: 400 }),
    };
  }

  return { data: result.data };
}
```

**Step 2: Commit**

```bash
git add apps/web/lib/validate.ts
git commit -m "feat: add validateBody helper for Zod-based API validation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Add create/update schemas for projects

**Files:**
- Modify: `apps/web/lib/schemas/project.ts`
- Modify: `apps/web/lib/schemas/index.ts`

**Step 1: Add API schemas to project.ts**

Keep the existing `projectSchema` (used by forms). Add API-oriented schemas below it:

```typescript
import { z } from 'zod';
import { PROJECT_COLORS } from '@architech/shared';

export const projectSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  address: z.string().optional().or(z.literal('')),
  status: z.enum(['active', 'paused', 'completed']),
  architect_id: z.string().optional().or(z.literal('')),
  color: z.string().optional().or(z.literal('')),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

// API schemas
export const projectCreateSchema = z.object({
  name: z.string().min(1, 'name is required').transform(s => s.trim()),
  address: z.string().nullish().transform(v => v?.trim() || null),
  status: z.enum(['active', 'paused', 'completed']).optional().default('active'),
  architect_id: z.string().uuid().nullish().transform(v => v || null),
  color: z.enum(PROJECT_COLORS).nullish().transform(v => v || null),
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = projectCreateSchema.partial();
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
```

**Step 2: Export from index.ts**

Add to `apps/web/lib/schemas/index.ts`:

```typescript
export { projectCreateSchema, projectUpdateSchema, type ProjectCreateInput, type ProjectUpdateInput } from './project';
```

**Step 3: Commit**

```bash
git add apps/web/lib/schemas/project.ts apps/web/lib/schemas/index.ts
git commit -m "feat: add project create/update API schemas

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Add create/update schemas for cost centers

**Files:**
- Modify: `apps/web/lib/schemas/cost-center.ts`
- Modify: `apps/web/lib/schemas/index.ts`

**Step 1: Add API schemas to cost-center.ts**

```typescript
import { z } from 'zod';
import { PROJECT_COLORS } from '@architech/shared';

export const costCenterSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  description: z.string().optional().or(z.literal('')),
  color: z.string().optional().or(z.literal('')),
});

export type CostCenterFormData = z.infer<typeof costCenterSchema>;

// API schemas
export const costCenterCreateSchema = z.object({
  name: z.string().min(1, 'name is required').max(100).transform(s => s.trim()),
  description: z.string().nullish().transform(v => v?.trim() || null),
  color: z.enum(PROJECT_COLORS).nullish().transform(v => v || null),
});

export type CostCenterCreateInput = z.infer<typeof costCenterCreateSchema>;

export const costCenterUpdateSchema = costCenterCreateSchema.partial();
export type CostCenterUpdateInput = z.infer<typeof costCenterUpdateSchema>;
```

**Step 2: Export from index.ts**

Add to `apps/web/lib/schemas/index.ts`:

```typescript
export { costCenterCreateSchema, costCenterUpdateSchema, type CostCenterCreateInput, type CostCenterUpdateInput } from './cost-center';
```

**Step 3: Commit**

```bash
git add apps/web/lib/schemas/cost-center.ts apps/web/lib/schemas/index.ts
git commit -m "feat: add cost center create/update API schemas

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Create bank account schema (NEW)

**Files:**
- Create: `apps/web/lib/schemas/bank-account.ts`
- Modify: `apps/web/lib/schemas/index.ts`

**Step 1: Create bank-account.ts**

```typescript
import { z } from 'zod';
import { CURRENCIES } from '@architech/shared';

export const bankAccountSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  bank_name: z.string().min(1, 'El banco es requerido'),
  cbu: z.string().optional().or(z.literal('')),
  alias: z.string().optional().or(z.literal('')),
  currency: z.enum(CURRENCIES),
});

export type BankAccountFormData = z.infer<typeof bankAccountSchema>;

// API schemas
export const bankAccountCreateSchema = z.object({
  name: z.string().min(1, 'name is required').transform(s => s.trim()),
  bank_name: z.string().min(1, 'bank_name is required').transform(s => s.trim()),
  cbu: z.string().nullish().transform(v => v?.trim() || null),
  alias: z.string().nullish().transform(v => v?.trim() || null),
  currency: z.enum(CURRENCIES).optional().default('ARS'),
});

export type BankAccountCreateInput = z.infer<typeof bankAccountCreateSchema>;

export const bankAccountUpdateSchema = bankAccountCreateSchema.partial();
export type BankAccountUpdateInput = z.infer<typeof bankAccountUpdateSchema>;
```

**Step 2: Export from index.ts**

Add to `apps/web/lib/schemas/index.ts`:

```typescript
export { bankAccountSchema, bankAccountCreateSchema, bankAccountUpdateSchema, type BankAccountFormData, type BankAccountCreateInput, type BankAccountUpdateInput } from './bank-account';
```

**Step 3: Commit**

```bash
git add apps/web/lib/schemas/bank-account.ts apps/web/lib/schemas/index.ts
git commit -m "feat: add bank account form and API schemas

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Add invite API schema and organization update schema

**Files:**
- Modify: `apps/web/lib/schemas/invite.ts`
- Modify: `apps/web/lib/schemas/organization.ts`
- Modify: `apps/web/lib/schemas/index.ts`

**Step 1: Add API schema to invite.ts**

```typescript
import { z } from 'zod';

export const inviteSchema = z.object({
  email: z.string().min(1, 'El email es requerido').email('Email inválido'),
  role: z.string().min(1, 'El rol es requerido'),
});

export type InviteFormData = z.infer<typeof inviteSchema>;

// API schema
export const inviteCreateSchema = z.object({
  email: z.string().email('Invalid email').transform(s => s.trim().toLowerCase()),
  role: z.enum(['admin', 'supervisor', 'architect']),
});

export type InviteCreateInput = z.infer<typeof inviteCreateSchema>;
```

**Step 2: Add update schema to organization.ts**

The existing `organizationSchema` handles forms. For the PATCH API, create a schema matching the ALLOWED_FIELDS pattern:

```typescript
import { z } from 'zod';

export const organizationSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  contact_email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  address_street: z.string().optional().or(z.literal('')),
  address_locality: z.string().optional().or(z.literal('')),
  address_province: z.string().optional().or(z.literal('')),
  address_postal_code: z.string().optional().or(z.literal('')),
  social_instagram: z.string().optional().or(z.literal('')),
  social_linkedin: z.string().optional().or(z.literal('')),
});

export type OrganizationFormData = z.infer<typeof organizationSchema>;

// API schema
const MAX_FIELD_LENGTH = 500;
const optionalField = z.string().max(MAX_FIELD_LENGTH).nullish().transform(v => v?.trim() || null);

export const organizationUpdateSchema = z.object({
  name: z.string().min(1).max(MAX_FIELD_LENGTH).transform(s => s.trim()).optional(),
  contact_email: z.string().email().max(MAX_FIELD_LENGTH).nullish().transform(v => v?.trim() || null),
  phone: optionalField,
  website: z.string().url().max(MAX_FIELD_LENGTH).nullish().transform(v => v?.trim() || null),
  address_street: optionalField,
  address_locality: optionalField,
  address_province: optionalField,
  address_postal_code: optionalField,
  social_instagram: optionalField,
  social_linkedin: optionalField,
});

export type OrganizationUpdateInput = z.infer<typeof organizationUpdateSchema>;
```

**Step 3: Export from index.ts**

Add new exports:

```typescript
export { inviteCreateSchema, type InviteCreateInput } from './invite';
export { organizationUpdateSchema, type OrganizationUpdateInput } from './organization';
```

**Step 4: Commit**

```bash
git add apps/web/lib/schemas/invite.ts apps/web/lib/schemas/organization.ts apps/web/lib/schemas/index.ts
git commit -m "feat: add invite and organization API schemas

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Migrate projects API routes

**Files:**
- Modify: `apps/web/app/api/projects/route.ts`
- Modify: `apps/web/app/api/projects/[id]/route.ts`

**Step 1: Migrate POST /api/projects**

Replace the manual validation in the POST handler with:

```typescript
import { validateBody } from '@/lib/validate';
import { projectCreateSchema } from '@/lib/schemas';
```

Replace the JSON parsing + manual checks with:

```typescript
const result = await validateBody(projectCreateSchema, req);
if ('error' in result) return result.error;
const { name, address, status, architect_id, color } = result.data;
```

Remove the `VALID_COLORS` constant from the file.

**Step 2: Migrate PATCH /api/projects/[id]**

Replace with `projectUpdateSchema`. Remove `VALID_STATUSES` and `VALID_COLORS` constants.

```typescript
import { validateBody } from '@/lib/validate';
import { projectUpdateSchema } from '@/lib/schemas';

const result = await validateBody(projectUpdateSchema, req);
if ('error' in result) return result.error;
const updates = result.data;
```

Add check for empty updates: `if (Object.keys(updates).length === 0)` return 400.

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add apps/web/app/api/projects/route.ts apps/web/app/api/projects/\\[id\\]/route.ts
git commit -m "refactor: migrate projects API routes to Zod validation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Migrate cost-centers API routes

**Files:**
- Modify: `apps/web/app/api/cost-centers/route.ts`
- Modify: `apps/web/app/api/cost-centers/[id]/route.ts`

**Step 1: Migrate POST /api/cost-centers**

Replace manual validation with `validateBody(costCenterCreateSchema, req)`. Remove `PROJECT_COLORS` import from this file.

**Step 2: Migrate PATCH /api/cost-centers/[id]**

Replace manual validation with `validateBody(costCenterUpdateSchema, req)`. Remove `PROJECT_COLORS` import.

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add apps/web/app/api/cost-centers/route.ts apps/web/app/api/cost-centers/\\[id\\]/route.ts
git commit -m "refactor: migrate cost-centers API routes to Zod validation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Migrate bank-accounts API routes

**Files:**
- Modify: `apps/web/app/api/bank-accounts/route.ts`
- Modify: `apps/web/app/api/bank-accounts/[id]/route.ts`

**Step 1: Migrate POST /api/bank-accounts**

Replace manual validation with `validateBody(bankAccountCreateSchema, req)`. Remove `VALID_CURRENCIES` constant.

**Step 2: Migrate PATCH /api/bank-accounts/[id]**

Replace manual validation with `validateBody(bankAccountUpdateSchema, req)`. Remove `VALID_CURRENCIES` constant.

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add apps/web/app/api/bank-accounts/route.ts apps/web/app/api/bank-accounts/\\[id\\]/route.ts
git commit -m "refactor: migrate bank-accounts API routes to Zod validation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Migrate invitations API route

**Files:**
- Modify: `apps/web/app/api/invitations/route.ts`

**Step 1: Migrate POST /api/invitations**

Replace manual validation with `validateBody(inviteCreateSchema, req)`. Keep the `ROLE_MAP` constant (maps roles to Clerk org roles — this is business logic, not validation). Remove `VALID_ROLES`, `EMAIL_REGEX` constants.

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add apps/web/app/api/invitations/route.ts
git commit -m "refactor: migrate invitations API route to Zod validation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 11: Migrate organization API route

**Files:**
- Modify: `apps/web/app/api/organization/route.ts`

**Step 1: Migrate PATCH /api/organization**

Replace the ALLOWED_FIELDS allowlist and manual field-by-field validation with `validateBody(organizationUpdateSchema, req)`. Remove `ALLOWED_FIELDS` and `MAX_FIELD_LENGTH` constants.

The schema already handles: field allowlist (only defined fields pass), max length (500), trim + null transform.

Keep the `resolveLogoUrl` helper (unrelated to validation).

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add apps/web/app/api/organization/route.ts
git commit -m "refactor: migrate organization API route to Zod validation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 12: Update project-colors.ts to use shared constants

**Files:**
- Modify: `apps/web/lib/project-colors.ts`

**Step 1: Import PROJECT_COLORS from shared instead of defining locally**

Replace the `PROJECT_COLORS` array definition with an import from `@architech/shared`. Keep the HEX maps and badge styles since those are UI-only concerns.

```typescript
import { PROJECT_COLORS } from '@architech/shared';
import type { ProjectColor } from '@architech/shared';

export { PROJECT_COLORS };

export const PROJECT_COLOR_HEX: Record<ProjectColor, string> = { ... };
// ... rest stays the same
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add apps/web/lib/project-colors.ts
git commit -m "refactor: use shared PROJECT_COLORS constant instead of local definition

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 13: Final build verification and cleanup

**Step 1: Full build**

```bash
npm run build
```

**Step 2: Check for unused imports or dead code**

Search for any remaining references to removed constants (`VALID_COLORS`, `VALID_STATUSES`, `VALID_CURRENCIES`, `ALLOWED_FIELDS`, `EMAIL_REGEX`).

**Step 3: Update design doc status**

Change status from `Approved` to `Implemented` in `docs/plans/2026-02-18-unified-validation-design.md`.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: cleanup and mark validation design as implemented

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
