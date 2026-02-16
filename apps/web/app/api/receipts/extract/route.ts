import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { extractReceiptData } from '@architech/ai';

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const body = await req.json();
  const { image_base64, mime_type } = body;

  if (!image_base64) {
    return NextResponse.json({ error: 'image_base64 is required' }, { status: 400 });
  }

  try {
    const result = await extractReceiptData(image_base64, mime_type ?? 'image/jpeg');
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Extraction failed';
    const cause = error instanceof Error && error.cause
      ? (error.cause instanceof Error ? error.cause.message : String(error.cause))
      : undefined;
    return NextResponse.json({ error: message, ...(cause && { detail: cause }) }, { status: 500 });
  }
}
