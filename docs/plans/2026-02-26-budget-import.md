# Budget Import from Excel — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to upload an Excel file (.xlsx/.xls) and have Claude interpret it, creating a budget in the app's existing BudgetSnapshot format.

**Architecture:** SheetJS parses the Excel into text tabular format in `packages/ai`. Claude Sonnet 4.5 interprets the text and returns structured JSON. The API route in `apps/web` validates, creates rubros in DB, assembles a BudgetSnapshot, and saves it. Two UI entry points: create-budget dialog and empty budget editor.

**Tech Stack:** SheetJS (`xlsx`), Anthropic SDK (`@anthropic-ai/sdk`), Next.js API routes, Zod validation, SWR revalidation.

**Design doc:** `docs/plans/2026-02-26-budget-import-design.md`

---

## Task 1: Install SheetJS and create budget-prompt.ts

**Files:**
- Modify: `packages/ai/package.json` (add `xlsx` dependency)
- Create: `packages/ai/src/budget-prompt.ts`

**Step 1: Install xlsx in packages/ai**

Run:
```bash
cd packages/ai && npm install xlsx
```

Expected: `xlsx` appears in `dependencies` in `packages/ai/package.json`.

**Step 2: Create `budget-prompt.ts`**

Create file `packages/ai/src/budget-prompt.ts`:

```typescript
export const BUDGET_IMPORT_PROMPT = `Sos un asistente que interpreta presupuestos de construcción argentinos desde planillas Excel.

## Input
Recibís el contenido textual de un archivo Excel. Puede tener cualquier formato, estructura o idioma.

## Objetivo
Extraer RUBROS (secciones principales) y TAREAS (ítems dentro de cada rubro) en formato JSON.

## Reglas críticas

1. **RUBROS** son secciones principales de alto nivel: "1. Albañilería", "Estructura", "Electricidad", etc.
2. **TAREAS** (items) son líneas dentro de cada rubro con: descripción, unidad, cantidad, costo unitario y subtotal.
3. Si hay subtotales a nivel de rubro en el Excel, extraelos como \`section_subtotal\` y \`section_cost\`.
4. Si no podés identificar un campo:
   - Unidad no visible → \`"gl"\`
   - Cantidad no visible → \`1\`
   - Costo o subtotal no visible → \`0\`
5. **NUNCA inventar datos.** Si un valor no está visible o no es interpretable, dejalo en 0.
6. Si no podés distinguir "costo" de "subtotal", poné 0 en ambos.
7. Si hay hojas que no son presupuesto (notas, condiciones, legales), ignormalas y reportalas en \`warnings\`.
8. \`is_additional\` es siempre \`false\`. El usuario lo cambia manualmente en el editor.

## Output format

Respondé ÚNICAMENTE con JSON válido, sin markdown ni explicaciones:

{
  "sections": [
    {
      "rubro_name": "Albañilería",
      "is_additional": false,
      "section_subtotal": 1340000,
      "section_cost": null,
      "items": [
        {
          "description": "Excavación y nivelación",
          "unit": "gl",
          "quantity": 1,
          "cost": 0,
          "subtotal": 450000
        }
      ]
    }
  ],
  "confidence": 0.85,
  "warnings": ["No se interpretó la hoja 'Condiciones generales'"]
}

## Confidence

Número entre 0 y 1 basado en cuánta estructura pudiste interpretar:
- 0.8-1.0: Rubros claros, ítems con datos completos
- 0.5-0.8: Estructura reconocible pero faltan algunos datos
- 0.3-0.5: Estructura ambigua, muchos valores en 0
- < 0.3: No se pudo interpretar como presupuesto

## Notas
- El JSON NO incluye \`rubro_id\` — lo asigna el backend.
- Limpiá nombres de rubros: quitá numeración ("1.", "2.1") y espacios extra.
- Si una hoja tiene una sola tabla, esa es el presupuesto.
- Si hay varias hojas, priorizá la que tenga estructura de rubros/ítems.`;
```

**Step 3: Verify TypeScript compiles**

Run:
```bash
cd packages/ai && npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add packages/ai/package.json packages/ai/package-lock.json packages/ai/src/budget-prompt.ts
git commit -m "feat: add SheetJS dependency and budget import prompt"
```

---

## Task 2: Create budget-extract.ts

**Files:**
- Create: `packages/ai/src/budget-extract.ts`

**Step 1: Create `budget-extract.ts`**

Create file `packages/ai/src/budget-extract.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';
import { BUDGET_IMPORT_PROMPT } from './budget-prompt';

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TEXT_LENGTH = 50_000;

