'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatCurrencyCompact } from '@/lib/format';
import type { SpendTrend } from '@architech/shared';

const monthLabels: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

function formatMonth(month: string): string {
  const [, monthNum] = month.split('-');
  return monthLabels[monthNum] || month;
}

const currencyTickFormatter = (value: number) => formatCurrencyCompact(value);
const currencyTooltipFormatter = (value: number | undefined) => formatCurrency(Number(value ?? 0));

export function SpendTrendChart({ data }: { data: SpendTrend[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tendencia Mensual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            No hay datos disponibles
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map(item => ({
    ...item,
    monthLabel: formatMonth(item.month),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tendencia Mensual</CardTitle>
      </CardHeader>
      <CardContent role="img" aria-label="Gráfico de tendencia: gasto mensual">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ left: 12, right: 12, top: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="monthLabel"
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
            <Line
              type="monotone"
              dataKey="total"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
