import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface StatBadge {
  label: string;
  variant: 'positive' | 'negative';
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  badge?: StatBadge;
  pulse?: boolean;
  href?: string;
  actionLabel?: string;
}

const badgeStyles = {
  positive: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20',
  negative: 'text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-900/20',
};

export function StatCard({ title, value, icon: Icon, iconBg, iconColor, badge, pulse, href, actionLabel }: StatCardProps) {
  return (
    <Card className={cn(
      'relative overflow-hidden border border-border/50 p-4 shadow-soft hover:scale-[1.02] transition-transform flex flex-col justify-between gap-0',
      href && actionLabel ? 'h-[10.5rem]' : 'h-32',
    )}>
      <div className="flex justify-between items-start">
        <div className={cn('p-2 rounded-lg', iconBg)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
        {badge && (
          <span className={cn('text-xs font-semibold flex items-center px-1.5 py-0.5 rounded', badgeStyles[badge.variant])}>
            {badge.label}
          </span>
        )}
        {pulse && (
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        )}
      </div>
      <div>
        <h3 className="text-2xl font-bold truncate" title={String(value)}>{value}</h3>
        <p className="text-xs text-muted-foreground mt-1">{title}</p>
      </div>
      {href && actionLabel && (
        <Link
          href={href}
          className="text-xs font-semibold text-primary hover:underline transition-colors"
        >
          {actionLabel} →
        </Link>
      )}
    </Card>
  );
}
