# Receipt Extraction V2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand receipt extraction to capture structured supplier data, receipt metadata, discriminated IVA, and persist to new DB schema with a `suppliers` table.

**Architecture:** The AI extraction returns a richer `ExtractionResult` grouped by zones (supplier, receipt, items, totals). On confirmation, the API upserts a `supplier` row by CUIT, then inserts the receipt referencing it. The frontend reads from the new structure and maps to the confirmation payload.

**Tech Stack:** TypeScript, Anthropic SDK, Next.js API routes, Supabase (Postgres), React

---

### Task 1: Update shared types

**Files:**
- Modify: `packages/shared/src/types.ts`

**Step 1: Replace ExtractionResult and related types**

Replace the `ExtractionResult`, `ExtractionItem`, and `ConfirmReceiptInput` types. Add `Supplier` type.

```typescript
// Replace existing ExtractionItem
export interface ExtractionItem {
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

// Replace existing ExtractionResult
export interface ExtractionResult {
  supplier: {
    name: string | null;
    responsible_person: string | null;
    cuit: string | null;
    iibb: string | null;
    address: {
      street: string | null;
      locality: string | null;
      province: string | null;
      postal_code: string | null;
    };
    activity_start_date: string | null;
    fiscal_condition: string | null;
  };
  receipt: {
    code: string | null;
    type: string | null;
    number: string | null;
    date: string | null;
    time: string | null;
  };
  items: ExtractionItem[];
  totals: {
    net_amount: number | null;
    iva_rate: number | null;
    iva_amount: number | null;
    total: number | null;
  };
  confidence: number;
}

// Add new Supplier type
export interface Supplier {
  id: string;
  organization_id: string;
  name: string;
  responsible_person: string | null;
  cuit: string | null;
  iibb: string | null;
  street: string | null;
  locality: string | null;
  province: string | null;
  postal_code: string | null;
  activity_start_date: string | null;
  fiscal_condition: string | null;
  created_at: string;
  updated_at: string;
}

// Replace existing ConfirmReceiptInput
export interface ConfirmReceiptInput {
  project_id: string;
  image_url: string;
  ai_raw_response: Record<string, unknown>;
  ai_confidence: number;
  // Supplier fields (used to upsert supplier)
  supplier: {
    name: string;
    responsible_person?: string | null;
    cuit?: string | null;
    iibb?: string | null;
    street?: string | null;
    locality?: string | null;
    province?: string | null;
    postal_code?: string | null;
    activity_start_date?: string | null;
    fiscal_condition?: string | null;
  };
  // Receipt metadata
  receipt_type?: string | null;
  receipt_code?: string | null;
  receipt_number?: string | null;
  receipt_date: string;
  receipt_time?: string | null;
  // Totals
  total_amount: number;
  net_amount?: number | null;
  iva_rate?: number | null;
  iva_amount?: number | null;
  // Items
  items: Omit<ExtractionItem, 'subtotal'>[];
}
```

**Step 2: Verify typecheck**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: Type errors in files that import `ExtractionResult` (this is expected — we fix them in subsequent tasks)

**Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: expand ExtractionResult and ConfirmReceiptInput types for v2"
```

---

### Task 2: Update extraction prompt

**Files:**
- Modify: `packages/ai/src/prompt.ts`

**Step 1: Replace the EXTRACTION_PROMPT**

```typescript
export const EXTRACTION_PROMPT = `You are a receipt/invoice data extractor specialized in Argentine fiscal documents (facturas, tiques, notas de crédito/débito).

Analyze this image and extract the following structured data:

## Supplier (proveedor/emisor)
- name: business name or razón social
- responsible_person: name of the responsible person if shown
- cuit: CUIT number (format: XX-XXXXXXXX-X)
- iibb: Ingresos Brutos number
- address.street: street name and number
- address.locality: city or locality
- address.province: province
- address.postal_code: postal/ZIP code
- activity_start_date: date of activity start (YYYY-MM-DD)
- fiscal_condition: e.g. "IVA Responsable Inscripto", "Monotributista", etc.

## Receipt metadata (datos del comprobante)
- code: fiscal code (e.g. "081", "011")
- type: document type (e.g. "Tique Factura A", "Factura B", "Nota de Crédito A")
- number: full receipt number including punto de venta (e.g. "00004-00004739")
- date: YYYY-MM-DD format
- time: HH:MM:SS format if present

## Line items (detalle de compra)
Array of items, each with:
- description: item description
- quantity: number (default 1 if not explicit)
- unit_price: price per unit
- subtotal: line total

## Totals
- net_amount: subtotal neto gravado (before tax)
- iva_rate: IVA percentage as a number (e.g. 21, 10.5, 27)
- iva_amount: IVA monetary amount
- total: final total (net_amount + iva_amount)

## Rules
- If a field is unreadable or not present, set it to null
- If there are no itemized lines, return an empty items array
- For CUIT, preserve the format with dashes (XX-XXXXXXXX-X)
- confidence: number 0 to 1, your confidence in overall extraction accuracy
- Return ONLY valid JSON, no markdown, no explanation

Output format:
{
  "supplier": {
    "name": "string or null",
    "responsible_person": "string or null",
    "cuit": "string or null",
    "iibb": "string or null",
    "address": {
      "street": "string or null",
      "locality": "string or null",
      "province": "string or null",
      "postal_code": "string or null"
    },
    "activity_start_date": "YYYY-MM-DD or null",
    "fiscal_condition": "string or null"
  },
  "receipt": {
    "code": "string or null",
    "type": "string or null",
    "number": "string or null",
    "date": "YYYY-MM-DD or null",
    "time": "HH:MM:SS or null"
  },
  "items": [{"description": "string", "quantity": number, "unit_price": number, "subtotal": number}],
  "totals": {
    "net_amount": number or null,
    "iva_rate": number or null,
    "iva_amount": number or null,
    "total": number or null
  },
  "confidence": number
}`;
```

**Step 2: Commit**

```bash
git add packages/ai/src/prompt.ts
git commit -m "feat: expand extraction prompt for full Argentine receipt parsing"
```

---

### Task 3: Update parseExtractionResponse and validateExtractionResult

**Files:**
- Modify: `packages/ai/src/extract.ts`

**Step 1: Replace parseExtractionResponse**

```typescript
export function parseExtractionResponse(raw: string): ExtractionResult {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const address = parsed.supplier?.address ?? {};

  return {
    supplier: {
      name: parsed.supplier?.name ?? null,
      responsible_person: parsed.supplier?.responsible_person ?? null,
      cuit: parsed.supplier?.cuit ?? null,
      iibb: parsed.supplier?.iibb ?? null,
      address: {
        street: address.street ?? null,
        locality: address.locality ?? null,
        province: address.province ?? null,
        postal_code: address.postal_code ?? null,
      },
      activity_start_date: parsed.supplier?.activity_start_date ?? null,
      fiscal_condition: parsed.supplier?.fiscal_condition ?? null,
    },
    receipt: {
      code: parsed.receipt?.code ?? null,
      type: parsed.receipt?.type ?? null,
      number: parsed.receipt?.number ?? null,
      date: parsed.receipt?.date ?? null,
      time: parsed.receipt?.time ?? null,
    },
    items: (parsed.items ?? []).map((item: Record<string, unknown>) => ({
      description: String(item.description ?? ''),
      quantity: Number(item.quantity ?? 1),
      unit_price: Number(item.unit_price ?? 0),
      subtotal: Number(item.subtotal ?? 0),
    })),
    totals: {
      net_amount: parsed.totals?.net_amount != null ? Number(parsed.totals.net_amount) : null,
      iva_rate: parsed.totals?.iva_rate != null ? Number(parsed.totals.iva_rate) : null,
      iva_amount: parsed.totals?.iva_amount != null ? Number(parsed.totals.iva_amount) : null,
      total: parsed.totals?.total != null ? Number(parsed.totals.total) : null,
    },
    confidence: Number(parsed.confidence ?? 0),
  };
}
```

**Step 2: Replace validateExtractionResult**

```typescript
export function validateExtractionResult(result: ExtractionResult): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (result.totals.total === null || result.totals.total === undefined) {
    errors.push('Total amount is required');
  }
  if (result.confidence < 0 || result.confidence > 1) {
    errors.push('Confidence must be between 0 and 1');
  }
  return { valid: errors.length === 0, errors };
}
```

**Step 3: Commit**

```bash
git add packages/ai/src/extract.ts
git commit -m "feat: update parseExtractionResponse for v2 schema"
```

---

### Task 4: Update tests for new schema

**Files:**
- Modify: `packages/ai/src/__tests__/extract.test.ts`

**Step 1: Rewrite tests for new schema**

```typescript
import { describe, it, expect } from 'vitest';
import { parseExtractionResponse, validateExtractionResult } from '../extract';
import type { ExtractionResult } from '@architech/shared';

