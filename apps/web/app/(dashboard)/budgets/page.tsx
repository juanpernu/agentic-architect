'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Calculator, Plus, Search } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { useCurrentUser } from '@/lib/use-current-user';
import type { BudgetListItem } from '@/lib/api-types';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
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
import { CreateBudgetDialog } from '@/components/create-budget-dialog';

export default function BudgetsPage() {
  const { isAdminOrSupervisor } = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

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
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proyecto</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Ultima actualizacion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBudgets.map((budget) => (
                <TableRow key={budget.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Link href={`/budgets/${budget.id}`} className="font-medium hover:underline">
                      {budget.project_name}
                    </Link>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateBudgetDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}
