'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import useSWR, { mutate } from 'swr';
import { sileo } from 'sileo';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Store,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Receipt,
  Plus,
  Trash2,
  Loader2,
  ZoomIn,
  ArrowRight,
} from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { receiptReviewSchema } from '@/lib/schemas';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { PROJECT_COLOR_HEX, COST_CENTER_COLOR_HEX } from '@/lib/project-colors';
import { cn } from '@/lib/utils';
import type { ExtractionResult, ExtractionItem, ConfirmReceiptInput, Project, CostCenter, BankAccount } from '@architech/shared';

interface ReceiptReviewProps {
  imageUrl: string;
  storagePath: string;
  extractionResult: ExtractionResult;
  preSelectedProjectId?: string;
  onDiscard: () => void;
}

interface EditableItem extends ExtractionItem {
  id: string;
  expanded: boolean;
}

export function ReceiptReview({
  imageUrl,
  storagePath,
  extractionResult,
  preSelectedProjectId,
  onDiscard,
}: ReceiptReviewProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(true);

  const [vendor, setVendor] = useState(extractionResult.supplier.name ?? '');
  const [date, setDate] = useState(extractionResult.receipt.date ?? '');
  const [total, setTotal] = useState(extractionResult.totals.total?.toString() ?? '');
  const [projectId, setProjectId] = useState(preSelectedProjectId ?? '');
  const [costCenterId, setCostCenterId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [items, setItems] = useState<EditableItem[]>(
    extractionResult.items.map((item, index) => ({
      ...item,
      id: `item-${index}`,
      expanded: false,
    }))
  );

  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const { data: projects } = useSWR<Project[]>('/api/projects', fetcher);
  const { data: costCenters } = useSWR<CostCenter[]>('/api/cost-centers', fetcher);
  const { data: bankAccounts } = useSWR<BankAccount[]>('/api/bank-accounts', fetcher);

  const confidence = extractionResult.confidence;

  const getConfidenceInfo = () => {
    if (confidence > 0.85) {
      return { label: 'Alta', icon: CheckCircle2, color: 'text-green-500' };
    } else if (confidence >= 0.6) {
      return { label: 'Media', icon: AlertCircle, color: 'text-yellow-500' };
    }
    return { label: 'Baja', icon: AlertTriangle, color: 'text-red-500' };
  };

  const confidenceInfo = getConfidenceInfo();
  const ConfidenceIcon = confidenceInfo.icon;

  const updateItem = (id: string, field: keyof ExtractionItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? Number(value) : item.quantity;
        const price = field === 'unit_price' ? Number(value) : item.unit_price;
        updated.subtotal = qty * price;
      }
      return updated;
    }));
  };

  const deleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
    if (editingItemId === id) setEditingItemId(null);
  };

  const addItem = () => {
    const newItem: EditableItem = {
      id: `item-${Date.now()}`,
      description: '',
      quantity: 1,
      unit_price: 0,
      subtotal: 0,
      expanded: false,
    };
    setItems([...items, newItem]);
    setEditingItemId(newItem.id);
    setItemsOpen(true);
  };

  const calculatedTotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  const handleConfirm = async () => {
    const result = receiptReviewSchema.safeParse({
      vendor,
      date,
      total,
      projectId,
      costCenterId,
      items,
    });

    if (!result.success) {
      const firstError = result.error.issues[0];
      sileo.error({ title: firstError.message });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: ConfirmReceiptInput = {
        project_id: projectId,
        cost_center_id: costCenterId,
        bank_account_id: bankAccountId || undefined,
        image_url: storagePath,
        ai_raw_response: { ...extractionResult },
        ai_confidence: confidence,
        supplier: {
          name: vendor,
          responsible_person: extractionResult.supplier.responsible_person,
          cuit: extractionResult.supplier.cuit,
          iibb: extractionResult.supplier.iibb,
          street: extractionResult.supplier.address.street,
          locality: extractionResult.supplier.address.locality,
          province: extractionResult.supplier.address.province,
          postal_code: extractionResult.supplier.address.postal_code,
          activity_start_date: extractionResult.supplier.activity_start_date,
          fiscal_condition: extractionResult.supplier.fiscal_condition,
        },
        receipt_type: extractionResult.receipt.type,
        receipt_code: extractionResult.receipt.code,
        receipt_number: extractionResult.receipt.number,
        receipt_date: date,
        receipt_time: extractionResult.receipt.time,
        total_amount: parseFloat(total) || calculatedTotal,
        net_amount: extractionResult.totals.net_amount,
        iva_rate: extractionResult.totals.iva_rate,
        iva_amount: extractionResult.totals.iva_amount,
        items: items.map(({ description, quantity, unit_price }) => ({
          description,
          quantity,
          unit_price,
        })),
      };

      const response = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al confirmar comprobante');
      }

      const createdReceipt = await response.json();

      sileo.success({ title: 'Comprobante confirmado con éxito' });

      await mutate('/api/receipts');
      await mutate(`/api/receipts?project_id=${projectId}`);
      await mutate(`/api/projects/${projectId}`);

      router.push(`/receipts/${createdReceipt.id}`);
    } catch (error) {
      sileo.error({
        title: error instanceof Error ? error.message : 'Error al confirmar comprobante',
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto flex flex-col min-h-screen bg-background animate-slide-up">
      {/* Header */}
      <header className="bg-card sticky top-0 z-20 px-4 py-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={onDiscard}
            className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">Revisar Comprobante</h1>
        </div>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto pb-40">
        {/* Image preview */}
        <section className="relative bg-muted border-b border-border">
          <div
            className="h-48 w-full relative overflow-hidden flex items-center justify-center group cursor-pointer"
            onClick={() => setShowImageDialog(true)}
          >
            <Image
              src={imageUrl}
              alt="Comprobante"
              fill
              className="object-cover opacity-90 group-hover:opacity-100 transition-opacity"
              sizes="(max-width: 512px) 100vw, 512px"
            />
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <span className="bg-black/50 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm flex items-center gap-1">
                <ZoomIn className="h-3.5 w-3.5" />
                Tocar para ampliar
              </span>
            </div>
          </div>
        </section>

        {/* Confidence card overlapping image */}
        <div className="px-5 -mt-6 relative z-10 mb-6">
          <div className="bg-card rounded-xl shadow-lg p-4 border border-border/50 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">
                Confianza IA
              </p>
              <div className="flex items-center gap-1.5">
                <ConfidenceIcon className={cn('h-5 w-5', confidenceInfo.color)} />
                <span className={cn('font-bold', confidenceInfo.color)}>
                  {confidenceInfo.label}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Escaneado</p>
              <p className="text-sm font-medium">Hace un momento</p>
            </div>
          </div>
        </div>

        {/* Form fields */}
        <div className="px-5 space-y-5">
          {/* Vendor */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5" htmlFor="vendor">
              Proveedor
            </label>
            <div className="relative">
              <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="vendor"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="pl-10 py-3 text-base"
                placeholder="Nombre del proveedor"
              />
            </div>
          </div>

          {/* Date + Total side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5" htmlFor="date">
                Fecha
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="pl-10 py-3 text-base"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5" htmlFor="total">
                Total
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="total"
                  type="number"
                  step="0.01"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  className="pl-10 py-3 text-base text-right font-semibold"
                />
              </div>
              {Math.abs((parseFloat(total) || 0) - calculatedTotal) > 0.01 && items.length > 0 && (
                <p className="text-xs text-yellow-600 mt-1">
                  Total ítems: {formatCurrency(calculatedTotal)}
                </p>
              )}
            </div>
          </div>

          {/* Project */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              Proyecto *
            </label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full py-3 text-base">
                <SelectValue placeholder="Seleccionar proyecto" />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <span className="flex items-center gap-2">
                      {project.color && (
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: PROJECT_COLOR_HEX[project.color] }}
                        />
                      )}
                      {project.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cost Center */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              Centro de Costos *
            </label>
            <Select value={costCenterId} onValueChange={setCostCenterId}>
              <SelectTrigger className="w-full py-3 text-base">
                <SelectValue placeholder="Seleccionar centro de costos" />
              </SelectTrigger>
              <SelectContent>
                {costCenters?.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>
                    <span className="flex items-center gap-2">
                      {cc.color && (
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: COST_CENTER_COLOR_HEX[cc.color] }}
                        />
                      )}
                      {cc.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bank Account */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              Cuenta Bancaria (opcional)
            </label>
            <Select value={bankAccountId} onValueChange={setBankAccountId}>
              <SelectTrigger className="w-full py-3 text-base">
                <SelectValue placeholder="Seleccionar cuenta bancaria" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts?.map((ba) => (
                  <SelectItem key={ba.id} value={ba.id}>
                    {ba.name} ({ba.bank_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <hr className="border-border my-2" />

          {/* Items section */}
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <button
              onClick={() => setItemsOpen(!itemsOpen)}
              className="w-full px-4 py-3 bg-muted/50 flex items-center justify-between text-left focus:outline-none"
            >
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                <span className="font-medium">Items del comprobante</span>
                <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full font-bold">
                  {items.length}
                </span>
              </div>
              {itemsOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            {itemsOpen && (
              <div className="divide-y divide-border/50">
                {items.map((item) => (
                  <div key={item.id}>
                    {editingItemId === item.id ? (
                      /* Editing mode */
                      <div className="p-4 space-y-3 bg-muted/30">
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          placeholder="Descripción"
                          autoFocus
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Cantidad</label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Precio Unit.</label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-sm font-medium">
                            Subtotal: {formatCurrency(item.subtotal)}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteItem(item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setEditingItemId(null)}
                            >
                              Listo
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Display mode */
                      <div className="p-4 flex justify-between items-start gap-3 hover:bg-muted/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.description || 'Sin descripción'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Cant: {item.quantity} x {formatCurrency(item.unit_price)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">
                            {formatCurrency(item.subtotal)}
                          </p>
                          <button
                            className="text-primary text-xs font-medium mt-1"
                            onClick={() => setEditingItemId(item.id)}
                          >
                            Editar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {items.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No hay ítems. Agrega al menos uno.
                  </div>
                )}

                <button
                  onClick={addItem}
                  className="w-full py-3 text-center text-primary text-sm font-medium hover:bg-muted/50 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Agregar Item Manualmente
                </button>
              </div>
            )}
          </div>

          <div className="h-8" />
        </div>
      </main>

      {/* Sticky footer */}
      <footer className="bg-card border-t border-border p-4 pb-8 sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full py-4 rounded-xl shadow-lg shadow-primary/20 text-base"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                Confirmar Comprobante
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full py-4 rounded-xl text-base"
            onClick={onDiscard}
            disabled={isSubmitting}
          >
            Descartar
          </Button>
        </div>
      </footer>

      {/* Image Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="max-w-4xl">
          <Image
            src={imageUrl}
            alt="Comprobante ampliado"
            width={800}
            height={600}
            className="w-full h-auto"
            sizes="(max-width: 896px) 100vw, 896px"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
