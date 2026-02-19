'use client';

import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { sileo } from 'sileo';
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
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field';
import { useFormValidation } from '@/lib/use-form-validation';
import { projectSchema } from '@/lib/schemas';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PROJECT_COLOR_HEX } from '@/lib/project-colors';
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
  const { errors, validate, clearErrors } = useFormValidation(projectSchema);
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
    clearErrors();
  }, [project, open, clearErrors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate(formData)) return;
    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        address: formData.address || undefined,
        status: formData.status,
        architect_id: formData.architect_id || undefined,
        color: formData.color || null,
      } satisfies Omit<CreateProjectInput | UpdateProjectInput, 'color'> & { color: ProjectColor | null };

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

      sileo.success({
        title: project ? 'Proyecto actualizado con éxito' : 'Proyecto creado con éxito',
      });

      // Refresh projects list
      await mutate('/api/projects');

      // If editing, also refresh the project detail
      if (project) {
        await mutate(`/api/projects/${project.id}`);
      }

      onOpenChange(false);
    } catch (error) {
      sileo.error({
        title: error instanceof Error ? error.message : 'Error al guardar proyecto',
      });
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

        <form onSubmit={handleSubmit}>
          <FieldGroup className="space-y-4">
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">
                Nombre <span className="text-red-500">*</span>
              </FieldLabel>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ej: Casa Rodriguez"
                aria-required="true"
                aria-invalid={!!errors.name}
              />
              <FieldError>{errors.name}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="address">Dirección</FieldLabel>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Ej: Av. Corrientes 1234, CABA"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="status">Estado</FieldLabel>
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
            </Field>

            <Field>
              <FieldLabel htmlFor="architect_id">Arquitecto</FieldLabel>
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
            </Field>

            <Field>
              <FieldLabel>Color (opcional)</FieldLabel>
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
                        backgroundColor: PROJECT_COLOR_HEX[c],
                      }}
                      aria-label={`Color ${c}`}
                    />
                  )
                )}
              </div>
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-4">
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
