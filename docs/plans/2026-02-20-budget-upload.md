# Budget Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to upload Excel/PDF files and automatically create a budget with AI-extracted rubros and items.

**Architecture:** File is sent to a new API endpoint that parses Excel (via `xlsx` lib) or PDF (via `pdfjs-dist` for text extraction) into structured content, sends it to Claude for extraction into `BudgetSnapshot` format, creates the budget + rubros in the DB, and returns the budget ID for navigation.

**Tech Stack:** Anthropic SDK (Claude), `xlsx` for Excel parsing, `pdfjs-dist` for PDF text extraction, Next.js API routes, Zod validation, shadcn/ui Dialog

---

### Task 1: Add `xlsx` and `pdfjs-dist` dependencies

**Files:**
- Modify: `packages/ai/package.json`

**Step 1: Install dependencies**

Run:
```bash
cd packages/ai && npm install xlsx pdfjs-dist@4.9.155
```

Note: `xlsx` is used for Excel parsing. `pdfjs-dist` is used for PDF text extraction (no native deps, works in Node). Pin `pdfjs-dist` to a stable version.

**Step 2: Verify installation**

Run: `cd packages/ai && node -e "require('xlsx'); require('pdfjs-dist'); console.log('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add packages/ai/package.json packages/ai/package-lock.json package-lock.json
git commit -m "chore: add xlsx and pdfjs-dist dependencies to @architech/ai"
```

---

### Task 2: Budget extraction prompt

**Files:**
- Create: `packages/ai/src/budget-prompt.ts`

**Step 1: Create the prompt file**

```typescript
export const BUDGET_EXTRACTION_PROMPT = `You are a construction budget data extractor. Analyze the following content from a budget document (Excel spreadsheet or PDF) and extract the structured data.

## What to extract

A construction budget is organized into RUBROS (sections/categories like "Albañilería", "Instalación Eléctrica", "Pintura", etc.) with LINE ITEMS underneath each rubro.

### Structure to identify:
1. **Rubros (sections):** Look for bold rows, numbered section headers, or rows that act as category dividers. Common patterns:
   - "1. ALBAÑILERÍA" or "RUBRO 1: Albañilería"
   - Bold or uppercase rows without unit/quantity values
   - Rows followed by indented sub-items

2. **Items (within each rubro):** Each item typically has:
   - description: what the work/material is
   - unit: measurement unit (m2, ml, gl, un, kg, m3, etc.) — default "gl" if not visible
   - quantity: how many units — default 1 if not visible
   - subtotal: the quoted price/amount for this line
   - cost: internal cost (rarely present in external budgets, default 0)

3. **Additional sections:** Look for sections labeled "ADICIONAL", "TRABAJOS ADICIONALES", or similar. These are separate from the base budget scope. Mark them with is_additional: true.

## Rules
- If a section has a SUBTOTAL row but individual items don't have prices, use the section subtotal as a section-level override.
- If quantity and unit are not visible for an item, default quantity=1 and unit="gl".
- cost should default to 0 unless explicitly shown (internal cost is rarely in external budgets).
- NEVER invent or calculate values not present in the source.
- If you cannot identify any rubro structure, create a single section called "General" with all items.
- Return ONLY valid JSON, no markdown, no explanation.

## Output format
{
  "sections": [
    {
      "rubro_name": "string",
      "is_additional": false,
      "subtotal": null,
      "items": [
        {
          "description": "string",
          "unit": "string",
          "quantity": number,
          "cost": 0,
          "subtotal": number
        }
      ]
    }
  ],
  "confidence": number
}

The confidence field (0 to 1) reflects how well the document structure was recognized.

## Content to analyze:
`;
```

**Step 2: Commit**

```bash
git add packages/ai/src/budget-prompt.ts
git commit -m "feat: add budget extraction prompt for AI parsing"
```

---

### Task 3: Budget extraction function

**Files:**
- Create: `packages/ai/src/extract-budget.ts`
- Modify: `packages/ai/src/index.ts`
- Modify: `packages/ai/package.json` (add export)

**Step 1: Create the extraction function**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { BUDGET_EXTRACTION_PROMPT } from './budget-prompt';

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

