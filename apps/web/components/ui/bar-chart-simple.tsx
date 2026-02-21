'use client';

import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BarChartItem {
  label: string;
  value: number;
  formattedValue?: string;
}

interface BarChartSimpleProps {
  title: string;
  data: BarChartItem[];
  legend?: string;
  highlightLast?: boolean;
  emptyMessage?: string;
}

const BAR_GRADIENT = [
  'bg-blue-100 dark:bg-blue-900/30',
  'bg-blue-200 dark:bg-blue-800/40',
  'bg-blue-300 dark:bg-blue-700/50',
  'bg-blue-400 dark:bg-blue-600/60',
  'bg-blue-500 dark:bg-blue-500/70',
];

export function BarChartSimple({
  title,
  data,
  legend,
  highlightLast = true,
  emptyMessage = 'No hay datos disponibles',
}: BarChartSimpleProps) {
  if (data.length === 0) {
    return (
      <Card className="shadow-soft border-border/50">
        <CardHeader>
          <CardTitle className="text-base font-bold">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <Card className="shadow-soft border-border/50">
      <CardHeader>
        <CardTitle className="text-base font-bold">{title}</CardTitle>
        {legend && (
          <CardAction>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs text-muted-foreground">{legend}</span>
            </div>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-40 flex items-end justify-between gap-2 pt-4 px-2 relative">
          {/* Dashed grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border-t border-dashed border-border h-0 w-full" />
            ))}
          </div>

          {/* Bars */}
          {data.map((item, index) => {
            const heightPercent = (item.value / maxValue) * 100;
            const isLast = index === data.length - 1;
            const gradientIndex = data.length <= 1
              ? 0
              : data.length <= BAR_GRADIENT.length
                ? index
                : Math.floor((index / (data.length - 1)) * (BAR_GRADIENT.length - 1));
            const barColor = isLast && highlightLast
              ? 'bg-primary'
              : BAR_GRADIENT[gradientIndex] ?? BAR_GRADIENT[BAR_GRADIENT.length - 1];

            return (
              <div
                key={item.label}
                className={cn(
                  'flex-1 rounded-t-sm relative group z-10 transition-all',
                  barColor,
                  isLast && highlightLast && 'shadow-lg shadow-primary/30'
                )}
                style={{ height: `${heightPercent}%` }}
              >
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {item.formattedValue ?? item.label}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
