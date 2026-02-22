import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StatBadge {
  label: string;
  variant: 'positive' | 'negative';
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  badge?: StatBadge;
  subtitle?: string;
  subtitleVariant?: 'muted' | 'warning';
  pulse?: boolean;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  iconColor,
  badge,
  subtitle,
  subtitleVariant = 'muted',
  pulse,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-2">
      <div className="flex flex-row items-center justify-between pb-2">
        <h3 className="tracking-tight text-sm font-medium text-muted-foreground">{title}</h3>
        <div className="relative">
          <Icon className={cn('h-5 w-5 text-muted-foreground', iconColor)} />
          {pulse && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-2xl font-bold">{value}</div>
        {badge && (
          <p className={cn(
            'text-xs flex items-center font-medium',
            badge.variant === 'positive' ? 'text-green-600' : 'text-red-500'
          )}>
            {badge.label}
          </p>
        )}
        {subtitle && (
          <p className={cn(
            'text-xs font-medium',
            subtitleVariant === 'warning' ? 'text-orange-600' : 'text-muted-foreground'
          )}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
