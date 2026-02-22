'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatCurrencyCompact } from '@/lib/format';

interface CashflowData {
  month: number;
  monthName: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

const currencyTickFormatter = (value: number) => formatCurrencyCompact(value);
const currencyTooltipFormatter = (value: number | undefined) => formatCurrency(Number(value ?? 0));

export function CashflowChart({ data }: { data: CashflowData[] }) {
  const hasData = data.some(d => d.totalIncome > 0 || d.totalExpense > 0);

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Flujo de Caja</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
            No hay movimientos registrados en este periodo
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flujo de Caja</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ left: 12, right: 12, top: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="monthName"
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
            <Legend />
            <Line
              type="monotone"
              dataKey="totalIncome"
              name="Ingresos"
              stroke="hsl(210, 100%, 50%)"
              strokeWidth={2}
              dot={{ fill: 'hsl(210, 100%, 50%)', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="totalExpense"
              name="Egresos"
              stroke="hsl(25, 100%, 55%)"
              strokeWidth={2}
              dot={{ fill: 'hsl(25, 100%, 55%)', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
