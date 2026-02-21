'use client';

import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { sileo } from 'sileo';
import { MapPin } from 'lucide-react';
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

const PROVINCES = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán',
];

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

  // Structured address fields (UI only — concatenated into `address` on save)
  const [street, setStreet] = useState('');
  const [locality, setLocality] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        address: project.address ?? '',
        status: project.status,
        architect_id: project.architect_id ?? '',
        color: project.color ?? '',
      });
      // Put existing address in street field since we can't reliably parse
      setStreet(project.address ?? '');
      setLocality('');
      setProvince('');
      setPostalCode('');
    } else {
      setFormData({
        name: '',
        address: '',
        status: 'active',
        architect_id: '',
        color: '',
      });
      setStreet('');
      setLocality('');
      setProvince('');
      setPostalCode('');
    }
    clearErrors();
  }, [project, open, clearErrors]);

  const buildAddress = (): string => {
    const parts = [street, locality, province, postalCode].filter(Boolean);
    return parts.join(', ');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = buildAddress();
    const data = { ...formData, address };
    if (!validate(data)) return;
    setIsSubmitting(true);

    try {
      const payload = {
        name: data.name,
        address: address || undefined,
        status: data.status,
        architect_id: data.architect_id || undefined,
        color: data.color || null,
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

      await mutate('/api/projects');

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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project info */}
          <FieldGroup className="space-y-1">
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

          {/* Ubicación section */}
          <div className="border border-border rounded-xl p-4 bg-muted/30 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Ubicación</span>
            </div>

            <Field>
              <FieldLabel htmlFor="street">Calle y Altura</FieldLabel>
              <Input
                id="street"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Ej: Av. Libertador 1234"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="locality">Localidad</FieldLabel>
              <Input
                id="locality"
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                placeholder="Ej: Vicente López"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="province">Provincia</FieldLabel>
                <Select
                  value={province || '__none__'}
                  onValueChange={(value) => setProvince(value === '__none__' ? '' : value)}
                >
                  <SelectTrigger id="province" className="w-full">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {PROVINCES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="postal_code">C.P.</FieldLabel>
                <Input
                  id="postal_code"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="Ej: 1638"
                />
              </Field>
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
