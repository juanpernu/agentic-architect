import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ProgressBarItem {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
}

interface ProgressBarListProps {
  title: string;
  description?: string;
  items: ProgressBarItem[];
  maxItems?: number;
  actionLabel?: string;
  actionHref?: string;
  emptyMessage?: string;
}

const BAR_COLORS = [
  'bg-primary',
  'bg-blue-400',
  'bg-blue-300',
  'bg-blue-200',
  'bg-blue-100',
];

export function ProgressBarList({
  title,
  description,
  items,
  maxItems = 5,
  actionLabel,
  actionHref,
  emptyMessage = 'No hay datos disponibles',
}: ProgressBarListProps) {
  const visibleItems = items.slice(0, maxItems);
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="p-6 flex flex-col space-y-1.5 pb-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold leading-none tracking-tight">{title}</h3>
          {actionLabel && actionHref && (
            <Link href={actionHref} className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
              {actionLabel}
            </Link>
          )}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="p-6">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="space-y-4">
            {visibleItems.map((item, index) => {
              const widthPercent = (item.value / maxValue) * 100;
              return (
                <div key={item.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium truncate mr-2">{item.label}</span>
                    <span className="font-bold shrink-0">{item.formattedValue}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={cn('h-2 rounded-full transition-all', BAR_COLORS[index] ?? BAR_COLORS[BAR_COLORS.length - 1])}
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
