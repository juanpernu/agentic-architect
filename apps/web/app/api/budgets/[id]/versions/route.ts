import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { id } = await params;
  const db = getDb();

  const { data: budget } = await db
    .from('budgets')
    .select('id')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .single();

  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await db
    .from('budget_versions')
    .select('id, version_number, total_amount, created_at, created_by:users!created_by(full_name)')
    .eq('budget_id', id)
    .order('version_number', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const versions = (data ?? []).map(({ created_by, ...v }) => ({
    ...v,
    created_by_name: (created_by as { full_name: string } | null)?.full_name ?? 'Usuario',
  }));

  return NextResponse.json(versions);
}