const FULL_RESPONSE = {
  supplier: {
    name: 'ILUMINART',
    responsible_person: 'Chiaramonte Mariano',
    cuit: '20-29150183-5',
    iibb: '20291501835',
    address: {
      street: 'Arenales 1811',
      locality: 'CABA',
      province: 'Buenos Aires',
      postal_code: '1124',
    },
    activity_start_date: '2013-11-01',
    fiscal_condition: 'IVA Responsable Inscripto',
  },
  receipt: {
    code: '081',
    type: 'Tique Factura A',
    number: '00004-00004739',
    date: '2026-02-13',
    time: '11:10:47',
  },
  items: [
    { description: 'FERRETERIA', quantity: 21, unit_price: 366, subtotal: 7685.95 },
  ],
  totals: {
    net_amount: 7685.95,
    iva_rate: 21,
    iva_amount: 1614.05,
    total: 9300,
  },
  confidence: 0.92,
};

describe('parseExtractionResponse', () => {
  it('parses a full v2 extraction response', () => {
    const raw = JSON.stringify(FULL_RESPONSE);
    const result = parseExtractionResponse(raw);

    expect(result.supplier.name).toBe('ILUMINART');
    expect(result.supplier.cuit).toBe('20-29150183-5');
    expect(result.supplier.address.street).toBe('Arenales 1811');
    expect(result.receipt.type).toBe('Tique Factura A');
    expect(result.receipt.date).toBe('2026-02-13');
    expect(result.items).toHaveLength(1);
    expect(result.totals.total).toBe(9300);
    expect(result.totals.iva_rate).toBe(21);
    expect(result.confidence).toBe(0.92);
  });

  it('handles response with null/missing fields', () => {
    const raw = JSON.stringify({
      supplier: { name: null },
      receipt: {},
      items: [],
      totals: { total: 1000 },
      confidence: 0.3,
    });

    const result = parseExtractionResponse(raw);
    expect(result.supplier.name).toBeNull();
    expect(result.supplier.cuit).toBeNull();
    expect(result.supplier.address.street).toBeNull();
    expect(result.receipt.code).toBeNull();
    expect(result.totals.net_amount).toBeNull();
    expect(result.totals.total).toBe(1000);
  });

  it('handles response wrapped in markdown code fences', () => {
    const inner = JSON.stringify({
      supplier: { name: 'Test' },
      receipt: { date: '2026-01-01' },
      items: [],
      totals: { total: 100 },
      confidence: 0.5,
    });
    const raw = '```json\n' + inner + '\n```';
    const result = parseExtractionResponse(raw);
    expect(result.supplier.name).toBe('Test');
    expect(result.totals.total).toBe(100);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseExtractionResponse('not json')).toThrow();
  });
});

