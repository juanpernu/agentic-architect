'use client';

import { ProgressBarList } from '@/components/ui/progress-bar-list';
import { formatCurrencyCompact } from '@/lib/format';
import type { RubroSpend } from '@architech/shared';

interface ProjectGroup {
  project_id: string;
  project_name: string;
  total_amount: number;
}

export function SpendByRubroChart({ data }: { data: RubroSpend[] }) {
  const projectMap = new Map<string, ProjectGroup>();
  for (const row of data) {
    const existing = projectMap.get(row.project_id);
    if (existing) {
      existing.total_amount += row.total_amount;
    } else {
      projectMap.set(row.project_id, {
        project_id: row.project_id,
        project_name: row.project_name,
        total_amount: row.total_amount,
      });
    }
  }
  const chartData = Array.from(projectMap.values()).sort((a, b) => b.total_amount - a.total_amount);

  return (
    <ProgressBarList
      title="Gasto por Proyecto"
      items={chartData.map((item) => ({
        id: item.project_id,
        label: item.project_name,
        value: item.total_amount,
        formattedValue: formatCurrencyCompact(item.total_amount),
      }))}
      emptyMessage="No hay datos disponibles"
    />
  );
}
