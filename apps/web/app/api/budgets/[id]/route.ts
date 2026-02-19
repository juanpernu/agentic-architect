import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { budgetSnapshotSchema } from '@/lib/schemas';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { id } = await params;
  const db = getDb();
  const versionParam = req.nextUrl.searchParams.get('version');

  const { data: budget, error } = await db
    .from('budgets')
    .select('*, project:projects!project_id(id, name)')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .single();

  if (error || !budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let versionQuery = db
    .from('budget_versions')
    .select('*')
    .eq('budget_id', id);

  if (versionParam) {
    versionQuery = versionQuery.eq('version_number', parseInt(versionParam, 10));
  } else {
    versionQuery = versionQuery.eq('version_number', budget.current_version);
  }

  const { data: version } = await versionQuery.single();

  return NextResponse.json({
    ...budget,
    latest_version: version,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const snapshot = body.snapshot;
  if (!snapshot) {
    return NextResponse.json({ error: 'snapshot is required' }, { status: 400 });
  }

  try {
    budgetSnapshotSchema.parse(snapshot);
  } catch (validationError) {
    return NextResponse.json({ error: 'Invalid snapshot format' }, { status: 400 });
  }

  const db = getDb();

  const { data: budget } = await db
    .from('budgets')
    .select('id, current_version')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .single();

  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const newVersion = budget.current_version + 1;

  const sections = (snapshot as { sections?: Array<{ items?: Array<{ subtotal?: number }> }> }).sections ?? [];
  const totalAmount = sections.reduce((sum, s) =>
    sum + (s.items ?? []).reduce((itemSum, i) => itemSum + (Number(i.subtotal) || 0), 0)
  , 0);

  const { error: versionError } = await db
    .from('budget_versions')
    .insert({
      budget_id: id,
      version_number: newVersion,
      snapshot,
      total_amount: totalAmount,
      created_by: ctx.dbUserId,
    });

  if (versionError) return NextResponse.json({ error: versionError.message }, { status: 500 });

  const { error: updateError } = await db
    .from('budgets')
    .update({ current_version: newVersion })
    .eq('id', id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ version_number: newVersion, total_amount: totalAmount });
}