describe('validateExtractionResult', () => {
  it('returns valid for complete extraction', () => {
    const result = parseExtractionResponse(JSON.stringify(FULL_RESPONSE));
    expect(validateExtractionResult(result).valid).toBe(true);
  });

  it('returns invalid when total is null', () => {
    const result: ExtractionResult = {
      supplier: {
        name: 'Test', responsible_person: null, cuit: null, iibb: null,
        address: { street: null, locality: null, province: null, postal_code: null },
        activity_start_date: null, fiscal_condition: null,
      },
      receipt: { code: null, type: null, number: null, date: '2026-01-01', time: null },
      items: [],
      totals: { net_amount: null, iva_rate: null, iva_amount: null, total: null },
      confidence: 0.1,
    };
    expect(validateExtractionResult(result).valid).toBe(false);
  });
});
```

**Step 2: Run tests**

Run: `cd packages/ai && npx vitest run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/ai/src/__tests__/extract.test.ts
git commit -m "test: update extraction tests for v2 schema"
```

---

### Task 5: Update DB migration file (for source control)

**Files:**
- Create: `packages/db/migrations/003_receipt_extraction_v2.sql`

Note: The migration is already applied in Supabase. This file is for source control only.

**Step 1: Write the migration file**

```sql
-- Suppliers table
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  responsible_person TEXT,
  cuit TEXT,
  iibb TEXT,
  street TEXT,
  locality TEXT,
  province TEXT,
  postal_code TEXT,
  activity_start_date DATE,
  fiscal_condition TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_suppliers_org_cuit ON suppliers(organization_id, cuit);
CREATE INDEX idx_suppliers_org_id ON suppliers(organization_id);

CREATE TRIGGER set_updated_at_suppliers
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Expand receipts table
ALTER TABLE receipts
  ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN receipt_type TEXT,
  ADD COLUMN receipt_code TEXT,
  ADD COLUMN receipt_number TEXT,
  ADD COLUMN receipt_time TIME,
  ADD COLUMN net_amount DECIMAL(12,2),
  ADD COLUMN iva_rate DECIMAL(5,2),
  ADD COLUMN iva_amount DECIMAL(12,2);

CREATE INDEX idx_receipts_supplier_id ON receipts(supplier_id);
```

**Step 2: Commit**

```bash
git add packages/db/migrations/003_receipt_extraction_v2.sql
git commit -m "feat: add migration for suppliers table and receipt v2 columns"
```

---

### Task 6: Update receipt confirmation API

**Files:**
- Modify: `apps/web/app/api/receipts/route.ts`

**Step 1: Update the POST handler to upsert supplier and persist new fields**

The POST handler must:
1. Upsert a supplier by `(organization_id, cuit)` — if CUIT exists update, otherwise insert
2. Insert the receipt with `supplier_id` and new fields (receipt_type, receipt_code, receipt_number, receipt_time, net_amount, iva_rate, iva_amount)
3. Insert receipt items as before

```typescript
// Inside POST handler, after validation, before receipt insert:

// Upsert supplier
let supplierId: string | null = null;
if (body.supplier && (body.supplier as Record<string, unknown>).name) {
  const supplierData = body.supplier as Record<string, unknown>;
  const db = getDb();

  if (supplierData.cuit) {
    // Try upsert by CUIT
    const { data: supplier, error: supplierError } = await db
      .from('suppliers')
      .upsert(
        {
          organization_id: ctx.orgId,
          name: supplierData.name,
          responsible_person: supplierData.responsible_person ?? null,
          cuit: supplierData.cuit,
          iibb: supplierData.iibb ?? null,
          street: supplierData.street ?? null,
          locality: supplierData.locality ?? null,
          province: supplierData.province ?? null,
          postal_code: supplierData.postal_code ?? null,
          activity_start_date: supplierData.activity_start_date ?? null,
          fiscal_condition: supplierData.fiscal_condition ?? null,
        },
        { onConflict: 'organization_id,cuit' }
      )
      .select('id')
      .single();

    if (!supplierError && supplier) {
      supplierId = supplier.id;
    }
  } else {
    // No CUIT — just insert
    const { data: supplier } = await db
      .from('suppliers')
      .insert({
        organization_id: ctx.orgId,
        name: supplierData.name as string,
        responsible_person: (supplierData.responsible_person as string) ?? null,
        fiscal_condition: (supplierData.fiscal_condition as string) ?? null,
      })
      .select('id')
      .single();

    if (supplier) supplierId = supplier.id;
  }
}

