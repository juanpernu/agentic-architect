'use client';

import { useState, useEffect } from 'react';
import { mutate } from 'swr';
import { sileo } from 'sileo';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { COST_CENTER_COLOR_HEX, PROJECT_COLORS } from '@/lib/project-colors';
import type { CostCenter, ProjectColor } from '@architech/shared';

interface CostCenterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCenter?: CostCenter;
}

export function CostCenterFormDialog({ open, onOpenChange, costCenter }: CostCenterFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    color: ProjectColor | '';
  }>({ name: '', description: '', color: '' });

  useEffect(() => {
    if (costCenter) {
      setFormData({
        name: costCenter.name,
        description: costCenter.description ?? '',
        color: costCenter.color ?? '',
      });
    } else {
      setFormData({ name: '', description: '', color: '' });
    }
  }, [costCenter, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        color: formData.color || null,
      };

      const response = await fetch(
        costCenter ? `/api/cost-centers/${costCenter.id}` : '/api/cost-centers',
        {
          method: costCenter ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al guardar');
      }

      sileo.success({ title: costCenter ? 'Centro de costos actualizado' : 'Centro de costos creado' });
      await mutate('/api/cost-centers');
      onOpenChange(false);
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al guardar' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{costCenter ? 'Editar Centro de Costos' : 'Nuevo Centro de Costos'}</DialogTitle>
          <DialogDescription>
            {costCenter ? 'Actualiza los datos del centro de costos' : 'Crea un nuevo centro de costos para clasificar comprobantes'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cc-name">Nombre <span className="text-red-500">*</span></Label>
            <Input
              id="cc-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Albañilería"
              maxLength={100}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cc-description">Descripción</Label>
            <Textarea
              id="cc-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descripción opcional del centro de costos"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Color (opcional)</Label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: formData.color === c ? '' : c })}
                  className={`h-8 w-8 rounded-full transition-all ${
                    formData.color === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: COST_CENTER_COLOR_HEX[c] }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : costCenter ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
