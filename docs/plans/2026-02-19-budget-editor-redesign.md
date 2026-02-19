# Budget Editor Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the budget editor from accordion-based sections to a continuous spreadsheet-style table with manual cost/subtotal, adicional sections, reordering, and hideable cost column.

**Architecture:** Update shared types and Zod schema to replace `unit_price` with `cost` and add `is_additional`. Update API total calculation. Replace `BudgetEditor`/`BudgetSectionCard` with a new `BudgetTable` component using `<table>` with section header rows and inline-editable item rows.

**Tech Stack:** React 19, Next.js 15, shadcn/ui (Table, Input, Button, Select), Zod, SWR, Lucide icons, Tailwind CSS.

---

### Task 1: Update shared types

**Files:**
- Modify: `packages/shared/src/types.ts:239-252`

**Step 1: Update BudgetItem and BudgetSection types**

Replace lines 239-252 with:

```typescript
export interface BudgetItem {
  description: string;
  unit: string;
  quantity: number;
  cost: number;
  subtotal: number;
}

export interface BudgetSection {
  cost_center_id: string;
  cost_center_name: string;
  is_additional: boolean;
  items: BudgetItem[];
}
```

Changes:
- `BudgetItem`: removed `unit_price`, added `cost`, reordered fields to match table columns
- `BudgetSection`: removed `subtotal` (calculated in UI), added `is_additional: boolean`

**Step 2: Verify build**

Run: `npm run build` from monorepo root
Expected: TypeScript errors in files that reference old field names — this is expected, we fix them in subsequent tasks.

**Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): update budget types — cost replaces unit_price, add is_additional"
```

---

### Task 2: Update Zod schema

**Files:**
- Modify: `apps/web/lib/schemas/budget.ts`

**Step 1: Update schema to match new types**

Replace the full file content with:

```typescript
import { z } from 'zod';

export const budgetItemSchema = z.object({
  description: z.string().min(1, 'La descripcion es requerida'),
  unit: z.string(),
  quantity: z.number().min(0),
  cost: z.number().min(0),
  subtotal: z.number().min(0),
});

export const budgetSectionSchema = z.object({
  cost_center_id: z.string().uuid(),
  cost_center_name: z.string(),
  is_additional: z.boolean(),
  items: z.array(budgetItemSchema).min(1),
});

export const budgetSnapshotSchema = z.object({
  sections: z.array(budgetSectionSchema).min(1),
});

export type BudgetSnapshotFormData = z.infer<typeof budgetSnapshotSchema>;
```

Changes from current:
- `unit_price` → `cost`
- Removed `subtotal` from section schema
- Added `is_additional: z.boolean()`
- Relaxed validations: `quantity` uses `.min(0)` not `.positive()`, `unit` drops `.min(1)`, `cost`/`subtotal` use `.min(0)`

**Step 2: Commit**

```bash
git add apps/web/lib/schemas/budget.ts
git commit -m "feat(schemas): update budget Zod schema — cost, is_additional, relaxed validations"
```

---

### Task 3: Update API routes — total calculation

**Files:**
- Modify: `apps/web/app/api/budgets/route.ts:105-106`
- Modify: `apps/web/app/api/budgets/[id]/route.ts:80-81`

**Step 1: Fix POST total calculation in `route.ts`**

In `apps/web/app/api/budgets/route.ts`, replace lines 104-106:

```typescript
  // Calculate total
  const sections = (snapshot as { sections?: Array<{ subtotal?: number }> }).sections ?? [];
  const totalAmount = sections.reduce((sum, s) => sum + (Number(s.subtotal) || 0), 0);
```

With:

```typescript
  // Calculate total (sum of all item subtotals across all sections)
  const sections = (snapshot as { sections?: Array<{ items?: Array<{ subtotal?: number }> }> }).sections ?? [];
  const totalAmount = sections.reduce((sum, s) =>
    sum + (s.items ?? []).reduce((itemSum, i) => itemSum + (Number(i.subtotal) || 0), 0)
  , 0);
```

**Step 2: Fix PUT total calculation in `[id]/route.ts`**

In `apps/web/app/api/budgets/[id]/route.ts`, replace lines 80-81:

```typescript
  const sections = (snapshot as { sections?: Array<{ subtotal?: number }> }).sections ?? [];
  const totalAmount = sections.reduce((sum, s) => sum + (Number(s.subtotal) || 0), 0);
```

With:

```typescript
  const sections = (snapshot as { sections?: Array<{ items?: Array<{ subtotal?: number }> }> }).sections ?? [];
  const totalAmount = sections.reduce((sum, s) =>
    sum + (s.items ?? []).reduce((itemSum, i) => itemSum + (Number(i.subtotal) || 0), 0)
  , 0);
