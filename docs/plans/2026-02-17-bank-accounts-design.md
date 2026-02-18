# Bank Accounts Feature — Design Document

**Date:** 2026-02-17
**Branch:** `feat/banks`
**Status:** Approved

## Problem

ObraLink needs to:
1. Register organization bank accounts (name, CBU, alias, etc.)
2. Link receipts to the bank account used for the expense

## Data Model

### New table: `bank_accounts`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, `gen_random_uuid()` |
| `organization_id` | TEXT | FK → organizations, NOT NULL |
| `name` | TEXT | NOT NULL |
| `bank_name` | TEXT | NOT NULL |
| `cbu` | TEXT | NULL |
| `alias` | TEXT | NULL |
| `currency` | TEXT | NOT NULL, DEFAULT 'ARS' |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() + trigger |

### Modified table: `receipts`

| New column | Type | Constraints |
|------------|------|-------------|
| `bank_account_id` | UUID | NULL, FK → bank_accounts(id) ON DELETE SET NULL |

### RLS Policies

- **SELECT:** admin and supervisor see all org accounts
- **INSERT/UPDATE/DELETE:** admin only

## API Routes

### `/api/bank-accounts` (route.ts)
- **GET** — List active accounts for org. Access: admin, supervisor.
- **POST** — Create account. Access: admin only. Requires `name`, `bank_name`.

### `/api/bank-accounts/[id]` (route.ts)
- **PATCH** — Update fields. Access: admin only.
- **DELETE** — Soft-delete (set `is_active = false`). Access: admin only.

### `/api/receipts/[id]` (existing, extend PATCH)
- Add `bank_account_id` as updatable field.

## UI Touchpoints

### 1. Settings → Bancos tab (`/settings/banks`)
- New tab visible to admin and supervisor
- Table: Nombre, Banco, CBU, Alias, Moneda, Acciones
- "Nueva cuenta" button (admin only)
- Edit/delete icon buttons per row (admin only)
- `BankAccountFormDialog` for create/edit with Zod validation
- Pattern: identical to Cost Centers page

### 2. Receipt detail (`/receipts/[id]`)
- New "Cuenta Bancaria" field in metadata section (next to Centro de Costos)
- Assigned: show name + bank_name
- Unassigned + admin/supervisor: select to assign
- Unassigned + architect: "Sin asignar"

### 3. Receipt upload flow
- Optional "Cuenta Bancaria" select after project selection

### 4. Receipts list (`/receipts`)
- New "Banco" column (hidden on mobile, like Centro de Costos)
- New "Cuenta Bancaria" filter dropdown

## Validation (Zod)

```typescript
const bankAccountSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  bank_name: z.string().min(1, 'El banco es requerido').max(100),
  cbu: z.string().regex(/^\d{22}$/, 'El CBU debe tener 22 dígitos').optional().or(z.literal('')),
  alias: z.string().max(50).optional().or(z.literal('')),
  currency: z.enum(['ARS', 'USD']).default('ARS'),
});
```

CBU validation: format only (22 digits). No check-digit validation to be lenient with typos, same approach as CUIT.

## Permissions

| Action | Admin | Supervisor | Architect |
|--------|-------|------------|-----------|
| View accounts | Yes | Yes | Read-only |
| Create/edit/delete accounts | Yes | No | No |
| Assign account to receipt | Yes | Yes | No |

## Approach

- Follows Cost Centers pattern exactly (soft-delete, settings tab, form dialog)
- `BankAccount` type added to `@architech/shared`
- Migration: `006_bank_accounts.sql`
