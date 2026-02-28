'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { fetcher } from '@/lib/fetcher';
import { formatCurrencyCompact } from '@/lib/format';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const monthLabels: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

type Granularity = 'month' | 'week';

function formatBucketLabel(bucket: string, granularity: Granularity): string {
  if (granularity === 'month') {
    const monthNum = bucket.split('-')[1];
    return monthLabels[monthNum] || bucket;
  }
  const [, mm, dd] = bucket.split('-');
  return `${parseInt(dd, 10)}/${parseInt(mm, 10)}`;
}

function formatTooltipLabel(bucket: string, granularity: Granularity): string {
  if (granularity === 'month') {
    const monthNum = bucket.split('-')[1];
    return monthLabels[monthNum] || bucket;
  }
  const [, mm, dd] = bucket.split('-');
  const monthName = monthLabels[mm] || mm;
  return `${parseInt(dd, 10)} ${monthName}`;
}

const chartConfig = {
  egresos: {
    label: 'Egresos',
    color: 'var(--primary)',
  },
} satisfies ChartConfig;

export function SpendTrendChart() {
  const [granularity, setGranularity] = useState<Granularity>('month');

  const { data: rawData } = useSWR<Array<{ bucket: string; total: number }>>(
    `/api/dashboard/spend-trend?granularity=${granularity}`,
    fetcher
  );

  const allItems = rawData ?? [];

  const chartData = allItems.map((item) => ({
    bucket: item.bucket,
    label: formatBucketLabel(item.bucket, granularity),
    tooltipLabel: formatTooltipLabel(item.bucket, granularity),
    egresos: item.total,
  }));

  // For daily view, show label every 7 days; for monthly show all
  const tickInterval = granularity === 'week' ? 6 : 0;

  const description = granularity === 'month'
    ? 'Últimos 6 meses'
    : 'Últimas 4 semanas';

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      {/* Header */}
      <div className="p-6 flex flex-col space-y-1.5 pb-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold leading-none tracking-tight">Egresos</h3>
          <div className="flex items-center gap-3">
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              <button
                type="button"
                className={`px-2.5 py-1 font-medium transition-colors ${
                  granularity === 'week'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted/50'
                }`}
                onClick={() => setGranularity('week')}
              >
                Semana
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 font-medium transition-colors border-l border-border ${
                  granularity === 'month'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted/50'
                }`}
                onClick={() => setGranularity('month')}
              >
                Mes
              </button>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {/* Chart */}
      <div className="p-6">
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <LineChart
              accessibilityLayer
              data={chartData}
              margin={{ left: 12, right: 12, top: 8, bottom: 4 }}
            >
              <CartesianGrid vertical={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={50}
                tickFormatter={(value) => formatCurrencyCompact(value)}
                className="text-xs"
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={tickInterval}
                className="text-xs"
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel={false}
                    labelFormatter={(_label, payload) => {
                      const item = payload?.[0]?.payload;
                      return item?.tooltipLabel ?? _label;
                    }}
                    formatter={(value) => formatCurrencyCompact(Number(value))}
                  />
                }
              />
              <Line
                dataKey="egresos"
                type="monotone"
                stroke="var(--color-egresos)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}
