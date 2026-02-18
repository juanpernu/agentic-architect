'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import {
  Receipt,
  Trash2,
  Building2,
  User,
  Calendar,
  DollarSign,
  Package,
  Layers,
  Landmark,
} from 'lucide-react';
import { sileo } from 'sileo';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { PROJECT_COLOR_HEX, COST_CENTER_COLOR_HEX } from '@/lib/project-colors';
import { useCurrentUser } from '@/lib/use-current-user';
import type { ReceiptDetail } from '@/lib/api-types';
import type { CostCenter, BankAccount } from '@architech/shared';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingCards } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
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

export default function ReceiptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin, isAdminOrSupervisor } = useCurrentUser();
  const receiptId = params.id as string;

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [selectedCostCenterId, setSelectedCostCenterId] = useState('');
  const [isSavingCostCenter, setIsSavingCostCenter] = useState(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [isSavingBankAccount, setIsSavingBankAccount] = useState(false);

  const { data: receipt, isLoading, error } = useSWR<ReceiptDetail>(
    receiptId ? `/api/receipts/${receiptId}` : null,
    fetcher
  );

  const { data: costCenters } = useSWR<CostCenter[]>('/api/cost-centers', fetcher);
  const { data: bankAccounts } = useSWR<BankAccount[]>('/api/bank-accounts', fetcher);

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
      router.push('/receipts');
    } catch (error) {
      sileo.error({
        title: error instanceof Error ? error.message : 'Error al eliminar comprobante',
      });
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleSaveCostCenter = async () => {
    if (!selectedCostCenterId) return;
    setIsSavingCostCenter(true);
    try {
      const response = await fetch(`/api/receipts/${receiptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost_center_id: selectedCostCenterId }),
      });
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al asignar centro de costos');
      }
      sileo.success({ title: 'Centro de costos asignado' });
      await mutate(`/api/receipts/${receiptId}`);
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al asignar' });
    } finally {
      setIsSavingCostCenter(false);
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

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Error" />
        <div className="text-red-600">Error al cargar el comprobante</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingCards count={2} />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Receipt}
          title="Comprobante no encontrado"
          description="El comprobante que buscas no existe"
          action={
            <Button onClick={() => router.push('/receipts')}>
              Volver a Comprobantes
            </Button>
          }
        />
      </div>
    );
  }

  const totalFromItems = receipt.receipt_items.reduce(
    (sum, item) => sum + item.subtotal,
    0
  );

  return (
    <div className="p-6">
      <PageHeader
        title={`Comprobante ${receipt.vendor ?? 'sin proveedor'}`}
        description={`${new Date(receipt.receipt_date).toLocaleDateString('es-AR')}`}
        action={
          isAdmin ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          ) : undefined
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Image */}
        <div className="lg:col-span-1">
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
                  src={receipt.image_url}
                  alt="Comprobante"
                  width={400}
                  height={300}
                  className="w-full h-auto object-contain"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Click para ampliar
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Confianza IA:</span>
                  <span className="font-medium">
                    {(receipt.ai_confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div>
                  <StatusBadge status={receipt.status} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Receipt Details */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-5">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    Proyecto
                  </Label>
                  <Link
                    href={`/projects/${receipt.project_id}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    {receipt.project.color && (
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: PROJECT_COLOR_HEX[receipt.project.color] }}
                      />
                    )}
                    {receipt.project.name}
                  </Link>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    Cargado por
                  </Label>
                  <div className="text-sm font-medium">{receipt.uploader.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(receipt.created_at).toLocaleString('es-AR')}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    Monto Total
                  </Label>
                  <div className="text-lg font-bold text-primary">
                    {formatCurrency(receipt.total_amount)}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Fecha del Comprobante
                  </Label>
                  <div className="text-sm font-medium">
                    {new Date(receipt.receipt_date).toLocaleDateString('es-AR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" />
                    Centro de Costos
                  </Label>
                  {receipt.cost_center ? (
                    <div className="flex items-center gap-2">
                      {receipt.cost_center.color && (
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: COST_CENTER_COLOR_HEX[receipt.cost_center.color] }}
                        />
                      )}
                      <span className="text-sm font-medium">{receipt.cost_center.name}</span>
                    </div>
                  ) : isAdminOrSupervisor ? (
                    <div className="flex items-center gap-2">
                      <Select value={selectedCostCenterId} onValueChange={setSelectedCostCenterId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Asignar centro de costos" />
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
                      {selectedCostCenterId && (
                        <Button size="sm" onClick={handleSaveCostCenter} disabled={isSavingCostCenter}>
                          {isSavingCostCenter ? 'Guardando...' : 'Asignar'}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Sin asignar</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-muted-foreground">
                    <Landmark className="h-3.5 w-3.5" />
                    Cuenta Bancaria
                  </Label>
                  {receipt.bank_account ? (
                    <div className="text-sm font-medium">
                      {receipt.bank_account.name}
                      <span className="text-muted-foreground ml-1">({receipt.bank_account.bank_name})</span>
                    </div>
                  ) : isAdminOrSupervisor ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <Select value={selectedBankAccountId} onValueChange={setSelectedBankAccountId}>
                        <SelectTrigger className="w-full sm:w-[220px]">
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
                        <Button size="sm" onClick={handleSaveBankAccount} disabled={isSavingBankAccount}>
                          {isSavingBankAccount ? 'Guardando...' : 'Asignar'}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Sin asignar</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Package className="inline mr-2 h-4 w-4" />
                Ítems del Comprobante
              </CardTitle>
            </CardHeader>
            <CardContent>
              {receipt.receipt_items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay ítems registrados
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">P. Unitario</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receipt.receipt_items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.description}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.unit_price)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(item.subtotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={3} className="text-right font-semibold">
                          Total:
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg">
                          {formatCurrency(totalFromItems)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Comprobante</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este comprobante?
              Esta acción no se puede deshacer.
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