// Then update the receipt insert to include new fields:
const { data: receipt, error: receiptError } = await db
  .from('receipts')
  .insert({
    project_id: body.project_id,
    uploaded_by: ctx.dbUserId,
    vendor: (body.supplier as Record<string, unknown>)?.name ?? body.vendor ?? null,
    supplier_id: supplierId,
    total_amount: body.total_amount,
    receipt_date: body.receipt_date,
    receipt_time: body.receipt_time ?? null,
    receipt_type: body.receipt_type ?? null,
    receipt_code: body.receipt_code ?? null,
    receipt_number: body.receipt_number ?? null,
    net_amount: body.net_amount ?? null,
    iva_rate: body.iva_rate ?? null,
    iva_amount: body.iva_amount ?? null,
    image_url: body.image_url,
    ai_raw_response: body.ai_raw_response ?? {},
    ai_confidence: body.ai_confidence ?? 0,
    status: 'confirmed',
  })
  .select()
  .single();
```

**Step 2: Commit**

```bash
git add apps/web/app/api/receipts/route.ts
git commit -m "feat: upsert supplier and persist v2 receipt fields on confirmation"
```

---

### Task 7: Update frontend receipt-review.tsx

**Files:**
- Modify: `apps/web/components/receipt-review.tsx`

**Step 1: Update state initialization to read from new schema**

Key changes:
- `vendor` state reads from `extractionResult.supplier.name`
- `date` state reads from `extractionResult.receipt.date`
- `total` state reads from `extractionResult.totals.total`
- `handleConfirm` builds a `ConfirmReceiptInput` with the new structure

```typescript
// State initialization changes:
const [vendor, setVendor] = useState(extractionResult.supplier.name ?? '');
const [date, setDate] = useState(extractionResult.receipt.date ?? '');
const [total, setTotal] = useState(extractionResult.totals.total?.toString() ?? '');

// In handleConfirm, update the payload:
const payload: ConfirmReceiptInput = {
  project_id: projectId,
  image_url: storagePath,
  ai_raw_response: { ...extractionResult },
  ai_confidence: confidence,
  supplier: {
    name: vendor,
    responsible_person: extractionResult.supplier.responsible_person,
    cuit: extractionResult.supplier.cuit,
    iibb: extractionResult.supplier.iibb,
    street: extractionResult.supplier.address.street,
    locality: extractionResult.supplier.address.locality,
    province: extractionResult.supplier.address.province,
    postal_code: extractionResult.supplier.address.postal_code,
    activity_start_date: extractionResult.supplier.activity_start_date,
    fiscal_condition: extractionResult.supplier.fiscal_condition,
  },
  receipt_type: extractionResult.receipt.type,
  receipt_code: extractionResult.receipt.code,
  receipt_number: extractionResult.receipt.number,
  receipt_date: date,
  receipt_time: extractionResult.receipt.time,
  total_amount: parseFloat(total) || calculatedTotal,
  net_amount: extractionResult.totals.net_amount,
  iva_rate: extractionResult.totals.iva_rate,
  iva_amount: extractionResult.totals.iva_amount,
  items: items.map(({ description, quantity, unit_price }) => ({
    description,
    quantity,
    unit_price,
  })),
};
```

**Step 2: Verify typecheck**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No type errors

**Step 3: Commit**

```bash
git add apps/web/components/receipt-review.tsx
git commit -m "feat: update receipt-review to use v2 extraction schema"
```

---

### Task 8: Update upload page type reference

**Files:**
- Modify: `apps/web/app/(dashboard)/upload/page.tsx`

**Step 1: Verify no code changes needed**

The upload page imports `ExtractionResult` but only passes it to `<ReceiptReview>`. Since the type is the same name, it should still compile. Verify with:

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors. If errors exist in this file, fix the type usage.

**Step 2: Commit (only if changes were needed)**

---

### Task 9: Final verification

**Step 1: Run all tests**

Run: `cd packages/ai && npx vitest run`
Expected: All tests pass

**Step 2: Run full typecheck**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

**Step 3: Manual smoke test**

Start dev server and upload the test ticket image. Verify:
- Extraction returns full v2 data (supplier, receipt metadata, totals with IVA)
- Confirmation saves supplier to DB
- Receipt has supplier_id, receipt_type, iva_rate, etc.
