import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ProgressBarItem {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
}

interface ProgressBarListProps {
  title: string;
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
  items,
  maxItems = 5,
  actionLabel,
  actionHref,
  emptyMessage = 'No hay datos disponibles',
}: ProgressBarListProps) {
  const visibleItems = items.slice(0, maxItems);
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  if (items.length === 0) {
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

  return (
    <Card className="shadow-soft border-border/50">
      <CardHeader>
        <CardTitle className="text-base font-bold">{title}</CardTitle>
        {actionLabel && actionHref && (
          <CardAction>
            <Link href={actionHref} className="text-xs text-primary font-medium hover:underline">
              {actionLabel}
            </Link>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
