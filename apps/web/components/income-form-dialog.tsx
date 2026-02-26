'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { sileo } from 'sileo';
import { fetcher } from '@/lib/fetcher';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Income } from '@architech/shared';

interface IncomeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  income?: Income & {
    project?: { id: string; name: string };
    income_type?: { id: string; name: string };
  };
  onSaved?: () => void;
}

export function IncomeFormDialog({ open, onOpenChange, income, onSaved }: IncomeFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [incomeTypeName, setIncomeTypeName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  // Load projects
  const { data: projects } = useSWR<Array<{ id: string; name: string }>>(
    open ? '/api/projects' : null,
    fetcher
  );

  // Load income types
  const { data: incomeTypes } = useSWR<Array<{ id: string; name: string }>>(
    open ? '/api/income-types' : null,
    fetcher
  );

  // Pre-populate form when editing
  useEffect(() => {
    if (income && open) {
      setProjectId(income.project_id);
      setIncomeTypeName(income.income_type?.name ?? '');
      setAmount(String(income.amount));
      setDate(income.date);
      setDescription(income.description ?? '');
    } else if (!income && open) {
      setProjectId('');
      setIncomeTypeName('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
    }
  }, [income, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Resolve income type: find existing or create new
      const trimmedType = incomeTypeName.trim();
      if (!trimmedType) throw new Error('Ingresá un tipo de ingreso');
      const existing = incomeTypes?.find((t) => t.name.toLowerCase() === trimmedType.toLowerCase());
      let resolvedTypeId = existing?.id;
      if (!resolvedTypeId) {
        const createRes = await fetch('/api/income-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmedType }),
        });
        if (!createRes.ok) {
          const err = await createRes.json();
          throw new Error(err.error ?? 'Error al crear tipo de ingreso');
        }
        const created = await createRes.json();
        resolvedTypeId = created.id;
      }

      const payload = {
        project_id: projectId,
        income_type_id: resolvedTypeId,
        amount: parseFloat(amount),
        date: date,
        description: description || null,
      };

      const url = income ? `/api/incomes/${income.id}` : '/api/incomes';
      const method = income ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error al guardar');
      }

      sileo.success({ title: income ? 'Ingreso actualizado' : 'Ingreso registrado' });
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al guardar' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{income ? 'Editar ingreso' : 'Registrar ingreso'}</DialogTitle>
          <DialogDescription>
            {income
              ? 'Modifica los datos del ingreso'
              : 'Registra un nuevo ingreso asociado a una obra'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="border border-border rounded-xl p-4 bg-muted/30 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="inc-project">Proyecto <span className="text-red-500">*</span></Label>
                <Select value={projectId} onValueChange={setProjectId} required>
                  <SelectTrigger id="inc-project" className="w-full">
                    <SelectValue placeholder="Selecciona un proyecto" />
                  </SelectTrigger>
                  <SelectContent>
                    {(projects ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inc-type">Tipo de ingreso <span className="text-red-500">*</span></Label>
                <Input
                  id="inc-type"
                  value={incomeTypeName}
                  onChange={(e) => setIncomeTypeName(e.target.value)}
                  placeholder="Ej: Certificado, Anticipo..."
                  list="inc-type-suggestions"
                  required
                />
                <datalist id="inc-type-suggestions">
                  {(incomeTypes ?? []).map((t) => (
                    <option key={t.id} value={t.name} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="inc-amount">Monto <span className="text-red-500">*</span></Label>
                <Input
                  id="inc-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inc-date">Fecha <span className="text-red-500">*</span></Label>
                <Input
                  id="inc-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inc-description">Descripcion</Label>
              <Textarea
                id="inc-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalle del ingreso (opcional)"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !projectId || !incomeTypeName.trim() || !amount || !date}>
              {isSubmitting ? 'Guardando...' : income ? 'Actualizar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
