import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb, getPublicFileUrl } from '@/lib/supabase';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();
  const { data, error } = await db
    .from('organizations')
    .select('*')
    .eq('id', ctx.orgId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (data.logo_url) {
    data.logo_url = getPublicFileUrl('org-assets', data.logo_url);
  }

  return NextResponse.json(data);
}

const ALLOWED_FIELDS = [
  'name', 'address_street', 'address_locality', 'address_province',
  'address_postal_code', 'phone', 'website',
  'contact_email', 'social_instagram', 'social_linkedin',
];

const MAX_FIELD_LENGTH = 500;

export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const updates: Record<string, string | null> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      const val = body[field];
      if (val !== null && typeof val !== 'string') {
        return NextResponse.json({ error: `${field} debe ser texto o null` }, { status: 400 });
      }
      if (typeof val === 'string' && val.length > MAX_FIELD_LENGTH) {
        return NextResponse.json({ error: `${field} excede el largo máximo (${MAX_FIELD_LENGTH})` }, { status: 400 });
      }
      updates[field] = typeof val === 'string' ? val.trim() || null : null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No hay campos válidos para actualizar' }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('organizations')
    .update(updates)
    .eq('id', ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (data.logo_url) {
    data.logo_url = getPublicFileUrl('org-assets', data.logo_url);
  }

  return NextResponse.json(data);
}
