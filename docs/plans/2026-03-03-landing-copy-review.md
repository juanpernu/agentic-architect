# Landing Page — Review de Contenido y Wording

> Feedback de arquitecta (profesional del rubro). Documento REV. 01.
> Fecha: 2026-03-03

---

## Resumen

La arquitecta revisó la landing completa y marcó **6 problemas de contenido** relacionados con terminología incorrecta del rubro, frases que no resuenan con el público objetivo, y oportunidades de ser más claro. Las secciones de Pricing y CTA final recibieron feedback positivo ("NICE"). El chart de rentabilidad por rubro fue elogiado ("SIMPLEMENTE HERMOSO").

---

## Issue 1 — "estudios de arquitectura" es incorrecto como público objetivo

**Sección:** Hero (subtítulo)
**Texto actual:** "Diseñado para estudios de arquitectura que quieren crecer."
**Problema:** Los estudios de arquitectura no construyen. Hacen proyecto y dirección de obra (no tienen gastos de compras de materiales, sino software, personal tipo dibujantes, directores de obra, etc.). La construcción está a cargo del **constructor** — ya sea ingeniero, arquitecto, maestro mayor de obras, o cualquier otro profesional que se autoperciba así.
**Segundo problema:** "que quieren crecer" no encaja. La herramienta no hace crecer el negocio, lo **ordena**.

**Sugerencias de la arquitecta:**
- "Diseñado para profesionales de la construcción que quieren llevar un trackeo financiero de sus obras transparente y actualizado"
- Usar "constructor" o "profesional de la construcción" en lugar de "estudio de arquitectura"
- Reemplazar "que quieren crecer" por algo que refleje orden/control

**Archivos afectados:**
- `apps/web/app/(marketing)/page.tsx` — líneas 87-89 (subtítulo hero)
- Metadata OpenGraph línea 9: "Gestión de obras para estudios que quieren crecer"

---

## Issue 2 — "no sabés si ganaste o perdiste" es exagerado

**Sección:** Comparison (título + card "Hoy")
**Textos actuales:**
- Título: "El problema que todo **estudio** conoce"
- Subtítulo: "...al final de la obra no sabés si ganaste o **perdiste**"
- Card "Hoy": "Recién al cerrar la obra descubrís que **perdiste plata**"

**Problema:** Nadie pierde haciendo obras. Si perdés, te dedicás a otra cosa. El dolor real es no saber **exactamente cuánto ganaste o cuánto gastaste**, no "perder plata". La frase actual suena poco creíble para el profesional del rubro.

**Sugerencias de la arquitecta:**
- Título: cambiar "estudio" → "constructor" o "profesional de la construcción"
- Subtítulo: "...al final de la obra, no sabés exactamente cuánto ganaste"
- Alternativa: "no sabés exactamente cuánto gastaste y cuánto ganaste"
- Card "Hoy": reformular para que hable de falta de visibilidad, no de pérdida

**Archivos afectados:**
- `apps/web/app/(marketing)/page.tsx` — líneas 124-129 (título y subtítulo comparison)
- Línea 153: texto de la card "Hoy"

---

## Issue 3 — "controlar tus obras" es demasiado amplio

**Sección:** Features (título)
**Texto actual:** "Todo lo que necesitás para controlar tus obras"
**Problema:** "Control de obras" en el rubro incluye muchísimas cosas: seguimiento de certificados, control de tareas, control de ingresos, materiales, etc. Agentect solo cubre el **aspecto financiero**. Usar "control de obras" genera expectativa de algo mucho más abarcativo.

**Sugerencia de la arquitecta:**
- Aclarar que es control **financiero**: "Todo lo que necesitás para controlar tus obras financieramente" o reformular con foco en lo económico

**Archivos afectados:**
- `apps/web/app/(marketing)/page.tsx` — líneas 203-205

---

## Issue 4 — "compartí con tu cliente" no refleja el flujo real

**Sección:** Features → Card "Armá presupuestos profesionales"
**Texto actual:** "Publicá versiones y compartí con tu cliente."
**Problema:** Un profesional no "comparte" un presupuesto de USD 200.000 así nomás. El flujo real es: armar el presupuesto, imprimirlo en PDF, revisarlo varias veces, y recién ahí enviarlo por mail con un texto bien pensado. "Compartí" suena demasiado informal y liviano para la seriedad del proceso.

