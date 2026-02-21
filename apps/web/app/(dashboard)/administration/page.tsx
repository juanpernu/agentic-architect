'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { StatCard } from '@/components/ui/stat-card';
import { LoadingCards, LoadingTable } from '@/components/ui/loading-skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CashflowChart } from '@/components/administration/cashflow-chart';
import { BalanceByProjectTable } from '@/components/administration/balance-by-project-table';
import { VsBudgetTable } from '@/components/administration/vs-budget-table';

export default function AdministrationPage() {
  const currentYear = new Date().getFullYear();
  const [projectId, setProjectId] = useState<string>('all');
  const [year, setYear] = useState<string>(currentYear.toString());

  // Fetch projects for filter
  const { data: projects } = useSWR('/api/projects', fetcher);

  // Build query params
  const params = new URLSearchParams();
  if (projectId !== 'all') params.set('projectId', projectId);
  params.set('year', year);
  const queryString = params.toString();

  // Fetch summary data
  const { data: summary, isLoading: isLoadingSummary, error: summaryError } = useSWR(
    `/api/administration/summary?${queryString}`,
    fetcher
  );

  // Fetch cashflow data
  const { data: cashflow, isLoading: isLoadingCashflow, error: cashflowError } = useSWR(
    `/api/administration/cashflow?${queryString}`,
    fetcher
  );

  // Fetch vs-budget only when a specific project is selected
  const { data: vsBudget } = useSWR(
    projectId !== 'all' ? `/api/administration/vs-budget?projectId=${projectId}` : null,
    fetcher
  );

  // Year options (current year and 2 previous)
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Todos los proyectos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proyectos</SelectItem>
            {(projects ?? []).map((p: any) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map(y => (
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error */}
      {(summaryError || cashflowError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          Error al cargar los datos de administracion. Intenta recargar la pagina.
        </div>
      )}

      {/* KPIs */}
      {isLoadingSummary ? (
        <LoadingCards count={3} />
      ) : summary ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <StatCard
            title="Total Ingresado"
            value={formatCurrency(summary.totalIncome)}
            icon={TrendingUp}
            iconBg="bg-green-50 dark:bg-green-900/20"
            iconColor="text-green-600 dark:text-green-400"
          />
          <StatCard
            title="Total Egresado"
            value={formatCurrency(summary.totalExpense)}
            icon={TrendingDown}
            iconBg="bg-red-50 dark:bg-red-900/20"
            iconColor="text-red-600 dark:text-red-400"
          />
          <StatCard
            title="Balance"
            value={formatCurrency(summary.balance)}
            icon={DollarSign}
            iconBg={summary.balance >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-red-50 dark:bg-red-900/20'}
            iconColor={summary.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}
          />
        </div>
      ) : null}

      {/* Cashflow Chart */}
      {isLoadingCashflow ? (
        <LoadingCards count={1} />
      ) : cashflow ? (
        <CashflowChart data={cashflow} />
      ) : null}

      {/* vs-budget section (only when specific project selected) */}
      {projectId !== 'all' && vsBudget?.hasPublishedBudget && (
        <VsBudgetTable
          rubros={vsBudget.rubros}
          totalBudgeted={vsBudget.totalBudgeted}
          totalActual={vsBudget.totalActual}
          totalDifference={vsBudget.totalDifference}
          globalPercentage={vsBudget.globalPercentage}
        />
      )}

      {/* Balance by project table (only when "all" selected) */}
      {projectId === 'all' && summary?.byProject && (
        <BalanceByProjectTable data={summary.byProject} />
      )}
    </div>
  );
}
