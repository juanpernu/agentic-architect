'use client';

import { useState, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { BarChart3, DollarSign, Receipt, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import type { RubroSpend, Project } from '@architech/shared';
import type { ReceiptWithDetails } from '@/lib/api-types';
import { EmptyState } from '@/components/ui/empty-state';
import { KPICard } from '@/components/ui/kpi-card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import { Input } from '@/components/ui/input';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SpendByRubroChart } from '@/components/reports/spend-by-rubro-chart';

/* ── Helpers ── */

interface ProjectGroup {
  project_id: string;
  project_name: string;
  total_amount: number;
  receipt_count: number;
  rubros: RubroSpend[];
}

function groupByProject(data: RubroSpend[]): ProjectGroup[] {
  const map = new Map<string, ProjectGroup>();
  for (const row of data) {
    const existing = map.get(row.project_id);
    if (existing) {
      existing.total_amount += row.total_amount;
      existing.receipt_count += row.receipt_count;
      existing.rubros.push(row);
    } else {
      map.set(row.project_id, {
        project_id: row.project_id,
        project_name: row.project_name,
        total_amount: row.total_amount,
        receipt_count: row.receipt_count,
        rubros: [row],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total_amount - a.total_amount);
}

/* ── Page ── */

export default function ReportsPage() {
  const router = useRouter();
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [expandedRubro, setExpandedRubro] = useState<string | null>(null);

  // Build query string for report API
  const reportParams = useMemo(() => {
    const params = new URLSearchParams();
    if (projectFilter !== 'all') params.set('project_id', projectFilter);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [projectFilter, dateFrom, dateTo]);

  const { data: reportData, isLoading: isLoadingReport, error } = useSWR<RubroSpend[]>(
    `/api/reports/by-rubro${reportParams}`,
    fetcher
  );

  const { data: projects } = useSWR<Project[]>('/api/projects', fetcher);

  // Group data by project
  const projectGroups = useMemo(
    () => (reportData ? groupByProject(reportData) : []),
    [reportData]
  );

  // Build query string for drill-down receipts (by rubro)
  const drilldownParams = useMemo(() => {
    if (!expandedRubro) return '';
    const params = new URLSearchParams();
    params.set('rubro_id', expandedRubro);
    params.set('status', 'confirmed');
    if (projectFilter !== 'all') params.set('project_id', projectFilter);
    return `?${params.toString()}`;
  }, [expandedRubro, projectFilter]);

  const { data: drilldownReceipts, isLoading: isLoadingDrilldown } = useSWR<ReceiptWithDetails[]>(
    expandedRubro ? `/api/receipts${drilldownParams}` : null,
    fetcher
  );

  // Filter drill-down receipts by date range client-side
  const filteredDrilldown = useMemo(() => {
    if (!drilldownReceipts) return [];
    return drilldownReceipts.filter((r) => {
      if (dateFrom && r.receipt_date < dateFrom) return false;
      if (dateTo && r.receipt_date > dateTo) return false;
      return true;
    });
  }, [drilldownReceipts, dateFrom, dateTo]);

  // KPI calculations
  const totalSpend = reportData?.reduce((sum, r) => sum + r.total_amount, 0) ?? 0;
  const totalReceipts = reportData?.reduce((sum, r) => sum + r.receipt_count, 0) ?? 0;
  const topProject = projectGroups[0]; // Already sorted desc

  const handleToggleProject = (projectId: string) => {
    setExpandedProject((prev) => {
      if (prev === projectId) {
        // Collapsing project — also collapse any expanded rubro
        setExpandedRubro(null);
        return null;
      }
      setExpandedRubro(null);
      return projectId;
    });
  };

  const handleToggleRubro = (rubroId: string) => {
    setExpandedRubro((prev) => (prev === rubroId ? null : rubroId));
  };

  if (error) {
    return (
      <div>
        <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 pt-4 md:pt-6 pb-6 mb-6 border-b border-border bg-card">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Reportes</h1>
        </div>
        <div className="text-red-600">Error al cargar reportes</div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      {/* Header band */}
      <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 pt-4 md:pt-6 pb-6 mb-6 border-b border-border bg-card">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground mt-1">Analisis de gastos por proyecto y rubro</p>
      </div>

      {/* Filters */}
      <FieldGroup className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <Field className="sm:w-auto">
            <FieldLabel>Proyecto</FieldLabel>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="sm:w-[200px]">
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
          </Field>
          <Field className="sm:w-auto">
            <FieldLabel htmlFor="report-date-from">Desde</FieldLabel>
            <Input
              id="report-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="sm:w-[160px]"
            />
          </Field>
          <Field className="sm:w-auto">
            <FieldLabel htmlFor="report-date-to">Hasta</FieldLabel>
            <Input
              id="report-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="sm:w-[160px]"
            />
          </Field>
        </div>
      </FieldGroup>

      {isLoadingReport && <LoadingTable rows={6} />}

      {!isLoadingReport && reportData && (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 mb-6">
            <KPICard title="Total Gastado" value={formatCurrency(totalSpend)} icon={DollarSign} />
            <KPICard title="Comprobantes" value={totalReceipts} icon={Receipt} />
            <KPICard
              title="Mayor Gasto"
              value={topProject?.project_name ?? '—'}
              icon={TrendingUp}
              description={topProject ? formatCurrency(topProject.total_amount) : undefined}
            />
          </div>

          {reportData.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Sin datos"
              description="No hay comprobantes confirmados para los filtros seleccionados"
            />
          ) : (
            <>
              {/* Chart */}
              <div className="mb-6">
                <SpendByRubroChart data={reportData} />
              </div>

              {/* Summary Table: Project → Rubro hierarchy */}
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>Proyecto / Rubro</TableHead>
                        <TableHead className="text-right">Comprobantes</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">% del Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectGroups.map((group) => {
                        const isProjectExpanded = expandedProject === group.project_id;
                        const pct = totalSpend > 0
                          ? ((group.total_amount / totalSpend) * 100).toFixed(1)
                          : '0.0';

                        return (
                          <Fragment key={group.project_id}>
                            {/* Project row */}
                            <TableRow
                              className="cursor-pointer hover:bg-muted/50 font-medium"
                              onClick={() => handleToggleProject(group.project_id)}
                              aria-expanded={isProjectExpanded}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleToggleProject(group.project_id); }}
                            >
                              <TableCell>
                                {isProjectExpanded
                                  ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              </TableCell>
                              <TableCell>{group.project_name}</TableCell>
                              <TableCell className="text-right">{group.receipt_count}</TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(group.total_amount)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {pct}%
                              </TableCell>
                            </TableRow>

                            {/* Rubro sub-rows */}
                            {isProjectExpanded && group.rubros
                              .sort((a, b) => b.total_amount - a.total_amount)
                              .map((rubro) => {
                                const rubroPct = totalSpend > 0
                                  ? ((rubro.total_amount / totalSpend) * 100).toFixed(1)
                                  : '0.0';
                                const isRubroExpanded = expandedRubro === rubro.rubro_id;

                                return (
                                  <Fragment key={rubro.rubro_id}>
                                    <TableRow
                                      className="cursor-pointer hover:bg-muted/30 bg-muted/10"
                                      onClick={() => handleToggleRubro(rubro.rubro_id)}
                                      aria-expanded={isRubroExpanded}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === 'Enter') handleToggleRubro(rubro.rubro_id); }}
                                    >
                                      <TableCell className="pl-8">
                                        {isRubroExpanded
                                          ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                          : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                                      </TableCell>
                                      <TableCell className="pl-8">
                                        <Badge
                                          variant="secondary"
                                          style={
                                            rubro.rubro_color
                                              ? { backgroundColor: rubro.rubro_color, color: '#fff' }
                                              : undefined
                                          }
                                        >
                                          {rubro.rubro_name}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right">{rubro.receipt_count}</TableCell>
                                      <TableCell className="text-right">
                                        {formatCurrency(rubro.total_amount)}
                                      </TableCell>
                                      <TableCell className="text-right text-muted-foreground">
                                        {rubroPct}%
                                      </TableCell>
                                    </TableRow>

                                    {/* Drill-down receipts for this rubro */}
                                    {isRubroExpanded && (
                                      <TableRow>
                                        <TableCell colSpan={5} className="p-0">
                                          <div className="bg-muted/30 p-4">
                                            {isLoadingDrilldown ? (
                                              <LoadingTable rows={3} />
                                            ) : filteredDrilldown.length === 0 ? (
                                              <p className="text-sm text-muted-foreground">
                                                No hay comprobantes para este rubro
                                              </p>
                                            ) : (
                                              <Table>
                                                <TableHeader>
                                                  <TableRow>
                                                    <TableHead>Proveedor</TableHead>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead className="text-right">Monto</TableHead>
                                                    <TableHead>Estado</TableHead>
                                                  </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                  {filteredDrilldown.map((receipt) => (
                                                    <TableRow
                                                      key={receipt.id}
                                                      className="cursor-pointer"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/receipts/${receipt.id}`);
                                                      }}
                                                    >
                                                      <TableCell>{receipt.vendor ?? 'Sin proveedor'}</TableCell>
                                                      <TableCell>
                                                        {new Date(receipt.receipt_date).toLocaleDateString('es-AR')}
                                                      </TableCell>
                                                      <TableCell className="text-right font-semibold">
                                                        {formatCurrency(receipt.total_amount)}
                                                      </TableCell>
                                                      <TableCell>
                                                        <StatusBadge status={receipt.status} />
                                                      </TableCell>
                                                    </TableRow>
                                                  ))}
                                                </TableBody>
                                              </Table>
                                            )}
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </Fragment>
                                );
                              })}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