export interface BudgetExtractionItem {
  description: string;
  unit: string;
  quantity: number;
  cost: number;
  subtotal: number;
}

export interface BudgetExtractionSection {
  rubro_name: string;
  is_additional: boolean;
  subtotal?: number;
  cost?: number;
  items: BudgetExtractionItem[];
}

export interface BudgetExtractionResult {
  sections: BudgetExtractionSection[];
  confidence: number;
}

export function parseBudgetExtractionResponse(raw: string): BudgetExtractionResult {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const sections: BudgetExtractionSection[] = (parsed.sections ?? []).map(
    (s: Record<string, unknown>) => ({
      rubro_name: String(s.rubro_name ?? 'Sin nombre'),
      is_additional: Boolean(s.is_additional),
      subtotal: s.subtotal != null ? Number(s.subtotal) : undefined,
      cost: s.cost != null ? Number(s.cost) : undefined,
      items: ((s.items as Record<string, unknown>[]) ?? []).map(
        (i: Record<string, unknown>) => ({
          description: String(i.description ?? ''),
          unit: String(i.unit ?? 'gl'),
          quantity: Number(i.quantity ?? 1),
          cost: Number(i.cost ?? 0),
          subtotal: Number(i.subtotal ?? 0),
        })
      ),
    })
  );

  return {
    sections,
    confidence: Number(parsed.confidence ?? 0),
  };
}

/**
 * Extract budget data from text content (Excel parsed to text).
 */
export async function extractBudgetFromText(
  textContent: string
): Promise<BudgetExtractionResult> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: BUDGET_EXTRACTION_PROMPT + textContent,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return parseBudgetExtractionResponse(textBlock.text);
}

/**
 * Extract budget data from PDF page images (vision).
 */
export async function extractBudgetFromImages(
  images: Array<{ base64: string; mimeType: 'image/png' | 'image/jpeg' }>
): Promise<BudgetExtractionResult> {
  const client = new Anthropic();

  const content: Anthropic.Messages.ContentBlockParam[] = images.map((img) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: img.mimeType,
      data: img.base64,
    },
  }));

  content.push({ type: 'text', text: BUDGET_EXTRACTION_PROMPT });

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 8192,
    messages: [{ role: 'user', content }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return parseBudgetExtractionResponse(textBlock.text);
}
```

**Step 2: Update `packages/ai/src/index.ts` to export the new functions**

Add these exports:

```typescript
export { extractBudgetFromText, extractBudgetFromImages, parseBudgetExtractionResponse } from './extract-budget';
export type { BudgetExtractionResult, BudgetExtractionSection, BudgetExtractionItem } from './extract-budget';
export { BUDGET_EXTRACTION_PROMPT } from './budget-prompt';
```

**Step 3: Update `packages/ai/package.json` exports**

Add to the `"exports"` field:

```json
"./extract-budget": "./src/extract-budget.ts",
"./budget-prompt": "./src/budget-prompt.ts"
```

**Step 4: Verify typecheck**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: no errors

**Step 5: Commit**

```bash
git add packages/ai/src/extract-budget.ts packages/ai/src/index.ts packages/ai/package.json
git commit -m "feat: add budget extraction function with text and vision support"
```

---

### Task 4: File parsing utilities (Excel + PDF to text)

**Files:**
- Create: `packages/ai/src/parse-file.ts`

**Step 1: Create file parsing utilities**

These utilities convert uploaded files into text content that can be sent to Claude.

```typescript
import * as XLSX from 'xlsx';

/**
 * Parse an Excel file buffer into a text representation of its content.
 * Preserves row/column structure as tab-separated values.
 */
export function parseExcelToText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t', blankrows: false });
    if (csv.trim()) {
      sheets.push(`=== Sheet: ${sheetName} ===\n${csv}`);
    }
  }

  return sheets.join('\n\n');
}

/**
 * Extract text content from a PDF buffer using pdfjs-dist.
 * Returns structured text with page separators.
 */
export async function parsePdfToText(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid issues with pdfjs-dist initialization
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const uint8Array = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8Array }).promise;

  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');

    if (text.trim()) {
      pages.push(`=== Page ${i} ===\n${text}`);
    }
  }

  return pages.join('\n\n');
}

