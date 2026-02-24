# Receipt Extraction V2 — Design Document

## Context

The current receipt extraction extracts only: vendor (string), date, total, line items, and confidence. This is insufficient for Argentine fiscal compliance and business intelligence. The system needs to extract structured supplier data, receipt metadata, and discriminated IVA.

## Decisions

- **Approach:** Unified implementation (AI + DB + API in one iteration). Frontend UI expansion deferred to a separate iteration.
- **Supplier entity:** New `suppliers` table with upsert on `(organization_id, cuit)`.
- **Receiver data (ZONA VIOLETA):** Not extracted — already known in the system.
- **IVA handling:** Single global rate and amount per receipt (not per-item, not multi-aliquot).
- **Prompt strategy:** Generic for Argentine tickets/invoices, not hardcoded to any specific layout. Fields that don't exist in a given ticket return `null`.

## Extraction Schema

```typescript
interface ExtractionResult {
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
  items: {
    description: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
  totals: {
    net_amount: number | null;
    iva_rate: number | null;
    iva_amount: number | null;
    total: number | null;
  };
  confidence: number;
}
```

## Database Changes

### New table: `suppliers`

```sql
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
```

### Altered table: `receipts`

```sql
ALTER TABLE receipts
  ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN receipt_type TEXT,
  ADD COLUMN receipt_code TEXT,
  ADD COLUMN receipt_number TEXT,
  ADD COLUMN receipt_time TIME,
  ADD COLUMN net_amount DECIMAL(12,2),
  ADD COLUMN iva_rate DECIMAL(5,2),
  ADD COLUMN iva_amount DECIMAL(12,2);
```

Note: `vendor` column kept for backward compatibility (deprecated).

## Scope

### In scope (this iteration)
- New `ExtractionResult` type in `@architech/shared`
- New extraction prompt (generic for Argentine receipts)
- Updated `parseExtractionResponse` in `@architech/ai`
- DB migration (already applied in Supabase)
- Updated `/api/receipts/extract` route
- Updated `/api/receipts` POST (confirmation) to persist supplier + new fields
- Minimal frontend adjustments so `receipt-review.tsx` reads from new format
- New `Supplier` type in shared types

### Out of scope (deferred)
- Expanded review UI with all new fields editable
- Supplier management screen
- Multi-aliquot IVA support
- Receiver/client data extraction
