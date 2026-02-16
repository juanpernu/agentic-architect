'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { Building2, Edit, Trash2, Upload, MapPin, User, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingCards, LoadingTable } from '@/components/ui/loading-skeleton';
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
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ProjectFormDialog } from '@/components/project-form-dialog';
import type { Project, Receipt } from '@obralink/shared';

interface ProjectDetail extends Project {
  architect: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

interface ReceiptWithDetails extends Receipt {
  project: {
    id: string;
    name: string;
  };
  uploader: {
    id: string;
    full_name: string;
  };
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: project, isLoading: isLoadingProject, error: projectError } = useSWR<ProjectDetail>(
    projectId ? `/api/projects/${projectId}` : null,
    fetcher
  );

  const { data: receipts, isLoading: isLoadingReceipts } = useSWR<ReceiptWithDetails[]>(
    projectId ? `/api/receipts?project_id=${projectId}` : null,
    fetcher
  );

  const totalSpend = receipts?.reduce((sum, r) => sum + r.total_amount, 0) ?? 0;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? 'Error al eliminar proyecto');
      }

      toast.success('Proyecto eliminado con éxito');
      await mutate('/api/projects');
      router.push('/projects');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Error al eliminar proyecto'
      );
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (projectError) {
    return (
      <div className="p-6">
        <PageHeader title="Error" />
        <div className="text-red-600">Error al cargar el proyecto</div>
      </div>
    );
  }

  if (isLoadingProject) {
    return (
      <div className="p-6">
        <LoadingCards count={1} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Building2}
          title="Proyecto no encontrado"
          description="El proyecto que buscas no existe"
          action={
            <Button onClick={() => router.push('/projects')}>
              Volver a Proyectos
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title={project.name}
        description={project.address ?? 'Sin dirección'}
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditDialog(true)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={project.status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <User className="inline mr-2 h-4 w-4" />
              Arquitecto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-medium">
              {project.architect?.full_name ?? 'Sin asignar'}
            </div>
            {project.architect?.email && (
              <div className="text-xs text-muted-foreground mt-1">
                {project.architect.email}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gasto Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(totalSpend)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {receipts?.length ?? 0} comprobantes
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Comprobantes</h2>
        <Button asChild>
          <Link href={`/upload?project_id=${projectId}`}>
            <Upload className="mr-2 h-4 w-4" />
            Cargar Comprobante
          </Link>
        </Button>
      </div>

      {isLoadingReceipts && <LoadingTable rows={5} />}

      {!isLoadingReceipts && (!receipts || receipts.length === 0) && (
        <EmptyState
          icon={Upload}
          title="No hay comprobantes"
          description="Comienza cargando el primer comprobante de este proyecto"
          action={
            <Button asChild>
              <Link href={`/upload?project_id=${projectId}`}>
                <Upload className="mr-2" />
                Cargar Comprobante
              </Link>
            </Button>
          }
        />
      )}

      {!isLoadingReceipts && receipts && receipts.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Cargado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((receipt) => (
                <TableRow
                  key={receipt.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/receipts/${receipt.id}`)}
                >
                  <TableCell className="font-medium">
                    {receipt.vendor ?? 'Sin proveedor'}
                  </TableCell>
                  <TableCell>
                    {new Date(receipt.receipt_date).toLocaleDateString('es-AR')}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrency(receipt.total_amount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={receipt.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {receipt.uploader.full_name}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ProjectFormDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        project={project}
      />

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Proyecto</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar el proyecto "{project.name}"?
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
    </div>
  );
}
