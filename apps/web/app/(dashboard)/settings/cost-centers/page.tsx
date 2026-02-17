'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Layers, Pencil, Trash2, ShieldAlert } from 'lucide-react';
import { sileo } from 'sileo';
import { fetcher } from '@/lib/fetcher';
import { useCurrentUser } from '@/lib/use-current-user';
import { PROJECT_COLOR_HEX } from '@/lib/project-colors';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { CostCenterFormDialog } from '@/components/cost-center-form-dialog';
import type { CostCenter } from '@architech/shared';

export default function CostCentersPage() {
  const { role, isAdminOrSupervisor } = useCurrentUser();
  const canManage = role === 'admin' || role === 'supervisor';
  const { data: costCenters, error } = useSWR<CostCenter[]>(
    isAdminOrSupervisor ? '/api/cost-centers' : null,
    fetcher
  );

  if (!isAdminOrSupervisor) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acceso denegado"
        description="No tenés permisos para ver los centros de costos."
      />
    );
  }

  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingCostCenter, setEditingCostCenter] = useState<CostCenter | undefined>();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = (cc: CostCenter) => {
    setEditingCostCenter(cc);
    setShowFormDialog(true);
  };

  const handleCreate = () => {
    setEditingCostCenter(undefined);
    setShowFormDialog(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/cost-centers/${deletingId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al eliminar');
      }
      sileo.success({ title: 'Centro de costos eliminado' });
      await mutate('/api/cost-centers');
      setShowDeleteDialog(false);
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al eliminar' });
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  if (!costCenters && !error) return <LoadingTable />;

  if (error) {
    return (
      <EmptyState
        icon={Layers}
        title="Error al cargar centros de costos"
        description="Hubo un problema. Por favor, intenta de nuevo."
      />
    );
  }

  if (!costCenters || costCenters.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No hay centros de costos"
        description="Crea tu primer centro de costos para clasificar comprobantes."
        action={
          canManage ? (
            <Button onClick={handleCreate}>Crear centro de costos</Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      {canManage && (
        <div className="flex justify-end mb-4">
          <Button onClick={handleCreate}>Nuevo centro de costos</Button>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Color</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="hidden md:table-cell">Descripción</TableHead>
              {canManage && <TableHead className="w-[100px]">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {costCenters.map((cc) => (
              <TableRow key={cc.id}>
                <TableCell>
                  {cc.color ? (
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: PROJECT_COLOR_HEX[cc.color] }}
                    />
                  ) : (
                    <span className="inline-block h-3 w-3 rounded-full bg-muted" />
                  )}
                </TableCell>
                <TableCell className="font-medium">{cc.name}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {cc.description || '—'}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(cc)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(cc.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CostCenterFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        costCenter={editingCostCenter}
      />

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Centro de Costos</DialogTitle>
            <DialogDescription>
              ¿Estás seguro? Los comprobantes asignados a este centro conservarán la referencia pero no se podrá seleccionar en nuevos comprobantes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
