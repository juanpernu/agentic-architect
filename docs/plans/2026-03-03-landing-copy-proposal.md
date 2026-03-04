# Landing Page — Propuesta de Contenido v2

> Basado en feedback de arquitecta profesional del rubro (REV. 01)
> Fecha: 2026-03-03
> Referencia: `docs/plans/2026-03-03-landing-copy-review.md`

---

## Público objetivo — Corrección de targeting

**Antes:** Estudios de arquitectura
**Después:** Profesionales de la construcción (constructores, ingenieros, arquitectos directores de obra, maestros mayores de obra)

Este cambio de framing impacta toda la landing. El producto resuelve el control **financiero** de obras, no la gestión integral. Los usuarios son quienes manejan compras, pagos a proveedores y seguimiento de gastos — no necesariamente los que dibujan planos.

---

## Sección 1 — Hero

### Headline

Sin cambios. "Sabé exactamente cuánto ganás en cada obra" es fuerte y preciso.

### Subtítulo

**Actual:**
> Agentect reemplaza tus planillas de Excel con presupuestos integrados, seguimiento de gastos por rubro y control de rentabilidad en tiempo real. Diseñado para estudios de arquitectura que quieren crecer.

**Propuesta A (recomendada):**
> Agentect reemplaza tus planillas de Excel con presupuestos integrados, seguimiento de gastos por rubro y control de rentabilidad en tiempo real. Diseñado para profesionales de la construcción que quieren tener sus obras en orden.

**Propuesta B:**
> Presupuestos integrados, seguimiento de gastos por rubro y control financiero en tiempo real. Dejá Excel atrás y sabé exactamente cuánto entra y cuánto sale en cada obra.

**Razonamiento:**
- "profesionales de la construcción" es inclusivo (arquitectos, ingenieros, constructores, MMO)
- "tener sus obras en orden" refleja el valor real (organización) en vez de "crecer" (promesa que la herramienta no cumple directamente)
- Propuesta B elimina "Diseñado para..." y apuesta al beneficio directo

### Trust badges

Sin cambios. "Sin tarjeta de crédito" y "Setup en 5 minutos" son efectivos como reductores de fricción.

### Metadata OpenGraph

**Actual:** "Gestión de obras para estudios que quieren crecer"
**Propuesta:** "Control financiero de obras para profesionales de la construcción"

---

## Sección 2 — Comparison ("El problema que todo estudio conoce")

### Título

**Actual:** "El problema que todo estudio conoce"

**Propuesta A (recomendada):**
> El problema que todo constructor conoce

**Propuesta B:**
> El problema de siempre en la construcción

### Subtítulo

**Actual:**
> Presupuestás en Excel, cargás gastos a mano, y al final de la obra no sabés si ganaste o perdiste.

**Propuesta A (recomendada):**
> Presupuestás en Excel, cargás gastos a mano, y al final de la obra no sabés exactamente cuánto ganaste.

**Propuesta B:**
> Presupuestás en Excel, cargás gastos a mano, y al final de la obra no sabés exactamente cuánto gastaste ni cuánto ganaste.

**Razonamiento:** Nadie "pierde plata" haciendo obras — si perdieras, cambiarías de rubro. El dolor real es la **falta de visibilidad**: no saber los números exactos. Esto es más creíble y resuena con la experiencia cotidiana del profesional.

### Card "Hoy" — Tercer bullet

**Actual:**
> Recién al cerrar la obra descubrís que perdiste plata.

**Propuesta A (recomendada):**
> Recién al cerrar la obra sabés exactamente cuánto ganaste.

**Propuesta B:**
> Al final de la obra, los números nunca cierran como esperabas.

**Propuesta C:**
> Terminás la obra sin saber cuánto quedó de ganancia real.

---

## Sección 3 — Features

### Título de sección

**Actual:** "Todo lo que necesitás para controlar tus obras"

**Propuesta A (recomendada):**
> Todo lo que necesitás para el control financiero de tus obras

**Propuesta B:**
> Todo lo que necesitás para controlar las finanzas de tus obras

**Propuesta C:**
> Controlá ingresos, egresos y rentabilidad de cada obra

**Razonamiento:** "Control de obras" en el rubro abarca certificados, tareas, materiales, cronograma, etc. Agentect solo cubre lo financiero. Especificarlo evita generar expectativas falsas y posiciona mejor el producto.

### Feature 1 — Presupuestos: descripción

**Actual:**
> Editor integrado con rubros, ítems, unidades y costos. Publicá versiones y compartí con tu cliente.

**Propuesta A (recomendada):**
> Editor integrado con rubros, ítems, unidades y costos. Publicá versiones, exportá a PDF y envialo a tu cliente.

**Propuesta B:**
> Armá tu presupuesto con rubros y costos detallados. Publicá versiones y exportá a PDF listo para enviar.

