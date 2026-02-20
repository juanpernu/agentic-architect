import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();
  const projectId = req.nextUrl.searchParams.get('project_id');
  const dateFrom = req.nextUrl.searchParams.get('date_from');
  const dateTo = req.nextUrl.searchParams.get('date_to');

  let query = db
    .from('receipts')
    .select('id, total_amount, rubro_id, rubro:rubros(id, name, color), project:projects!inner(id, name)')
    .eq('status', 'confirmed');

  // Filter by org via project
  query = query.eq('project.organization_id', ctx.orgId);

  if (projectId) query = query.eq('project_id', projectId);
  if (dateFrom) query = query.gte('receipt_date', dateFrom);
  if (dateTo) query = query.lte('receipt_date', dateTo);

  const { data: receipts, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const map = new Map<string, {
    project_id: string;
    project_name: string;
    rubro_id: string;
    rubro_name: string;
    rubro_color: string | null;
    total_amount: number;
    receipt_count: number;
  }>();

  for (const r of receipts ?? []) {
    if (!r.rubro || !r.project) continue;
    const rubro = r.rubro as unknown as { id: string; name: string; color: string | null };
    const project = r.project as unknown as { id: string; name: string };
    const key = `${project.id}:${rubro.id}`;

    const existing = map.get(key);
    if (existing) {
      existing.total_amount += Number(r.total_amount);
      existing.receipt_count += 1;
    } else {
      map.set(key, {
        project_id: project.id,
        project_name: project.name,
        rubro_id: rubro.id,
        rubro_name: rubro.name,
        rubro_color: rubro.color,
        total_amount: Number(r.total_amount),
        receipt_count: 1,
      });
    }
  }

  const result = Array.from(map.values()).sort((a, b) => b.total_amount - a.total_amount);

  return NextResponse.json(result);
}
