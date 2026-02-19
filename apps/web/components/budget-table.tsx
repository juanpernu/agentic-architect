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

  const baseSections = sections.filter((s) => !s.is_additional);
  const additionalSections = sections.filter((s) => s.is_additional);

  const sumItems = (secs: BudgetSection[], field: 'cost' | 'subtotal') =>
    secs.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + (Number(i[field]) || 0), 0), 0);

  const baseTotalSubtotal = sumItems(baseSections, 'subtotal');
  const baseTotalCost = sumItems(baseSections, 'cost');
  const additionalTotalSubtotal = sumItems(additionalSections, 'subtotal');
  const additionalTotalCost = sumItems(additionalSections, 'cost');
  const grandTotalSubtotal = baseTotalSubtotal + additionalTotalSubtotal;

  const getSectionIndex = (section: BudgetSection) => sections.indexOf(section);

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
      const section = prev[sectionIndex];
      if (section.items.length <= 1) return prev;
      const next = [...prev];
      const updated = { ...section };
      updated.items = section.items.filter((_, i) => i !== itemIndex);
      next[sectionIndex] = updated;
      return next;
    });
    setIsDirty(true);
  }, []);

  const removeSection = useCallback((index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  }, []);

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
          <Button variant="outline" size="sm" onClick={() => setShowCost(!showCost)}>
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

          {renderSectionRows(baseSections)}

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

      {!readOnly && availableCostCenters.length > 0 && (
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <Select key={`base-${sections.length}`} onValueChange={(id) => addSection(id, false)}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Agregar rubro base..." />
            </SelectTrigger>
            <SelectContent>
              {availableCostCenters.map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select key={`add-${sections.length}`} onValueChange={(id) => addSection(id, true)}>
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
