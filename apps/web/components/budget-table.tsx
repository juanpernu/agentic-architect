'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { mutate } from 'swr';
import { sileo } from 'sileo';
import {
  Plus, Save, Trash2, ChevronUp, ChevronDown,
  EyeOff, Eye, Pencil, Loader2, CheckCircle2, AlertCircle, RefreshCw,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useCurrentUser } from '@/lib/use-current-user';
import { useAutosave } from '@/lib/use-autosave';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { SaveBudgetDialog } from '@/components/save-budget-dialog';
import type { BudgetSnapshot, BudgetSection, BudgetItem, Rubro } from '@architech/shared';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BudgetTableProps {
  budget: {
    id: string;
    project_id: string;
    status: 'draft' | 'published';
    snapshot: BudgetSnapshot | null;
    current_version: number;
    project?: { id: string; name: string };
  };
  onPublish?: () => void;
  onEdit?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function BudgetTable({ budget, onPublish, onEdit }: BudgetTableProps) {
  const { isAdminOrSupervisor } = useCurrentUser();
  const isDraft = budget.status === 'draft';
  const readOnly = !isDraft || !isAdminOrSupervisor;

  /* ---- Local snapshot state ---- */
  const [sections, setSections] = useState<BudgetSection[]>(
    budget.snapshot?.sections ?? []
  );
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCost, setShowCost] = useState(true);
  const [isEditSwitching, setIsEditSwitching] = useState(false);

  /* Re-sync when server data changes (e.g. after SWR revalidation on navigation back) */
  const serverSnapshotRef = useRef(JSON.stringify(budget.snapshot));
  useEffect(() => {
    const serverSnapshot = JSON.stringify(budget.snapshot);
    if (serverSnapshot !== serverSnapshotRef.current) {
      setSections(budget.snapshot?.sections ?? []);
      serverSnapshotRef.current = serverSnapshot;
    }
  }, [budget.snapshot]);

  /* ---- Autosave ---- */
  const snapshot: BudgetSnapshot = { sections };
  const { saveStatus, retry, flush } = useAutosave(budget.id, snapshot, isDraft && isAdminOrSupervisor);

  /* ---- Derived data ---- */
  const baseSections = sections.filter((s) => !s.is_additional);
  const additionalSections = sections.filter((s) => s.is_additional);

  const calcItemsSum = (s: BudgetSection, field: 'cost' | 'subtotal') =>
    s.items.reduce((sum, i) => sum + (Number(i[field]) || 0), 0);

  const getEffectiveSubtotal = (s: BudgetSection) =>
    s.subtotal != null ? s.subtotal : calcItemsSum(s, 'subtotal');

  const getEffectiveCost = (s: BudgetSection) =>
    s.cost != null ? s.cost : calcItemsSum(s, 'cost');

  const sumSections = (secs: BudgetSection[], field: 'cost' | 'subtotal') =>
    secs.reduce((sum, s) =>
      sum + (field === 'subtotal' ? getEffectiveSubtotal(s) : getEffectiveCost(s)), 0);

  const baseTotalSubtotal = sumSections(baseSections, 'subtotal');
  const baseTotalCost = sumSections(baseSections, 'cost');
  const additionalTotalSubtotal = sumSections(additionalSections, 'subtotal');
  const additionalTotalCost = sumSections(additionalSections, 'cost');
  const grandTotalSubtotal = baseTotalSubtotal + additionalTotalSubtotal;

  const getSectionIndex = (section: BudgetSection) => sections.indexOf(section);

  /* ---- Section mutations ---- */

  const updateSectionField = useCallback((sectionIndex: number, field: 'subtotal' | 'cost', value: number | undefined) => {
    setSections((prev) => {
      const next = [...prev];
      next[sectionIndex] = { ...next[sectionIndex], [field]: value };
      return next;
    });
  }, []);

  const renameSectionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const renameSection = useCallback((sectionIndex: number, newName: string) => {
    setSections((prev) => {
      const next = [...prev];
      next[sectionIndex] = { ...next[sectionIndex], rubro_name: newName };
      return next;
    });

    // Debounce the API call to rename the rubro
    if (renameSectionDebounceRef.current) clearTimeout(renameSectionDebounceRef.current);
    renameSectionDebounceRef.current = setTimeout(() => {
      const rubroId = sections[sectionIndex]?.rubro_id;
      if (rubroId && newName.trim()) {
        fetch(`/api/rubros/${rubroId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName.trim() }),
        }).catch(() => {
          // Silent fail — autosave will persist the name in the snapshot
        });
      }
    }, 1000);
  }, [sections]);

  /* ---- Item mutations ---- */

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
  }, []);

  const addItem = useCallback((sectionIndex: number) => {
    setSections((prev) => {
      const next = [...prev];
      const section = { ...next[sectionIndex] };
      section.items = [...section.items, { description: '', unit: 'gl', quantity: 1, cost: 0, subtotal: 0 }];
      next[sectionIndex] = section;
      return next;
    });
  }, []);

  const removeItem = useCallback((sectionIndex: number, itemIndex: number) => {
    setSections((prev) => {
      const section = prev[sectionIndex];
      if (section.items.length <= 1) return prev;
      const next = [...prev];
      const updated = { ...section };
      updated.items = section.items.filter((_, i) => i !== itemIndex);
      next[sectionIndex] = updated;
      return next;
    });
  }, []);

  /* ---- Section management ---- */

  const removeSection = useCallback(async (index: number) => {
    const section = sections[index];
    if (!section) return;

    // Delete the rubro from backend
    try {
      const res = await fetch(`/api/rubros/${section.rubro_id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json();
        sileo.error({ title: body.error ?? 'Error al eliminar rubro' });
        return;
      }
    } catch {
      sileo.error({ title: 'Error al eliminar rubro' });
      return;
    }

    setSections((prev) => prev.filter((_, i) => i !== index));
  }, [sections]);

  const moveSection = useCallback((index: number, direction: 'up' | 'down') => {
    setSections((prev) => {
      const section = prev[index];
      const isAdditional = section.is_additional;
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
  }, []);

  const addRubro = useCallback(async (isAdditional: boolean) => {
    try {
      const res = await fetch('/api/rubros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget_id: budget.id, name: 'Nuevo rubro' }),
      });

      if (!res.ok) {
        const body = await res.json();
        sileo.error({ title: body.error ?? 'Error al crear rubro' });
        return;
      }

      const rubro: Rubro = await res.json();

      const newSection: BudgetSection = {
        rubro_id: rubro.id,
        rubro_name: rubro.name,
        is_additional: isAdditional,
        items: [{ description: '', unit: 'gl', quantity: 1, cost: 0, subtotal: 0 }],
      };

      setSections((prev) => {
        if (isAdditional) return [...prev, newSection];
        const firstAdditionalIdx = prev.findIndex((s) => s.is_additional);
        if (firstAdditionalIdx === -1) return [...prev, newSection];
        return [...prev.slice(0, firstAdditionalIdx), newSection, ...prev.slice(firstAdditionalIdx)];
      });
    } catch {
      sileo.error({ title: 'Error al crear rubro' });
    }
  }, [budget.id]);

  /* ---- Publish (Guardar version) ---- */

  const handlePublish = async () => {
    setIsSaving(true);
    try {
      // Flush any pending autosave changes before publishing
      const flushed = await flush();
      if (!flushed) {
        throw new Error('No se pudieron guardar los cambios pendientes');
      }

      const response = await fetch(`/api/budgets/${budget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al guardar');
      }

      const result = await response.json();
      sileo.success({ title: `Version ${result.version_number} guardada` });
      setShowSaveDialog(false);
      await mutate(`/api/budgets/${budget.id}`);
      await mutate('/api/budgets');
      onPublish?.();
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al guardar' });
    } finally {
      setIsSaving(false);
    }
  };

  /* ---- Edit mode (published -> draft) ---- */

  const handleEditMode = async () => {
    setIsEditSwitching(true);
    try {
      const res = await fetch(`/api/budgets/${budget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Error al cambiar a borrador');
      }

      await mutate(`/api/budgets/${budget.id}`);
      await mutate('/api/budgets');
      onEdit?.();
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error' });
    } finally {
      setIsEditSwitching(false);
    }
  };

  /* ---- Render helpers ---- */

  const colSpan = showCost ? (readOnly ? 6 : 7) : (readOnly ? 5 : 6);

  let sectionNumber = 0;

  const renderSectionRows = (secs: BudgetSection[]) => {
    return secs.map((section) => {
      sectionNumber++;
      const currentSectionNum = sectionNumber;
      const sectionIdx = getSectionIndex(section);
      const sectionCost = section.items.reduce((sum, i) => sum + (Number(i.cost) || 0), 0);
      const sectionSubtotal = section.items.reduce((sum, i) => sum + (Number(i.subtotal) || 0), 0);

      return (
        <TableBody key={`${section.rubro_id}-${sectionIdx}`}>
          {/* Section header */}
          <TableRow className="bg-slate-800 text-white hover:bg-slate-800">
            <TableCell className="px-3 py-2 font-bold">{currentSectionNum}</TableCell>
            <TableCell className="px-3 py-2 font-bold">
              {readOnly ? (
                section.rubro_name
              ) : (
                <Input
                  value={section.rubro_name}
                  onChange={(e) => renameSection(sectionIdx, e.target.value)}
                  className="h-7 text-sm border-0 shadow-none focus-visible:ring-1 bg-slate-700 text-white font-bold placeholder:text-slate-400"
                  placeholder="Nombre del rubro"
                />
              )}
            </TableCell>
            <TableCell className="px-3 py-2" />
            <TableCell className="px-3 py-2" />
            <TableCell className="px-3 py-2 text-right font-bold">
              {readOnly ? (
                formatCurrency(getEffectiveSubtotal(section))
              ) : (
                <div className="relative flex items-center justify-end">
                  <span className="absolute left-2 text-white font-bold text-sm pointer-events-none">$</span>
                  <CurrencyInput
                    value={section.subtotal != null ? section.subtotal : sectionSubtotal}
                    onValueChange={(v) => updateSectionField(sectionIdx, 'subtotal', v === 0 ? undefined : v)}
                    className={`h-7 text-sm border-0 shadow-none focus-visible:ring-1 text-right font-bold w-32 pl-6 ${section.subtotal != null ? 'bg-slate-600 text-white placeholder:text-white' : 'bg-slate-700 text-white placeholder:text-white'}`}
                  />
                </div>
              )}
            </TableCell>
            {showCost && (
              <TableCell className="px-3 py-2 text-right font-bold">
                {readOnly ? (
                  formatCurrency(getEffectiveCost(section))
                ) : (
                  <div className="relative flex items-center justify-end">
                    <span className="absolute left-2 text-white font-bold text-sm pointer-events-none">$</span>
                    <CurrencyInput
                      value={section.cost != null ? section.cost : sectionCost}
                      onValueChange={(v) => updateSectionField(sectionIdx, 'cost', v === 0 ? undefined : v)}
                      className={`h-7 text-sm border-0 shadow-none focus-visible:ring-1 text-right font-bold w-32 pl-6 ${section.cost != null ? 'bg-slate-600 text-white placeholder:text-white' : 'bg-slate-700 text-white placeholder:text-white'}`}
                    />
                  </div>
                )}
              </TableCell>
            )}
            {!readOnly && (
              <TableCell className="px-3 py-2">
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
              </TableCell>
            )}
          </TableRow>

          {/* Item rows */}
          {section.items.map((item, itemIdx) => (
            <TableRow key={itemIdx} className="hover:bg-gray-50">
              <TableCell className="px-3 py-1 text-sm text-muted-foreground">
                {currentSectionNum},{itemIdx + 1}
              </TableCell>
              <TableCell className="px-3 py-1">
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(sectionIdx, itemIdx, 'description', e.target.value)}
                  placeholder="Descripcion"
                  disabled={readOnly}
                  className="h-7 text-sm border-0 shadow-none focus-visible:ring-1 bg-transparent"
                />
              </TableCell>
              <TableCell className="px-3 py-1">
                <Input
                  value={item.unit}
                  onChange={(e) => updateItem(sectionIdx, itemIdx, 'unit', e.target.value)}
                  placeholder="gl"
                  disabled={readOnly}
                  className="h-7 text-sm border-0 shadow-none focus-visible:ring-1 bg-transparent w-16"
                />
              </TableCell>
              <TableCell className="px-3 py-1">
                <CurrencyInput
                  value={item.quantity || 0}
                  onValueChange={(v) => updateItem(sectionIdx, itemIdx, 'quantity', v)}
                  disabled={readOnly}
                  className="h-7 text-sm border-0 shadow-none focus-visible:ring-1 bg-transparent w-20"
                />
              </TableCell>
              <TableCell className="px-3 py-1">
                <CurrencyInput
                  value={item.subtotal || 0}
                  onValueChange={(v) => updateItem(sectionIdx, itemIdx, 'subtotal', v)}
                  disabled={readOnly}
                  className="h-7 text-sm border-0 shadow-none focus-visible:ring-1 bg-transparent text-right"
                />
              </TableCell>
              {showCost && (
                <TableCell className="px-3 py-1">
                  <CurrencyInput
                    value={item.cost || 0}
                    onValueChange={(v) => updateItem(sectionIdx, itemIdx, 'cost', v)}
                    disabled={readOnly}
                    className="h-7 text-sm border-0 shadow-none focus-visible:ring-1 bg-transparent text-right"
                  />
                </TableCell>
              )}
              {!readOnly && (
                <TableCell className="px-3 py-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(sectionIdx, itemIdx)}>
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}

          {/* Section subtotal row */}
          <TableRow className="bg-muted/20 hover:bg-muted/20">
            <TableCell className="px-3 py-1" />
            <TableCell className="px-3 py-1 text-sm font-medium text-muted-foreground">Subtotal {section.rubro_name}</TableCell>
            <TableCell className="px-3 py-1" />
            <TableCell className="px-3 py-1" />
            <TableCell className="px-3 py-1 text-right text-sm font-semibold">{formatCurrency(getEffectiveSubtotal(section))}</TableCell>
            {showCost && <TableCell className="px-3 py-1 text-right text-sm font-semibold">{formatCurrency(getEffectiveCost(section))}</TableCell>}
            {!readOnly && <TableCell className="px-3 py-1" />}
          </TableRow>

          {/* Add item button */}
          {!readOnly && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={colSpan} className="px-3 py-1">
                <Button variant="ghost" size="sm" onClick={() => addItem(sectionIdx)} className="h-6 text-xs">
                  <Plus className="mr-1 h-3 w-3" /> Agregar item
                </Button>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      );
    });
  };

  /* ---- Autosave status indicator ---- */

  const renderSaveStatus = () => {
    if (!isDraft) return null;

    switch (saveStatus) {
      case 'saving':
        return (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Guardando...
          </span>
        );
      case 'saved':
        return (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Borrador guardado
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1 text-sm text-red-600">
            <AlertCircle className="h-3 w-3" />
            Error al guardar
            <Button variant="ghost" size="sm" className="h-5 px-1 text-xs" onClick={retry}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Reintentar
            </Button>
          </span>
        );
      default:
        return null;
    }
  };

  /* ---- Main render ---- */

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {(budget.project as { name: string })?.name}
            </h1>
            {isDraft ? (
              <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
                Borrador
              </Badge>
            ) : (
              <Badge variant="secondary">v{budget.current_version}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {!isDraft && (
              <>
                <span className="text-sm text-muted-foreground">
                  Presupuesto v{budget.current_version}
                </span>
                <span className="text-muted-foreground">·</span>
              </>
            )}
            <span className="text-lg font-semibold">{formatCurrency(grandTotalSubtotal)}</span>
            {isDraft && (
              <>
                <span className="text-muted-foreground">·</span>
                {renderSaveStatus()}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCost(!showCost)}>
            {showCost ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
            Costo
          </Button>
          {isDraft && isAdminOrSupervisor && (
            <Button onClick={() => setShowSaveDialog(true)}>
              <Save className="mr-2 h-4 w-4" />
              Guardar version
            </Button>
          )}
          {!isDraft && isAdminOrSupervisor && (
            <Button variant="outline" onClick={handleEditMode} disabled={isEditSwitching}>
              {isEditSwitching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="mr-2 h-4 w-4" />
              )}
              Editar presupuesto
            </Button>
          )}
        </div>
      </div>

      {/* Draft banner */}
      {isDraft && isAdminOrSupervisor && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Editando · Los cambios se guardan automaticamente
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="px-3 py-2 w-[60px]">Item</TableHead>
              <TableHead className="px-3 py-2">Descripcion de tareas de obra</TableHead>
              <TableHead className="px-3 py-2 w-[80px]">Unidad</TableHead>
              <TableHead className="px-3 py-2 w-[90px]">Cant</TableHead>
              <TableHead className="px-3 py-2 text-right w-[130px]">Subtotal</TableHead>
              {showCost && <TableHead className="px-3 py-2 text-right w-[130px]">Costo</TableHead>}
              {!readOnly && <TableHead className="px-3 py-2 w-[90px]" />}
            </TableRow>
          </TableHeader>

          {renderSectionRows(baseSections)}

          {/* Base total */}
          {baseSections.length > 0 && (
            <TableFooter>
              <TableRow className="bg-muted/30 border-t-2 border-slate-300 font-bold">
                <TableCell className="px-3 py-2" />
                <TableCell className="px-3 py-2">TOTAL</TableCell>
                <TableCell className="px-3 py-2" />
                <TableCell className="px-3 py-2" />
                <TableCell className="px-3 py-2 text-right">{formatCurrency(baseTotalSubtotal)}</TableCell>
                {showCost && <TableCell className="px-3 py-2 text-right">{formatCurrency(baseTotalCost)}</TableCell>}
                {!readOnly && <TableCell className="px-3 py-2" />}
              </TableRow>
            </TableFooter>
          )}

          {/* Additional sections */}
          {additionalSections.length > 0 && (
            <>
              <TableBody>
                <TableRow className="bg-amber-50 border-t-2 border-amber-300 hover:bg-amber-50">
                  <TableCell colSpan={colSpan} className="px-3 py-2 font-bold text-amber-800">
                    Adicional
                  </TableCell>
                </TableRow>
              </TableBody>
              {renderSectionRows(additionalSections)}
              <TableFooter>
                <TableRow className="bg-amber-50/50 border-t-2 border-amber-300 font-bold">
                  <TableCell className="px-3 py-2" />
                  <TableCell className="px-3 py-2">TOTAL ADICIONAL</TableCell>
                  <TableCell className="px-3 py-2" />
                  <TableCell className="px-3 py-2" />
                  <TableCell className="px-3 py-2 text-right">{formatCurrency(additionalTotalSubtotal)}</TableCell>
                  {showCost && <TableCell className="px-3 py-2 text-right">{formatCurrency(additionalTotalCost)}</TableCell>}
                  {!readOnly && <TableCell className="px-3 py-2" />}
                </TableRow>
              </TableFooter>
            </>
          )}
        </Table>
      </div>

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

      {/* Save (publish) dialog */}
      <SaveBudgetDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onConfirm={handlePublish}
        isSaving={isSaving}
      />
    </div>
  );
}
