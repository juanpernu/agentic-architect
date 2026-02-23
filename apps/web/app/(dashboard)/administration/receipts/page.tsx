'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Receipt, Search, ArrowUpDown } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import type { ReceiptWithDetails } from '@/lib/api-types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Project, Rubro, BankAccount } from '@architech/shared';
import { PROJECT_BADGE_STYLES } from '@/lib/project-colors';

export default function AdministrationReceiptsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [rubroFilter, setRubroFilter] = useState<string>('all');
  const [bankAccountFilter, setBankAccountFilter] = useState<string>('all');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: receipts, isLoading: isLoadingReceipts, error } = useSWR<ReceiptWithDetails[]>(
    '/api/receipts',
    fetcher
  );

  const { data: projects } = useSWR<Project[]>('/api/projects', fetcher);
  const { data: rubros } = useSWR<Rubro[]>('/api/rubros', fetcher);
  const { data: bankAccounts } = useSWR<BankAccount[]>('/api/bank-accounts', fetcher);

  const filteredReceipts = receipts
    ?.filter((receipt) => {
      const matchesSearch = (receipt.vendor ?? '')
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesProject =
        projectFilter === 'all' || receipt.project_id === projectFilter;
      const matchesStatus =
        statusFilter === 'all' || receipt.status === statusFilter;
      const matchesRubro =
        rubroFilter === 'all' || receipt.rubro_id === rubroFilter;
      const matchesBankAccount =
        bankAccountFilter === 'all' || receipt.bank_account_id === bankAccountFilter;
      const matchesDateFrom = !dateFrom || receipt.receipt_date >= dateFrom;
      const matchesDateTo = !dateTo || receipt.receipt_date <= dateTo;
      return matchesSearch && matchesProject && matchesStatus && matchesRubro && matchesBankAccount && matchesDateFrom && matchesDateTo;
    })
    .sort((a, b) => {
      const cmp = a.receipt_date.localeCompare(b.receipt_date);
      if (cmp !== 0) return sortDirection === 'asc' ? cmp : -cmp;
      return a.created_at.localeCompare(b.created_at);
    });

  const totalAmount = filteredReceipts?.reduce((sum, r) => sum + (r.total_amount ?? 0), 0) ?? 0;
  const receiptCount = filteredReceipts?.length ?? 0;

  if (error) {
    return <div className="text-red-600">Error al cargar comprobantes</div>;
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="relative w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar proveedor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            aria-label="Buscar por proveedor"
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Proyecto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proyectos</SelectItem>
            {projects?.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="confirmed">Confirmado</SelectItem>
            <SelectItem value="rejected">Rechazado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={rubroFilter} onValueChange={setRubroFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Rubro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los rubros</SelectItem>
            {rubros?.map((rubro) => (
              <SelectItem key={rubro.id} value={rubro.id}>
                <span className="flex items-center gap-2">
                  {rubro.color && (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: rubro.color }}
                    />
                  )}
                  {rubro.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={bankAccountFilter} onValueChange={setBankAccountFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Cuenta bancaria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las cuentas</SelectItem>
            {bankAccounts?.map((ba) => (
              <SelectItem key={ba.id} value={ba.id}>
                {ba.name} ({ba.bank_name})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-[140px]"
          aria-label="Desde"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-[140px]"
          aria-label="Hasta"
        />
      </div>

      {isLoadingReceipts && <LoadingTable rows={8} />}

      {!isLoadingReceipts && filteredReceipts?.length === 0 && (
        <EmptyState
          icon={Receipt}
          title="No hay comprobantes"
          description={
            searchQuery || projectFilter !== 'all' || statusFilter !== 'all' || rubroFilter !== 'all' || bankAccountFilter !== 'all' || dateFrom || dateTo
              ? 'No se encontraron comprobantes con los filtros seleccionados'
              : 'Los comprobantes cargados aparecerán aquí'
          }
        />
      )}

      {!isLoadingReceipts && filteredReceipts && filteredReceipts.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead className="hidden lg:table-cell">Rubro</TableHead>
                  <TableHead className="hidden xl:table-cell">Banco</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8"
                      onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                    >
                      Fecha
                      <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Cargado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.map((receipt) => (
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
                      {receipt.project ? (
                        receipt.project.color && PROJECT_BADGE_STYLES[receipt.project.color] ? (
                          <Badge
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                            style={{
                              backgroundColor: PROJECT_BADGE_STYLES[receipt.project.color].bg,
                              color: PROJECT_BADGE_STYLES[receipt.project.color].text,
                              borderColor: 'transparent',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/projects/${receipt.project_id}`);
                            }}
                          >
                            {receipt.project.name}
                          </Badge>
                        ) : (
                          <span
                            className="text-primary hover:underline cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/projects/${receipt.project_id}`);
                            }}
                          >
                            {receipt.project.name}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {receipt.rubro ? (
                        <Badge
                          variant="secondary"
                          style={
                            receipt.rubro.color
                              ? {
                                  backgroundColor: `${receipt.rubro.color}18`,
                                  color: receipt.rubro.color,
                                }
                              : undefined
                          }
                        >
                          {receipt.rubro.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground">
                      {receipt.bank_account ? receipt.bank_account.name : '—'}
                    </TableCell>
                    <TableCell>
                      {new Date(receipt.receipt_date).toLocaleDateString('es-AR')}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
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
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    {receiptCount} {receiptCount === 1 ? 'comprobante' : 'comprobantes'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell" />
                  <TableCell className="hidden xl:table-cell" />
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(totalAmount)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </Card>
      )}
    </>
  );
}
