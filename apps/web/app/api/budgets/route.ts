import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

/** Calculate total from a live snapshot's sections.
 *  Uses section-level subtotal override when present, otherwise sums items. */
function snapshotTotal(snapshot: unknown): number {
  const s = snapshot as {
    sections?: Array<{ subtotal?: number; items?: Array<{ subtotal?: number }> }>;
  } | null;
  if (!s?.sections) return 0;
  return s.sections.reduce((sum, sec) => {
    if (sec.subtotal != null) return sum + Number(sec.subtotal);
    return sum + (sec.items ?? []).reduce((iSum, i) => iSum + (Number(i.subtotal) || 0), 0);
  }, 0);
}

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();
  const projectId = req.nextUrl.searchParams.get('project_id');

  let query = db
    .from('budgets')
    .select('*, project:projects!project_id(id, name)')
    .eq('organization_id', ctx.orgId)
    .order('updated_at', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch latest version total for each budget
  const budgetIds = (data ?? []).map((b) => b.id);
  let versionTotals: Record<string, number> = {};

  if (budgetIds.length > 0) {
    const { data: versions } = await db
      .from('budget_versions')
      .select('budget_id, version_number, total_amount')
      .in('budget_id', budgetIds);

    // Group by budget_id and take the highest version_number
    const latestVersions: Record<string, { version: number; total: number }> = {};
    for (const v of versions ?? []) {
      const existing = latestVersions[v.budget_id];
      if (!existing || v.version_number > existing.version) {
        latestVersions[v.budget_id] = { version: v.version_number, total: Number(v.total_amount) };
      }
    }
    versionTotals = Object.fromEntries(
      Object.entries(latestVersions).map(([id, v]) => [id, v.total])
    );
  }

  const budgets = (data ?? []).map(({ project, ...b }) => ({
    ...b,
    project_name: (project as { id: string; name: string })?.name ?? '',
    // Use published version total when available, otherwise calculate from live snapshot
    total_amount: versionTotals[b.id] || snapshotTotal(b.snapshot),
  }));

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

  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
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

  // Create budget as draft with empty snapshot
  const { data: budget, error: budgetError } = await db
    .from('budgets')
    .insert({
      project_id: projectId,
      organization_id: ctx.orgId,
      current_version: 0,
      status: 'draft',
      snapshot: { sections: [] },
    })
    .select()
    .single();

  if (budgetError) return NextResponse.json({ error: budgetError.message }, { status: 500 });

  return NextResponse.json(budget, { status: 201 });
}