export interface BudgetImportItem {
  description: string;
  unit: string;
  quantity: number;
  cost: number;
  subtotal: number;
}

export interface BudgetImportSection {
  rubro_name: string;
  is_additional: boolean;
  section_subtotal: number | null;
  section_cost: number | null;
  items: BudgetImportItem[];
}

export interface BudgetImportResult {
  sections: BudgetImportSection[];
  confidence: number;
  warnings: string[];
}

/**
 * Parse an Excel buffer into a text tabular representation.
 * Each sheet is separated by a header line: --- Hoja: "SheetName" ---
 */
export function parseExcelToText(buffer: Buffer, fileName: string): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const csv = XLSX.utils.sheet_to_csv(sheet);
    const trimmed = csv.trim();
    if (!trimmed || trimmed.replace(/,/g, '').trim().length === 0) continue;

    parts.push(`--- Hoja: "${sheetName}" ---`);
    parts.push(trimmed);
  }

  if (parts.length === 0) {
    throw new Error('El Excel no contiene datos');
  }

  let text = parts.join('\n\n');
  if (text.length > MAX_TEXT_LENGTH) {
    text = text.slice(0, MAX_TEXT_LENGTH);
  }

  return text;
}

/**
 * Parse Claude's JSON response, stripping potential markdown fences.
 */
export function parseBudgetImportResponse(raw: string): BudgetImportResult {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const sections: BudgetImportSection[] = (parsed.sections ?? []).map(
    (s: Record<string, unknown>) => ({
      rubro_name: String(s.rubro_name ?? 'Sin nombre'),
      is_additional: Boolean(s.is_additional ?? false),
      section_subtotal: s.section_subtotal != null ? Number(s.section_subtotal) : null,
      section_cost: s.section_cost != null ? Number(s.section_cost) : null,
      items: (Array.isArray(s.items) ? s.items : []).map(
        (item: Record<string, unknown>) => ({
          description: String(item.description ?? ''),
          unit: String(item.unit ?? 'gl'),
          quantity: Number(item.quantity ?? 1),
          cost: Number(item.cost ?? 0),
          subtotal: Number(item.subtotal ?? 0),
        })
      ),
    })
  );

  return {
    sections,
    confidence: Number(parsed.confidence ?? 0),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
  };
}

/**
 * Main extraction function: parse Excel → call Claude → return structured result.
 */
