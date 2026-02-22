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
import type { Expense } from '@architech/shared';

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense & {
    project?: { id: string; name: string };
    rubro?: { id: string; name: string } | null;
  };
  onSaved?: () => void;
}

export function ExpenseFormDialog({ open, onOpenChange, expense, onSaved }: ExpenseFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [rubroId, setRubroId] = useState('');
  const [receiptId, setReceiptId] = useState('');
  const [description, setDescription] = useState('');

  // Load projects
  const { data: projects } = useSWR<Array<{ id: string; name: string }>>(
    open ? '/api/projects' : null,
    fetcher
  );

  // Fetch budgets for selected project (to get rubros)
  const { data: budgets } = useSWR<Array<{ id: string }>>(
    projectId ? `/api/budgets?project_id=${projectId}` : null,
    fetcher
  );
  const budget = budgets?.[0];

  // Fetch rubros for the budget
  const { data: rubros } = useSWR<Array<{ id: string; name: string }>>(
    budget?.id ? `/api/rubros?budget_id=${budget.id}` : null,
    fetcher
  );

  // Fetch receipts for selected project
  const { data: receipts } = useSWR<Array<{ id: string; vendor: string | null; total_amount: number }>>(
    projectId ? `/api/receipts?project_id=${projectId}&status=confirmed&limit=100` : null,
    fetcher
  );

  // When project changes, reset dependent fields
  useEffect(() => {
    if (!expense) {
      setRubroId('');
      setReceiptId('');
    }
  }, [projectId, expense]);

  // Pre-populate form when editing
  useEffect(() => {
    if (expense && open) {
      setProjectId(expense.project_id);
      setCategory(expense.category);
      setAmount(String(expense.amount));
      setDate(expense.date);
      setRubroId(expense.rubro_id ?? '');
      setReceiptId(expense.receipt_id ?? '');
      setDescription(expense.description ?? '');
    } else if (!expense && open) {
      setProjectId('');
      setCategory('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setRubroId('');
      setReceiptId('');
      setDescription('');
    }
  }, [expense, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        project_id: projectId,
        category: category,
        amount: parseFloat(amount),
        date: date,
        rubro_id: rubroId || null,
        receipt_id: receiptId || null,
        description: description || null,
      };

      const url = expense ? `/api/expenses/${expense.id}` : '/api/expenses';
      const method = expense ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error al guardar');
      }

      sileo.success({ title: expense ? 'Egreso actualizado' : 'Egreso registrado' });
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
          <DialogTitle>{expense ? 'Editar egreso' : 'Registrar egreso'}</DialogTitle>
          <DialogDescription>
            {expense
              ? 'Modifica los datos del egreso'
              : 'Registra un nuevo egreso asociado a una obra'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project */}
          <div className="space-y-2">
            <Label htmlFor="exp-project">Proyecto <span className="text-red-500">*</span></Label>
            <Select value={projectId} onValueChange={setProjectId} required>
              <SelectTrigger id="exp-project" className="w-full">
                <SelectValue placeholder="Selecciona un proyecto" />
              </SelectTrigger>
              <SelectContent>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="exp-category">Categoría <span className="text-red-500">*</span></Label>
            <Input
              id="exp-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ej: Materiales, Mano de obra, Transporte"
              required
            />
          </div>

          {/* Amount and Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="exp-amount">Monto <span className="text-red-500">*</span></Label>
              <Input
                id="exp-amount"
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
              <Label htmlFor="exp-date">Fecha <span className="text-red-500">*</span></Label>
              <Input
                id="exp-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Rubro (only when project is selected) */}
          {projectId && (
            <div className="space-y-2">
              <Label htmlFor="exp-rubro">Rubro</Label>
              <Select value={rubroId} onValueChange={setRubroId}>
                <SelectTrigger id="exp-rubro" className="w-full">
                  <SelectValue placeholder="Selecciona un rubro" />
                </SelectTrigger>
                <SelectContent>
                  {(rubros ?? []).length === 0 ? (
                    <SelectItem value="_empty" disabled>Sin rubros disponibles</SelectItem>
                  ) : (
                    (rubros ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Receipt (only when project is selected) */}
          {projectId && (
            <div className="space-y-2">
              <Label htmlFor="exp-receipt">Comprobante</Label>
              <Select value={receiptId} onValueChange={setReceiptId}>
                <SelectTrigger id="exp-receipt" className="w-full">
                  <SelectValue placeholder="Selecciona un comprobante" />
                </SelectTrigger>
                <SelectContent>
                  {(receipts ?? []).length === 0 ? (
                    <SelectItem value="_empty" disabled>Sin comprobantes disponibles</SelectItem>
                  ) : (
                    (receipts ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.vendor ?? 'Sin proveedor'} — ${r.total_amount}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="exp-description">Descripcion</Label>
            <Textarea
              id="exp-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalle del egreso (opcional)"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !projectId || !category || !amount || !date}>
              {isSubmitting ? 'Guardando...' : expense ? 'Actualizar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
