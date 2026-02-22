'use client';

import { useState, useRef } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel, FieldError, FieldGroup } from '@/components/ui/field';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { organizationSchema } from '@/lib/schemas';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Upload, Loader2, Save } from 'lucide-react';
import { sileo } from 'sileo';
import type { Organization } from '@architech/shared';

function OrgSettingsFormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="p-6 border-b border-border/50">
          <Skeleton className="h-5 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-6">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-9 w-28" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OrgSettingsForm() {
  const { data: org, mutate } = useSWR<Organization>('/api/organization', fetcher);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!org) return <OrgSettingsFormSkeleton />;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const raw: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      raw[key] = (value as string).trim();
    }

    const result = organizationSchema.safeParse(raw);
    if (!result.success) {
      const errs: Partial<Record<string, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        if (key && !errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    setSaving(true);
    const updates: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(raw)) {
      updates[key] = value || null;
    }

    try {
      const res = await fetch('/api/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar');
      }

      const updated = await res.json();
      mutate(updated, false);
      sileo.success({ title: 'Configuración guardada' });
    } catch (err) {
      sileo.error({ title: err instanceof Error ? err.message : 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/organization/logo', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al subir logo');
      }

      const result = await res.json();
      setLogoPreview(result.signed_url);
      mutate(result.organization, false);
      sileo.success({ title: 'Logo actualizado' });
    } catch (err) {
      sileo.error({ title: err instanceof Error ? err.message : 'Error al subir logo' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Profile / Organization info */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="p-6 border-b border-border/50">
          <h2 className="text-lg font-semibold">Información de la Organización</h2>
          <p className="text-sm text-muted-foreground mt-1">Actualiza la información de tu cuenta y logo.</p>
        </div>
        <div className="p-6 space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20 border-2 border-background shadow-sm">
              <AvatarImage src={logoPreview ?? org.logo_url ?? undefined} alt={org.name} />
              <AvatarFallback className="text-2xl"><Building2 className="h-8 w-8" /></AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  {uploading ? 'Subiendo...' : 'Cambiar foto'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">JPG, PNG o WebP. Max 1MB.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          </div>

          {/* Main fields */}
          <FieldGroup className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field data-invalid={!!fieldErrors.name}>
              <FieldLabel htmlFor="name">Nombre</FieldLabel>
              <Input id="name" name="name" defaultValue={org.name} aria-invalid={!!fieldErrors.name} />
              <FieldError>{fieldErrors.name}</FieldError>
            </Field>
            <Field data-invalid={!!fieldErrors.contact_email}>
              <FieldLabel htmlFor="contact_email">Email de contacto</FieldLabel>
              <Input id="contact_email" name="contact_email" type="email" defaultValue={org.contact_email ?? ''} aria-invalid={!!fieldErrors.contact_email} />
              <FieldError>{fieldErrors.contact_email}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
              <Input id="phone" name="phone" defaultValue={org.phone ?? ''} />
            </Field>
            <Field data-invalid={!!fieldErrors.website}>
              <FieldLabel htmlFor="website">Website</FieldLabel>
              <Input id="website" name="website" defaultValue={org.website ?? ''} aria-invalid={!!fieldErrors.website} />
              <FieldError>{fieldErrors.website}</FieldError>
            </Field>
          </FieldGroup>
        </div>
      </div>

      {/* Address */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="p-6 border-b border-border/50">
          <h2 className="text-lg font-semibold">Dirección</h2>
          <p className="text-sm text-muted-foreground mt-1">Información de ubicación de la organización.</p>
        </div>
        <div className="p-6">
          <FieldGroup className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field>
              <FieldLabel htmlFor="address_street">Calle</FieldLabel>
              <Input id="address_street" name="address_street" defaultValue={org.address_street ?? ''} />
            </Field>
            <Field>
              <FieldLabel htmlFor="address_locality">Localidad</FieldLabel>
              <Input id="address_locality" name="address_locality" defaultValue={org.address_locality ?? ''} />
            </Field>
            <Field>
              <FieldLabel htmlFor="address_province">Provincia</FieldLabel>
              <Input id="address_province" name="address_province" defaultValue={org.address_province ?? ''} />
            </Field>
            <Field>
              <FieldLabel htmlFor="address_postal_code">Código Postal</FieldLabel>
              <Input id="address_postal_code" name="address_postal_code" defaultValue={org.address_postal_code ?? ''} />
            </Field>
          </FieldGroup>
        </div>
      </div>

      {/* Social */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="p-6 border-b border-border/50">
          <h2 className="text-lg font-semibold">Redes Sociales</h2>
          <p className="text-sm text-muted-foreground mt-1">Links a perfiles de la organización.</p>
        </div>
        <div className="p-6">
          <FieldGroup className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field>
              <FieldLabel htmlFor="social_instagram">Instagram</FieldLabel>
              <Input id="social_instagram" name="social_instagram" placeholder="@usuario" defaultValue={org.social_instagram ?? ''} />
            </Field>
            <Field>
              <FieldLabel htmlFor="social_linkedin">LinkedIn</FieldLabel>
              <Input id="social_linkedin" name="social_linkedin" placeholder="URL o nombre" defaultValue={org.social_linkedin ?? ''} />
            </Field>
          </FieldGroup>
        </div>
      </div>

      {/* Actions footer */}
      <div className="flex items-center justify-end gap-4 pt-2 pb-8">
        <Button type="button" variant="ghost" disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>
    </form>
  );
}
