import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();
  const projectId = req.nextUrl.searchParams.get('project_id');

  let query = db
    .from('budgets')
    .select(`
      *,
      project:projects!project_id(id, name),
      latest_version:budget_versions(total_amount)
    `)
    .eq('organization_id', ctx.orgId)
    .order('updated_at', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const budgets = (data ?? []).map(({ latest_version, project, ...b }) => {
    const versions = latest_version as Array<{ total_amount: number }> | null;
    return {
      ...b,
      project_name: (project as { id: string; name: string })?.name ?? '',
      total_amount: versions?.length ? Number(versions[versions.length - 1].total_amount) : 0,
    };
  });

  return NextResponse.json(budgets);
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const projectId = body.project_id as string;
  const snapshot = body.snapshot as Record<string, unknown>;

  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
  }
  if (!snapshot) {
    return NextResponse.json({ error: 'snapshot is required' }, { status: 400 });
  }

  const db = getDb();

  // Verify project exists and belongs to org
  const { data: project } = await db
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('organization_id', ctx.orgId)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Check project doesn't already have a budget
  const { data: existing } = await db
    .from('budgets')
    .select('id')
    .eq('project_id', projectId)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Project already has a budget' }, { status: 409 });
  }

  // Calculate total
  const sections = (snapshot as { sections?: Array<{ subtotal?: number }> }).sections ?? [];
  const totalAmount = sections.reduce((sum, s) => sum + (Number(s.subtotal) || 0), 0);

  // Create budget
  const { data: budget, error: budgetError } = await db
    .from('budgets')
    .insert({
      project_id: projectId,
      organization_id: ctx.orgId,
      current_version: 1,
    })
    .select()
    .single();

  if (budgetError) return NextResponse.json({ error: budgetError.message }, { status: 500 });

  // Create first version
  const { error: versionError } = await db
    .from('budget_versions')
    .insert({
      budget_id: budget.id,
      version_number: 1,
      snapshot,
      total_amount: totalAmount,
      created_by: ctx.dbUserId,
    });

  if (versionError) return NextResponse.json({ error: versionError.message }, { status: 500 });

  return NextResponse.json(budget, { status: 201 });
}
