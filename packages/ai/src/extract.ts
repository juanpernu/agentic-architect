import Anthropic from '@anthropic-ai/sdk';
import type { ExtractionResult } from '@architech/shared';
import { EXTRACTION_PROMPT } from './prompt';

export type SupportedMimeType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

export function parseExtractionResponse(raw: string): ExtractionResult {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    vendor: parsed.vendor ?? null,
    date: parsed.date ?? null,
    total: parsed.total ?? null,
    items: (parsed.items ?? []).map((item: Record<string, unknown>) => ({
      description: String(item.description ?? ''),
      quantity: Number(item.quantity ?? 1),
      unit_price: Number(item.unit_price ?? 0),
      subtotal: Number(item.subtotal ?? 0),
    })),
    confidence: Number(parsed.confidence ?? 0),
  };
}

export function validateExtractionResult(result: ExtractionResult): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (result.total === null || result.total === undefined) {
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
