import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { validateBody } from '@/lib/validate';
import { bankAccountCreateSchema } from '@/lib/schemas';

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

  const result = await validateBody(bankAccountCreateSchema, req);
  if ('error' in result) return result.error;
  const { name, bank_name, cbu, alias, currency } = result.data;

  const db = getDb();
  const { data, error } = await db
    .from('bank_accounts')
    .insert({
      organization_id: ctx.orgId,
      name,
      bank_name,
      cbu,
      alias,
      currency,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
