'use client';

import { useState, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { BarChart3, DollarSign, Receipt, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import type { CostCenterSpend, Project } from '@architech/shared';
import type { ReceiptWithDetails } from '@/lib/api-types';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { KPICard } from '@/components/ui/kpi-card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
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
import { COST_CENTER_BADGE_STYLES } from '@/lib/project-colors';
import { SpendByCostCenterChart } from '@/components/reports/spend-by-cost-center-chart';

export default function ReportsPage() {
  const router = useRouter();
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedCostCenter, setExpandedCostCenter] = useState<string | null>(null);

  // Build query string for report API
  const reportParams = useMemo(() => {
    const params = new URLSearchParams();
    if (projectFilter !== 'all') params.set('project_id', projectFilter);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [projectFilter, dateFrom, dateTo]);

  const { data: reportData, isLoading: isLoadingReport, error } = useSWR<CostCenterSpend[]>(
    `/api/reports/by-cost-center${reportParams}`,
    fetcher
  );

  const { data: projects } = useSWR<Project[]>('/api/projects', fetcher);

  // Build query string for drill-down receipts
  const drilldownParams = useMemo(() => {
    if (!expandedCostCenter) return '';
    const params = new URLSearchParams();
    params.set('cost_center_id', expandedCostCenter);
    params.set('status', 'confirmed');
    if (projectFilter !== 'all') params.set('project_id', projectFilter);
    return `?${params.toString()}`;
  }, [expandedCostCenter, projectFilter]);

  const { data: drilldownReceipts, isLoading: isLoadingDrilldown } = useSWR<ReceiptWithDetails[]>(
    expandedCostCenter ? `/api/receipts${drilldownParams}` : null,
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
  const topCostCenter = reportData?.[0]; // Already sorted desc by API

  const handleToggleCostCenter = (costCenterId: string) => {
    setExpandedCostCenter((prev) => (prev === costCenterId ? null : costCenterId));
  };

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Reportes" />
        <div className="text-red-600">Error al cargar reportes</div>
      </div>
    );
  }

  return (
    <div className="p-6 animate-slide-up">
      <PageHeader
        title="Reportes"
        description="Análisis de gastos por centro de costos"
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
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

      {isLoadingReport && <LoadingTable rows={6} />}

      {!isLoadingReport && reportData && (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 mb-6">
            <KPICard title="Total Gastado" value={formatCurrency(totalSpend)} icon={DollarSign} />
            <KPICard title="Comprobantes" value={totalReceipts} icon={Receipt} />
            <KPICard
              title="Mayor Gasto"
              value={topCostCenter?.cost_center_name ?? '—'}
              icon={TrendingUp}
              description={topCostCenter ? formatCurrency(topCostCenter.total_amount) : undefined}
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
                <SpendByCostCenterChart data={reportData} />
              </div>

              {/* Summary Table with Drill-down */}
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>Centro de Costos</TableHead>
                        <TableHead className="text-right">Comprobantes</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">% del Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.map((row) => {
                        const isExpanded = expandedCostCenter === row.cost_center_id;
                        const pct = totalSpend > 0
                          ? ((row.total_amount / totalSpend) * 100).toFixed(1)
                          : '0.0';

                        return (
                          <Fragment key={row.cost_center_id}>
                            <TableRow
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleToggleCostCenter(row.cost_center_id)}
                            >
                              <TableCell>
                                {isExpanded
                                  ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  style={
                                    row.cost_center_color && COST_CENTER_BADGE_STYLES[row.cost_center_color as keyof typeof COST_CENTER_BADGE_STYLES]
                                      ? {
                                          backgroundColor: COST_CENTER_BADGE_STYLES[row.cost_center_color as keyof typeof COST_CENTER_BADGE_STYLES].bg,
                                          color: COST_CENTER_BADGE_STYLES[row.cost_center_color as keyof typeof COST_CENTER_BADGE_STYLES].text,
                                        }
                                      : undefined
                                  }
                                >
                                  {row.cost_center_name}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">{row.receipt_count}</TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(row.total_amount)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {pct}%
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow>
                                <TableCell colSpan={5} className="p-0">
                                  <div className="bg-muted/30 p-4">
                                    {isLoadingDrilldown ? (
                                      <LoadingTable rows={3} />
                                    ) : filteredDrilldown.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">
                                        No hay comprobantes para este centro de costos
                                      </p>
                                    ) : (
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Proveedor</TableHead>
                                            <TableHead>Proyecto</TableHead>
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
                                              <TableCell>{receipt.project?.name ?? '—'}</TableCell>
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
