'use client';

import { useState, useCallback, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { sileo } from 'sileo';
import { Plus, Save } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { useCurrentUser } from '@/lib/use-current-user';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { BudgetSectionCard } from '@/components/budget-section-card';
import { SaveBudgetDialog } from '@/components/save-budget-dialog';
import type { BudgetSnapshot, BudgetSection, CostCenter } from '@architech/shared';
import type { BudgetDetail } from '@/lib/api-types';

interface BudgetEditorProps {
  budget: BudgetDetail;
  readOnly?: boolean;
}

export function BudgetEditor({ budget, readOnly: forceReadOnly }: BudgetEditorProps) {
  const { isAdminOrSupervisor } = useCurrentUser();
  const readOnly = forceReadOnly || !isAdminOrSupervisor;

  const { data: costCenters = [] } = useSWR<CostCenter[]>('/api/cost-centers', fetcher);

  const [sections, setSections] = useState<BudgetSection[]>(
    budget.latest_version?.snapshot?.sections ?? []
  );
  const [isDirty, setIsDirty] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSections(budget.latest_version?.snapshot?.sections ?? []);
    setIsDirty(false);
  }, [budget.latest_version?.version_number]);

  const totalAmount = sections.reduce((sum, s) => sum + s.subtotal, 0);

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

  const addSection = useCallback((costCenterId: string) => {
    const cc = costCenters.find((c) => c.id === costCenterId);
    if (!cc) return;
    setSections((prev) => [
      ...prev,
      {
        cost_center_id: cc.id,
        cost_center_name: cc.name,
        subtotal: 0,
        items: [{ description: '', quantity: 1, unit: 'unidad', unit_price: 0, subtotal: 0 }],
      },
    ]);
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
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{(budget.project as { name: string })?.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">v{budget.current_version}</Badge>
            <span className="text-muted-foreground">·</span>
            <span className="text-lg font-semibold">{formatCurrency(totalAmount)}</span>
          </div>
        </div>
        {!readOnly && (
          <Button onClick={() => setShowSaveDialog(true)} disabled={!isDirty}>
            <Save className="mr-2 h-4 w-4" />
            Guardar
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {sections.map((section, index) => (
          <BudgetSectionCard
            key={`${section.cost_center_id}-${index}`}
            section={section}
            onUpdate={(s) => updateSection(index, s)}
            onRemove={() => removeSection(index)}
            readOnly={readOnly}
          />
        ))}
      </div>

      {!readOnly && availableCostCenters.length > 0 && (
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <Select onValueChange={addSection}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Agregar rubro..." />
            </SelectTrigger>
            <SelectContent>
              {availableCostCenters.map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex justify-end border-t pt-4">
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Total del presupuesto</div>
          <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
        </div>
      </div>

      <SaveBudgetDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onConfirm={handleSave}
        isSaving={isSaving}
      />
    </div>
  );
}
