'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import {
  BarChart3,
  Building2,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
} from 'lucide-react';
import { sileo } from 'sileo';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency, formatCurrencyCompact } from '@/lib/format';
import { useCurrentUser } from '@/lib/use-current-user';
import { usePlan } from '@/lib/use-plan';
import { PROJECT_COLOR_HEX } from '@/lib/project-colors';
import type { BudgetListItem, ProjectDetail, ReceiptWithDetails } from '@/lib/api-types';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingCards, LoadingTable } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProjectFormDialog } from '@/components/project-form-dialog';
import { VsBudgetTable } from '@/components/administration/vs-budget-table';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 6;

const RUBRO_COLORS: Record<string, string> = {
  Materiales: 'bg-slate-100 text-slate-800',
  'Mano de Obra': 'bg-emerald-50 text-emerald-700',
  Honorarios: 'bg-indigo-50 text-indigo-700',
  Servicios: 'bg-amber-50 text-amber-700',
};

const RUBRO_BAR_COLORS = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-blue-500',
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-orange-100 text-orange-600',
    'bg-blue-100 text-blue-600',
    'bg-emerald-100 text-emerald-600',
    'bg-purple-100 text-purple-600',
    'bg-gray-100 text-gray-600',
    'bg-rose-100 text-rose-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin, isAdminOrSupervisor } = useCurrentUser();
  const projectId = params.id as string;

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<string | null>(null);
  const [isDeletingReceipt, setIsDeletingReceipt] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rubroFilter, setRubroFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

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
  const budgetAmount = budgets?.[0]?.total_amount ?? 0;
  const spendPercent = budgetAmount > 0 ? Math.min((totalSpend / budgetAmount) * 100, 100) : 0;

  // Rubro distribution
  const rubroDistribution = useMemo(() => {
    if (!receipts || receipts.length === 0 || totalSpend === 0) return [];
    const map = new Map<string, number>();
    for (const r of receipts) {
      const name = r.rubro?.name ?? 'Sin rubro';
      map.set(name, (map.get(name) ?? 0) + r.total_amount);
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount, percent: Math.round((amount / totalSpend) * 100) }))
      .sort((a, b) => b.amount - a.amount);
  }, [receipts, totalSpend]);

  // Available rubros for filter
  const availableRubros = useMemo(() => {
    if (!receipts) return [];
    const set = new Set<string>();
    for (const r of receipts) {
      if (r.rubro?.name) set.add(r.rubro.name);
    }
    return Array.from(set).sort();
  }, [receipts]);

  // Filtered receipts
  const filteredReceipts = useMemo(() => {
    if (!receipts) return [];
    const now = new Date();
    return receipts.filter((r) => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchVendor = r.vendor?.toLowerCase().includes(q);
        const matchRubro = r.rubro?.name?.toLowerCase().includes(q);
        if (!matchVendor && !matchRubro) return false;
      }
      // Rubro
      if (rubroFilter !== 'all' && r.rubro?.name !== rubroFilter) return false;
      // Date
      if (dateFilter !== 'all') {
        const d = new Date(r.receipt_date);
        if (dateFilter === 'this_month') {
          if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
        } else if (dateFilter === 'last_month') {
          const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          if (d.getMonth() !== lm.getMonth() || d.getFullYear() !== lm.getFullYear()) return false;
        } else if (dateFilter === 'this_year') {
          if (d.getFullYear() !== now.getFullYear()) return false;
        }
      }
      return true;
    });
  }, [receipts, searchQuery, rubroFilter, dateFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredReceipts.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedReceipts = filteredReceipts.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE
  );
  const showFrom = filteredReceipts.length > 0 ? (safeCurrentPage - 1) * PAGE_SIZE + 1 : 0;
  const showTo = Math.min(safeCurrentPage * PAGE_SIZE, filteredReceipts.length);

  // Reset page on filter change
  const handleSearchChange = (v: string) => { setSearchQuery(v); setCurrentPage(1); };
  const handleRubroChange = (v: string) => { setRubroFilter(v); setCurrentPage(1); };
  const handleDateChange = (v: string) => { setDateFilter(v); setCurrentPage(1); };

  const handleDeleteReceipt = async () => {
    if (!receiptToDelete) return;
    setIsDeletingReceipt(true);
    try {
      const response = await fetch(`/api/receipts/${receiptToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al eliminar comprobante');
      }

      sileo.success({ title: 'Comprobante eliminado' });
      await mutate(`/api/receipts?project_id=${projectId}`);
    } catch (error) {
      sileo.error({
        title: error instanceof Error ? error.message : 'Error al eliminar comprobante',
      });
    } finally {
      setIsDeletingReceipt(false);
      setReceiptToDelete(null);
    }
  };

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
        <div className="text-red-600">Error al cargar el proyecto</div>
      </div>
    );
  }

  if (isLoadingProject) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <LoadingCards count={2} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-lg mx-auto p-6">
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

  const projectColor = project.color ? PROJECT_COLOR_HEX[project.color] : '#3B82F6';

  return (
    <div className="animate-slide-up">
      {/* Header band */}
      <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 pt-4 md:pt-6 pb-6 mb-6 border-b border-border bg-card">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link href="/projects" className="hover:text-primary transition-colors">
            Proyectos
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">{project.name}</span>
        </div>

        {/* Title + actions */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              {project.color && (
                <span
                  className="inline-block h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: PROJECT_COLOR_HEX[project.color] }}
                />
              )}
              {project.name}
            </h1>
            <p className="text-muted-foreground mt-1">
              {project.address ?? 'Gestión integral del presupuesto y control de gastos.'}
            </p>
          </div>
        {isAdminOrSupervisor && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(true)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </Button>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Stats cards row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Budget card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet className="h-14 w-14 text-primary" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Total Presupuestado</p>
          <h3 className="text-3xl font-bold tracking-tight">
            {budgetAmount > 0 ? formatCurrency(budgetAmount) : '—'}
          </h3>
          {budgetAmount > 0 && budgets?.[0] && (
            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-green-600 bg-green-50 py-1 px-2 rounded w-fit">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>v{budgets[0].current_version}</span>
            </div>
          )}
          {budgetAmount === 0 && (
            <div className="mt-4">
              {isAdminOrSupervisor ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/budgets">
                    <Calculator className="mr-2 h-4 w-4" />
                    Crear presupuesto
                  </Link>
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">Sin presupuesto</p>
              )}
            </div>
          )}
        </div>

        {/* Spend card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-1">Gasto total</p>
          <h3 className="text-3xl font-bold tracking-tight mb-4">
            {formatCurrency(totalSpend)}
          </h3>
          {budgetAmount > 0 && (
            <div className="flex flex-col gap-2">
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="bg-primary h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${spendPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>$0</span>
                <span>Meta: {formatCurrencyCompact(budgetAmount)}</span>
              </div>
            </div>
          )}
          {budgetAmount === 0 && (
            <p className="text-xs text-muted-foreground">{receipts?.length ?? 0} comprobantes</p>
          )}
        </div>

        {/* Rubro distribution card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col gap-4">
          <h4 className="text-sm font-semibold">Distribución por Rubro</h4>
          {rubroDistribution.length > 0 ? (
            <div className="space-y-3">
              {rubroDistribution.map((item, idx) => (
                <div key={item.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-medium">{item.percent}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`${RUBRO_BAR_COLORS[idx % RUBRO_BAR_COLORS.length]} h-2 rounded-full`}
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos de rubros</p>
          )}
        </div>
      </div>

      {/* Receipts table — full width */}
      <div className="flex flex-col min-h-[500px]">
        <div className="rounded-xl border border-border bg-card shadow-sm flex flex-col h-full overflow-hidden">
            {/* Table header */}
            <div className="p-6 border-b border-border/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold">Comprobantes del Proyecto</h2>
                <p className="text-sm text-muted-foreground">Registro detallado de facturas y gastos.</p>
              </div>
              <Button asChild>
                <Link href={`/upload?project_id=${projectId}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Cargar Comprobante
                </Link>
              </Button>
            </div>

            {/* Filters */}
            <div className="px-6 py-3 bg-muted/30 border-b border-border/50 flex gap-3 overflow-x-auto">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por proveedor o rubro..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={rubroFilter} onValueChange={handleRubroChange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Todos los Rubros" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Rubros</SelectItem>
                  {availableRubros.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={handleDateChange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="this_month">Este Mes</SelectItem>
                  <SelectItem value="last_month">Mes Pasado</SelectItem>
                  <SelectItem value="this_year">Este Año</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {isLoadingReceipts ? (
              <div className="p-6">
                <LoadingTable rows={5} />
              </div>
            ) : filteredReceipts.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <EmptyState
                  icon={Upload}
                  title={receipts?.length === 0 ? 'No hay comprobantes' : 'Sin resultados'}
                  description={
                    receipts?.length === 0
                      ? 'Comienza cargando el primer comprobante'
                      : 'Probá ajustando los filtros'
                  }
                />
              </div>
            ) : (
              <>
                <div className="overflow-auto flex-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead className="hidden sm:table-cell">Rubro</TableHead>
                        <TableHead className="hidden md:table-cell">Tipo</TableHead>
                        <TableHead className="text-right">Total (ARS)</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedReceipts.map((receipt) => {
                        const vendor = receipt.vendor || 'Sin proveedor';
                        const rubroName = receipt.rubro?.name ?? 'Sin rubro';
                        const rubroStyle = RUBRO_COLORS[rubroName] ?? 'bg-slate-100 text-slate-800';
                        return (
                          <TableRow
                            key={receipt.id}
                            className="group cursor-pointer"
                            onClick={() => router.push(`/receipts/${receipt.id}`)}
                            onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/receipts/${receipt.id}`); }}
                            tabIndex={0}
                            aria-label={`Ver comprobante de ${receipt.vendor || 'Sin proveedor'}`}
                          >
                            <TableCell className="text-muted-foreground font-medium">
                              {new Date(receipt.receipt_date).toLocaleDateString('es-AR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                timeZone: 'America/Buenos_Aires',
                              })}
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${getAvatarColor(vendor)}`}>
                                  {getInitials(vendor)}
                                </div>
                                <span>{vendor}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${rubroStyle}`}>
                                {rubroName}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground hidden md:table-cell">
                              {receipt.receipt_type ?? '—'}
                            </TableCell>
                            <TableCell className="font-bold text-right font-mono">
                              {formatCurrency(receipt.total_amount)}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-muted-foreground hover:text-primary transition-colors p-1 rounded-full hover:bg-muted"
                                  >
                                    <MoreVertical className="h-5 w-5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => router.push(`/receipts/${receipt.id}`)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Ver comprobante
                                  </DropdownMenuItem>
                                  {isAdminOrSupervisor && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => setReceiptToDelete(receipt.id)}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Eliminar
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Mostrando <span className="font-medium text-foreground">{showFrom}</span> a{' '}
                    <span className="font-medium text-foreground">{showTo}</span> de{' '}
                    <span className="font-medium text-foreground">{filteredReceipts.length}</span> resultados
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safeCurrentPage <= 1}
                      className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safeCurrentPage >= totalPages}
                      className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
      </div>

      {/* Financial section — visible to admin and supervisor */}
      {isAdminOrSupervisor && <FinancialSection projectId={projectId} />}

      {/* Dialogs */}
      <ProjectFormDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        project={project}
      />

      <Dialog open={!!receiptToDelete} onOpenChange={(open) => { if (!open) setReceiptToDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Comprobante</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este comprobante?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReceiptToDelete(null)}
              disabled={isDeletingReceipt}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteReceipt}
              disabled={isDeletingReceipt}
            >
              {isDeletingReceipt ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Proyecto</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar el proyecto &quot;{project.name}&quot;?
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

function FinancialSection({ projectId }: { projectId: string }) {
  const { canViewAdministration } = usePlan();
  const { data: vsBudget, isLoading } = useSWR(
    canViewAdministration ? `/api/administration/vs-budget?projectId=${projectId}` : null,
    fetcher
  );

  if (!canViewAdministration) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Financiero</h2>
      </div>

      {isLoading && <LoadingTable rows={4} />}

      {!isLoading && vsBudget && !vsBudget.hasPublishedBudget && (
        <EmptyState
          icon={BarChart3}
          title="Sin presupuesto publicado"
          description="Este proyecto no tiene un presupuesto publicado. Publica un presupuesto para ver la comparacion financiera."
        />
      )}

      {!isLoading && vsBudget?.hasPublishedBudget && (
        <VsBudgetTable
          rubros={vsBudget.rubros}
          totalBudgeted={vsBudget.totalBudgeted}
          totalActual={vsBudget.totalActual}
          totalDifference={vsBudget.totalDifference}
          globalPercentage={vsBudget.globalPercentage}
        />
      )}
    </div>
  );
}
