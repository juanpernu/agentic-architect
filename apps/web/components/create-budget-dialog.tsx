'use client';

import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { useRouter } from 'next/navigation';
import { sileo } from 'sileo';
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
import { AlertTriangle } from 'lucide-react';
import type { Project, CostCenter, BudgetSnapshot } from '@architech/shared';
import type { BudgetListItem } from '@/lib/api-types';

interface CreateBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBudgetDialog({ open, onOpenChange }: CreateBudgetDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const { data: projects = [] } = useSWR<Project[]>(open ? '/api/projects' : null, fetcher);
  const { data: budgets = [] } = useSWR<BudgetListItem[]>(open ? '/api/budgets' : null, fetcher);
  const { data: costCenters = [] } = useSWR<CostCenter[]>(open ? '/api/cost-centers' : null, fetcher);

  // Filter out projects that already have a budget
  const projectsWithBudget = new Set(budgets.map((b) => b.project_id));
  const availableProjects = projects.filter((p) => !projectsWithBudget.has(p.id));
  const activeCostCenters = costCenters.filter((c) => c.is_active);
  const noCostCenters = activeCostCenters.length === 0;

  useEffect(() => {
    setSelectedProjectId('');
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    setIsSubmitting(true);

    try {
      // Create initial snapshot with one empty section if cost centers exist
      const initialSnapshot: BudgetSnapshot = {
        sections: activeCostCenters.length > 0
          ? [{
              cost_center_id: activeCostCenters[0].id,
              cost_center_name: activeCostCenters[0].name,
              is_additional: false,
              items: [{ description: '', unit: 'gl', quantity: 1, cost: 0, subtotal: 0 }],
            }]
          : [],
      };

      const response = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: selectedProjectId, snapshot: initialSnapshot }),
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
          {noCostCenters && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                No hay centros de costos creados. <a href="/settings/cost-centers" className="font-medium underline">Crear centros de costos</a> antes de crear un presupuesto.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedProjectId || noCostCenters}>
              {isSubmitting ? 'Creando...' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