export async function extractBudgetData(
  fileBuffer: Buffer,
  fileName: string
): Promise<BudgetImportResult> {
  const tabularText = parseExcelToText(fileBuffer, fileName);

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: BUDGET_IMPORT_PROMPT },
            { type: 'text', text: `\n\n## Contenido del Excel "${fileName}":\n\n${tabularText}` },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    return parseBudgetImportResponse(textBlock.text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Error al interpretar el presupuesto. Intentá de nuevo.');
    }
    if (error instanceof Error && error.message === 'No text response from Claude') {
      throw error;
    }
    console.error('[extractBudgetData] Anthropic API error:', error);
    throw new Error('Failed to extract budget data', { cause: error });
  }
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
cd packages/ai && npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add packages/ai/src/budget-extract.ts
git commit -m "feat: add budget extraction function with Excel parsing"
```

---

## Task 3: Update packages/ai exports

**Files:**
- Modify: `packages/ai/src/index.ts` (lines 1-2)
- Modify: `packages/ai/package.json` (exports field)

**Step 1: Update `packages/ai/src/index.ts`**

Current content:
```typescript
export { extractReceiptData, parseExtractionResponse, validateExtractionResult } from './extract';
export { EXTRACTION_PROMPT } from './prompt';
```

Add after existing lines:
```typescript
export { extractBudgetData, parseExcelToText, parseBudgetImportResponse } from './budget-extract';
export type { BudgetImportResult, BudgetImportSection, BudgetImportItem } from './budget-extract';
export { BUDGET_IMPORT_PROMPT } from './budget-prompt';
```

**Step 2: Update `packages/ai/package.json` exports**

Current `exports` field:
```json
{
  ".": "./src/index.ts",
  "./extract": "./src/extract.ts",
  "./prompt": "./src/prompt.ts"
}
```

Add new entries:
```json
{
  ".": "./src/index.ts",
  "./extract": "./src/extract.ts",
  "./prompt": "./src/prompt.ts",
  "./budget-extract": "./src/budget-extract.ts",
  "./budget-prompt": "./src/budget-prompt.ts"
}
```

**Step 3: Verify TypeScript compiles**

Run:
```bash
cd packages/ai && npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add packages/ai/src/index.ts packages/ai/package.json
git commit -m "feat: export budget import functions from @architech/ai"
```

---

## Task 4: Create the import API route

**Files:**
- Create: `apps/web/app/api/budgets/[id]/import/route.ts`

This is the main backend endpoint. It:
1. Validates auth, budget ownership, and budget state
2. Reads the uploaded Excel file
3. Calls `extractBudgetData` to get AI interpretation
4. Creates rubros in DB via Supabase (not via internal API call — direct DB insert to avoid HTTP overhead)
5. Assembles BudgetSnapshot with real `rubro_id`s
6. Validates with `budgetSnapshotSchema`
7. Saves snapshot to the budget

**Step 1: Create the route file**

Create file `apps/web/app/api/budgets/[id]/import/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { extractBudgetData } from '@architech/ai';
import { budgetSnapshotSchema } from '@/lib/schemas';
import { apiError } from '@/lib/api-error';
import { rateLimit } from '@/lib/rate-limit';
import type { BudgetSnapshot, BudgetSection } from '@architech/shared';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls'];
const MIN_CONFIDENCE = 0.3;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const rl = rateLimit('extract', ctx.orgId);
  if (rl) return rl;

  const { id } = await params;
  const db = getDb();

  // 1. Validate budget exists, belongs to org, is draft, and is empty
  const { data: budget } = await db
    .from('budgets')
    .select('id, status, snapshot')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .single();

  if (!budget) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (budget.status !== 'draft') {
    return NextResponse.json(
      { error: 'Solo se puede importar en un presupuesto en borrador.' },
      { status: 409 }
    );
  }

  const existingSnapshot = budget.snapshot as BudgetSnapshot | null;
  if (existingSnapshot?.sections && existingSnapshot.sections.length > 0) {
    return NextResponse.json(
      { error: 'El presupuesto ya tiene datos. Creá uno nuevo para importar.' },
      { status: 409 }
    );
  }

  // 2. Parse the uploaded file
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 });
  }

  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: 'El archivo debe ser .xlsx o .xls' },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'El archivo supera el tamaño máximo (5MB)' },
      { status: 400 }
    );
  }

  // 3. Extract budget data via AI
  let result;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    result = await extractBudgetData(buffer, file.name);
  } catch (error) {
    if (error instanceof Error && error.message === 'El Excel no contiene datos') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return apiError(error, 'Error al procesar el archivo Excel', 422, {
      route: '/api/budgets/[id]/import',
    });
  }

  // 4. Validate confidence threshold
  if (result.confidence < MIN_CONFIDENCE) {
    return NextResponse.json(
      {
        error: 'No se pudo interpretar la estructura del presupuesto',
        confidence: result.confidence,
        warnings: result.warnings,
      },
      { status: 422 }
    );
  }

  if (result.sections.length === 0) {
    return NextResponse.json(
      { error: 'No se encontraron rubros en el archivo' },
      { status: 422 }
    );
  }

  // 5. Create rubros in DB and assemble snapshot
  const sections: BudgetSection[] = [];

  for (let i = 0; i < result.sections.length; i++) {
    const importSection = result.sections[i];

    // Create rubro in DB
    const { data: rubro, error: rubroError } = await db
      .from('rubros')
      .insert({
        budget_id: id,
        name: importSection.rubro_name,
        sort_order: i,
      })
      .select('id, name')
      .single();

    if (rubroError || !rubro) {
      return apiError(
        rubroError,
        `Error al crear rubro "${importSection.rubro_name}"`,
        500,
        { route: '/api/budgets/[id]/import' }
      );
    }

    const section: BudgetSection = {
      rubro_id: rubro.id,
      rubro_name: rubro.name,
      is_additional: importSection.is_additional,
      items: importSection.items.map((item) => ({
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        cost: item.cost,
        subtotal: item.subtotal,
      })),
    };

    // Add section-level overrides if present
    if (importSection.section_subtotal != null) {
      section.subtotal = importSection.section_subtotal;
    }
    if (importSection.section_cost != null) {
      section.cost = importSection.section_cost;
    }

    sections.push(section);
  }

  const snapshot: BudgetSnapshot = { sections };

  // 6. Validate the assembled snapshot
  const parsed = budgetSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Error al armar el presupuesto importado' },
      { status: 422 }
    );
  }

  // 7. Save snapshot to budget
  const { error: updateError } = await db
    .from('budgets')
    .update({ snapshot: parsed.data })
    .eq('id', id);

  if (updateError) {
    return apiError(updateError, 'Error al guardar el presupuesto', 500, {
      route: '/api/budgets/[id]/import',
    });
  }

  return NextResponse.json({
    snapshot: parsed.data,
    confidence: result.confidence,
    warnings: result.warnings,
  });
}
```

**Step 2: Verify directory exists**

Run:
```bash
ls apps/web/app/api/budgets/\[id\]/
```

Expected: `route.ts` and possibly `publish/` or `versions/`. The `import/` directory is new.

**Step 3: Verify TypeScript compiles**

Run:
```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add apps/web/app/api/budgets/\[id\]/import/route.ts
git commit -m "feat: add POST /api/budgets/[id]/import endpoint"
```

---

## Task 5: Add Excel import option to create-budget dialog

**Files:**
- Modify: `apps/web/components/create-budget-dialog.tsx`

The dialog currently has: select project → create button. We add a second path: select project → choose file → creates budget + imports Excel → redirects to editor.

**Step 1: Modify `create-budget-dialog.tsx`**

The full modified component:

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import { useRouter } from 'next/navigation';
import { sileo } from 'sileo';
import { Upload, Loader2 } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Project } from '@architech/shared';
import type { BudgetListItem } from '@/lib/api-types';

interface CreateBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBudgetDialog({ open, onOpenChange }: CreateBudgetDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: projects = [] } = useSWR<Project[]>(open ? '/api/projects' : null, fetcher);
  const { data: budgets = [] } = useSWR<BudgetListItem[]>(open ? '/api/budgets' : null, fetcher);

  const projectsWithBudget = new Set(budgets.map((b) => b.project_id));
  const availableProjects = projects.filter((p) => !projectsWithBudget.has(p.id));

  useEffect(() => {
    setSelectedProjectId('');
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: selectedProjectId }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al crear presupuesto');
      }

      const budget = await response.json();

      sileo.success({ title: 'Presupuesto creado' });
      await mutate('/api/budgets');
      onOpenChange(false);
      router.push(`/budgets/${budget.id}`);
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al crear presupuesto' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportClick = () => {
    if (!selectedProjectId) {
      sileo.error({ title: 'Seleccioná un proyecto primero' });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    e.target.value = '';

    setIsImporting(true);

    try {
      // 1. Create empty budget
      const createRes = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: selectedProjectId }),
      });

      if (!createRes.ok) {
        const errorBody = await createRes.json();
        throw new Error(errorBody.error ?? 'Error al crear presupuesto');
      }

      const budget = await createRes.json();

      // 2. Import Excel into the budget
      const formData = new FormData();
      formData.append('file', file);

      const importRes = await fetch(`/api/budgets/${budget.id}/import`, {
        method: 'POST',
        body: formData,
      });

      if (!importRes.ok) {
        const errorBody = await importRes.json();
        throw new Error(errorBody.error ?? 'Error al importar presupuesto');
      }

      const result = await importRes.json();

      if (result.confidence < 0.6) {
        sileo.warning({
          title: 'Presupuesto importado',
          description: 'Algunos datos no pudieron interpretarse con certeza. Revisá los valores.',
        });
      } else {
        sileo.success({
          title: 'Presupuesto importado',
          description: 'Revisá los datos importados.',
        });
      }

      if (result.warnings?.length > 0) {
        for (const w of result.warnings) {
          sileo.info({ title: w });
        }
      }

      await mutate('/api/budgets');
      onOpenChange(false);
      router.push(`/budgets/${budget.id}`);
    } catch (error) {
      sileo.error({
        title: error instanceof Error ? error.message : 'Error al importar presupuesto',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const busy = isSubmitting || isImporting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo Presupuesto</DialogTitle>
          <DialogDescription>Selecciona el proyecto para crear su presupuesto</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="project">Proyecto <span className="text-red-500">*</span></FieldLabel>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger id="project" className="w-full">
                <SelectValue placeholder="Seleccionar proyecto" />
              </SelectTrigger>
              <SelectContent>
                {availableProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableProjects.length === 0 && (
              <FieldDescription>
                Todos los proyectos ya tienen presupuesto
              </FieldDescription>
            )}
          </Field>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleImportClick}
              disabled={busy || !selectedProjectId}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Interpretando...
                </>
              ) : (
                <>
                  <Upload className="mr-1 h-4 w-4" />
                  Importar Excel
                </>
              )}
            </Button>
            <Button type="submit" disabled={busy || !selectedProjectId}>
              {isSubmitting ? 'Creando...' : 'Crear vacío'}
            </Button>
          </DialogFooter>
        </form>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />
      </DialogContent>
    </Dialog>
  );
}
```

