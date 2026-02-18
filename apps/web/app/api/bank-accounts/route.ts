import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();
  const { data, error } = await db
    .from('bank_accounts')
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
  if (ctx.role !== 'admin') return forbidden();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.name || !(body.name as string).trim()) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
  }

  if (!body.bank_name || !(body.bank_name as string).trim()) {
    return NextResponse.json({ error: 'El nombre del banco es requerido' }, { status: 400 });
  }

  const VALID_CURRENCIES = ['ARS', 'USD'];
  if (body.currency && !VALID_CURRENCIES.includes(body.currency as string)) {
    return NextResponse.json({ error: 'Moneda no válida. Opciones: ARS, USD' }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('bank_accounts')
    .insert({
      organization_id: ctx.orgId,
      name: (body.name as string).trim(),
      bank_name: (body.bank_name as string).trim(),
      cbu: body.cbu ? (body.cbu as string).trim() : null,
      alias: body.alias ? (body.alias as string).trim() : null,
      currency: (body.currency as string) ?? 'ARS',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
