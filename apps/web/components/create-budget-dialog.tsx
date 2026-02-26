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