**Razonamiento:** Un presupuesto de cientos de miles de dólares no se "comparte" casualmente. El flujo real es: armar, revisar varias veces, exportar a PDF, y enviar por mail con un texto profesional. "Exportá a PDF y envialo" refleja ese proceso sin sonar informal.

### Feature 2 — Rentabilidad por rubro: badge "Costo"

**Actual:** Badge dice "Costo"

**Propuesta (recomendada):**
> Renombrar a **"Preventivo"**

**Alternativa:**
> "Costo Preventivo"

**Razonamiento:** En la jerga de construcción, el costo estimado previo a la ejecución se llama "preventivo" o "costo preventivo". "Costo" a secas se confunde con "gasto real" (la tercera barra). "Preventivo" es inmediatamente claro para cualquier profesional del rubro.

**Nota:** Evaluar si este renaming también debería aplicarse dentro de la app (budget editor, vs-budget table) como mejora separada.

### Feature 3 — Seguimiento por obra: descripción

**Actual:**
> Ingresos, egresos y comprobantes centralizados por proyecto. Sabé al instante cuánto va cada obra.

**Propuesta A (recomendada):**
> Ingresos, egresos y facturas centralizados por proyecto. Sabé al instante el estado financiero de cada obra.

**Propuesta B:**
> Ingresos, egresos y facturas centralizados por proyecto. Sabé al instante cómo viene cada obra.

**Razonamiento:** "Cuánto va cada obra" es ambiguo. "El estado financiero" es más preciso. También se reemplaza "comprobantes" por "facturas" (ver Issue 7).

---

## Sección 4 — Facilitator (Escáner AI)

### Título

Sin cambios. "Cargá los gastos de tu obra en segundos" es claro y directo.

### Descripción

**Actual:**
> Sacale una foto al comprobante y Agentect extrae proveedor, monto, CUIT y fecha automáticamente. Vos solo confirmás.

**Propuesta A (recomendada):**
> Sacale una foto a la factura de compra y Agentect extrae proveedor, monto, CUIT y fecha automáticamente. Vos asignás a qué obra corresponde y confirmás.

**Propuesta B:**
> Sacale una foto a la factura que recibiste y Agentect extrae los datos automáticamente. Vos asignás la obra y confirmás.

**Razonamiento:**
1. "Factura" es más concreto que "comprobante" — el profesional sabe inmediatamente de qué se habla
2. "Vos solo confirmás" omite un paso clave (asignar obra) que además es un diferencial del producto
3. "Factura de compra" es el término más "for dummies" y claro

---

## Sección 5 — Pricing

Sin cambios de estructura. La arquitecta dio feedback positivo.

**Micro-cambio sugerido:** En las features de los planes, considerar cambiar "comprobantes" por "facturas" para consistencia con el cambio de la sección 4:
- "20 comprobantes por proyecto" → "20 facturas por proyecto"
- "Comprobantes ilimitados" → "Facturas ilimitadas"

---

## Sección 6 — CTA Final

Sin cambios. Feedback positivo ("NICE =)").

---

## Resumen de cambios

| # | Sección | Tipo | Cambio principal |
|---|---------|------|-----------------|
| 1 | Hero subtítulo | Wording | "estudios de arquitectura que quieren crecer" → "profesionales de la construcción que quieren tener sus obras en orden" |
| 2 | Hero metadata | SEO | OG description alineada al nuevo targeting |
| 3 | Comparison título | Wording | "estudio" → "constructor" |
| 4 | Comparison subtítulo | Wording | "no sabés si ganaste o perdiste" → "no sabés exactamente cuánto ganaste" |
| 5 | Comparison card Hoy | Wording | "perdiste plata" → reformular sin exagerar |
| 6 | Features título | Wording | "controlar tus obras" → "control financiero de tus obras" |
| 7 | Features presupuestos | Wording | "compartí con tu cliente" → "exportá a PDF y envialo" |
| 8 | Features chart badge | Terminología | "Costo" → "Preventivo" |
| 9 | Features tabla desc | Wording | "cuánto va cada obra" → "el estado financiero de cada obra" |
| 10 | Facilitator desc | Wording | "comprobante" → "factura de compra", agregar paso de asignar obra |
| 11 | Pricing features | Consistencia | "comprobantes" → "facturas" (opcional) |

---

## Notas de implementación

- Todos los cambios son de texto — no requieren cambios de diseño ni estructura
- Archivo principal afectado: `apps/web/app/(marketing)/page.tsx`
- El cambio de "Costo" → "Preventivo" podría tener impacto en la app si se decide alinear la terminología (scope separado)
- El cambio de "comprobante" → "factura" en pricing es opcional y podría evaluarse para la app completa como proyecto de UX writing separado
