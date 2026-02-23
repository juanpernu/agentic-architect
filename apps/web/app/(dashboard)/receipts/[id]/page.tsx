'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import {
  Receipt,
  Trash2,
  ChevronRight,
  Package,
  Sparkles,
  Plus,
  X,
} from 'lucide-react';
import { sileo } from 'sileo';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { PROJECT_COLOR_HEX } from '@/lib/project-colors';
import { useCurrentUser } from '@/lib/use-current-user';
import type { ReceiptDetail } from '@/lib/api-types';
import type { Rubro, BankAccount } from '@architech/shared';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingCards } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function EditableItemCard({ item, canEdit, onSaved }: {
  item: { id: string; description: string; quantity: number; unit_price: number; subtotal: number };
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [desc, setDesc] = useState(item.description);
  const [qty, setQty] = useState(String(item.quantity));
  const [price, setPrice] = useState(String(item.unit_price));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync when item changes externally
  useEffect(() => {
    setDesc(item.description);
    setQty(String(item.quantity));
    setPrice(String(item.unit_price));
  }, [item.description, item.quantity, item.unit_price]);

  const saveItemField = async (fields: Record<string, unknown>) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/receipt-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? 'Error al guardar');
      }
      onSaved();
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al guardar item' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/receipt-items/${item.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? 'Error al eliminar');
      }
      sileo.success({ title: 'Item eliminado' });
      onSaved();
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al eliminar item' });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Live subtotal computed from local state
  const liveSubtotal = (parseFloat(qty) || 0) * (parseFloat(price) || 0);

  const handleDescBlur = () => {
    if (desc !== item.description) saveItemField({ description: desc });
  };

  const handleQtyBlur = () => {
    const n = parseFloat(qty);
    if (isNaN(n)) { setQty(String(item.quantity)); return; }
    if (n !== item.quantity) {
      saveItemField({ quantity: n });
    }
  };

  const handlePriceBlur = () => {
    const n = parseFloat(price);
    if (isNaN(n)) { setPrice(String(item.unit_price)); return; }
    // Si el usuario pone 0, restaurar el valor original de la extracción
    if (n === 0) {
      setPrice(String(item.unit_price));
      return;
    }
    if (n !== item.unit_price) {
      saveItemField({ unit_price: n });
    }
  };

  const cardContent = (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm transition-colors hover:border-primary/30 group relative">
      {/* Description */}
      <div className="mb-3">
        <label className="block text-[10px] font-semibold uppercase text-muted-foreground tracking-wider mb-1">Descripcion</label>
        {canEdit ? (
          <input
            type="text"
            className="w-full text-sm font-medium border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onBlur={handleDescBlur}
            disabled={isSaving}
          />
        ) : (
          <div className="w-full text-sm font-medium border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50">
            {item.description}
          </div>
        )}
      </div>

      {/* Qty / Unit price / Subtotal + delete */}
      <div className="flex items-end gap-3">
        <div className="flex-1 grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase text-muted-foreground tracking-wider mb-1">Cant.</label>
            {canEdit ? (
              <input
                type="number"
                step="any"
                className="w-full text-sm font-medium border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onBlur={handleQtyBlur}
                disabled={isSaving}
              />
            ) : (
              <div className="w-full text-sm font-medium border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50">
                {item.quantity}
              </div>
            )}
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase text-muted-foreground tracking-wider mb-1">Precio Unit.</label>
            {canEdit ? (
              <input
                type="number"
                step="0.01"
                className="w-full text-sm font-medium border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                onBlur={handlePriceBlur}
                disabled={isSaving}
              />
            ) : (
              <div className="w-full text-sm font-medium border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50">
                {formatCurrency(item.unit_price)}
              </div>
            )}
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase text-muted-foreground tracking-wider mb-1">Subtotal</label>
            <div className="w-full text-sm font-semibold font-mono border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50">
              {formatCurrency(canEdit ? liveSubtotal : item.subtotal)}
            </div>
          </div>
        </div>

        {/* Trash icon */}
        {canEdit && (
          !showDeleteConfirm ? (
            <button
              className="mb-0.5 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-muted-foreground/50 hover:text-destructive hover:bg-red-50"
              onClick={() => setShowDeleteConfirm(true)}
              title="Eliminar item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : (
            <div className="mb-0.5 flex items-center gap-1">
              <Button
                variant="destructive"
                size="sm"
                className="h-8 text-xs px-2"
                onClick={handleDeleteItem}
                disabled={isDeleting}
              >
                {isDeleting ? '...' : 'Si'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs px-2"
                onClick={() => setShowDeleteConfirm(false)}
              >
                No
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  );

  return cardContent;
}

export default function ReceiptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin, isAdminOrSupervisor } = useCurrentUser();
  const receiptId = params.id as string;

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [isSavingBankAccount, setIsSavingBankAccount] = useState(false);

  // Editable field state
  const [editVendor, setEditVendor] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [isSavingField, setIsSavingField] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);

  const { data: receipt, isLoading, error } = useSWR<ReceiptDetail>(
    receiptId ? `/api/receipts/${receiptId}` : null,
    fetcher
  );

  // Fetch budgets for the receipt's project, then rubros from that budget
  const { data: budgets } = useSWR<Array<{ id: string }>>(
    receipt?.project_id ? `/api/budgets?project_id=${receipt.project_id}` : null,
    fetcher
  );
  const budgetId = budgets?.[0]?.id;
  const { data: rubros } = useSWR<Rubro[]>(
    budgetId ? `/api/rubros?budget_id=${budgetId}` : null,
    fetcher
  );
  const { data: bankAccounts } = useSWR<BankAccount[]>('/api/bank-accounts', fetcher);
  const { data: projects } = useSWR<Array<{ id: string; name: string; color?: keyof typeof PROJECT_COLOR_HEX }>>(
    '/api/projects',
    fetcher
  );
  const { data: users } = useSWR<Array<{ id: string; full_name: string }>>(
    isAdmin ? '/api/users' : null,
    fetcher
  );

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/receipts/${receiptId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al eliminar comprobante');
      }

      sileo.success({ title: 'Comprobante eliminado con éxito' });
      await mutate('/api/receipts');
      if (receipt) {
        await mutate(`/api/receipts?project_id=${receipt.project_id}`);
        await mutate(`/api/projects/${receipt.project_id}`);
      }
      router.push('/administration/receipts');
    } catch (error) {
      sileo.error({
        title: error instanceof Error ? error.message : 'Error al eliminar comprobante',
      });
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleSaveBankAccount = async () => {
    if (!selectedBankAccountId) return;
    setIsSavingBankAccount(true);
    try {
      const response = await fetch(`/api/receipts/${receiptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank_account_id: selectedBankAccountId }),
      });
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al asignar cuenta bancaria');
      }
      sileo.success({ title: 'Cuenta bancaria asignada' });
      await mutate(`/api/receipts/${receiptId}`);
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al asignar' });
    } finally {
      setIsSavingBankAccount(false);
    }
  };

  // Sync editable fields when receipt loads
  useEffect(() => {
    if (receipt) {
      setEditVendor(receipt.vendor ?? '');
      setEditDate(receipt.receipt_date);
      setEditAmount(String(receipt.total_amount));
    }
  }, [receipt]);

  // Save a single field via PATCH
  const saveField = useCallback(async (field: string, value: unknown) => {
    setIsSavingField(true);
    try {
      const response = await fetch(`/api/receipts/${receiptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? 'Error al guardar');
      }
      sileo.success({ title: 'Campo actualizado' });
      await mutate(`/api/receipts/${receiptId}`);
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al guardar' });
    } finally {
      setIsSavingField(false);
    }
  }, [receiptId]);

  const handleAddItem = async () => {
    setIsAddingItem(true);
    try {
      const response = await fetch('/api/receipt-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt_id: receiptId, description: 'Nuevo item', quantity: 1, unit_price: 0 }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? 'Error al agregar item');
      }
      await mutate(`/api/receipts/${receiptId}`);
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al agregar item' });
    } finally {
      setIsAddingItem(false);
    }
  };

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-4">Error</h1>
        <div className="text-red-600">Error al cargar el comprobante</div>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingCards count={2} />;
  }

  if (!receipt) {
    return (
      <EmptyState
        icon={Receipt}
        title="Comprobante no encontrado"
        description="El comprobante que buscas no existe"
        action={
          <Button onClick={() => router.push('/administration/receipts')}>
            Volver a Comprobantes
          </Button>
        }
      />
    );
  }

  const totalFromItems = receipt.receipt_items.reduce(
    (sum, item) => sum + item.subtotal,
    0
  );

  const confidencePercent = (receipt.ai_confidence * 100).toFixed(0);
  const isHighConfidence = receipt.ai_confidence >= 0.8;

  return (
    <div className="animate-slide-up">
      {/* Header band — breadcrumb */}
      <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 pt-4 md:pt-6 pb-6 border-b border-border bg-card">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link href="/administration/receipts" className="hover:text-primary transition-colors">
            Comprobantes
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">{receipt.vendor ?? 'Sin proveedor'}</span>
        </div>

        {/* Title + status + actions — always inline */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-3xl font-bold tracking-tight truncate">
              {receipt.vendor ?? 'Sin proveedor'}
              {receipt.receipt_number && (
                <span className="text-muted-foreground font-normal ml-2 text-base md:text-xl">#{receipt.receipt_number}</span>
              )}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={receipt.status} />
            </div>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive shrink-0"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          )}
        </div>
      </div>

      {/* Split panel — breaks out of layout padding */}
      <div className="-mx-4 md:-mx-8 -mb-4 md:-mb-8 flex flex-col lg:flex-row min-h-[calc(100vh-180px)]">
        {/* Left: Image viewer (60%) */}
        <div className="lg:w-[60%] flex flex-col border-r border-border bg-slate-100/50">
          <div
            className="flex-1 overflow-auto p-6 lg:p-8 flex items-start justify-center cursor-pointer"
            onClick={() => setShowImageDialog(true)}
            style={{
              backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
              backgroundSize: '20px 20px',
              backgroundColor: '#f8fafc',
            }}
          >
            <div className="bg-white shadow-xl w-full max-w-3xl rounded-sm relative border border-slate-200 hover:shadow-2xl transition-shadow">
              <Image
                src={receipt.image_url}
                alt="Comprobante"
                width={700}
                height={900}
                className="w-full h-auto object-contain"
                sizes="(max-width: 1024px) 100vw, 55vw"
              />
              {/* AI confidence overlay */}
              <div className="absolute top-3 right-3">
                <span
                  className={`text-[11px] font-bold px-2 py-1 rounded-full border shadow-sm ${
                    isHighConfidence
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : 'bg-amber-100 text-amber-800 border-amber-200'
                  }`}
                >
                  IA {confidencePercent}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Data panel (40%) */}
        <div className="lg:w-[40%] bg-white flex flex-col h-full shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">
          {/* Panel header */}
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Datos del Comprobante
            </h3>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Informacion extraida y asignaciones.
            </p>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Informacion General */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm border-b border-slate-100 pb-2">Informacion General</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {/* Proveedor — full width, editable */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Proveedor / Razon Social</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full text-sm font-medium border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors pr-12"
                      value={editVendor}
                      onChange={(e) => setEditVendor(e.target.value)}
                      onBlur={() => { if (editVendor !== (receipt.vendor ?? '')) saveField('vendor', editVendor); }}
                      disabled={isSavingField}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                          isHighConfidence
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {confidencePercent}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Proyecto (editable dropdown) + Fecha (editable) */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Proyecto</label>
                  <Select
                    value={receipt.project_id}
                    onValueChange={(value) => saveField('project_id', value)}
                    disabled={isSavingField}
                  >
                    <SelectTrigger className="w-full h-9 bg-slate-50/50 text-sm font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {projects?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-1.5">
                            {p.color && (
                              <span
                                className="inline-block h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: PROJECT_COLOR_HEX[p.color] }}
                              />
                            )}
                            {p.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Fecha de Emision</label>
                  <input
                    type="date"
                    className="w-full text-sm font-medium border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    onBlur={() => { if (editDate !== receipt.receipt_date) saveField('receipt_date', editDate); }}
                    disabled={isSavingField}
                  />
                </div>

                {/* Cargado por (dropdown for admins, read-only for others) + Monto Total (editable) */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Cargado por</label>
                  {isAdmin && users ? (
                    <Select
                      value={receipt.uploaded_by}
                      onValueChange={(value) => saveField('uploaded_by', value)}
                      disabled={isSavingField}
                    >
                      <SelectTrigger className="w-full h-9 bg-slate-50/50 text-sm font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="w-full text-sm font-medium border border-slate-200 rounded-lg px-3 py-2 bg-slate-100/80 text-muted-foreground truncate" title={receipt.uploader.full_name}>
                      {receipt.uploader.full_name}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Monto Total</label>
                  {isEditingAmount ? (
                    <input
                      type="number"
                      step="0.01"
                      autoFocus
                      className="w-full text-sm font-bold text-primary border border-slate-200 rounded-lg px-3 py-2 bg-white ring-2 ring-primary/20 border-primary transition-colors"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      onBlur={() => {
                        setIsEditingAmount(false);
                        const num = parseFloat(editAmount);
                        if (!isNaN(num) && num !== receipt.total_amount) saveField('total_amount', num);
                      }}
                      disabled={isSavingField}
                    />
                  ) : (
                    <div
                      className="w-full text-sm font-bold text-primary border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 hover:bg-white cursor-text transition-colors"
                      onClick={() => setIsEditingAmount(true)}
                    >
                      {formatCurrency(parseFloat(editAmount) || 0)}
                    </div>
                  )}
                </div>

                {/* Rubro — full width, optional dropdown from project budget */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Rubro</label>
                  {isAdminOrSupervisor ? (
                    <Select
                      value={receipt.rubro_id ?? 'none'}
                      onValueChange={(value) => saveField('rubro_id', value === 'none' ? null : value)}
                      disabled={isSavingField || !rubros}
                    >
                      <SelectTrigger className="w-full h-9 bg-slate-50/50 text-sm font-medium">
                        <SelectValue placeholder={rubros ? 'Sin asignar' : 'Cargando rubros...'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground">Sin asignar</span>
                        </SelectItem>
                        {rubros?.map((rubro) => (
                          <SelectItem key={rubro.id} value={rubro.id}>
                            <span className="flex items-center gap-2">
                              {rubro.color && (
                                <span
                                  className="inline-block h-2 w-2 rounded-full shrink-0"
                                  style={{ backgroundColor: rubro.color }}
                                />
                              )}
                              {rubro.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="w-full text-sm font-medium border border-slate-200 rounded-lg px-3 py-2 bg-slate-100/80 text-muted-foreground">
                      {receipt.rubro?.name ?? 'Sin asignar'}
                    </div>
                  )}
                </div>

                {/* Cuenta Bancaria — full width */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Cuenta Bancaria</label>
                  {receipt.bank_account ? (
                    <div className="w-full text-sm font-medium border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50">
                      {receipt.bank_account.name}
                      <span className="text-muted-foreground ml-1">({receipt.bank_account.bank_name})</span>
                    </div>
                  ) : isAdminOrSupervisor ? (
                    <div className="flex items-center gap-2">
                      <Select value={selectedBankAccountId} onValueChange={setSelectedBankAccountId}>
                        <SelectTrigger className="w-full h-9 bg-slate-50/50">
                          <SelectValue placeholder="Asignar cuenta" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankAccounts?.map((ba) => (
                            <SelectItem key={ba.id} value={ba.id}>
                              {ba.name} ({ba.bank_name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedBankAccountId && (
                        <Button size="sm" className="h-9 shrink-0" onClick={handleSaveBankAccount} disabled={isSavingBankAccount}>
                          {isSavingBankAccount ? 'Guardando...' : 'Asignar'}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="w-full text-sm text-muted-foreground border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50">
                      Sin asignar
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="font-medium text-sm">Items del Comprobante</h4>
                {isAdminOrSupervisor && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleAddItem}
                    disabled={isAddingItem}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Agregar
                  </Button>
                )}
              </div>

              {receipt.receipt_items.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No hay items registrados
                </div>
              ) : (
                <div className="space-y-3">
                  {receipt.receipt_items.map((item) => (
                    <EditableItemCard
                      key={item.id}
                      item={item}
                      canEdit={isAdminOrSupervisor}
                      onSaved={() => mutate(`/api/receipts/${receiptId}`)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Dark totals card */}
            <div className="bg-slate-900 text-white p-4 rounded-lg">
              {receipt.net_amount != null && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-400">Subtotal Neto</span>
                  <span className="text-sm font-mono">{formatCurrency(receipt.net_amount)}</span>
                </div>
              )}
              {receipt.iva_amount != null && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-400">
                    IVA{receipt.iva_rate != null ? ` (${receipt.iva_rate}%)` : ''}
                  </span>
                  <span className="text-sm font-mono">{formatCurrency(receipt.iva_amount)}</span>
                </div>
              )}
              {receipt.receipt_items.length > 0 && receipt.net_amount == null && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-400">Total items ({receipt.receipt_items.length})</span>
                  <span className="text-sm font-mono">{formatCurrency(totalFromItems)}</span>
                </div>
              )}
              <div className="h-px bg-slate-700 my-3" />
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm">Total Comprobante</span>
                <span className="font-bold text-xl font-mono text-green-400">
                  {formatCurrency(receipt.total_amount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Comprobante</DialogTitle>
            <DialogDescription>
              ¿Estas seguro de que deseas eliminar este comprobante?
              Esta accion no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="max-w-4xl">
          <Image
            src={receipt.image_url}
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
