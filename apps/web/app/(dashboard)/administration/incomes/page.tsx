'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Wallet, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { sileo } from 'sileo';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { IncomeFormDialog } from '@/components/income-form-dialog';
import type { Income } from '@architech/shared';

type IncomeRow = Income & {
  project?: { id: string; name: string };
};

export default function IncomesPage() {
  // Filter state
  const [projectId, setProjectId] = useState('all');

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeRow | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingIncome, setDeletingIncome] = useState<IncomeRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Data fetching: projects for filters
  const { data: projects } = useSWR<Array<{ id: string; name: string }>>(
    '/api/projects',
    fetcher
  );
  // Build income list URL based on filters
  const buildUrl = () => {
    const params = new URLSearchParams();
    if (projectId && projectId !== 'all') params.set('projectId', projectId);
    return `/api/incomes?${params.toString()}`;
  };

  const incomesUrl = buildUrl();
  const { data: incomesResponse, isLoading, error } = useSWR<{ data: IncomeRow[]; total: number }>(incomesUrl, fetcher);
  const incomes = incomesResponse?.data;

  // Open edit dialog
  const handleEdit = (income: IncomeRow) => {
    setEditingIncome(income);
    setFormOpen(true);
  };

  // Open create dialog
  const handleCreate = () => {
    setEditingIncome(undefined);
    setFormOpen(true);
  };

  // Open delete confirmation
  const handleDeleteClick = (income: IncomeRow) => {
    setDeletingIncome(income);
    setDeleteDialogOpen(true);
  };

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (!deletingIncome) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/incomes/${deletingIncome.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error al eliminar');
      }
      sileo.success({ title: 'Ingreso eliminado' });
      await mutate(incomesUrl);
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al eliminar' });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeletingIncome(null);
    }
  };

  // After form save, refresh the list
  const handleSaved = () => {
    mutate(incomesUrl);
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Proyecto</label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(projects ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto">
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo ingreso
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          Error al cargar los ingresos. Intenta recargar la pagina.
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <LoadingTable rows={6} />
      ) : !incomes || incomes.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No hay ingresos registrados"
          description="No hay ingresos registrados con los filtros seleccionados."
          action={
            <Button onClick={handleCreate} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Registrar ingreso
            </Button>
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Descripcion</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {incomes.map((income) => (
                <TableRow key={income.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(income.date).toLocaleDateString('es-AR')}
                  </TableCell>
                  <TableCell>{income.project?.name ?? '-'}</TableCell>
                  <TableCell>{income.category}</TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap">
                    {formatCurrency(income.amount)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={income.description ?? ''}>
                    {income.description ?? '-'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(income)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(income)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create / Edit dialog */}
      <IncomeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        income={editingIncome}
        onSaved={handleSaved}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar ingreso</DialogTitle>
            <DialogDescription>
              Esta accion no se puede deshacer. Se eliminara permanentemente este ingreso
              {deletingIncome?.project?.name ? ` de ${deletingIncome.project.name}` : ''}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
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
