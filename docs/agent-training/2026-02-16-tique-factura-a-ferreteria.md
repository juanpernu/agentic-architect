# Training Case: Tique Factura A — Ferretería

**Date:** 2026-02-16
**Status:** Success (after prompt iterations)
**Ticket type:** Tique Factura A (Cod. 081)
**Source image:** test-ticket.jpeg (ILUMINART, Arenales 1811, CABA)

---

## Correct Extraction

```json
{
  "supplier": {
    "name": "ILUMINART",
    "responsible_person": "Chiaramonte Mariano",
    "cuit": "20-29150183-5",
    "iibb": "20291501835",
    "address": {
      "street": "Arenales 1811",
      "locality": "CABA",
      "province": "Buenos Aires",
      "postal_code": "1124"
    },
    "activity_start_date": "2013-11-01",
    "fiscal_condition": "IVA Responsable Inscripto"
  },
  "receipt": {
    "code": "081",
    "type": "Tique Factura A",
    "number": "00004-00004739",
    "date": "2026-02-13",
    "time": "11:10:47"
  },
  "items": [
    {
      "description": "FERRETERIA",
      "quantity": 1,
      "unit_price": 7685.95,
      "subtotal": 7685.95
    }
  ],
  "totals": {
    "net_amount": 7685.95,
    "iva_rate": 21,
    "iva_amount": 1614.05,
    "total": 9300.00
  }
}
```

## Ticket Layout (Zones)

```
┌─────────────────────────────────────────┐
│ ZONA VERDE — Emisor/Proveedor           │
│ ILUMINART                               │
│ CUIT: 20-29150183-5                     │
│ Arenales 1811, CABA, Buenos Aires       │
│ IVA Responsable Inscripto               │
├─────────────────────────────────────────┤
│ ZONA AMARILLA — Datos del comprobante   │
│ Cod. 081 - Tique Factura A             │
│ Nro. 00004-00004739                     │
│ Fecha 13/02/2026  Hora 11:10:47        │
├─────────────────────────────────────────┤
│ ZONA VIOLETA — Receptor (IGNORAR)       │
│ NESTOBRAS S.A.                          │
│ CUIT 30717717089                        │
│ IVA Responsable Inscripto               │
├─────────────────────────────────────────┤
│ ZONA CYAN — Detalle de compra           │
│ Cant./Precio Unit.                      │
│ Descripción (%IVA)[%BI]     IMPORTE    │
│ FERRETERIA    (21)           $7685,95   │
│ SUBTOT IMP NETO GRAVADO      $7685,95   │
│ Alicuota 21%                 $1614,05   │
│ TOTAL                        $9300,00   │
└─────────────────────────────────────────┘
```

## Pitfalls Encountered

### 1. Emisor vs Receptor confusion
- **Problem:** AI extracted NESTOBRAS (receptor) instead of ILUMINART (emisor)
- **Root cause:** Both entities have similar fields (name, CUIT, fiscal condition). Without explicit positioning guidance, the AI picked the wrong one.
- **Fix:** Prompt must describe exact layout position — emisor is FIRST entity at the TOP, receptor appears AFTER the receipt metadata section.

### 2. IVA aliquot confused with quantity
- **Problem:** `(21)` next to item line was interpreted as quantity=21 instead of IVA rate=21%
- **Root cause:** The column header says `(%IVA)` but the AI ignored it and treated `(21)` as quantity.
- **Fix:** Prompt must explicitly state that numbers in parentheses are IVA percentages, not quantities. Must also instruct to never invent values — use IMPORTE as subtotal directly.

### 3. Invented unit prices
- **Problem:** When AI used 21 as quantity, it invented a unit price to make the math work (e.g., $326 or $7685.95) instead of reading actual values from the ticket.
- **Root cause:** The ticket doesn't show quantity/unit_price explicitly for this line. Only the IMPORTE ($7685,95) is shown.
- **Fix:** Prompt must instruct: if qty/unit_price not explicitly visible, default to quantity=1 and unit_price=IMPORTE.

### 4. CUIT digit misread
- **Problem:** AI returned CUIT "30-71771089" (10 digits) instead of "30-71771708-9" (11 digits)
- **Root cause:** OCR-level misread of digits from the image
- **Fix:** CUIT validation should be lenient — discard invalid CUITs (set to null) instead of blocking the receipt confirmation with a 400 error.

## Prompt Evolution

| Version | Issue | Change |
|---------|-------|--------|
| v1 | Generic, no Argentine specifics | Added structured zones, Argentine fiscal fields |
| v2 | AI picked receptor instead of emisor | Added "extract only SUPPLIER, NOT receiver" |
| v3 | AI still picked receptor | Added exact layout positions (emisor=top, receptor=after metadata) |
| v4 | (21) read as quantity | Added "numbers in parentheses are IVA %" |
| v5 | AI still used (21) as qty, invented prices | Added 4 critical rules: never invent, use IMPORTE as subtotal, default qty=1 |
