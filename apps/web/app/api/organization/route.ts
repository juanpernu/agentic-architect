import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb, getPublicFileUrl } from '@/lib/supabase';
import { validateBody } from '@/lib/validate';
import { organizationUpdateSchema } from '@/lib/schemas';
import { dbError } from '@/lib/api-error';

/** If logo_url is already a full URL, return as-is; otherwise resolve via Supabase storage. */
function resolveLogoUrl(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) return logoUrl;
  return getPublicFileUrl('org-assets', logoUrl);
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();
  const { data, error } = await db
    .from('organizations')
    .select('*')
    .eq('id', ctx.orgId)
    .single();

  if (error) return dbError(error, 'select', { route: '/api/organization' });

  data.logo_url = resolveLogoUrl(data.logo_url);

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const result = await validateBody(organizationUpdateSchema, req);
  if ('error' in result) return result.error;
  const updates = result.data;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('organizations')
    .update(updates)
    .eq('id', ctx.orgId)
    .select()
    .single();

  if (error) return dbError(error, 'update', { route: '/api/organization' });

  data.logo_url = resolveLogoUrl(data.logo_url);

  return NextResponse.json(data);
}
