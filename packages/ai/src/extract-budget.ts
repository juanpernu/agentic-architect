import Anthropic from '@anthropic-ai/sdk';
import { BUDGET_EXTRACTION_PROMPT } from './budget-prompt';

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

export interface BudgetExtractionItem {
  description: string;
  unit: string;
  quantity: number;
  cost: number;
  subtotal: number;
}

export interface BudgetExtractionSection {
  rubro_name: string;
  is_additional: boolean;
  subtotal?: number;
  cost?: number;
  items: BudgetExtractionItem[];
}

export interface BudgetExtractionResult {
  sections: BudgetExtractionSection[];
  confidence: number;
}

export function parseBudgetExtractionResponse(raw: string): BudgetExtractionResult {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const sections: BudgetExtractionSection[] = (parsed.sections ?? []).map(
    (s: Record<string, unknown>) => ({
      rubro_name: String(s.rubro_name ?? 'Sin nombre'),
      is_additional: Boolean(s.is_additional),
      subtotal: s.subtotal != null ? Number(s.subtotal) : undefined,
      cost: s.cost != null ? Number(s.cost) : undefined,
      items: ((s.items as Record<string, unknown>[]) ?? []).map(
        (i: Record<string, unknown>) => ({
          description: String(i.description ?? ''),
          unit: String(i.unit ?? 'gl'),
          quantity: Number(i.quantity ?? 1),
          cost: Number(i.cost ?? 0),
          subtotal: Number(i.subtotal ?? 0),
        })
      ),
    })
  );

  return {
    sections,
    confidence: Number(parsed.confidence ?? 0),
  };
}

export async function extractBudgetFromText(
  textContent: string
): Promise<BudgetExtractionResult> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: BUDGET_EXTRACTION_PROMPT + textContent,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return parseBudgetExtractionResponse(textBlock.text);
}

export async function extractBudgetFromImages(
  images: Array<{ base64: string; mimeType: 'image/png' | 'image/jpeg' }>
): Promise<BudgetExtractionResult> {
  const client = new Anthropic();

  const content: Anthropic.Messages.ContentBlockParam[] = images.map((img) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: img.mimeType,
      data: img.base64,
    },
  }));

  content.push({ type: 'text', text: BUDGET_EXTRACTION_PROMPT });

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 8192,
    messages: [{ role: 'user', content }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return parseBudgetExtractionResponse(textBlock.text);
}
