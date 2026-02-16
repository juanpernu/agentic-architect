import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

const VALID_STATUSES = ['active', 'paused', 'completed'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { id } = await params;
  const db = getDb();

  const { data, error } = await db
    .from('projects')
    .select('*, architect:users!architect_id(id, full_name, email, avatar_url)')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
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

  // Validate status if provided
  if (body.status && !VALID_STATUSES.includes(body.status as string)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  const db = getDb();

  // Supervisors can only update their own projects
  if (ctx.role === 'supervisor') {
    const { data: project } = await db
      .from('projects')
      .select('architect_id')
      .eq('id', id)
      .eq('organization_id', ctx.orgId)
      .single();
    if (project?.architect_id !== ctx.dbUserId) return forbidden();
  }

  const updateFields: Record<string, unknown> = {};
  if (body.name) updateFields.name = body.name;
  if (body.address !== undefined) updateFields.address = body.address;
  if (body.status) updateFields.status = body.status;
  if (body.architect_id !== undefined) updateFields.architect_id = body.architect_id;

  const { data, error } = await db
    .from('projects')
    .update(updateFields)
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const { id } = await params;
  const db = getDb();

  const { error } = await db
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
