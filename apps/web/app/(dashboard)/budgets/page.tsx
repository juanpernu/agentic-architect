'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useRouter } from 'next/navigation';
import { sileo } from 'sileo';
import { Calculator, Plus, Search, Trash2 } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { formatRelativeShort } from '@/lib/date-utils';
import { getInitials, getAvatarColor } from '@/lib/avatar-utils';
import { useCurrentUser } from '@/lib/use-current-user';
import type { BudgetListItem } from '@/lib/api-types';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingCards } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CreateBudgetDialog } from '@/components/create-budget-dialog';
import { cn } from '@/lib/utils';

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
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <h1 className="text-2xl font-bold tracking-tight">Presupuestos</h1>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
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
            const avatarColor = getAvatarColor(budget.project_name);
            const initials = getInitials(budget.project_name);

            return (
              <div
                key={budget.id}
                role="button"
                tabIndex={0}
                className="group bg-card rounded-xl p-4 shadow-soft border border-border/50 active:scale-[0.99] transition-all cursor-pointer hover:border-primary/50"
                onClick={() => router.push(`/budgets/${budget.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/budgets/${budget.id}`); } }}
              >
                {/* Top row: avatar + name + version badge */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0',
                        avatarColor.bg,
                        avatarColor.text
                      )}
                    >
                      {initials}
                    </div>
                    <h4 className="font-semibold leading-tight truncate">
                      {budget.project_name}
                    </h4>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200 border border-purple-200 dark:border-purple-800/50 shrink-0 ml-2">
                    v{budget.current_version}
                  </span>
                </div>

                {/* Divider + total + date */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Total
                    </span>
                    <span className="text-base font-bold">
                      {formatCurrency(budget.total_amount)}
                    </span>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className="text-[10px] text-muted-foreground">Actualizado</span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {formatRelativeShort(budget.updated_at)}
                    </span>
                  </div>
                </div>

                {/* Delete action for admins */}
                {isAdminOrSupervisor && (
                  <div className="mt-3 pt-2 border-t border-border md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      className="text-xs text-destructive hover:underline flex items-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingBudget(budget);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
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
  );
}
