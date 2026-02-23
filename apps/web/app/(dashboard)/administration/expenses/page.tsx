'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { Receipt, Plus, MoreHorizontal, Pencil, Trash2, Paperclip, ExternalLink } from 'lucide-react';
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
import { ExpenseFormDialog } from '@/components/expense-form-dialog';
import type { Expense } from '@architech/shared';

type ExpenseRow = Expense & {
  project?: { id: string; name: string };
  expense_type?: { id: string; name: string };
  rubro?: { id: string; name: string } | null;
};

export default function ExpensesPage() {
  // Filter state
  const [projectId, setProjectId] = useState('all');
  const [expenseTypeId, setExpenseTypeId] = useState('all');
  const [rubroId, setRubroId] = useState('all');

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<ExpenseRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Data fetching: projects and expense types for filters
  const { data: projects } = useSWR<Array<{ id: string; name: string }>>(
    '/api/projects',
    fetcher
  );
  const { data: expenseTypes } = useSWR<Array<{ id: string; name: string }>>(
    '/api/expense-types',
    fetcher
  );

  // Fetch budgets for selected project (to get rubros for filter)
  const { data: budgets } = useSWR<Array<{ id: string }>>(
    projectId && projectId !== 'all' ? `/api/budgets?project_id=${projectId}` : null,
    fetcher
  );
  const budget = budgets?.[0];

  const { data: rubros } = useSWR<Array<{ id: string; name: string }>>(
    budget?.id ? `/api/rubros?budget_id=${budget.id}` : null,
    fetcher
  );

  // Build expense list URL based on filters
  const buildUrl = () => {
    const params = new URLSearchParams();
    if (projectId && projectId !== 'all') params.set('projectId', projectId);
    if (expenseTypeId && expenseTypeId !== 'all') params.set('expenseTypeId', expenseTypeId);
    if (rubroId && rubroId !== 'all') params.set('rubroId', rubroId);
    return `/api/expenses?${params.toString()}`;
  };

  const expensesUrl = buildUrl();
  const { data: expensesResponse, isLoading, error } = useSWR<{ data: ExpenseRow[]; total: number }>(expensesUrl, fetcher);
  const expenses = expensesResponse?.data;

  // When project filter changes, reset rubro filter
  const handleProjectChange = (value: string) => {
    setProjectId(value);
    setRubroId('all');
  };

  // Open edit dialog
  const handleEdit = (expense: ExpenseRow) => {
    setEditingExpense(expense);
    setFormOpen(true);
  };

  // Open create dialog
  const handleCreate = () => {
    setEditingExpense(undefined);
    setFormOpen(true);
  };

  // Open delete confirmation
  const handleDeleteClick = (expense: ExpenseRow) => {
    setDeletingExpense(expense);
    setDeleteDialogOpen(true);
  };

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (!deletingExpense) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/expenses/${deletingExpense.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error al eliminar');
      }
      sileo.success({ title: 'Egreso eliminado' });
      await mutate(expensesUrl);
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al eliminar' });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeletingExpense(null);
    }
  };

  // After form save, refresh the list
  const handleSaved = () => {
    mutate(expensesUrl);
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Proyecto</label>
          <Select value={projectId} onValueChange={handleProjectChange}>
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

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Tipo de egreso</label>
          <Select value={expenseTypeId} onValueChange={setExpenseTypeId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(expenseTypes ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {projectId && projectId !== 'all' && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Rubro</label>
            <Select value={rubroId} onValueChange={setRubroId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(rubros ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="ml-auto">
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo egreso
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          Error al cargar los egresos. Intenta recargar la pagina.
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <LoadingTable rows={6} />
      ) : !expenses || expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Sin egresos"
          description="No hay egresos registrados con los filtros seleccionados."
          action={
            <Button onClick={handleCreate} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Registrar egreso
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
                <TableHead>Tipo</TableHead>
                <TableHead>Rubro</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-center">Comp.</TableHead>
                <TableHead>Descripcion</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(expense.date).toLocaleDateString('es-AR')}
                  </TableCell>
                  <TableCell>{expense.project?.name ?? '-'}</TableCell>
                  <TableCell>{expense.expense_type?.name ?? '-'}</TableCell>
                  <TableCell>{expense.rubro?.name ?? '-'}</TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap">
                    {formatCurrency(expense.amount)}
                  </TableCell>
                  <TableCell className="text-center">
                    {expense.receipt_id ? (
                      <Link
                        href={`/receipts/${expense.receipt_id}`}
                        className="inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                        title="Ver comprobante"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Paperclip className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={expense.description ?? ''}>
                    {expense.description ?? '-'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {expense.receipt_id && (
                          <DropdownMenuItem asChild>
                            <Link href={`/receipts/${expense.receipt_id}`}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Ver comprobante
                            </Link>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleEdit(expense)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(expense)}
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
      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        expense={editingExpense}
        onSaved={handleSaved}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar egreso</DialogTitle>
            <DialogDescription>
              Esta accion no se puede deshacer. Se eliminara permanentemente este egreso
              {deletingExpense?.project?.name ? ` de ${deletingExpense.project.name}` : ''}.
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
