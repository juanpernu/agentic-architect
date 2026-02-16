'use client';

import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { toast } from 'sonner';
import { fetcher } from '@/lib/fetcher';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Project, CreateProjectInput, UpdateProjectInput, ProjectStatus, ProjectColor } from '@architech/shared';

interface OrgUser {
  id: string;
  full_name: string | null;
  email: string;
}

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project;
}

export function ProjectFormDialog({ open, onOpenChange, project }: ProjectFormDialogProps) {
  const { data: users = [] } = useSWR<OrgUser[]>(open ? '/api/users' : null, fetcher);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    address: string;
    status: ProjectStatus;
    architect_id: string;
    color: ProjectColor | '';
  }>({
    name: '',
    address: '',
    status: 'active',
    architect_id: '',
    color: '',
  });

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        address: project.address ?? '',
        status: project.status,
        architect_id: project.architect_id ?? '',
        color: project.color ?? '',
      });
    } else {
      setFormData({
        name: '',
        address: '',
        status: 'active',
        architect_id: '',
        color: '',
      });
    }
  }, [project, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload: CreateProjectInput | UpdateProjectInput = {
        name: formData.name,
        address: formData.address || undefined,
        status: formData.status,
        architect_id: formData.architect_id || undefined,
        color: formData.color || undefined,
      };

      const response = await fetch(
        project ? `/api/projects/${project.id}` : '/api/projects',
        {
          method: project ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al guardar proyecto');
      }

      toast.success(
        project ? 'Proyecto actualizado con éxito' : 'Proyecto creado con éxito'
      );

      // Refresh projects list
      await mutate('/api/projects');

      // If editing, also refresh the project detail
      if (project) {
        await mutate(`/api/projects/${project.id}`);
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Error al guardar proyecto'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {project ? 'Editar Proyecto' : 'Nuevo Proyecto'}
          </DialogTitle>
          <DialogDescription>
            {project
              ? 'Actualiza los datos del proyecto'
              : 'Completa los datos para crear un nuevo proyecto'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Nombre <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Ej: Casa Rodriguez"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder="Ej: Av. Corrientes 1234, CABA"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value as ProjectStatus })
              }
            >
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="architect_id">Arquitecto</Label>
            <Select
              value={formData.architect_id || '__none__'}
              onValueChange={(value) =>
                setFormData({ ...formData, architect_id: value === '__none__' ? '' : value })
              }
            >
              <SelectTrigger id="architect_id" className="w-full">
                <SelectValue placeholder="Seleccionar arquitecto (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin asignar</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name ?? user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Color (opcional)</Label>
            <div className="flex gap-2 flex-wrap">
              {(['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal'] as const).map(
                (c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, color: formData.color === c ? '' : c })
                    }
                    className={`h-8 w-8 rounded-full transition-all ${
                      formData.color === c
                        ? 'ring-2 ring-offset-2 ring-foreground scale-110'
                        : 'hover:scale-110'
                    }`}
                    style={{
                      backgroundColor: {
                        red: '#ef4444',
                        blue: '#3b82f6',
                        green: '#22c55e',
                        yellow: '#eab308',
                        purple: '#a855f7',
                        orange: '#f97316',
                        pink: '#ec4899',
                        teal: '#14b8a6',
                      }[c],
                    }}
                    aria-label={`Color ${c}`}
                  />
                )
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : project ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
