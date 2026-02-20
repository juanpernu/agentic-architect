import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

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

  // If a specific version is requested, fetch from budget_versions for historical view
  if (versionParam) {
    const { data: version } = await db
      .from('budget_versions')
      .select('*')
      .eq('budget_id', id)
      .eq('version_number', parseInt(versionParam, 10))
      .single();

    return NextResponse.json({
      ...budget,
      latest_version: version,
    });
  }

  // Otherwise return live snapshot from the budget row
  return NextResponse.json({
    ...budget,
    latest_version: budget.current_version > 0
      ? (await db
          .from('budget_versions')
          .select('*')
          .eq('budget_id', id)
          .eq('version_number', budget.current_version)
          .single()
        ).data
      : null,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const db = getDb();

  const { data: budget } = await db
    .from('budgets')
    .select('id, status')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .single();

  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Status change: published -> draft
  if (body.status === 'draft' && budget.status === 'published') {
    const { error } = await db
      .from('budgets')
      .update({ status: 'draft' })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: 'draft' });
  }

  // Autosave: update snapshot (only when draft)
  if (body.snapshot !== undefined) {
    if (budget.status !== 'draft') {
      return NextResponse.json({ error: 'Budget is published. Click "Editar presupuesto" first.' }, { status: 409 });
    }

    const { error } = await db
      .from('budgets')
      .update({ snapshot: body.snapshot })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ saved: true });
  }

  return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
}

export async function PUT(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const { id } = await params;
  const db = getDb();

  const { data: budget } = await db
    .from('budgets')
    .select('id, current_version, snapshot, status')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .single();

  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (budget.status !== 'draft') {
    return NextResponse.json({ error: 'Budget is not in draft mode' }, { status: 409 });
  }

  const snapshot = budget.snapshot as {
    sections?: Array<{ subtotal?: number; items?: Array<{ subtotal?: number }> }>;
  };
  const sections = snapshot?.sections ?? [];
  const totalAmount = sections.reduce((sum, s) => {
    if (s.subtotal != null) return sum + Number(s.subtotal);
    return sum + (s.items ?? []).reduce((itemSum, i) => itemSum + (Number(i.subtotal) || 0), 0);
  }, 0);

  const newVersion = budget.current_version + 1;

  const { error: versionError } = await db
    .from('budget_versions')
    .insert({
      budget_id: id,
      version_number: newVersion,
      snapshot: budget.snapshot,
      total_amount: totalAmount,
      created_by: ctx.dbUserId,
    });

  if (versionError) return NextResponse.json({ error: versionError.message }, { status: 500 });

  const { error: updateError } = await db
    .from('budgets')
    .update({ current_version: newVersion, status: 'published' })
    .eq('id', id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ version_number: newVersion, total_amount: totalAmount });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const { id } = await params;
  const db = getDb();

  const { data: budget } = await db
    .from('budgets')
    .select('id')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .single();

  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await db
    .from('budgets')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
