import Anthropic from '@anthropic-ai/sdk';
import type { ExtractionResult } from '@architech/shared';
import { EXTRACTION_PROMPT } from './prompt';

export type SupportedMimeType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

export function parseExtractionResponse(raw: string): ExtractionResult {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const address = parsed.supplier?.address ?? {};

  return {
    supplier: {
      name: parsed.supplier?.name ?? null,
      responsible_person: parsed.supplier?.responsible_person ?? null,
      cuit: parsed.supplier?.cuit ?? null,
      iibb: parsed.supplier?.iibb ?? null,
      address: {
        street: address.street ?? null,
        locality: address.locality ?? null,
        province: address.province ?? null,
        postal_code: address.postal_code ?? null,
      },
      activity_start_date: parsed.supplier?.activity_start_date ?? null,
      fiscal_condition: parsed.supplier?.fiscal_condition ?? null,
    },
    receipt: {
      code: parsed.receipt?.code ?? null,
      type: parsed.receipt?.type ?? null,
      number: parsed.receipt?.number ?? null,
      date: parsed.receipt?.date ?? null,
      time: parsed.receipt?.time ?? null,
    },
    items: (parsed.items ?? []).map((item: Record<string, unknown>) => ({
      description: String(item.description ?? ''),
      quantity: Number(item.quantity ?? 1),
      unit_price: Number(item.unit_price ?? 0),
      subtotal: Number(item.subtotal ?? 0),
    })),
    totals: {
      net_amount: parsed.totals?.net_amount != null ? Number(parsed.totals.net_amount) : null,
      iva_rate: parsed.totals?.iva_rate != null ? Number(parsed.totals.iva_rate) : null,
      iva_amount: parsed.totals?.iva_amount != null ? Number(parsed.totals.iva_amount) : null,
      total: parsed.totals?.total != null ? Number(parsed.totals.total) : null,
    },
    confidence: Number(parsed.confidence ?? 0),
  };
}

export function validateExtractionResult(result: ExtractionResult): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (result.totals.total === null || result.totals.total === undefined) {
    errors.push('Total amount is required');
  }
  if (result.confidence < 0 || result.confidence > 1) {
    errors.push('Confidence must be between 0 and 1');
  }
  return { valid: errors.length === 0, errors };
}

export async function extractReceiptData(imageBase64: string, mimeType: SupportedMimeType = 'image/jpeg'): Promise<ExtractionResult> {
  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imageBase64,
              },
            },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude Vision');
    }

    return parseExtractionResponse(textBlock.text);
  } catch (error) {
    if (error instanceof Error && error.message === 'No text response from Claude Vision') {
      throw error;
    }
    console.error('[extractReceiptData] Anthropic API error:', error);
    throw new Error('Failed to extract receipt data', { cause: error });
  }
}
