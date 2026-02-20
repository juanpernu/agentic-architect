'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import useSWR, { mutate } from 'swr';
import { sileo } from 'sileo';
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { receiptReviewSchema } from '@/lib/schemas';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { PROJECT_COLOR_HEX } from '@/lib/project-colors';
import type { ExtractionResult, ExtractionItem, ConfirmReceiptInput, Project, Rubro, BankAccount } from '@architech/shared';
import type { BudgetListItem } from '@/lib/api-types';

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
  const [rubroId, setRubroId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
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
  const { data: budgets } = useSWR<BudgetListItem[]>('/api/budgets', fetcher);
  const { data: bankAccounts } = useSWR<BankAccount[]>('/api/bank-accounts', fetcher);

  // Find the budget for the selected project, then fetch its rubros
  const selectedBudget = budgets?.find((b) => b.project_id === projectId);
  const { data: rubros } = useSWR<Rubro[]>(
    selectedBudget ? `/api/rubros?budget_id=${selectedBudget.id}` : null,
    fetcher
  );

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

  // Reset rubroId when project changes
  const handleProjectChange = (newProjectId: string) => {
    setProjectId(newProjectId);
    setRubroId('');
  };

  const handleConfirm = async () => {
    const result = receiptReviewSchema.safeParse({
      vendor,
      date,
      total,
      projectId,
      rubroId,
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
        rubro_id: rubroId,
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

      // Refresh data
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
              <CardHeader>
                <CardTitle className="text-sm">Datos del Comprobante</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldGroup className="space-y-4">
                {/* Vendor */}
                <Field>
                  <FieldLabel>Proveedor</FieldLabel>
                  {editingField === 'vendor' ? (
                    <div className="flex gap-2">
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
                    <div className="relative cursor-pointer" onClick={() => startEditing('vendor', vendor)}>
                      <Input
                        readOnly
                        value={vendor || ''}
                        placeholder="Sin proveedor"
                        className="cursor-pointer pr-9"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') startEditing('vendor', vendor); }}
                        aria-label="Editar proveedor"
                      />
                      <Edit2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                  )}
                </Field>

                {/* Date */}
                <Field>
                  <FieldLabel>Fecha</FieldLabel>
                  {editingField === 'date' ? (
                    <div className="flex gap-2">
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
                    <div className="relative cursor-pointer" onClick={() => startEditing('date', date)}>
                      <Input
                        readOnly
                        value={date ? new Date(date).toLocaleDateString('es-AR') : ''}
                        placeholder="Sin fecha"
                        className="cursor-pointer pr-9"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') startEditing('date', date); }}
                        aria-label="Editar fecha"
                      />
                      <Edit2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                  )}
                </Field>

                {/* Total */}
                <Field>
                  <FieldLabel>Total</FieldLabel>
                  {editingField === 'total' ? (
                    <div className="flex gap-2">
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
                    <div className="relative cursor-pointer" onClick={() => startEditing('total', total)}>
                      <Input
                        readOnly
                        value={formatCurrency(parseFloat(total) || 0)}
                        className="cursor-pointer pr-9 font-semibold"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') startEditing('total', total); }}
                        aria-label="Editar total"
                      />
                      <Edit2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                  )}
                  {Math.abs((parseFloat(total) || 0) - calculatedTotal) > 0.01 && (
                    <p className="text-xs text-yellow-600 mt-1">
                      Total de ítems: {formatCurrency(calculatedTotal)}
                    </p>
                  )}
                </Field>

                {/* Project */}
                <Field>
                  <FieldLabel htmlFor="project">Proyecto *</FieldLabel>
                  <Select value={projectId} onValueChange={handleProjectChange}>
                    <SelectTrigger id="project" className="w-full mt-1">
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
                </Field>

                {/* Rubro */}
                <Field>
                  <FieldLabel htmlFor="rubro">Rubro *</FieldLabel>
                  {projectId && !selectedBudget ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      Este proyecto no tiene presupuesto con rubros
                    </p>
                  ) : (
                    <Select value={rubroId} onValueChange={setRubroId} disabled={!selectedBudget}>
                      <SelectTrigger id="rubro" className="w-full mt-1">
                        <SelectValue placeholder="Seleccionar rubro" />
                      </SelectTrigger>
                      <SelectContent>
                        {rubros?.map((rubro) => (
                          <SelectItem key={rubro.id} value={rubro.id}>
                            <span className="flex items-center gap-2">
                              {rubro.color && (
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: rubro.color }}
                                />
                              )}
                              {rubro.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>

                {/* Bank Account */}
                <Field>
                  <FieldLabel>Cuenta Bancaria (opcional)</FieldLabel>
                  <Select value={bankAccountId} onValueChange={setBankAccountId}>
                    <SelectTrigger>
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
                </Field>
                </FieldGroup>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Ítems del Comprobante</CardTitle>
            <CardAction>
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar Ítem
              </Button>
            </CardAction>
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
                  <div className="p-3 border-t bg-muted/30">
                    <FieldGroup className="space-y-3">
                      <Field>
                        <FieldLabel htmlFor={`desc-${item.id}`}>Descripción</FieldLabel>
                        <Input
                          id={`desc-${item.id}`}
                          value={item.description}
                          onChange={(e) =>
                            updateItem(item.id, 'description', e.target.value)
                          }
                          placeholder="Descripción del ítem"
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field>
                          <FieldLabel htmlFor={`qty-${item.id}`}>Cantidad</FieldLabel>
                          <Input
                            id={`qty-${item.id}`}
                            type="number"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)
                            }
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor={`price-${item.id}`}>Precio Unitario</FieldLabel>
                          <Input
                            id={`price-${item.id}`}
                            type="number"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) =>
                              updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)
                            }
                          />
                        </Field>
                      </div>
                    </FieldGroup>
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
