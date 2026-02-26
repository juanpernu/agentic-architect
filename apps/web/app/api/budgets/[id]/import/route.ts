import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { extractBudgetData } from '@architech/ai';
import { budgetSnapshotSchema } from '@/lib/schemas';
import { apiError } from '@/lib/api-error';
import { rateLimit } from '@/lib/rate-limit';
import type { BudgetSnapshot, BudgetSection } from '@architech/shared';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls'];
const MIN_CONFIDENCE = 0.3;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const rl = rateLimit('extract', ctx.orgId);
  if (rl) return rl;

  const { id } = await params;
  const db = getDb();

  // 1. Validate budget exists, belongs to org, is draft, and is empty
  const { data: budget } = await db
    .from('budgets')
    .select('id, status, snapshot')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .single();

  if (!budget) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (budget.status !== 'draft') {
    return NextResponse.json(
      { error: 'Solo se puede importar en un presupuesto en borrador.' },
      { status: 409 }
    );
  }

  const existingSnapshot = budget.snapshot as BudgetSnapshot | null;
  if (existingSnapshot?.sections && existingSnapshot.sections.length > 0) {
    return NextResponse.json(
      { error: 'El presupuesto ya tiene datos. Creá uno nuevo para importar.' },
      { status: 409 }
    );
  }

  // 2. Parse the uploaded file
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 });
  }

  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: 'El archivo debe ser .xlsx o .xls' },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'El archivo supera el tamaño máximo (5MB)' },
      { status: 400 }
    );
  }

  // 3. Extract budget data via AI
  let result;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    result = await extractBudgetData(buffer, file.name);
  } catch (error) {
    if (error instanceof Error && error.message === 'El Excel no contiene datos') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return apiError(error, 'Error al procesar el archivo Excel', 422, {
      route: '/api/budgets/[id]/import',
    });
  }

  // 4. Validate confidence threshold
  if (result.confidence < MIN_CONFIDENCE) {
    return NextResponse.json(
      {
        error: 'No se pudo interpretar la estructura del presupuesto',
        confidence: result.confidence,
        warnings: result.warnings,
      },
      { status: 422 }
    );
  }

  if (result.sections.length === 0) {
    return NextResponse.json(
      { error: 'No se encontraron rubros en el archivo' },
      { status: 422 }
    );
  }

  // 5. Create rubros in DB and assemble snapshot
  const sections: BudgetSection[] = [];

  for (let i = 0; i < result.sections.length; i++) {
    const importSection = result.sections[i];

    // Create rubro in DB
    const { data: rubro, error: rubroError } = await db
      .from('rubros')
      .insert({
        budget_id: id,
        name: importSection.rubro_name,
        sort_order: i,
      })
      .select('id, name')
      .single();

    if (rubroError || !rubro) {
      return apiError(
        rubroError,
        `Error al crear rubro "${importSection.rubro_name}"`,
        500,
        { route: '/api/budgets/[id]/import' }
      );
    }

    const section: BudgetSection = {
      rubro_id: rubro.id,
      rubro_name: rubro.name,
      is_additional: importSection.is_additional,
      items: importSection.items.map((item) => ({
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        cost: item.cost,
        subtotal: item.subtotal,
      })),
    };

    // Add section-level overrides if present
    if (importSection.section_subtotal != null) {
      section.subtotal = importSection.section_subtotal;
    }
    if (importSection.section_cost != null) {
      section.cost = importSection.section_cost;
    }

    sections.push(section);
  }

  const snapshot: BudgetSnapshot = { sections };

  // 6. Validate the assembled snapshot
  const parsed = budgetSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Error al armar el presupuesto importado' },
      { status: 422 }
    );
  }

  // 7. Save snapshot to budget
  const { error: updateError } = await db
    .from('budgets')
    .update({ snapshot: parsed.data })
    .eq('id', id);

  if (updateError) {
    return apiError(updateError, 'Error al guardar el presupuesto', 500, {
      route: '/api/budgets/[id]/import',
    });
  }

  return NextResponse.json({
    snapshot: parsed.data,
    confidence: result.confidence,
    warnings: result.warnings,
  });
}