Key changes from original:
- Added `isImporting` state, `fileInputRef` ref
- Added `handleImportClick` and `handleFileChange` functions
- Added hidden `<input type="file" accept=".xlsx,.xls">` at the bottom
- Added "Importar Excel" button in footer between Cancel and Create
- Renamed "Crear" to "Crear vacío" to differentiate
- Added `Loader2` and `Upload` lucide icons
- Import flow: create budget → POST import → show toasts → redirect

**Step 2: Verify TypeScript compiles**

Run:
```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add apps/web/components/create-budget-dialog.tsx
git commit -m "feat: add Excel import option to create budget dialog"
```

---

## Task 6: Add import button to empty budget editor

**Files:**
- Modify: `apps/web/components/budget-table.tsx` (around lines 630-642)

When `sections.length === 0` and `!readOnly`, show an "Importar desde Excel" button alongside the existing "Agregar rubro" buttons.

**Step 1: Add import state, ref, and handler**

At the top of the `BudgetTable` component (after existing state declarations around line 56), add:

```typescript
const [isImporting, setIsImporting] = useState(false);
const importFileRef = useRef<HTMLInputElement>(null);
```

Add the import at the top of the file (with existing imports from lucide-react, line 8):
```typescript
Upload
```
(add to the existing destructured import from `lucide-react`)