**Sugerencias de la arquitecta:**
- "Armá tu presupuesto desde una plantilla prearmada, imprimilo en PDF y envialo al cliente"
- O algo que no suene tan informal

**Archivos afectados:**
- `apps/web/app/(marketing)/page.tsx` — líneas 215-217 (CardDescription del feature de presupuestos)

---

## Issue 5 — "Costo" debería ser "Costo Preventivo" o "Preventivo"

**Sección:** Features → Chart de rentabilidad por rubro (badge legend)
**Texto actual:** Badge "Costo" (segunda barra del chart, azul)
**Problema:** En el rubro de la construcción, lo que se muestra como "Costo" se conoce como "Compras" o **"preventivo"** (costo estimado previo a la obra). "Costo" a secas se confunde con "gasto real" (que es la tercera barra verde). La diferencia entre Costo y Gasto Real no queda clara.

**Sugerencia de la arquitecta:**
- Renombrar a **"Preventivo"** o **"Costo Preventivo"**

**Archivos afectados:**
- `apps/web/app/(marketing)/page.tsx` — línea 258 (badge "Costo")
- Considerar si este cambio también aplica dentro de la app (budget editor, vs-budget table)

---

## Issue 6 — "cuánto va cada obra" suena raro

**Sección:** Features → Card "Cada peso asociado a su obra"
**Texto actual:** "Sabé al instante cuánto va cada obra."
**Problema:** "Cuánto va" es una expresión ambigua y rara en este contexto.

**Sugerencia de la arquitecta:**
- "Sabé al instante el estado de cada obra"
- O alternativa que sea más clara

**Archivos afectados:**
- `apps/web/app/(marketing)/page.tsx` — líneas 301-303 (CardDescription)

---

## Issue 7 — "comprobante" debería ser "factura"

**Sección:** Facilitator (escáner AI)
**Texto actual:** "Sacale una foto al comprobante y Agentect extrae proveedor, monto, CUIT y fecha automáticamente. Vos solo confirmás."
**Problema:** "Comprobante" es técnicamente correcto pero poco claro. "Factura" es lo que el profesional entiende de inmediato. Además, "vos solo confirmás" omite un paso clave: asignar a qué obra corresponde.

**Sugerencias de la arquitecta:**
- "Sacale una foto a la factura que recibiste o emitiste"
- O: "Sacale una foto a la factura de compra" (más "for dummies")
- Agregar: "Vos asignás a qué obra corresponde y confirmás"

**Archivos afectados:**
- `apps/web/app/(marketing)/page.tsx` — líneas 380-381 (descripción del facilitator)

**Nota:** Este cambio de terminología ("comprobante" → "factura") podría evaluarse también para el resto de la landing (pricing: "20 comprobantes por proyecto", "Comprobantes ilimitados") y potencialmente para la app misma como mejora futura de UX writing.

---

## Secciones con feedback positivo

| Sección | Feedback |
|---------|----------|
| Chart rentabilidad por rubro | "SIMPLEMENTE HERMOSO" |
| Tabla seguimiento por obra | "Divino" (salvo el "cuánto va") |
| Pricing + CTA final | "NICE =)" |

---

## Prioridad sugerida

| # | Issue | Impacto | Esfuerzo |
|---|-------|---------|----------|
| 1 | "estudios de arquitectura" → público correcto | Alto — target equivocado | Bajo |
| 2 | "perdiste plata" → falta de visibilidad | Alto — credibilidad | Bajo |
| 7 | "comprobante" → "factura" | Medio — claridad | Bajo |
| 3 | "controlar" → "controlar financieramente" | Medio — expectativas | Bajo |
| 5 | "Costo" → "Preventivo" | Medio — jerga del rubro | Bajo |
| 4 | "compartí" → flujo realista | Medio — credibilidad | Bajo |
| 6 | "cuánto va" → "el estado de" | Bajo — cosmético | Bajo |

Todos los cambios son de copy (texto), no requieren cambios estructurales ni de diseño.
