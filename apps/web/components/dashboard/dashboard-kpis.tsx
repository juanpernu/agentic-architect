'use client';

import useSWR from 'swr';
import { Building2, DollarSign, Receipt, Clock } from 'lucide-react';
import { KPICard } from '@/components/ui/kpi-card';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardStats {
  active_projects: number;
  monthly_spend: number;
  weekly_receipts: number;
  pending_review: number;
}

export function DashboardKPIs() {
  const { data, error, isLoading } = useSWR<DashboardStats>('/api/dashboard/stats', fetcher);

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-6 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-sm text-muted-foreground">
        Error cargando estadísticas
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <KPICard
        title="Proyectos Activos"
        value={data.active_projects}
        icon={Building2}
      />
      <KPICard
        title="Gasto Mensual"
        value={formatCurrency(data.monthly_spend)}
        icon={DollarSign}
      />
      <KPICard
        title="Comprobantes esta Semana"
        value={data.weekly_receipts}
        icon={Receipt}
      />
      <KPICard
        title="Pendientes de Revisión"
        value={data.pending_review}
        icon={Clock}
      />
    </div>
  );
}
