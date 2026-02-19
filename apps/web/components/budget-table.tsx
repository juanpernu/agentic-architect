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
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
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

  const calcItemsSum = (s: BudgetSection, field: 'cost' | 'subtotal') =>
    s.items.reduce((sum, i) => sum + (Number(i[field]) || 0), 0);

  const getEffectiveSubtotal = (s: BudgetSection) =>
    s.subtotal != null ? s.subtotal : calcItemsSum(s, 'subtotal');

  const getEffectiveCost = (s: BudgetSection) =>
    s.cost != null ? s.cost : calcItemsSum(s, 'cost');

  const sumSections = (secs: BudgetSection[], field: 'cost' | 'subtotal') =>
    secs.reduce((sum, s) => sum + (field === 'subtotal' ? getEffectiveSubtotal(s) : getEffectiveCost(s)), 0);

  const baseTotalSubtotal = sumSections(baseSections, 'subtotal');
  const baseTotalCost = sumSections(baseSections, 'cost');
  const additionalTotalSubtotal = sumSections(additionalSections, 'subtotal');
  const additionalTotalCost = sumSections(additionalSections, 'cost');
  const grandTotalSubtotal = baseTotalSubtotal + additionalTotalSubtotal;

  const getSectionIndex = (section: BudgetSection) => sections.indexOf(section);

  const updateSectionField = useCallback((sectionIndex: number, field: 'subtotal' | 'cost', value: number | undefined) => {
    setSections((prev) => {
      const next = [...prev];
      next[sectionIndex] = { ...next[sectionIndex], [field]: value };
      return next;
    });
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

  const activeCostCenters = costCenters.filter((c) => c.is_active);

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
        <TableBody key={`${section.cost_center_id}-${sectionIdx}`}>
          <TableRow className="bg-slate-800 text-white hover:bg-slate-800">
            <TableCell className="px-3 py-2 font-bold">{currentSectionNum}</TableCell>
            <TableCell className="px-3 py-2 font-bold">{section.cost_center_name}</TableCell>
            <TableCell className="px-3 py-2" />
            <TableCell className="px-3 py-2" />
            <TableCell className="px-3 py-2 text-right font-bold">
              {readOnly ? (
                formatCurrency(getEffectiveSubtotal(section))
              ) : (
                <div className="relative flex items-center justify-end">
                  <span className="absolute left-2 text-white font-bold text-sm pointer-events-none">$</span>
                  <Input
                    type="number"
                    value={section.subtotal != null ? section.subtotal : ''}
                    placeholder={formatCurrency(sectionSubtotal).replace('$', '').trim()}
                    onChange={(e) => {
                      const raw = e.target.value;
                      updateSectionField(sectionIdx, 'subtotal', raw === '' ? undefined : parseFloat(raw) || 0);
                    }}
                    className={`h-7 text-sm border-0 shadow-none focus-visible:ring-1 text-right font-bold w-32 pl-6 ${section.subtotal != null ? 'bg-slate-600 text-white placeholder:text-white' : 'bg-slate-700 text-white placeholder:text-white'}`}
                    min={0}
                    step="any"
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
                    <Input
                      type="number"
                      value={section.cost != null ? section.cost : ''}
                      placeholder={formatCurrency(sectionCost).replace('$', '').trim()}
                      onChange={(e) => {
                        const raw = e.target.value;
                        updateSectionField(sectionIdx, 'cost', raw === '' ? undefined : parseFloat(raw) || 0);
                      }}
                      className={`h-7 text-sm border-0 shadow-none focus-visible:ring-1 text-right font-bold w-32 pl-6 ${section.cost != null ? 'bg-slate-600 text-white placeholder:text-white' : 'bg-slate-700 text-white placeholder:text-white'}`}
                      min={0}
                      step="any"
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
                <Input
                  type="number"
                  value={item.quantity || ''}
                  onChange={(e) => updateItem(sectionIdx, itemIdx, 'quantity', parseFloat(e.target.value) || 0)}
                  disabled={readOnly}
                  className="h-7 text-sm border-0 shadow-none focus-visible:ring-1 bg-transparent w-20"
                  min={0}
                  step="any"
                />
              </TableCell>
              <TableCell className="px-3 py-1">
                <Input
                  type="number"
                  value={item.subtotal || ''}
                  onChange={(e) => updateItem(sectionIdx, itemIdx, 'subtotal', parseFloat(e.target.value) || 0)}
                  disabled={readOnly}
                  className="h-7 text-sm border-0 shadow-none focus-visible:ring-1 bg-transparent text-right"
                  min={0}
                  step="any"
                />
              </TableCell>
              {showCost && (
                <TableCell className="px-3 py-1">
                  <Input
                    type="number"
                    value={item.cost || ''}
                    onChange={(e) => updateItem(sectionIdx, itemIdx, 'cost', parseFloat(e.target.value) || 0)}
                    disabled={readOnly}
                    className="h-7 text-sm border-0 shadow-none focus-visible:ring-1 bg-transparent text-right"
                    min={0}
                    step="any"
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
            <TableCell className="px-3 py-1 text-sm font-medium text-muted-foreground">Subtotal {section.cost_center_name}</TableCell>
            <TableCell className="px-3 py-1" />
            <TableCell className="px-3 py-1" />
            <TableCell className="px-3 py-1 text-right text-sm font-semibold">{formatCurrency(getEffectiveSubtotal(section))}</TableCell>
            {showCost && <TableCell className="px-3 py-1 text-right text-sm font-semibold">{formatCurrency(getEffectiveCost(section))}</TableCell>}
            {!readOnly && <TableCell className="px-3 py-1" />}
          </TableRow>

          {!readOnly && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={showCost ? 7 : 6} className="px-3 py-1">
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

          {additionalSections.length > 0 && (
            <>
              <TableBody>
                <TableRow className="bg-amber-50 border-t-2 border-amber-300 hover:bg-amber-50">
                  <TableCell colSpan={showCost ? (readOnly ? 6 : 7) : (readOnly ? 5 : 6)} className="px-3 py-2 font-bold text-amber-800">
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

      {!readOnly && activeCostCenters.length > 0 && (
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <Select key={`base-${sections.length}`} onValueChange={(id) => addSection(id, false)}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Agregar rubro base..." />
            </SelectTrigger>
            <SelectContent>
              {activeCostCenters.map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select key={`add-${sections.length}`} onValueChange={(id) => addSection(id, true)}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Agregar adicional..." />
            </SelectTrigger>
            <SelectContent>
              {activeCostCenters.map((cc) => (
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
