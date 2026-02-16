import { describe, it, expect } from 'vitest';
import { parseExtractionResponse, validateExtractionResult } from '../extract';
import type { ExtractionResult } from '@architech/shared';

describe('parseExtractionResponse', () => {
  it('parses valid JSON extraction response', () => {
    const raw = JSON.stringify({
      vendor: 'Ferretería López',
      date: '2026-01-15',
      total: 45000.50,
      items: [
        { description: 'Cemento x 50kg', quantity: 10, unit_price: 3500, subtotal: 35000 },
        { description: 'Arena x m3', quantity: 2, unit_price: 5000.25, subtotal: 10000.50 },
      ],
      confidence: 0.92,
    });

    const result = parseExtractionResponse(raw);
    expect(result.vendor).toBe('Ferretería López');
    expect(result.total).toBe(45000.50);
    expect(result.items).toHaveLength(2);
    expect(result.confidence).toBe(0.92);
  });

  it('handles response with null fields', () => {
    const raw = JSON.stringify({
      vendor: null,
      date: null,
      total: 1000,
      items: [],
      confidence: 0.3,
    });

    const result = parseExtractionResponse(raw);
    expect(result.vendor).toBeNull();
    expect(result.date).toBeNull();
    expect(result.confidence).toBe(0.3);
  });

  it('handles response wrapped in markdown code fences', () => {
    const raw = '```json\n{"vendor":"Test","date":null,"total":100,"items":[],"confidence":0.5}\n```';
    const result = parseExtractionResponse(raw);
    expect(result.vendor).toBe('Test');
    expect(result.total).toBe(100);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseExtractionResponse('not json')).toThrow();
  });
});

describe('validateExtractionResult', () => {
  it('returns valid for complete extraction', () => {
    const result: ExtractionResult = {
      vendor: 'Test',
      date: '2026-01-01',
      total: 1000,
      items: [{ description: 'Item', quantity: 1, unit_price: 1000, subtotal: 1000 }],
      confidence: 0.9,
    };
    expect(validateExtractionResult(result).valid).toBe(true);
  });

  it('returns invalid when total is null', () => {
    const result: ExtractionResult = {
      vendor: 'Test',
      date: '2026-01-01',
      total: null,
      items: [],
      confidence: 0.1,
    };
    expect(validateExtractionResult(result).valid).toBe(false);
  });
});
