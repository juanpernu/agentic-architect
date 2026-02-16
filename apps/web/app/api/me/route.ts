import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  return NextResponse.json({ role: ctx.role });
}
