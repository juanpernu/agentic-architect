import crypto from 'crypto';
import { env } from '../env';

/**
 * Verify Mercado Pago webhook signature.
 *
 * MP sends x-signature header with format: "ts=TIMESTAMP,v1=HASH"
 * The HMAC-SHA256 is computed over: "id:{dataId};request-id:{requestId};ts:{ts};"
 *
 * @see https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks
 */
export function verifyWebhookSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string
): boolean {
  if (!xSignature || !xRequestId || !dataId) return false;

  const parts = xSignature.split(',');
  const tsEntry = parts.find((p) => p.trim().startsWith('ts='));
  const v1Entry = parts.find((p) => p.trim().startsWith('v1='));
  if (!tsEntry || !v1Entry) return false;

  const ts = tsEntry.split('=')[1]?.trim();
  const receivedSig = v1Entry.split('=')[1]?.trim();
  if (!ts || !receivedSig) return false;

  const template = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expectedSig = crypto
    .createHmac('sha256', env.MP_WEBHOOK_SECRET)
    .update(template)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(receivedSig, 'hex'),
    Buffer.from(expectedSig, 'hex')
  );
}
