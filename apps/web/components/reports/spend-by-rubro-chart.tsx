'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatCurrencyCompact } from '@/lib/format';
import type { RubroSpend } from '@architech/shared';

const currencyTickFormatter = (value: number) => formatCurrencyCompact(value);
const currencyTooltipFormatter = (value: string | number | (string | number)[]) => formatCurrency(Number(value ?? 0));

const DEFAULT_BAR_COLOR = 'hsl(var(--primary))';

interface ProjectGroup {
  project_name: string;
  total_amount: number;
}

export function SpendByRubroChart({ data }: { data: RubroSpend[] }) {
  // Group by project for the chart
  const projectMap = new Map<string, ProjectGroup>();
  for (const row of data) {
    const existing = projectMap.get(row.project_id);
    if (existing) {
      existing.total_amount += row.total_amount;
    } else {
      projectMap.set(row.project_id, {
        project_name: row.project_name,
        total_amount: row.total_amount,
      });
    }
  }
  const chartData = Array.from(projectMap.values()).sort((a, b) => b.total_amount - a.total_amount);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gasto por Proyecto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            No hay datos disponibles
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gasto por Proyecto</CardTitle>
      </CardHeader>
      <CardContent role="img" aria-label="Grafico de barras: gasto por proyecto">
        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 50)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 12, right: 12, top: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis
              type="number"
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={currencyTickFormatter}
            />
            <YAxis
              type="category"
              dataKey="project_name"
              className="text-xs"
              width={120}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip
              formatter={currencyTooltipFormatter}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Bar dataKey="total_amount" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={entry.project_name}
                  fill={DEFAULT_BAR_COLOR}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
