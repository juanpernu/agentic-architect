'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatCurrencyCompact } from '@/lib/format';
import { COST_CENTER_BADGE_STYLES } from '@/lib/project-colors';
import type { CostCenterSpend, ProjectColor } from '@architech/shared';

const currencyTickFormatter = (value: number) => formatCurrencyCompact(value);
const currencyTooltipFormatter = (value: number | undefined) => formatCurrency(Number(value ?? 0));

const DEFAULT_BAR_COLOR = 'hsl(var(--primary))';

export function SpendByCostCenterChart({ data }: { data: CostCenterSpend[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gasto por Centro de Costos</CardTitle>
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
        <CardTitle>Gasto por Centro de Costos</CardTitle>
      </CardHeader>
      <CardContent role="img" aria-label="Gráfico de barras: gasto por centro de costos">
        <ResponsiveContainer width="100%" height={Math.max(300, data.length * 50)}>
          <BarChart data={data} layout="vertical" margin={{ left: 12, right: 12, top: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis
              type="number"
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={currencyTickFormatter}
            />
            <YAxis
              type="category"
              dataKey="cost_center_name"
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
              {data.map((entry) => (
                <Cell
                  key={entry.cost_center_id}
                  fill={
                    entry.cost_center_color && COST_CENTER_BADGE_STYLES[entry.cost_center_color as ProjectColor]
                      ? COST_CENTER_BADGE_STYLES[entry.cost_center_color as ProjectColor].text
                      : DEFAULT_BAR_COLOR
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