Add `useRef` to the React import if not already there (line 1).

Add the handler function (after `addRubro` callback, around line 255):

```typescript
const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = '';

  setIsImporting(true);
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`/api/budgets/${budget.id}/import`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error ?? 'Error al importar presupuesto');
    }

    const result = await res.json();

    if (result.confidence < 0.6) {
      sileo.warning({
        title: 'Presupuesto importado',
        description: 'Algunos datos no pudieron interpretarse con certeza. Revisá los valores.',
      });
    } else {
      sileo.success({
        title: 'Presupuesto importado',
        description: 'Revisá los datos importados.',
      });
    }

    if (result.warnings?.length > 0) {
      for (const w of result.warnings) {
        sileo.info({ title: w });
      }
    }

    // Revalidate SWR to refresh budget data
    await mutate(`/api/budgets/${budget.id}`);
  } catch (error) {
    sileo.error({
      title: error instanceof Error ? error.message : 'Error al importar presupuesto',
    });
  } finally {
    setIsImporting(false);
  }
}, [budget.id]);
```

**Step 2: Add the import button in the empty state**

Around line 630-642, modify the "Add rubro buttons" section. Replace the current block:

```tsx
{/* Add rubro buttons */}
{!readOnly && (
  <div className="flex items-center gap-2">
    <Button variant="outline" size="sm" onClick={() => addRubro(false)}>
      <Plus className="mr-1 h-4 w-4" />
      Agregar rubro
    </Button>
    <Button variant="outline" size="sm" onClick={() => addRubro(true)} className="border-amber-300 text-amber-700 hover:bg-amber-50">
      <Plus className="mr-1 h-4 w-4" />
      Agregar adicional
    </Button>
  </div>
)}
```

