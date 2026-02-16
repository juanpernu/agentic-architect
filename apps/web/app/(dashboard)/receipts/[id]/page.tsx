'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import {
  Receipt,
  Trash2,
  Building2,
  User,
  Calendar,
  DollarSign,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { useCurrentUser } from '@/lib/use-current-user';
import type { ReceiptDetail } from '@/lib/api-types';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingCards } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
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

export default function ReceiptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin } = useCurrentUser();
  const receiptId = params.id as string;

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);

  const { data: receipt, isLoading, error } = useSWR<ReceiptDetail>(
    receiptId ? `/api/receipts/${receiptId}` : null,
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

      toast.success('Comprobante eliminado con éxito');
      await mutate('/api/receipts');
      if (receipt) {
        await mutate(`/api/receipts?project_id=${receipt.project_id}`);
        await mutate(`/api/projects/${receipt.project_id}`);
      }
      router.push('/receipts');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Error al eliminar comprobante'
      );
      setIsDeleting(false);
      setShowDeleteDialog(false);
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
                <img
                  src={receipt.image_url}
                  alt="Comprobante"
                  className="w-full h-auto object-contain"
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
          {/* Info Cards */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  <Building2 className="inline mr-2 h-4 w-4" />
                  Proyecto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/projects/${receipt.project_id}`}
                  className="text-base font-medium text-primary hover:underline"
                >
                  {receipt.project.name}
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  <User className="inline mr-2 h-4 w-4" />
                  Cargado por
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-base font-medium">
                  {receipt.uploader.full_name}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(receipt.created_at).toLocaleString('es-AR')}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  <DollarSign className="inline mr-2 h-4 w-4" />
                  Monto Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(receipt.total_amount)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  <Calendar className="inline mr-2 h-4 w-4" />
                  Fecha del Comprobante
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-base font-medium">
                  {new Date(receipt.receipt_date).toLocaleDateString('es-AR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

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
          <img
            src={receipt.image_url}
            alt="Comprobante ampliado"
            className="w-full h-auto"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
