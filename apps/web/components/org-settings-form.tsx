'use client';

import { useState, useRef } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Organization } from '@architech/shared';

function OrgSettingsFormSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 mb-8">
      <Skeleton className="h-6 w-32 mb-4" />
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrgSettingsForm() {
  const { data: org, mutate } = useSWR<Organization>('/api/organization', fetcher);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!org) return <OrgSettingsFormSkeleton />;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const updates: Record<string, string | null> = {};

    for (const [key, value] of formData.entries()) {
      updates[key] = (value as string).trim() || null;
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
      toast.success('Configuración guardada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
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
      toast.success('Logo actualizado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir logo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6 mb-8">
      <h2 className="text-lg font-semibold mb-4">Organización</h2>

      {/* Logo */}
      <div className="flex items-center gap-4 mb-6">
        <Avatar className="h-16 w-16">
          <AvatarImage src={logoPreview ?? undefined} alt={org.name} />
          <AvatarFallback><Building2 className="h-8 w-8" /></AvatarFallback>
        </Avatar>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            {uploading ? 'Subiendo...' : 'Cambiar logo'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleLogoUpload}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" defaultValue={org.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_email">Email de contacto</Label>
            <Input id="contact_email" name="contact_email" type="email" defaultValue={org.contact_email ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" name="phone" defaultValue={org.phone ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input id="website" name="website" defaultValue={org.website ?? ''} />
          </div>
        </div>

        <h3 className="text-sm font-medium text-muted-foreground pt-2">Dirección</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="address_street">Calle</Label>
            <Input id="address_street" name="address_street" defaultValue={org.address_street ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_locality">Localidad</Label>
            <Input id="address_locality" name="address_locality" defaultValue={org.address_locality ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_province">Provincia</Label>
            <Input id="address_province" name="address_province" defaultValue={org.address_province ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_postal_code">Código Postal</Label>
            <Input id="address_postal_code" name="address_postal_code" defaultValue={org.address_postal_code ?? ''} />
          </div>
        </div>

        <h3 className="text-sm font-medium text-muted-foreground pt-2">Redes sociales</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="social_instagram">Instagram</Label>
            <Input id="social_instagram" name="social_instagram" placeholder="@usuario" defaultValue={org.social_instagram ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="social_linkedin">LinkedIn</Label>
            <Input id="social_linkedin" name="social_linkedin" placeholder="URL o nombre" defaultValue={org.social_linkedin ?? ''} />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </div>
  );
}
