import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb, getSignedImageUrl } from '@/lib/supabase';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { id } = await params;
  const db = getDb();

  const { data, error } = await db
    .from('receipts')
    .select('*, project:projects!inner(id, name, color, organization_id), uploader:users!uploaded_by(id, full_name), receipt_items(*)')
    .eq('id', id)
    .eq('project.organization_id', ctx.orgId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Generate signed URL for the receipt image
  if (data.image_url) {
    data.image_url = await getSignedImageUrl(data.image_url);
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const { id } = await params;
  const db = getDb();

  // Verify the receipt belongs to the org before deleting
  const { data: receipt } = await db
    .from('receipts')
    .select('id, projects!inner(organization_id)')
    .eq('id', id)
    .eq('projects.organization_id', ctx.orgId)
    .single();

  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await db.from('receipts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
