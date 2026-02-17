import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

const VALID_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal'];

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();
  const { data, error } = await db
    .from('cost_centers')
    .select('*')
    .eq('organization_id', ctx.orgId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.name || !(body.name as string).trim()) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
  }

  if ((body.name as string).length > 100) {
    return NextResponse.json({ error: 'El nombre no puede exceder 100 caracteres' }, { status: 400 });
  }

  if (body.color && !VALID_COLORS.includes(body.color as string)) {
    return NextResponse.json({ error: `color debe ser uno de: ${VALID_COLORS.join(', ')}` }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('cost_centers')
    .insert({
      organization_id: ctx.orgId,
      name: (body.name as string).trim(),
      description: body.description ? (body.description as string).trim() : null,
      color: body.color ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
