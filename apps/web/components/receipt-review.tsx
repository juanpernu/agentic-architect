'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import useSWR, { mutate } from 'swr';
import { toast } from 'sonner';
import {
  Check,
  X,
  Edit2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import type { ExtractionResult, ExtractionItem, ConfirmReceiptInput, Project } from '@architech/shared';

interface ReceiptReviewProps {
  imageUrl: string;
  storagePath: string;
  extractionResult: ExtractionResult;
  preSelectedProjectId?: string;
  onDiscard: () => void;
}

type EditableField = 'vendor' | 'date' | 'total' | null;

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

  const [vendor, setVendor] = useState(extractionResult.supplier.name ?? '');
  const [date, setDate] = useState(extractionResult.receipt.date ?? '');
  const [total, setTotal] = useState(extractionResult.totals.total?.toString() ?? '');
  const [projectId, setProjectId] = useState(preSelectedProjectId ?? '');
  const [items, setItems] = useState<EditableItem[]>(
    extractionResult.items.map((item, index) => ({
      ...item,
      id: `item-${index}`,
      expanded: false,
    }))
  );

  const [editingField, setEditingField] = useState<EditableField>(null);
  const [tempValue, setTempValue] = useState('');

  const { data: projects } = useSWR<Project[]>('/api/projects', fetcher);

  const confidence = extractionResult.confidence;

  const getConfidenceBadge = () => {
    if (confidence > 0.85) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Alta confianza
        </Badge>
      );
    } else if (confidence >= 0.6) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <AlertCircle className="mr-1 h-3 w-3" />
          Confianza media
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          <AlertTriangle className="mr-1 h-3 w-3" />
          Baja confianza
        </Badge>
      );
    }
  };

  const startEditing = (field: EditableField, currentValue: string) => {
    setEditingField(field);
    setTempValue(currentValue);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setTempValue('');
  };

  const saveField = () => {
    switch (editingField) {
      case 'vendor':
        setVendor(tempValue);
        break;
      case 'date':
        setDate(tempValue);
        break;
      case 'total':
        setTotal(tempValue);
        break;
    }
    setEditingField(null);
    setTempValue('');
  };

  const toggleItemExpanded = (id: string) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, expanded: !item.expanded } : item
    ));
  };

  const updateItem = (id: string, field: keyof ExtractionItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;

      const updated = { ...item, [field]: value };

      // Recalculate subtotal if quantity or unit_price changed
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
  };

  const addItem = () => {
    const newItem: EditableItem = {
      id: `item-${Date.now()}`,
      description: '',
      quantity: 1,
      unit_price: 0,
      subtotal: 0,
      expanded: true,
    };
    setItems([...items, newItem]);
  };

  const calculatedTotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  const handleConfirm = async () => {
    if (!projectId) {
      toast.error('Debes seleccionar un proyecto');
      return;
    }

    if (!vendor) {
      toast.error('El proveedor es requerido');
      return;
    }

    if (!date) {
      toast.error('La fecha es requerida');
      return;
    }

    if (items.length === 0) {
      toast.error('Debes tener al menos un ítem');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: ConfirmReceiptInput = {
        project_id: projectId,
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

      toast.success('Comprobante confirmado con éxito');

      // Refresh data
      await mutate('/api/receipts');
      await mutate(`/api/receipts?project_id=${projectId}`);
      await mutate(`/api/projects/${projectId}`);

      router.push(`/receipts/${createdReceipt.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Error al confirmar comprobante'
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Revisar Comprobante"
        description="Verifica y edita la información extraída"
      />

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Confidence Badge */}
        <div className="flex justify-between items-center">
          {getConfidenceBadge()}
          {confidence < 0.85 && (
            <p className="text-sm text-muted-foreground">
              {confidence < 0.6 ? 'Revisá todos los campos cuidadosamente' : 'Verificá los campos destacados'}
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Image Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Imagen del Comprobante</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="relative rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setShowImageDialog(true)}
              >
                <Image
                  src={imageUrl}
                  alt="Comprobante"
                  width={400}
                  height={300}
                  className="w-full h-auto max-h-80 object-contain"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Click para ampliar
              </p>
            </CardContent>
          </Card>

          {/* Extracted Fields */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                {/* Vendor */}
                <div>
                  <Label>Proveedor</Label>
                  {editingField === 'vendor' ? (
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        autoFocus
                      />
                      <Button size="sm" onClick={saveField}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEditing}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between p-2 rounded border mt-1 cursor-pointer hover:bg-muted/50"
                      onClick={() => startEditing('vendor', vendor)}
                      onKeyDown={(e) => { if (e.key === 'Enter') startEditing('vendor', vendor); }}
                      role="button"
                      tabIndex={0}
                      aria-label="Editar proveedor"
                    >
                      <span className={vendor ? '' : 'text-muted-foreground'}>
                        {vendor || 'Sin proveedor'}
                      </span>
                      <Edit2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Date */}
                <div>
                  <Label>Fecha</Label>
                  {editingField === 'date' ? (
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="date"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        autoFocus
                      />
                      <Button size="sm" onClick={saveField}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEditing}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between p-2 rounded border mt-1 cursor-pointer hover:bg-muted/50"
                      onClick={() => startEditing('date', date)}
                      onKeyDown={(e) => { if (e.key === 'Enter') startEditing('date', date); }}
                      role="button"
                      tabIndex={0}
                      aria-label="Editar fecha"
                    >
                      <span className={date ? '' : 'text-muted-foreground'}>
                        {date ? new Date(date).toLocaleDateString('es-AR') : 'Sin fecha'}
                      </span>
                      <Edit2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Total */}
                <div>
                  <Label>Total</Label>
                  {editingField === 'total' ? (
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        autoFocus
                      />
                      <Button size="sm" onClick={saveField}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEditing}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between p-2 rounded border mt-1 cursor-pointer hover:bg-muted/50"
                      onClick={() => startEditing('total', total)}
                      onKeyDown={(e) => { if (e.key === 'Enter') startEditing('total', total); }}
                      role="button"
                      tabIndex={0}
                      aria-label="Editar total"
                    >
                      <span className="font-semibold">
                        {formatCurrency(parseFloat(total) || 0)}
                      </span>
                      <Edit2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  {Math.abs((parseFloat(total) || 0) - calculatedTotal) > 0.01 && (
                    <p className="text-xs text-yellow-600 mt-1">
                      Total de ítems: {formatCurrency(calculatedTotal)}
                    </p>
                  )}
                </div>

                {/* Project */}
                <div>
                  <Label htmlFor="project">Proyecto *</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger id="project" className="w-full mt-1">
                      <SelectValue placeholder="Seleccionar proyecto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects?.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Ítems del Comprobante</CardTitle>
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar Ítem
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleItemExpanded(item.id)}
                >
                  <div className="flex-1">
                    <div className="font-medium">{item.description || 'Sin descripción'}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(item.subtotal)}
                    </div>
                  </div>
                  {item.expanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {item.expanded && (
                  <div className="p-3 border-t bg-muted/30 space-y-3">
                    <div>
                      <Label htmlFor={`desc-${item.id}`}>Descripción</Label>
                      <Input
                        id={`desc-${item.id}`}
                        value={item.description}
                        onChange={(e) =>
                          updateItem(item.id, 'description', e.target.value)
                        }
                        placeholder="Descripción del ítem"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`qty-${item.id}`}>Cantidad</Label>
                        <Input
                          id={`qty-${item.id}`}
                          type="number"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor={`price-${item.id}`}>Precio Unitario</Label>
                        <Input
                          id={`price-${item.id}`}
                          type="number"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) =>
                            updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">
                        Subtotal: {formatCurrency(item.subtotal)}
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No hay ítems. Agrega al menos uno para continuar.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onDiscard}
            disabled={isSubmitting}
            className="flex-1"
          >
            Descartar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Confirmando...' : 'Confirmar Comprobante'}
          </Button>
        </div>
      </div>

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