/**
 * Detect file type from MIME type and return the appropriate parser type.
 */
export function getFileType(mimeType: string): 'excel' | 'pdf' | null {
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel'
  ) {
    return 'excel';
  }
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }
  return null;
}
```

**Step 2: Update `packages/ai/src/index.ts`**

Add:
```typescript
export { parseExcelToText, parsePdfToText, getFileType } from './parse-file';
```

**Step 3: Update `packages/ai/package.json` exports**

Add:
```json
"./parse-file": "./src/parse-file.ts"
```

**Step 4: Commit**

```bash
git add packages/ai/src/parse-file.ts packages/ai/src/index.ts packages/ai/package.json
git commit -m "feat: add Excel and PDF file parsing utilities"
```

---

### Task 5: API endpoint `POST /api/budgets/extract`

**Files:**
- Create: `apps/web/app/api/budgets/extract/route.ts`

**Step 1: Create the API route**

This endpoint receives a file + project_id, extracts budget data with AI, creates the budget + rubros in the DB, and returns the budget ID.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { extractBudgetFromText } from '@architech/ai';
import { parseExcelToText, parsePdfToText, getFileType } from '@architech/ai/parse-file';
import { budgetSnapshotSchema } from '@/lib/schemas';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/pdf',
];

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const projectId = formData.get('project_id') as string | null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!projectId) return NextResponse.json({ error: 'project_id is required' }, { status: 400 });

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File must be Excel (.xlsx, .xls) or PDF' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File size must be under 10MB' }, { status: 400 });
  }

  const db = getDb();

  // Verify project belongs to org and has no existing budget
  const { data: project } = await db
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('organization_id', ctx.orgId)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { data: existingBudget } = await db
    .from('budgets')
    .select('id')
    .eq('project_id', projectId)
    .single();

  if (existingBudget) {
    return NextResponse.json({ error: 'Project already has a budget' }, { status: 409 });
  }

  // Parse file content
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileType = getFileType(file.type);

  let textContent: string;
  try {
    if (fileType === 'excel') {
      textContent = parseExcelToText(buffer);
    } else {
      textContent = await parsePdfToText(buffer);
    }
  } catch {
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 400 });
  }

  if (!textContent.trim()) {
    return NextResponse.json({ error: 'File appears to be empty' }, { status: 400 });
  }

  // Extract with AI
  let extraction;
  try {
    extraction = await extractBudgetFromText(textContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI extraction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!extraction.sections.length) {
    return NextResponse.json({ error: 'No budget sections found in file' }, { status: 422 });
  }

  // Create budget
  const { data: budget, error: budgetError } = await db
    .from('budgets')
    .insert({
      project_id: projectId,
      organization_id: ctx.orgId,
      current_version: 0,
      status: 'draft',
      snapshot: { sections: [] }, // placeholder, updated after rubros are created
    })
    .select()
    .single();

  if (budgetError) return NextResponse.json({ error: budgetError.message }, { status: 500 });

  // Create rubros and build final snapshot
  const sections = [];
  for (let i = 0; i < extraction.sections.length; i++) {
    const s = extraction.sections[i];

    const { data: rubro, error: rubroError } = await db
      .from('rubros')
      .insert({
        budget_id: budget.id,
        name: s.rubro_name,
        sort_order: i,
      })
      .select()
      .single();

    if (rubroError) {
      // Cleanup: delete the budget we just created
      await db.from('budgets').delete().eq('id', budget.id);
      return NextResponse.json({ error: rubroError.message }, { status: 500 });
    }

    sections.push({
      rubro_id: rubro.id,
      rubro_name: s.rubro_name,
      is_additional: s.is_additional,
      subtotal: s.subtotal,
      cost: s.cost,
      items: s.items.length > 0
        ? s.items
        : [{ description: '', unit: 'gl', quantity: 1, cost: 0, subtotal: 0 }],
    });
  }

  // Update budget with final snapshot
  const snapshot = { sections };
  const parsed = budgetSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    // Cleanup on validation failure
    await db.from('budgets').delete().eq('id', budget.id);
    return NextResponse.json({ error: 'AI extraction produced invalid data' }, { status: 422 });
  }

  const { error: updateError } = await db
    .from('budgets')
    .update({ snapshot: parsed.data })
    .eq('id', budget.id);

  if (updateError) {
    await db.from('budgets').delete().eq('id', budget.id);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      budget_id: budget.id,
      sections_count: sections.length,
      items_count: sections.reduce((sum, s) => sum + s.items.length, 0),
    },
    { status: 201 }
  );
}
```

