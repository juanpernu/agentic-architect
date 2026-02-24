import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { validateBody } from '@/lib/validate';
import { projectUpdateSchema } from '@/lib/schemas';
import { dbError } from '@/lib/api-error';

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

  const result = await validateBody(projectUpdateSchema, req);
  if ('error' in result) return result.error;
  const updates = result.data;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
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

  const { data, error } = await db
    .from('projects')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .select()
    .single();

  if (error) return dbError(error, 'update', { route: '/api/projects/[id]' });
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

  if (error) return dbError(error, 'delete', { route: '/api/projects/[id]' });
  return NextResponse.json({ deleted: true });
}