```

**Step 3: Commit**

```bash
git add apps/web/app/api/budgets/route.ts apps/web/app/api/budgets/[id]/route.ts
git commit -m "fix(api): calculate total_amount from item subtotals instead of section subtotals"
```

---

### Task 4: Update CreateBudgetDialog

**Files:**
- Modify: `apps/web/components/create-budget-dialog.tsx:49-57`

**Step 1: Update initial snapshot template**

In `create-budget-dialog.tsx`, replace lines 49-57:

```typescript
      const initialSnapshot: BudgetSnapshot = {
        sections: costCenters.length > 0
          ? [{
              cost_center_id: costCenters[0].id,
              cost_center_name: costCenters[0].name,
              subtotal: 0,
              items: [{ description: '', quantity: 1, unit: 'unidad', unit_price: 0, subtotal: 0 }],
            }]
          : [],
      };
```

With:

```typescript
      const initialSnapshot: BudgetSnapshot = {
        sections: costCenters.length > 0
          ? [{
              cost_center_id: costCenters[0].id,
              cost_center_name: costCenters[0].name,
              is_additional: false,
              items: [{ description: '', unit: 'gl', quantity: 1, cost: 0, subtotal: 0 }],
            }]
          : [],
      };
```

Changes: removed `subtotal` from section, added `is_additional: false`, `unit_price` → `cost`, default unit `'gl'`.

**Step 2: Commit**

```bash
git add apps/web/components/create-budget-dialog.tsx
git commit -m "feat(create-dialog): update initial snapshot template for new budget format"
```

---

### Task 5: Create BudgetTable component (replaces BudgetEditor)

**Files:**
- Create: `apps/web/components/budget-table.tsx`
- Modify: `apps/web/app/(dashboard)/budgets/[id]/page.tsx` (update import)

This is the main component. It replaces `budget-editor.tsx` entirely.

**Step 1: Create `budget-table.tsx`**

```tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { sileo } from 'sileo';
import { Plus, Save, Trash2, ChevronUp, ChevronDown, EyeOff, Eye } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { useCurrentUser } from '@/lib/use-current-user';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { SaveBudgetDialog } from '@/components/save-budget-dialog';
import type { BudgetSnapshot, BudgetSection, BudgetItem, CostCenter } from '@architech/shared';
import type { BudgetDetail } from '@/lib/api-types';

interface BudgetTableProps {
  budget: BudgetDetail;
  readOnly?: boolean;
}

