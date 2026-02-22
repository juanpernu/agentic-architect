import Link from 'next/link';
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
  iconBg?: string;
  iconColor?: string;
  badge?: StatBadge;
  subtitle?: string;
  subtitleVariant?: 'muted' | 'warning';
  pulse?: boolean;
  href?: string;
  actionLabel?: string;
}

const badgeStyles = {
  positive: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20',
  negative: 'text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-900/20',
};

export function StatCard({
  title,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  badge,
  subtitle,
  subtitleVariant = 'muted',
  pulse,
  href,
  actionLabel,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-2">
      <div className="flex flex-row items-center justify-between pb-2">
        <h3 className="tracking-tight text-sm font-medium text-muted-foreground">{title}</h3>
        <div className="relative">
          {iconBg ? (
            <div className={cn('p-2 rounded-lg', iconBg)}>
              <Icon className={cn('h-5 w-5', iconColor)} />
            </div>
          ) : (
            <Icon className={cn('h-5 w-5 text-muted-foreground', iconColor)} />
          )}
          {pulse && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-2xl font-bold">{value}</div>
        {badge && (
          <span className={cn(
            'text-xs font-semibold flex items-center px-1.5 py-0.5 rounded w-fit',
            badgeStyles[badge.variant]
          )}>
            {badge.label}
          </span>
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
      {href && actionLabel && (
        <Link
          href={href}
          className="text-xs font-semibold text-primary hover:underline transition-colors mt-1"
        >
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}
