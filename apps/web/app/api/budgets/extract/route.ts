import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { extractBudgetFromText } from '@architech/ai';
import { parseExcelToText, parsePdfToText, getFileType } from '@architech/ai/parse-file';
import { budgetSnapshotSchema } from '@/lib/schemas';

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/pdf',
];

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const projectId = formData.get('project_id') as string | null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!projectId) return NextResponse.json({ error: 'project_id is required' }, { status: 400 });

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File must be Excel (.xlsx, .xls) or PDF' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File size must be under 10MB' }, { status: 400 });
  }

  const db = getDb();

  const { data: project } = await db
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('organization_id', ctx.orgId)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { data: existingBudget } = await db
    .from('budgets')
    .select('id')
    .eq('project_id', projectId)
    .single();

  if (existingBudget) {
    return NextResponse.json({ error: 'Project already has a budget' }, { status: 409 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileType = getFileType(file.type);

  let textContent: string;
  try {
    if (fileType === 'excel') {
      textContent = parseExcelToText(buffer);
    } else {
      textContent = await parsePdfToText(buffer);
    }
  } catch {
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 400 });
  }

  if (!textContent.trim()) {
    return NextResponse.json({ error: 'File appears to be empty' }, { status: 400 });
  }

  let extraction;
  try {
    extraction = await extractBudgetFromText(textContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI extraction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!extraction.sections.length) {
    return NextResponse.json({ error: 'No budget sections found in file' }, { status: 422 });
  }

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

  const sections = [];
  for (let i = 0; i < extraction.sections.length; i++) {
    const s = extraction.sections[i];

    const { data: rubro, error: rubroError } = await db
      .from('rubros')
      .insert({
        budget_id: budget.id,
        name: s.rubro_name,
        sort_order: i,
      })
      .select()
      .single();

    if (rubroError) {
      await db.from('budgets').delete().eq('id', budget.id);
      return NextResponse.json({ error: rubroError.message }, { status: 500 });
    }

    sections.push({
      rubro_id: rubro.id,
      rubro_name: s.rubro_name,
      is_additional: s.is_additional,
      subtotal: s.subtotal,
      cost: s.cost,
      items: s.items.length > 0
        ? s.items
        : [{ description: '', unit: 'gl', quantity: 1, cost: 0, subtotal: 0 }],
    });
  }

  const snapshot = { sections };
  const parsed = budgetSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    await db.from('budgets').delete().eq('id', budget.id);
    return NextResponse.json({ error: 'AI extraction produced invalid data' }, { status: 422 });
  }

  const { error: updateError } = await db
    .from('budgets')
    .update({ snapshot: parsed.data })
    .eq('id', budget.id);

  if (updateError) {
    await db.from('budgets').delete().eq('id', budget.id);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      budget_id: budget.id,
      sections_count: sections.length,
      items_count: sections.reduce((sum, s) => sum + s.items.length, 0),
    },
    { status: 201 }
  );
}
