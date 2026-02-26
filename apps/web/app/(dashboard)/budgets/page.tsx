'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useRouter } from 'next/navigation';
import { sileo } from 'sileo';
import { Calculator, Plus, Search, Trash2 } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { PROJECT_COLOR_HEX } from '@/lib/project-colors';
import { formatRelativeShort } from '@/lib/date-utils';
import { useCurrentUser } from '@/lib/use-current-user';
import type { BudgetListItem } from '@/lib/api-types';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingCards } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
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
      <div className="space-y-6 animate-slide-up">
        <h1 className="text-2xl font-bold tracking-tight">Presupuestos</h1>
        <div className="text-red-600">Error al cargar presupuestos</div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      {/* Header band */}
      <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 pt-4 md:pt-6 pb-6 mb-6 border-b border-border bg-card space-y-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Presupuestos</h1>
          <p className="text-muted-foreground mt-1">Cotizaciones y presupuestos por proyecto</p>
        </div>
        <div className="relative sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por obra o cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            aria-label="Buscar presupuestos"
          />
        </div>
      </div>

      <div className="space-y-6">

      {/* CTA Card — New Budget */}
      {isAdminOrSupervisor && (
        <div className="bg-primary rounded-2xl p-5 shadow-lg text-white relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-lg font-bold mb-1">Nuevo Presupuesto</h2>
            <p className="text-primary-foreground/80 text-sm mb-4">
              Crea una cotización rápida o usa el asistente de IA.
            </p>
            <Button
              variant="secondary"
              className="bg-white text-primary hover:bg-gray-50 shadow"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="mr-1 h-4 w-4" />
              Crear ahora
            </Button>
          </div>
          <div className="absolute -right-6 -bottom-10 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl" />
        </div>
      )}

      {/* Section header */}
      {!isLoading && filteredBudgets && filteredBudgets.length > 0 && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recientes</h3>
        </div>
      )}

      {isLoading && <LoadingCards count={4} />}

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
                <Plus className="mr-2 h-4 w-4" />
                Crear Presupuesto
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Budget cards */}
      {!isLoading && filteredBudgets && filteredBudgets.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
          {filteredBudgets.map((budget) => {
            return (
              <Card
                key={budget.id}
                role="button"
                tabIndex={0}
                className="group shadow-soft border-border/50 active:scale-[0.99] transition-all cursor-pointer hover:border-primary/50"
                onClick={() => router.push(`/budgets/${budget.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/budgets/${budget.id}`); } }}
              >
                <CardContent>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {budget.project_color && (
                        <span
                          className="inline-block w-3 h-3 rounded-full shrink-0 mt-1.5"
                          style={{ backgroundColor: PROJECT_COLOR_HEX[budget.project_color as keyof typeof PROJECT_COLOR_HEX] }}
                        />
                      )}
                      <h3 className="text-2xl font-bold leading-tight truncate">
                        {budget.project_name}
                      </h3>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200 border border-purple-200 dark:border-purple-800/50 shrink-0">
                      v{budget.current_version}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Total: {formatCurrency(budget.total_amount)}
                  </div>
                </CardContent>

                <CardFooter className="border-t border-border justify-between">
                  <div className="text-xs text-muted-foreground">
                    Ult. act. {formatRelativeShort(budget.updated_at)}
                    {budget.updated_by_name && (
                      <span> por <span className="font-medium text-foreground">{budget.updated_by_name}</span></span>
                    )}
                  </div>
                  {isAdminOrSupervisor && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingBudget(budget);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
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
              Se eliminará el presupuesto de <strong>{deletingBudget?.project_name}</strong> y todas sus versiones. Esta acción no se puede deshacer.
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
    </div>
  );
}
