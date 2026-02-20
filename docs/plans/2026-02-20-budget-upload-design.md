# Budget Upload — Design Document

## Goal

Allow users to upload an existing budget file (Excel or PDF) and automatically populate a new budget in the system, eliminating manual data entry.

## Architecture

AI-powered extraction using Anthropic (Claude) via the `@architech/ai` package. The same SDK and pattern already used for receipt extraction. Excel files are parsed server-side into structured text before sending to Claude; PDFs are sent as images via Claude's vision capability.

## User Flow

```
Upload dialog → AI extraction → Create budget + rubros + snapshot → Navigate to /budgets/:id (draft)
```

### Entry Points

1. **`/budgets` page** — "Importar presupuesto" button next to "Crear presupuesto". User selects a project (filtered to those without a budget) and uploads a file.

2. **`/projects/[id]` page** — "Importar presupuesto" button in the Presupuesto card footer (when no budget exists). Project is pre-selected.

### Dialog Steps

**Step 1: Upload**
- Project selector (pre-filled if coming from project page, selectable if from /budgets)
- File drop zone / file picker (accepts .xlsx, .xls, .pdf, max 10MB)
- User drops/selects file → automatic processing begins

**Step 2: Processing**
- Spinner with status text ("Analizando presupuesto...")
- API call: `POST /api/budgets/extract` with FormData (file)
- On success: automatically creates the budget, rubros, and snapshot
- Navigates to `/budgets/:id` — the budget editor opens in draft mode with all data pre-populated
- User reviews and edits using the existing BudgetTable editor
- Dialog closes on navigation

**Error handling:**
- AI can't parse → show error message in dialog, allow retry
- File too large / wrong type → client-side validation before upload

## API Design

### `POST /api/budgets/extract`

**Request:** `multipart/form-data`
- `file` — the Excel or PDF file
- `project_id` — UUID of the target project

**Processing:**
1. Validate auth (admin/supervisor only)
2. Validate project belongs to org and has no existing budget
3. Parse file based on type:
   - **Excel:** use `xlsx` library to extract cell data as structured text (rows/columns with headers)
   - **PDF:** convert pages to images (using `pdf-to-img` or similar)
4. Call `extractBudget()` from `@architech/ai` with the parsed content
5. Validate result with `budgetSnapshotSchema` (Zod)
6. Create budget: `POST /api/budgets` logic (insert budget row with snapshot)
7. Create rubros: insert a `rubros` row for each section in the snapshot
8. Update snapshot with real `rubro_id` references
9. Return `{ budget_id, sections_count, items_count }`

**Response:** `201 Created`
```json
{
  "budget_id": "uuid",
  "sections_count": 8,
  "items_count": 42
}
```

## AI Extraction

### Location

`packages/ai/src/extract-budget.ts` + `packages/ai/src/budget-prompt.ts`

### Excel Processing

1. Parse `.xlsx` with the `xlsx` library
2. Convert each sheet to CSV-like text (preserving structure)
3. Send to Claude as text with the extraction prompt

### PDF Processing

1. Convert PDF pages to PNG images
2. Send images to Claude with vision + extraction prompt

### Prompt Design

The prompt instructs Claude to:
- Identify sections/rubros (typically bold rows, section headers, numbered groups)
- For each section: extract name, whether it's "adicional" or base scope
- For each item: extract description, unit (gl, m2, ml, etc.), quantity, subtotal (price), cost (if visible)
- Return valid JSON matching `BudgetSnapshot` schema
- If a section has a subtotal row but no individual items with prices, use section-level `subtotal` override
- Default `cost` to 0 if not present (internal cost is rarely in external budgets)

### Output

```typescript
interface BudgetExtractionResult {
  sections: Array<{
    rubro_name: string;
    is_additional: boolean;
    subtotal?: number;
    cost?: number;
    items: Array<{
      description: string;
      unit: string;
      quantity: number;
      cost: number;
      subtotal: number;
    }>;
  }>;
}
```

This maps directly to `BudgetSnapshot` (minus `rubro_id`, which is added after creating the rubro rows in the DB).

## Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ImportBudgetDialog` | `apps/web/components/import-budget-dialog.tsx` | Upload dialog with project selector + file drop zone + processing state |
| `extractBudget()` | `packages/ai/src/extract-budget.ts` | AI extraction function |
| `budgetExtractionPrompt` | `packages/ai/src/budget-prompt.ts` | Prompt template for Claude |
| `POST /api/budgets/extract` | `apps/web/app/api/budgets/extract/route.ts` | API endpoint |

## Constraints

- Max file size: 10MB
- Accepted types: `.xlsx`, `.xls`, `.pdf`
- Auth: admin or supervisor only (same as budget creation)
- One budget per project (existing constraint, validated server-side)
- No file storage — the uploaded file is processed and discarded

## Dependencies

New npm packages needed:
- `xlsx` — Excel parsing (already widely used, no native deps)
- A PDF-to-image library for PDF support (e.g., `pdf-to-img` or `pdfjs-dist`)

## Out of Scope

- Importing into an existing budget (replace/merge)
- Template-based deterministic parsing
- Storing the original file in Supabase Storage
- Batch upload of multiple budgets
