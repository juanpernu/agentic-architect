import { getSupabaseAdmin } from '@architech/db';

export function getDb() {
  return getSupabaseAdmin();
}
