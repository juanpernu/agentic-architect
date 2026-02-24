import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { validateBody } from '@/lib/validate';
import { incomeTypeCreateSchema } from '@/lib/schemas';
import { requireAdministrationAccess } from '@/lib/plan-guard';
import { dbError } from '@/lib/api-error';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();
  const { data, error } = await db
    .from('income_types')
    .select('*')
    .eq('org_id', ctx.orgId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) return dbError(error, 'select', { route: '/api/income-types' });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const planError = await requireAdministrationAccess(ctx.orgId);
  if (planError) return planError;

  const result = await validateBody(incomeTypeCreateSchema, req);
  if ('error' in result) return result.error;
  const { name } = result.data;

  const db = getDb();
  const { data, error } = await db
    .from('income_types')
    .insert({ org_id: ctx.orgId, name })
    .select()
    .single();

  if (error) return dbError(error, 'insert', { route: '/api/income-types' });
  return NextResponse.json(data, { status: 201 });
}
