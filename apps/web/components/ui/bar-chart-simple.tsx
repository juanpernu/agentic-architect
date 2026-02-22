import { cn } from '@/lib/utils';

interface BarChartItem {
  label: string;
  value: number;
  formattedValue?: string;
}

interface BarChartSimpleProps {
  title: string;
  description?: string;
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
  description,
  data,
  legend,
  highlightLast = true,
  emptyMessage = 'No hay datos disponibles',
}: BarChartSimpleProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="p-6 flex flex-col space-y-1.5 pb-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold leading-none tracking-tight">{title}</h3>
          {legend && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs text-muted-foreground">{legend}</span>
            </div>
          )}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="p-6">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
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
        )}
        {/* X-axis labels */}
        {data.length > 0 && (
          <div className="flex justify-between mt-3 px-2">
            {data.map((item) => (
              <span key={item.label} className="text-xs text-muted-foreground font-medium flex-1 text-center">
                {item.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
