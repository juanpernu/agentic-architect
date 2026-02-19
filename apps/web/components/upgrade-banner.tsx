'use client';

import Link from 'next/link';
import { Zap } from 'lucide-react';

interface UpgradeBannerProps {
  message: string;
}

export function UpgradeBanner({ message }: UpgradeBannerProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
      <Zap className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="flex-1 text-amber-800 dark:text-amber-200">{message}</p>
      <Link
        href="/settings/billing"
        className="shrink-0 font-medium text-amber-700 underline underline-offset-4 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
      >
        Ver planes
      </Link>
    </div>
  );
}
