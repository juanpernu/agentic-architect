import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { extractReceiptData } from '@architech/ai';
import { apiError } from '@/lib/api-error';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const rl = rateLimit('extract', ctx.orgId);
  if (rl) return rl;

  const body = await req.json();
  const { image_base64, mime_type } = body;

  if (!image_base64) {
    return NextResponse.json({ error: 'image_base64 is required' }, { status: 400 });
  }

  try {
    const result = await extractReceiptData(image_base64, mime_type ?? 'image/jpeg');
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, 'Error al procesar el comprobante', 500, { route: '/api/receipts/extract' });
  }
}
