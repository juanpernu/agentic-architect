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
  };
  onSaved?: () => void;
}

export function IncomeFormDialog({ open, onOpenChange, income, onSaved }: IncomeFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  // Load projects
  const { data: projects } = useSWR<Array<{ id: string; name: string }>>(
    open ? '/api/projects' : null,
    fetcher
  );

  // Pre-populate form when editing
  useEffect(() => {
    if (income && open) {
      setProjectId(income.project_id);
      setCategory(income.category);
      setAmount(String(income.amount));
      setDate(income.date);
      setDescription(income.description ?? '');
    } else if (!income && open) {
      setProjectId('');
      setCategory('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
    }
  }, [income, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        project_id: projectId,
        category: category,
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
          {/* Project */}
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

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="inc-category">Categoría <span className="text-red-500">*</span></Label>
            <Input
              id="inc-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ej: Certificado, Anticipo, Ajuste"
              required
            />
          </div>

          {/* Amount and Date */}
          <div className="grid grid-cols-2 gap-4">
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

          {/* Description */}
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !projectId || !category || !amount || !date}>
              {isSubmitting ? 'Guardando...' : income ? 'Actualizar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