**Step 2: Verify typecheck**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: no errors

**Step 3: Commit**

```bash
git add "apps/web/app/api/budgets/extract/route.ts"
git commit -m "feat: add POST /api/budgets/extract endpoint"
```

---

### Task 6: `ImportBudgetDialog` component

**Files:**
- Create: `apps/web/components/import-budget-dialog.tsx`

**Step 1: Create the dialog component**

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import { useRouter } from 'next/navigation';
import { sileo } from 'sileo';
import { Upload, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Project } from '@architech/shared';
import type { BudgetListItem } from '@/lib/api-types';

interface ImportBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected project ID (when opening from project detail page) */
  projectId?: string;
}

type Step = 'select' | 'processing' | 'error';

const ACCEPTED_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/pdf',
];
const MAX_SIZE = 10 * 1024 * 1024;

export function ImportBudgetDialog({ open, onOpenChange, projectId: preselectedProjectId }: ImportBudgetDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('select');
  const [selectedProjectId, setSelectedProjectId] = useState(preselectedProjectId ?? '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const { data: projects = [] } = useSWR<Project[]>(open && !preselectedProjectId ? '/api/projects' : null, fetcher);
  const { data: budgets = [] } = useSWR<BudgetListItem[]>(open && !preselectedProjectId ? '/api/budgets' : null, fetcher);

  const projectsWithBudget = new Set(budgets.map((b) => b.project_id));
  const availableProjects = projects.filter((p) => !projectsWithBudget.has(p.id));

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep('select');
      setSelectedProjectId(preselectedProjectId ?? '');
      setSelectedFile(null);
      setErrorMessage('');
    }
  }, [open, preselectedProjectId]);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Formato no soportado. Usa Excel (.xlsx, .xls) o PDF.';
    }
    if (file.size > MAX_SIZE) {
      return 'El archivo supera los 10MB.';
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setErrorMessage(error);
      setStep('error');
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleSubmit = async () => {
    const projectToUse = preselectedProjectId || selectedProjectId;
    if (!projectToUse || !selectedFile) return;

    setStep('processing');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('project_id', projectToUse);

      const response = await fetch('/api/budgets/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al procesar el archivo');
      }

      const result = await response.json();

      sileo.success({
        title: `Presupuesto importado: ${result.sections_count} rubros, ${result.items_count} items`,
      });

      await mutate('/api/budgets');
      onOpenChange(false);
      router.push(`/budgets/${result.budget_id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Error al procesar el archivo');
      setStep('error');
    }
  };

  const projectLabel = preselectedProjectId
    ? undefined // project already known, no need to show selector
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Presupuesto</DialogTitle>
          <DialogDescription>
            Subi un archivo Excel o PDF y la IA extraerá los rubros e items automáticamente
          </DialogDescription>
        </DialogHeader>

        {step === 'processing' ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Analizando presupuesto...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Esto puede tomar unos segundos
              </p>
            </div>
          </div>
        ) : step === 'error' ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div className="text-center">
              <p className="font-medium text-destructive">{errorMessage}</p>
            </div>
            <Button variant="outline" onClick={() => { setStep('select'); setSelectedFile(null); setErrorMessage(''); }}>
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Project selector (only when not pre-selected) */}
              {!preselectedProjectId && (
                <Field>
                  <FieldLabel htmlFor="import-project">Proyecto <span className="text-red-500">*</span></FieldLabel>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger id="import-project" className="w-full">
                      <SelectValue placeholder="Seleccionar proyecto" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {/* File drop zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : selectedFile
                    ? 'border-green-400 bg-green-50'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter') fileInputRef.current?.click(); }}
                tabIndex={0}
                role="button"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.pdf"
                  onChange={handleInputChange}
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet className="h-8 w-8 text-green-600" />
                    <p className="font-medium text-green-700">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(0)} KB — Click para cambiar
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="font-medium">Arrastrá un archivo o hacé click para seleccionar</p>
                    <p className="text-xs text-muted-foreground">Excel (.xlsx, .xls) o PDF — máx 10MB</p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!(preselectedProjectId || selectedProjectId) || !selectedFile}
              >
                <Upload className="mr-2 h-4 w-4" />
                Importar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify typecheck**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: no errors

**Step 3: Commit**

```bash
git add apps/web/components/import-budget-dialog.tsx
git commit -m "feat: add ImportBudgetDialog component"
```

---

### Task 7: Add "Importar" button to budgets list page

**Files:**
- Modify: `apps/web/app/(dashboard)/budgets/page.tsx`

**Step 1: Add import dialog state and button**

In `apps/web/app/(dashboard)/budgets/page.tsx`:

1. Add import at the top:
```typescript
import { ImportBudgetDialog } from '@/components/import-budget-dialog';
```

2. Add state:
```typescript
const [showImportDialog, setShowImportDialog] = useState(false);
```

3. Change the `action` in `PageHeader` to include both buttons:
```typescript
action={
  isAdminOrSupervisor ? (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => setShowImportDialog(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Importar
      </Button>
      <Button onClick={() => setShowCreateDialog(true)}>
        <Plus className="mr-2" />
        Nuevo Presupuesto
      </Button>
    </div>
  ) : undefined
}
```

4. Add the `Upload` import from lucide-react.

5. Add the dialog component before the closing `</div>`:
```typescript
<ImportBudgetDialog
  open={showImportDialog}
  onOpenChange={setShowImportDialog}
/>
```

**Step 2: Verify typecheck**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: no errors

**Step 3: Commit**

```bash
git add "apps/web/app/(dashboard)/budgets/page.tsx"
git commit -m "feat: add import budget button to budgets list page"
```

---

### Task 8: Add "Importar" button to project detail page

**Files:**
- Modify: `apps/web/app/(dashboard)/projects/[id]/page.tsx`

**Step 1: Add import dialog to project page**

In the project detail page, the Presupuesto card footer already has a "Crear presupuesto" link when no budget exists. Add an "Importar" button next to it.

1. Add import at the top:
```typescript
import { ImportBudgetDialog } from '@/components/import-budget-dialog';
```

2. Add state:
```typescript
const [showImportDialog, setShowImportDialog] = useState(false);
```

3. In the Presupuesto card's `<CardFooter>`, modify the "no budget" branch to show both buttons:

Find the section that currently shows:
```tsx
) : isAdminOrSupervisor ? (
  <Button variant="outline" size="sm" asChild>
    <Link href="/budgets">
      <Calculator className="mr-2 h-4 w-4" />
      Crear presupuesto
    </Link>
  </Button>
) : null}
```

Replace with:
```tsx
) : isAdminOrSupervisor ? (
  <div className="flex gap-2">
    <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
      <Upload className="mr-2 h-4 w-4" />
      Importar
    </Button>
    <Button variant="outline" size="sm" asChild>
      <Link href="/budgets">
        <Calculator className="mr-2 h-4 w-4" />
        Crear presupuesto
      </Link>
    </Button>
  </div>
) : null}
```

4. Add `Upload` to the lucide-react imports (it's already imported for the Comprobantes section).

5. Add the dialog before the closing `</div>` of the page, after the delete dialog:
```tsx
<ImportBudgetDialog
  open={showImportDialog}
  onOpenChange={setShowImportDialog}
  projectId={projectId}
/>
```

**Step 2: Verify typecheck**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: no errors

**Step 3: Commit**

```bash
git add "apps/web/app/(dashboard)/projects/[id]/page.tsx"
git commit -m "feat: add import budget button to project detail page"
```

---

### Task 9: TypeScript check + final verification

**Files:** None (verification only)

**Step 1: Full typecheck**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: no errors

**Step 2: Verify all files are committed**

Run: `git status`
Expected: clean working tree

**Step 3: Push**

Run: `git push -u origin feat/budget-upload`
