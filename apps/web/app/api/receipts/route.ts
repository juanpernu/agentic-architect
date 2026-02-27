import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb, getSignedImageUrl } from '@/lib/supabase';
import { checkPlanLimit, requireAdministrationAccess } from '@/lib/plan-guard';
import { dbError } from '@/lib/api-error';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id');
  const rubroId = searchParams.get('rubro_id');
  const limit = searchParams.get('limit');

  const db = getDb();

  let query = db
    .from('receipts')
    .select('*, project:projects!project_id(id, name, color), uploader:users!uploaded_by(id, full_name), rubro:rubros(id, name, color), bank_account:bank_accounts(id, name, bank_name)')
    .order('created_at', { ascending: false });

  // Filter by org via projects
  query = query.eq('project.organization_id', ctx.orgId);

  if (projectId) query = query.eq('project_id', projectId);
  if (rubroId) query = query.eq('rubro_id', rubroId);

  // Architects only see own receipts
  if (ctx.role === 'architect') {
    query = query.eq('uploaded_by', ctx.dbUserId);
  }

  if (limit) {
    const n = parseInt(limit, 10);
    if (!isNaN(n) && n > 0) query = query.limit(n);
  }

  const { data, error } = await query;
  if (error) return dbError(error, 'select', { route: '/api/receipts' });

  // Generate signed URLs for receipt images
  const receipts = data ?? [];
  await Promise.all(
    receipts.map(async (receipt: Record<string, unknown>) => {
      if (receipt.image_url) {
        receipt.image_url = await getSignedImageUrl(receipt.image_url as string);
      }
    })
  );

  return NextResponse.json(receipts);
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.project_id || !body.total_amount || !body.receipt_date || !body.image_url) {
    return NextResponse.json({ error: 'project_id, total_amount, receipt_date, and image_url are required' }, { status: 400 });
  }

  // Validate category value
  if (body.category && body.category !== 'income' && body.category !== 'expense') {
    return NextResponse.json({ error: 'category must be "income" or "expense"' }, { status: 400 });
  }

  const guard = await checkPlanLimit(ctx.orgId, 'receipt', { projectId: body.project_id as string });
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.reason }, { status: 403 });
  }

  const db = getDb();

  // Validate project belongs to org
  const { data: validProject } = await db
    .from('projects')
    .select('id')
    .eq('id', body.project_id as string)
    .eq('organization_id', ctx.orgId)
    .single();
  if (!validProject) {
    return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 400 });
  }

  // Validate paid_by belongs to org (if provided)
  if (body.paid_by) {
    const { data: validUser } = await db
      .from('users')
      .select('id')
      .eq('id', body.paid_by as string)
      .eq('organization_id', ctx.orgId)
      .eq('is_active', true)
      .maybeSingle();
    if (!validUser) {
      return NextResponse.json({ error: 'Usuario no válido' }, { status: 400 });
    }
  }

  // rubro_id is required for expenses and when category is not set (backwards compat)
  if (body.category !== 'income' && !body.rubro_id) {
    return NextResponse.json(
      { error: 'rubro_id is required' },
      { status: 400 }
    );
  }

  // Validate rubro_id belongs to the same org (via budget) — skip when not provided (income)
  if (body.rubro_id) {
    const { data: validRubro } = await db
      .from('rubros')
      .select('id, budget:budgets!budget_id(organization_id)')
      .eq('id', body.rubro_id as string)
      .maybeSingle();

    if (!validRubro || (validRubro.budget as unknown as { organization_id: string })?.organization_id !== ctx.orgId) {
      return NextResponse.json(
        { error: 'Rubro no válido' },
        { status: 400 }
      );
    }
  }

  // Validate bank_account_id if provided
  if (body.bank_account_id) {
    const { data: validBA } = await db
      .from('bank_accounts')
      .select('id')
      .eq('id', body.bank_account_id as string)
      .eq('organization_id', ctx.orgId)
      .eq('is_active', true)
      .maybeSingle();

    if (!validBA) {
      return NextResponse.json(
        { error: 'Cuenta bancaria no válida o inactiva' },
        { status: 400 }
      );
    }
  }

  // Upsert supplier if provided
  let supplierId: string | null = null;
  const supplierData = body.supplier as Record<string, unknown> | undefined;

  const CUIT_REGEX = /^\d{2}-\d{7,8}-\d$/;
  if (supplierData?.name) {
    // Normalize CUIT: strip non-digits, then re-format with dashes
    if (supplierData.cuit) {
      const digits = (supplierData.cuit as string).replace(/\D/g, '');
      if (digits.length === 11) {
        supplierData.cuit = `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
      }
      // If CUIT is still invalid after normalization, discard it rather than blocking
      if (!CUIT_REGEX.test(supplierData.cuit as string)) {
        logger.warn('Discarding invalid CUIT', { route: '/api/receipts', cuit: supplierData.cuit });
        supplierData.cuit = null;
      }
    }

    if (supplierData.cuit) {
      const { data: supplier, error: supplierError } = await db
        .from('suppliers')
        .upsert(
          {
            organization_id: ctx.orgId,
            name: supplierData.name,
            responsible_person: supplierData.responsible_person ?? null,
            cuit: supplierData.cuit,
            iibb: supplierData.iibb ?? null,
            street: supplierData.street ?? null,
            locality: supplierData.locality ?? null,
            province: supplierData.province ?? null,
            postal_code: supplierData.postal_code ?? null,
            activity_start_date: supplierData.activity_start_date ?? null,
            fiscal_condition: supplierData.fiscal_condition ?? null,
          },
          { onConflict: 'organization_id,cuit' }
        )
        .select('id')
        .single();

      if (supplierError) {
        logger.error('Supplier upsert failed', { route: '/api/receipts' }, supplierError);
      }
      if (supplier) supplierId = supplier.id;
    } else {
      const { data: supplier, error: supplierError } = await db
        .from('suppliers')
        .insert({
          organization_id: ctx.orgId,
          name: supplierData.name as string,
          responsible_person: (supplierData.responsible_person as string) ?? null,
          fiscal_condition: (supplierData.fiscal_condition as string) ?? null,
        })
        .select('id')
        .single();

      if (supplierError) {
        logger.error('Supplier insert failed', { route: '/api/receipts' }, supplierError);
      }
      if (supplier) supplierId = supplier.id;
    }
  }

  // Insert receipt with new fields
  const { data: receipt, error: receiptError } = await db
    .from('receipts')
    .insert({
      project_id: body.project_id,
      category: body.category ?? null,
      rubro_id: body.rubro_id ?? null,
      bank_account_id: body.bank_account_id ?? null,
      uploaded_by: ctx.dbUserId,
      vendor: (supplierData?.name as string) ?? (body.vendor as string) ?? null,
      supplier_id: supplierId,
      total_amount: body.total_amount,
      receipt_date: body.receipt_date,
      receipt_time: body.receipt_time ?? null,
      receipt_type: body.receipt_type ?? null,
      receipt_code: body.receipt_code ?? null,
      receipt_number: body.receipt_number ?? null,
      net_amount: body.net_amount ?? null,
      iva_rate: body.iva_rate ?? null,
      iva_amount: body.iva_amount ?? null,
      image_url: body.image_url,
      ai_raw_response: body.ai_raw_response ?? {},
      ai_confidence: body.ai_confidence ?? 0,
    })
    .select()
    .single();

  if (receiptError) {
    // Cleanup orphaned supplier if it was newly inserted (no CUIT = no upsert reuse)
    if (supplierId && !supplierData?.cuit) {
      await db.from('suppliers').delete().eq('id', supplierId);
    }
    return dbError(receiptError, 'insert', { route: '/api/receipts' });
  }

  // Insert receipt items if provided
  if ((body.items as unknown[])?.length > 0) {
    const items = (body.items as Array<{ description: string; quantity: number; unit_price: number }>).map((item) => ({
      receipt_id: receipt.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    const { error: itemsError } = await db.from('receipt_items').insert(items);
    if (itemsError) {
      await db.from('receipts').delete().eq('id', receipt.id);
      return dbError(itemsError, 'insert', { route: '/api/receipts' });
    }
  }

  // Create linked financial record (only if org has Administration access)
  if (body.category) {
    const adminBlock = await requireAdministrationAccess(ctx.orgId);
    if (!adminBlock) {
      if (body.category === 'expense') {
        const { error: expError } = await db.from('expenses').insert({
          org_id: ctx.orgId,
          project_id: body.project_id,
          amount: body.total_amount,
          date: body.receipt_date,
          rubro_id: body.rubro_id || null,
          receipt_id: receipt.id,
          paid_by: body.paid_by || null,
          description: `Comprobante ${body.receipt_number ?? ''}`.trim() || null,
          created_by: ctx.dbUserId,
        });
        if (expError) {
          // Rollback: delete receipt (items cascade)
          await db.from('receipts').delete().eq('id', receipt.id);
          return dbError(expError, 'insert', { route: '/api/receipts (expense)' });
        }
      } else if (body.category === 'income') {
        const { error: incError } = await db.from('incomes').insert({
          org_id: ctx.orgId,
          project_id: body.project_id,
          amount: body.total_amount,
          date: body.receipt_date,
          receipt_id: receipt.id,
          description: `Comprobante ${body.receipt_number ?? ''}`.trim() || null,
          created_by: ctx.dbUserId,
        });
        if (incError) {
          await db.from('receipts').delete().eq('id', receipt.id);
          return dbError(incError, 'insert', { route: '/api/receipts (income)' });
        }
      }
    }
  }

  return NextResponse.json(receipt, { status: 201 });
}
