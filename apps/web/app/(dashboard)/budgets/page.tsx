'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useRouter } from 'next/navigation';
import { sileo } from 'sileo';
import { Calculator, Plus, Search, Trash2 } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { useCurrentUser } from '@/lib/use-current-user';
import type { BudgetListItem } from '@/lib/api-types';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CreateBudgetDialog } from '@/components/create-budget-dialog';

export default function BudgetsPage() {
  const router = useRouter();
  const { isAdminOrSupervisor } = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deletingBudget, setDeletingBudget] = useState<BudgetListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deletingBudget) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/budgets/${deletingBudget.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al eliminar');
      }
      sileo.success({ title: 'Presupuesto eliminado' });
      await mutate('/api/budgets');
      setDeletingBudget(null);
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al eliminar' });
    } finally {
      setIsDeleting(false);
    }
  };

  const { data: budgets, isLoading, error } = useSWR<BudgetListItem[]>(
    '/api/budgets',
    fetcher
  );

  const filteredBudgets = budgets?.filter((b) =>
    b.project_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Presupuestos" />
        <div className="text-red-600">Error al cargar presupuestos</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Presupuestos"
        description="Presupuestos de obra por proyecto"
        action={
          isAdminOrSupervisor ? (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2" />
              Nuevo Presupuesto
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por proyecto..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 max-w-md"
          aria-label="Buscar presupuestos"
        />
      </div>

      {isLoading && <LoadingTable />}

      {!isLoading && filteredBudgets?.length === 0 && (
        <EmptyState
          icon={Calculator}
          title="No hay presupuestos"
          description={
            searchQuery
              ? 'No se encontraron presupuestos con ese filtro'
              : 'Comienza creando un presupuesto para un proyecto'
          }
          action={
            !searchQuery && isAdminOrSupervisor ? (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2" />
                Crear Presupuesto
              </Button>
            ) : undefined
          }
        />
      )}

      {!isLoading && filteredBudgets && filteredBudgets.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proyecto</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Ultima actualizacion</TableHead>
                {isAdminOrSupervisor && <TableHead className="w-[50px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBudgets.map((budget) => (
                <TableRow key={budget.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/budgets/${budget.id}`)}>
                  <TableCell className="font-medium">
                    {budget.project_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">v{budget.current_version}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(budget.total_amount)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(budget.updated_at).toLocaleDateString('es-AR')}
                  </TableCell>
                  {isAdminOrSupervisor && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); setDeletingBudget(budget); }}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </Card>
      )}

      <CreateBudgetDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      <AlertDialog open={!!deletingBudget} onOpenChange={(open) => !open && setDeletingBudget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar presupuesto</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminara el presupuesto de <strong>{deletingBudget?.project_name}</strong> y todas sus versiones. Esta accion no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
