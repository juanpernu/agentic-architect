'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatCurrencyCompact } from '@/lib/format';
import type { SpendByProject } from '@architech/shared';

const currencyTickFormatter = (value: number) => formatCurrencyCompact(value);
const currencyTooltipFormatter = (value: number | undefined) => formatCurrency(Number(value ?? 0));

export function SpendByProjectChart({ data }: { data: SpendByProject[] }) {
  if (data.length === 0) {
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
      <CardContent role="img" aria-label="Gráfico de barras: gasto por proyecto">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ left: 12, right: 12, top: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="project_name"
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              className="text-xs"
              width={60}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={currencyTickFormatter}
            />
            <Tooltip
              formatter={currencyTooltipFormatter}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Bar
              dataKey="total_spend"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
