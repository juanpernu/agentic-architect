import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { randomUUID } from 'crypto';
import { dbError } from '@/lib/api-error';
import { rateLimit } from '@/lib/rate-limit';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const rl = rateLimit('upload', ctx.orgId);
  if (rl) return rl;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File must be an image (JPEG, PNG, WebP, HEIC)' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File size must be under 10MB' }, { status: 400 });
  }

  const db = getDb();
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? 'jpg';
  const path = `${ctx.orgId}/${randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await db.storage
    .from('receipts')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) return dbError(error, 'upload', { route: '/api/receipts/upload' });

  // Generate a signed URL for immediate preview (1 hour)
  const { data: signedData, error: signedError } = await db.storage
    .from('receipts')
    .createSignedUrl(path, 3600);

  if (signedError) return dbError(signedError, 'select', { route: '/api/receipts/upload' });

  return NextResponse.json({
    image_url: signedData.signedUrl,
    storage_path: path,
  });
}
