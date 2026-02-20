'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { Building2, Calculator, Edit, Trash2, Upload } from 'lucide-react';
import { sileo } from 'sileo';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { useCurrentUser } from '@/lib/use-current-user';
import { PROJECT_COLOR_HEX } from '@/lib/project-colors';
import type { BudgetListItem, ProjectDetail, ReceiptWithDetails } from '@/lib/api-types';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LoadingCards, LoadingTable } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
import { ImportBudgetDialog } from '@/components/import-budget-dialog';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin, isAdminOrSupervisor } = useCurrentUser();
  const projectId = params.id as string;

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
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

  const { data: budgets } = useSWR<BudgetListItem[]>(
    projectId ? `/api/budgets?project_id=${projectId}` : null,
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
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al eliminar proyecto');
      }

      sileo.success({ title: 'Proyecto eliminado con éxito' });
      await mutate('/api/projects');
      router.push('/projects');
    } catch (error) {
      sileo.error({
        title: error instanceof Error ? error.message : 'Error al eliminar proyecto',
      });
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
    <div className="p-6 animate-slide-up">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {project.color && (
              <span
                className="inline-block h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: PROJECT_COLOR_HEX[project.color] }}
              />
            )}
            {project.name}
          </span>
        }
        description={project.address ?? 'Sin dirección'}
        action={
          (isAdminOrSupervisor) ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditDialog(true)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
              {isAdmin && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-4 md:grid-cols-2 mb-6 stagger-children">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Presupuesto</CardTitle>
            {budgets && budgets.length > 0 && (
              <CardAction>
                <Badge variant="secondary">v{budgets[0].current_version}</Badge>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {budgets && budgets.length > 0 ? (
              <>
                <div className="text-3xl font-bold tracking-tight">
                  {formatCurrency(budgets[0].total_amount)}
                </div>
                <CardDescription className="mt-2">Version actual</CardDescription>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold tracking-tight text-muted-foreground/40">
                  —
                </div>
                <CardDescription className="mt-2">Sin presupuesto</CardDescription>
              </>
            )}
          </CardContent>
          <CardFooter className="border-t pt-4">
            {budgets && budgets.length > 0 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/budgets/${budgets[0].id}`}>
                  <Calculator className="mr-2 h-4 w-4" />
                  Ver presupuesto
                </Link>
              </Button>
            ) : isAdminOrSupervisor ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/budgets">
                    <Calculator className="mr-2 h-4 w-4" />
                    Crear presupuesto
                  </Link>
                </Button>
              </div>
            ) : null}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Gasto Total</CardTitle>
            <CardAction>
              <StatusBadge status={project.status} />
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">
              {formatCurrency(totalSpend)}
            </div>
            <CardDescription className="mt-2">
              {receipts?.length ?? 0} comprobantes
            </CardDescription>
          </CardContent>
          <CardFooter className="border-t pt-4 flex items-center gap-3">
            {project.architect ? (
              <>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={project.architect.avatar_url ?? undefined} alt={project.architect.full_name} />
                  <AvatarFallback className="text-xs">
                    {project.architect.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium">{project.architect.full_name}</div>
                  <div className="text-xs text-muted-foreground">{project.architect.email}</div>
                </div>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Sin arquitecto asignado</span>
            )}
          </CardFooter>
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
                  onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/receipts/${receipt.id}`); }}
                  tabIndex={0}
                  role="link"
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

      <ImportBudgetDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        projectId={projectId}
      />
    </div>
  );
}
