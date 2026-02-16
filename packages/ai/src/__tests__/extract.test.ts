import { describe, it, expect } from 'vitest';
import { parseExtractionResponse, validateExtractionResult } from '../extract';
import type { ExtractionResult } from '@architech/shared';

const FULL_RESPONSE = {
  supplier: {
    name: 'ILUMINART',
    responsible_person: 'Chiaramonte Mariano',
    cuit: '20-29150183-5',
    iibb: '20291501835',
    address: {
      street: 'Arenales 1811',
      locality: 'CABA',
      province: 'Buenos Aires',
      postal_code: '1124',
    },
    activity_start_date: '2013-11-01',
    fiscal_condition: 'IVA Responsable Inscripto',
  },
  receipt: {
    code: '081',
    type: 'Tique Factura A',
    number: '00004-00004739',
    date: '2026-02-13',
    time: '11:10:47',
  },
  items: [
    { description: 'FERRETERIA', quantity: 21, unit_price: 366, subtotal: 7685.95 },
  ],
  totals: {
    net_amount: 7685.95,
    iva_rate: 21,
    iva_amount: 1614.05,
    total: 9300,
  },
  confidence: 0.92,
};

describe('parseExtractionResponse', () => {
  it('parses a full v2 extraction response', () => {
    const raw = JSON.stringify(FULL_RESPONSE);
    const result = parseExtractionResponse(raw);

    expect(result.supplier.name).toBe('ILUMINART');
    expect(result.supplier.cuit).toBe('20-29150183-5');
    expect(result.supplier.address.street).toBe('Arenales 1811');
    expect(result.receipt.type).toBe('Tique Factura A');
    expect(result.receipt.date).toBe('2026-02-13');
    expect(result.items).toHaveLength(1);
    expect(result.totals.total).toBe(9300);
    expect(result.totals.iva_rate).toBe(21);
    expect(result.confidence).toBe(0.92);
  });

  it('handles response with null/missing fields', () => {
    const raw = JSON.stringify({
      supplier: { name: null },
      receipt: {},
      items: [],
      totals: { total: 1000 },
      confidence: 0.3,
    });

    const result = parseExtractionResponse(raw);
    expect(result.supplier.name).toBeNull();
    expect(result.supplier.cuit).toBeNull();
    expect(result.supplier.address.street).toBeNull();
    expect(result.receipt.code).toBeNull();
    expect(result.totals.net_amount).toBeNull();
    expect(result.totals.total).toBe(1000);
  });

  it('handles response wrapped in markdown code fences', () => {
    const inner = JSON.stringify({
      supplier: { name: 'Test' },
      receipt: { date: '2026-01-01' },
      items: [],
      totals: { total: 100 },
      confidence: 0.5,
    });
    const raw = '```json\n' + inner + '\n```';
    const result = parseExtractionResponse(raw);
    expect(result.supplier.name).toBe('Test');
    expect(result.totals.total).toBe(100);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseExtractionResponse('not json')).toThrow();
  });
});

describe('validateExtractionResult', () => {
  it('returns valid for complete extraction', () => {
    const result = parseExtractionResponse(JSON.stringify(FULL_RESPONSE));
    expect(validateExtractionResult(result).valid).toBe(true);
  });

  it('returns invalid when total is null', () => {
    const result: ExtractionResult = {
      supplier: {
        name: 'Test', responsible_person: null, cuit: null, iibb: null,
        address: { street: null, locality: null, province: null, postal_code: null },
        activity_start_date: null, fiscal_condition: null,
      },
      receipt: { code: null, type: null, number: null, date: '2026-01-01', time: null },
      items: [],
      totals: { net_amount: null, iva_rate: null, iva_amount: null, total: null },
      confidence: 0.1,
    };
    expect(validateExtractionResult(result).valid).toBe(false);
  });
});
