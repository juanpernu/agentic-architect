import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { randomUUID } from 'crypto';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No se proporcionó un archivo' }, { status: 400 });

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'El archivo debe ser una imagen (JPEG, PNG, WebP)' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'El archivo debe pesar menos de 2MB' }, { status: 400 });
  }

  const db = getDb();

  const ext = EXT_MAP[file.type] ?? 'png';
  const path = `org-logos/${ctx.orgId}/${randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await db.storage
    .from('org-assets')
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  // Save logo path to organization, then clean up old file
  const { data: updatedOrg, error: updateError } = await db
    .from('organizations')
    .select('logo_url')
    .eq('id', ctx.orgId)
    .single();

  const oldLogoUrl = updatedOrg?.logo_url;

  const { data, error: saveError } = await db
    .from('organizations')
    .update({ logo_url: path })
    .eq('id', ctx.orgId)
    .select()
    .single();

  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });

  // Remove old logo file after DB update (minimizes orphan risk)
  if (oldLogoUrl && oldLogoUrl !== path && !oldLogoUrl.startsWith('http')) {
    await db.storage.from('org-assets').remove([oldLogoUrl]);
  }

  // Generate signed URL for immediate preview
  const { data: signedData } = await db.storage
    .from('org-assets')
    .createSignedUrl(path, 3600);

  return NextResponse.json({
    logo_url: path,
    signed_url: signedData?.signedUrl ?? null,
    organization: data,
  });
}
