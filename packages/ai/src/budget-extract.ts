import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';
import { BUDGET_IMPORT_PROMPT } from './budget-prompt';

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TEXT_LENGTH = 50_000;

export interface BudgetImportItem {
  description: string;
  unit: string;
  quantity: number;
  cost: number;
  subtotal: number;
}

export interface BudgetImportSection {
  rubro_name: string;
  is_additional: boolean;
  section_subtotal: number | null;
  section_cost: number | null;
  items: BudgetImportItem[];
}

export interface BudgetImportResult {
  sections: BudgetImportSection[];
  confidence: number;
  warnings: string[];
}

/**
 * Parse an Excel buffer into a text tabular representation.
 * Each sheet is separated by a header line: --- Hoja: "SheetName" ---
 */
export function parseExcelToText(buffer: Buffer, fileName: string): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const csv = XLSX.utils.sheet_to_csv(sheet);
    const trimmed = csv.trim();
    if (!trimmed || trimmed.replace(/,/g, '').trim().length === 0) continue;

    parts.push(`--- Hoja: "${sheetName}" ---`);
    parts.push(trimmed);
  }

  if (parts.length === 0) {
    throw new Error('El Excel no contiene datos');
  }

  let text = parts.join('\n\n');
  if (text.length > MAX_TEXT_LENGTH) {
    text = text.slice(0, MAX_TEXT_LENGTH);
  }

  return text;
}

/**
 * Parse Claude's JSON response, stripping potential markdown fences.
 */
export function parseBudgetImportResponse(raw: string): BudgetImportResult {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const sections: BudgetImportSection[] = (parsed.sections ?? []).map(
    (s: Record<string, unknown>) => ({
      rubro_name: String(s.rubro_name ?? 'Sin nombre'),
      is_additional: Boolean(s.is_additional ?? false),
      section_subtotal: s.section_subtotal != null ? Number(s.section_subtotal) : null,
      section_cost: s.section_cost != null ? Number(s.section_cost) : null,
      items: (Array.isArray(s.items) ? s.items : []).map(
        (item: Record<string, unknown>) => ({
          description: String(item.description ?? ''),
          unit: String(item.unit ?? 'gl'),
          quantity: Number(item.quantity ?? 1),
          cost: Number(item.cost ?? 0),
          subtotal: Number(item.subtotal ?? 0),
        })
      ),
    })
  );

  return {
    sections,
    confidence: Number(parsed.confidence ?? 0),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
  };
}

/**
 * Main extraction function: parse Excel → call Claude → return structured result.
 */
export async function extractBudgetData(
  fileBuffer: Buffer,
  fileName: string
): Promise<BudgetImportResult> {
  const tabularText = parseExcelToText(fileBuffer, fileName);

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: BUDGET_IMPORT_PROMPT },
            { type: 'text', text: `\n\n## Contenido del Excel "${fileName}":\n\n${tabularText}` },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    return parseBudgetImportResponse(textBlock.text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Error al interpretar el presupuesto. Intentá de nuevo.');
    }
    if (error instanceof Error && error.message === 'No text response from Claude') {
      throw error;
    }
    console.error('[extractBudgetData] Anthropic API error:', error);
    throw new Error('Failed to extract budget data', { cause: error });
  }
}
