import { getSupabaseAdmin } from '@obralink/db';

export function getDb() {
  return getSupabaseAdmin();
}
