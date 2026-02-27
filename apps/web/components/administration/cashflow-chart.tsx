'use client';

import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';

interface CashflowData {
  month: number;
  monthName: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

const currencyTooltipFormatter = (value: string | number | (string | number)[]) => formatCurrency(Number(value ?? 0));

export function CashflowChart({ data }: { data: CashflowData[] }) {
  // Show last 6 months with data
  const recentData = data.filter(d => d.totalIncome > 0 || d.totalExpense > 0).slice(-6);

  if (recentData.length === 0) {
    return (
      <Card>
        <div className="px-6 pt-5 pb-2">
          <h3 className="text-lg font-semibold">Tendencia Mensual</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Flujo de gastos en los últimos 6 meses.</p>
        </div>
        <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
          No hay movimientos registrados en este periodo
        </div>
      </Card>
    );
  }

  // Merge income + expense into a single "net flow" or show total movement
  const chartData = recentData.map(d => ({
    monthName: d.monthName,
    total: d.totalIncome + d.totalExpense,
    income: d.totalIncome,
    expense: d.totalExpense,
  }));

  return (
    <Card>
      <div className="px-6 pt-5 pb-2">
        <h3 className="text-lg font-semibold">Tendencia Mensual</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Flujo de gastos en los últimos 6 meses.</p>
      </div>
      <div className="px-2 pb-4">
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData} margin={{ left: 12, right: 12, top: 16, bottom: 4 }}>
            <defs>
              <linearGradient id="cashflowGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="monthName"
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              dy={8}
            />
            <Tooltip
              formatter={currencyTooltipFormatter}
              labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                padding: '8px 12px',
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              name="Total"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              fill="url(#cashflowGradient)"
              dot={{ fill: 'hsl(var(--background))', stroke: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
              activeDot={{ fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2, r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
