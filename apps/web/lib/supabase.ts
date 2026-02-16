import { getSupabaseAdmin } from '@architech/db';

export function getDb() {
  return getSupabaseAdmin();
}

/**
 * Generate a signed URL for a receipt image stored in Supabase Storage.
 * Handles both storage paths and legacy full public URLs.
 */
export async function getSignedImageUrl(imageUrl: string): Promise<string> {
  // If it's already a full URL (legacy), extract the storage path
  const path = imageUrl.includes('/storage/v1/object/public/receipts/')
    ? imageUrl.split('/storage/v1/object/public/receipts/')[1]
    : imageUrl;

  const db = getDb();
  const { data, error } = await db.storage
    .from('receipts')
    .createSignedUrl(path, 3600); // 1 hour

  if (error || !data?.signedUrl) {
    return imageUrl; // Fallback to stored value
  }

  return data.signedUrl;
}