With:

```tsx
{/* Add rubro buttons */}
{!readOnly && (
  <div className="flex items-center gap-2">
    {sections.length === 0 && (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => importFileRef.current?.click()}
          disabled={isImporting}
        >
          {isImporting ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              Interpretando...
            </>
          ) : (
            <>
              <Upload className="mr-1 h-4 w-4" />
              Importar Excel
            </>
          )}
        </Button>
        <input
          ref={importFileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleImportFile}
        />
      </>
    )}
    <Button variant="outline" size="sm" onClick={() => addRubro(false)}>
      <Plus className="mr-1 h-4 w-4" />
      Agregar rubro
    </Button>
    <Button variant="outline" size="sm" onClick={() => addRubro(true)} className="border-amber-300 text-amber-700 hover:bg-amber-50">
      <Plus className="mr-1 h-4 w-4" />
      Agregar adicional
    </Button>
  </div>
)}
```

**Step 3: Verify TypeScript compiles**

Run:
```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

**Step 4: Manual smoke test**

Run:
```bash
cd apps/web && npm run dev
```

1. Create a new budget → dialog should show "Importar Excel" and "Crear vacío" buttons
2. Go to an empty budget → should show "Importar Excel" button alongside "Agregar rubro"
3. Upload a valid .xlsx → should call API, show toast, and populate editor
4. Upload an invalid file → should show error toast

**Step 5: Commit**

```bash
git add apps/web/components/budget-table.tsx
git commit -m "feat: add Excel import button to empty budget editor"
```

---

## Task 7: Final integration test and cleanup

**Step 1: Verify the full flow compiles**

Run:
```bash
npm run typecheck
```

Expected: No errors across the monorepo.

**Step 2: Verify lint passes**

Run:
```bash
npm run lint
```

Expected: No new lint errors.

**Step 3: Final commit (if any cleanup needed)**

If any issues were found and fixed:
```bash
git add -A
git commit -m "fix: address lint/type issues from budget import feature"
```

---

## Summary of all files

| File | Action | Task |
|------|--------|------|
| `packages/ai/package.json` | Modify (add `xlsx` dep + exports) | 1, 3 |
| `packages/ai/src/budget-prompt.ts` | Create | 1 |
| `packages/ai/src/budget-extract.ts` | Create | 2 |
| `packages/ai/src/index.ts` | Modify (add re-exports) | 3 |
| `apps/web/app/api/budgets/[id]/import/route.ts` | Create | 4 |
| `apps/web/components/create-budget-dialog.tsx` | Modify | 5 |
| `apps/web/components/budget-table.tsx` | Modify | 6 |