export function BudgetTable({ budget, readOnly: forceReadOnly }: BudgetTableProps) {
  const { isAdminOrSupervisor } = useCurrentUser();
  const readOnly = forceReadOnly || !isAdminOrSupervisor;

  const { data: costCenters = [] } = useSWR<CostCenter[]>('/api/cost-centers', fetcher);

  const [sections, setSections] = useState<BudgetSection[]>(
    budget.latest_version?.snapshot?.sections ?? []
  );
  const [isDirty, setIsDirty] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCost, setShowCost] = useState(true);

  useEffect(() => {
    setSections(budget.latest_version?.snapshot?.sections ?? []);
    setIsDirty(false);
  }, [budget.latest_version?.version_number]);

  // Split sections into base and additional
  const baseSections = sections.filter((s) => !s.is_additional);
  const additionalSections = sections.filter((s) => s.is_additional);

  // Totals
  const sumItems = (secs: BudgetSection[], field: 'cost' | 'subtotal') =>
    secs.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + (Number(i[field]) || 0), 0), 0);

  const baseTotalSubtotal = sumItems(baseSections, 'subtotal');
  const baseTotalCost = sumItems(baseSections, 'cost');
  const additionalTotalSubtotal = sumItems(additionalSections, 'subtotal');
  const additionalTotalCost = sumItems(additionalSections, 'cost');
  const grandTotalSubtotal = baseTotalSubtotal + additionalTotalSubtotal;

  // Helpers to map flat section index
  const getSectionIndex = (section: BudgetSection) => sections.indexOf(section);

  const updateSection = useCallback((index: number, section: BudgetSection) => {
    setSections((prev) => {
      const next = [...prev];
      next[index] = section;
      return next;
    });
    setIsDirty(true);
  }, []);

  const removeSection = useCallback((index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  }, []);

  const updateItem = useCallback((sectionIndex: number, itemIndex: number, field: keyof BudgetItem, value: string | number) => {
    setSections((prev) => {
      const next = [...prev];
      const section = { ...next[sectionIndex] };
      const items = [...section.items];
      items[itemIndex] = { ...items[itemIndex], [field]: value };
      section.items = items;
      next[sectionIndex] = section;
      return next;
    });
    setIsDirty(true);
  }, []);

  const addItem = useCallback((sectionIndex: number) => {
    setSections((prev) => {
      const next = [...prev];
      const section = { ...next[sectionIndex] };
      section.items = [...section.items, { description: '', unit: 'gl', quantity: 1, cost: 0, subtotal: 0 }];
      next[sectionIndex] = section;
      return next;
    });
    setIsDirty(true);
  }, []);

  const removeItem = useCallback((sectionIndex: number, itemIndex: number) => {
    setSections((prev) => {
      const next = [...prev];
      const section = { ...next[sectionIndex] };
      section.items = section.items.filter((_, i) => i !== itemIndex);
      next[sectionIndex] = section;
      return next;
    });
    setIsDirty(true);
  }, []);

  const moveSection = useCallback((index: number, direction: 'up' | 'down') => {
    setSections((prev) => {
      const section = prev[index];
      const isAdditional = section.is_additional;
      // Find all indices of same type
      const sameTypeIndices = prev
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.is_additional === isAdditional)
        .map(({ i }) => i);

      const posInType = sameTypeIndices.indexOf(index);
      if (direction === 'up' && posInType === 0) return prev;
      if (direction === 'down' && posInType === sameTypeIndices.length - 1) return prev;

      const swapWith = direction === 'up'
        ? sameTypeIndices[posInType - 1]
        : sameTypeIndices[posInType + 1];

      const next = [...prev];
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return next;
    });
    setIsDirty(true);
  }, []);

  const addSection = useCallback((costCenterId: string, isAdditional: boolean) => {
    const cc = costCenters.find((c) => c.id === costCenterId);
    if (!cc) return;
    const newSection: BudgetSection = {
      cost_center_id: cc.id,
      cost_center_name: cc.name,
      is_additional: isAdditional,
      items: [{ description: '', unit: 'gl', quantity: 1, cost: 0, subtotal: 0 }],
    };
    setSections((prev) => {
      if (isAdditional) return [...prev, newSection];
      // Insert before first additional
      const firstAdditionalIdx = prev.findIndex((s) => s.is_additional);
      if (firstAdditionalIdx === -1) return [...prev, newSection];
      return [...prev.slice(0, firstAdditionalIdx), newSection, ...prev.slice(firstAdditionalIdx)];
    });
    setIsDirty(true);
  }, [costCenters]);

  const usedCostCenterIds = new Set(sections.map((s) => s.cost_center_id));
  const availableCostCenters = costCenters.filter((c) => c.is_active && !usedCostCenterIds.has(c.id));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const snapshot: BudgetSnapshot = { sections };
      const response = await fetch(`/api/budgets/${budget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al guardar');
      }

      const result = await response.json();
      sileo.success({ title: `Version ${result.version_number} guardada` });
      setIsDirty(false);
      setShowSaveDialog(false);
      await mutate(`/api/budgets/${budget.id}`);
      await mutate('/api/budgets');
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al guardar' });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Build numbering: base sections 1..N, additional continues from N+1
  let sectionNumber = 0;

  const renderSectionRows = (secs: BudgetSection[]) => {
    return secs.map((section) => {
      sectionNumber++;
      const currentSectionNum = sectionNumber;
      const sectionIdx = getSectionIndex(section);
      const sectionCost = section.items.reduce((sum, i) => sum + (Number(i.cost) || 0), 0);
      const sectionSubtotal = section.items.reduce((sum, i) => sum + (Number(i.subtotal) || 0), 0);

      return (
        <tbody key={`${section.cost_center_id}-${sectionIdx}`}>
          {/* Section header row */}
          <tr className="bg-slate-800 text-white">
            <td className="px-3 py-2 font-bold">{currentSectionNum}</td>
            <td className="px-3 py-2 font-bold">{section.cost_center_name}</td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2" />
            <td className="px-3 py-2 text-right font-bold">{formatCurrency(sectionSubtotal)}</td>
            {showCost && <td className="px-3 py-2 text-right font-bold">{formatCurrency(sectionCost)}</td>}
            {!readOnly && (
              <td className="px-3 py-2">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:text-white hover:bg-slate-700" onClick={() => moveSection(sectionIdx, 'up')}>
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:text-white hover:bg-slate-700" onClick={() => moveSection(sectionIdx, 'down')}>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:text-white hover:bg-slate-700" onClick={() => removeSection(sectionIdx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </td>
            )}
          </tr>

          {/* Item rows */}
          {section.items.map((item, itemIdx) => (
            <tr key={itemIdx} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="px-3 py-1 text-sm text-muted-foreground">
                {currentSectionNum},{itemIdx + 1}
              </td>
              <td className="px-3 py-1">
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(sectionIdx, itemIdx, 'description', e.target.value)}
                  placeholder="Descripcion"
                  disabled={readOnly}
                  className="h-7 text-sm border-0 shadow-none focus-visible:ring-1 bg-transparent"
                />
              </td>
              <td className="px-3 py-1">
                <Input
                  value={item.unit}
                  onChange={(e) => updateItem(sectionIdx, itemIdx, 'unit', e.target.value)}
                  placeholder="gl"
                  disabled={readOnly}
                  className="h-7 text-sm border-0 shadow-none focus-visible:ring-1 bg-transparent w-16"
                />
              </td>
              <td className="px-3 py-1">
                <Input
                  type="number"
                  value={item.quantity || ''}
                  onChange={(e) => updateItem(sectionIdx, itemIdx, 'quantity', parseFloat(e.target.value) || 0)}
                  disabled={readOnly}
                  className="h-7 text-sm border-0 shadow-none focus-visible:ring-1 bg-transparent w-20"
                  min={0}
                  step="any"
                />
              </td>
              <td className="px-3 py-1">
                <Input
                  type="number"
                  value={item.subtotal || ''}
                  onChange={(e) => updateItem(sectionIdx, itemIdx, 'subtotal', parseFloat(e.target.value) || 0)}
                  disabled={readOnly}
                  className="h-7 text-sm border-0 shadow-none focus-visible:ring-1 bg-transparent text-right"
                  min={0}
                  step="any"
                />
              </td>
              {showCost && (
                <td className="px-3 py-1">
                  <Input
                    type="number"
                    value={item.cost || ''}
                    onChange={(e) => updateItem(sectionIdx, itemIdx, 'cost', parseFloat(e.target.value) || 0)}
                    disabled={readOnly}
                    className="h-7 text-sm border-0 shadow-none focus-visible:ring-1 bg-transparent text-right"
                    min={0}
                    step="any"
                  />
                </td>
              )}
              {!readOnly && (
                <td className="px-3 py-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(sectionIdx, itemIdx)}>
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </td>
              )}
            </tr>
          ))}

          {/* Add item row */}
          {!readOnly && (
            <tr className="border-b border-gray-200">
              <td colSpan={showCost ? 7 : 6} className="px-3 py-1">
                <Button variant="ghost" size="sm" onClick={() => addItem(sectionIdx)} className="h-6 text-xs">
                  <Plus className="mr-1 h-3 w-3" /> Agregar item
                </Button>
              </td>
            </tr>
          )}
        </tbody>
      );
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{(budget.project as { name: string })?.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">v{budget.current_version}</Badge>
            <span className="text-muted-foreground">·</span>
            <span className="text-lg font-semibold">{formatCurrency(grandTotalSubtotal)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCost(!showCost)}
          >
            {showCost ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
            Costo
          </Button>
          {!readOnly && (
            <Button onClick={() => setShowSaveDialog(true)} disabled={!isDirty}>
              <Save className="mr-2 h-4 w-4" />
              Guardar
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="px-3 py-2 text-left font-medium w-[60px]">Item</th>
              <th className="px-3 py-2 text-left font-medium">Descripcion de tareas de obra</th>
              <th className="px-3 py-2 text-left font-medium w-[80px]">Unidad</th>
              <th className="px-3 py-2 text-left font-medium w-[90px]">Cant</th>
              <th className="px-3 py-2 text-right font-medium w-[130px]">Subtotal</th>
              {showCost && <th className="px-3 py-2 text-right font-medium w-[130px]">Costo</th>}
              {!readOnly && <th className="px-3 py-2 w-[90px]" />}
            </tr>
          </thead>

          {/* Base sections */}
          {renderSectionRows(baseSections)}

          {/* Base total */}
          {baseSections.length > 0 && (
            <tfoot>
              <tr className="bg-muted/30 border-t-2 border-slate-300 font-bold">
                <td className="px-3 py-2" />
                <td className="px-3 py-2">TOTAL</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right">{formatCurrency(baseTotalSubtotal)}</td>
                {showCost && <td className="px-3 py-2 text-right">{formatCurrency(baseTotalCost)}</td>}
                {!readOnly && <td className="px-3 py-2" />}
              </tr>
            </tfoot>
          )}

          {/* Additional sections */}
          {additionalSections.length > 0 && (
            <>
              <tbody>
                <tr className="bg-amber-50 border-t-2 border-amber-300">
                  <td colSpan={showCost ? (readOnly ? 6 : 7) : (readOnly ? 5 : 6)} className="px-3 py-2 font-bold text-amber-800">
                    Adicional
                  </td>
                </tr>
              </tbody>
              {renderSectionRows(additionalSections)}
              <tfoot>
                <tr className="bg-amber-50/50 border-t-2 border-amber-300 font-bold">
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2">TOTAL ADICIONAL</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right">{formatCurrency(additionalTotalSubtotal)}</td>
                  {showCost && <td className="px-3 py-2 text-right">{formatCurrency(additionalTotalCost)}</td>}
                  {!readOnly && <td className="px-3 py-2" />}
                </tr>
              </tfoot>
            </>
          )}
        </table>
      </div>

      {/* Add section controls */}
      {!readOnly && availableCostCenters.length > 0 && (
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <Select onValueChange={(id) => addSection(id, false)}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Agregar rubro base..." />
            </SelectTrigger>
            <SelectContent>
              {availableCostCenters.map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={(id) => addSection(id, true)}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Agregar adicional..." />
            </SelectTrigger>
            <SelectContent>
              {availableCostCenters.map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <SaveBudgetDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onConfirm={handleSave}
        isSaving={isSaving}
      />
    </div>
  );
}
```

**Step 2: Update budget detail page to use BudgetTable**

In `apps/web/app/(dashboard)/budgets/[id]/page.tsx`, replace:

```typescript
import { BudgetEditor } from '@/components/budget-editor';
```

With:

```typescript
import { BudgetTable } from '@/components/budget-table';
```

And replace:

```tsx
<BudgetEditor budget={budget} readOnly={isHistoricalVersion || undefined} />
```

With:

```tsx
<BudgetTable budget={budget} readOnly={isHistoricalVersion || undefined} />
```

**Step 3: Commit**

```bash
git add apps/web/components/budget-table.tsx apps/web/app/\(dashboard\)/budgets/\[id\]/page.tsx
git commit -m "feat(ui): replace BudgetEditor with BudgetTable — spreadsheet-style budget editing"
```

---

### Task 6: Update BudgetEditor addSection for type compatibility

**Files:**
- Modify: `apps/web/components/budget-editor.tsx:59-72` (update for new types — needed if old component still imported anywhere)

Since we replaced the import in the detail page, the old `budget-editor.tsx` and `budget-section-card.tsx` are now unused. We can delete them.

**Step 1: Delete old components**

```bash
rm apps/web/components/budget-editor.tsx
rm apps/web/components/budget-section-card.tsx
```

**Step 2: Verify no remaining imports**

Search for `budget-editor` and `budget-section-card` imports across the codebase. The only import was in `budgets/[id]/page.tsx` which we updated in Task 5.

**Step 3: Commit**

```bash
git add -u apps/web/components/budget-editor.tsx apps/web/components/budget-section-card.tsx
git commit -m "chore: remove old accordion-based budget editor components"
```

---

### Task 7: Build verification and fix any remaining type errors

**Files:**
- Potentially: any file with lingering `unit_price` or `section.subtotal` references

**Step 1: Run full build**

Run: `npm run build` from monorepo root
Expected: Clean build

**Step 2: Fix any remaining type errors**

Grep for `unit_price` and fix any remaining references. Likely places:
- Any test files referencing old field names
- Any utility functions using old fields

**Step 3: Commit if fixes were needed**

```bash
git add -A
git commit -m "fix: resolve remaining type errors from budget schema migration"
```

---

## Summary of Changes

| File | Action | What Changes |
|------|--------|-------------|
| `packages/shared/src/types.ts` | Modify | `BudgetItem`: `unit_price` → `cost`; `BudgetSection`: remove `subtotal`, add `is_additional` |
| `apps/web/lib/schemas/budget.ts` | Modify | Match new types, relax validations |
| `apps/web/app/api/budgets/route.ts` | Modify | totalAmount sums `item.subtotal` across all sections |
| `apps/web/app/api/budgets/[id]/route.ts` | Modify | totalAmount sums `item.subtotal` across all sections |
| `apps/web/components/create-budget-dialog.tsx` | Modify | Initial snapshot template uses `cost`, `is_additional` |
| `apps/web/components/budget-table.tsx` | **Create** | New continuous table editor with all editing logic |
| `apps/web/app/(dashboard)/budgets/[id]/page.tsx` | Modify | Import `BudgetTable` instead of `BudgetEditor` |
| `apps/web/components/budget-editor.tsx` | **Delete** | Replaced by `BudgetTable` |
| `apps/web/components/budget-section-card.tsx` | **Delete** | Replaced by inline rows in `BudgetTable` |
