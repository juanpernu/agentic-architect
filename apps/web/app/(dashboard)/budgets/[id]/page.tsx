'use client';

import { use, useCallback, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { ChevronRight, History } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { LoadingCards, LoadingBudgetTable } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { BudgetTable } from '@/components/budget-table';
import type { BudgetDetail } from '@/lib/api-types';

export default function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const versionParam = searchParams.get('version');

  const apiUrl = versionParam
    ? `/api/budgets/${id}?version=${versionParam}`
    : `/api/budgets/${id}`;

  const { data: budget, isLoading, isValidating, error, mutate } = useSWR<BudgetDetail>(apiUrl, fetcher);

  // Track initial sync: show skeleton until first revalidation completes after mount.
  // This avoids showing stale cached data while SWR fetches fresh data.
  const [isInitialSync, setIsInitialSync] = useState(true);
  useEffect(() => {
    if (!isValidating && budget) {
      setIsInitialSync(false);
    }
  }, [isValidating, budget]);

  const isHistoricalVersion = versionParam && budget
    ? Number(versionParam) !== budget.current_version
    : false;

  const handlePublish = useCallback(() => {
    mutate();
  }, [mutate]);

  const handleEdit = useCallback(() => {
    mutate();
  }, [mutate]);

  if (isLoading) {
    return <LoadingCards count={3} />;
  }

  if (error || !budget) {
    return (
      <div>
        <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 pt-4 md:pt-6 pb-6 mb-6 border-b border-border bg-card">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Presupuesto</h1>
        </div>
        <div className="text-red-600">Error al cargar el presupuesto</div>
      </div>
    );
  }

  // For historical version viewing, override the snapshot from the version
  const budgetForTable = isHistoricalVersion && budget.latest_version
    ? {
        ...budget,
        snapshot: budget.latest_version.snapshot,
        status: 'published' as const, // historical versions are always read-only
      }
    : budget;

  const showSkeleton = isInitialSync && isValidating;

  return (
    <div className="animate-slide-up">
      {/* Header band */}
      <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 pt-4 md:pt-6 pb-6 mb-6 border-b border-border bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link href="/budgets" className="hover:text-primary transition-colors">
            Presupuestos
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">{budget?.project?.name ?? 'Presupuesto'}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {budget?.project?.name ?? 'Presupuesto'}
          </h1>
          <div className="flex items-center gap-3">
            {isHistoricalVersion && (
              <Link href={`/budgets/${id}`}>
                <Button variant="outline" size="sm">
                  Volver a version actual
                </Button>
              </Link>
            )}
            <Link href={`/budgets/${id}/history`}>
              <Button variant="outline" size="sm">
                <History className="mr-2 h-4 w-4" />
                Historial
              </Button>
            </Link>
          </div>
        </div>
      </div>
      {showSkeleton ? (
        <LoadingBudgetTable />
      ) : (
        <BudgetTable
          budget={budgetForTable}
          onPublish={handlePublish}
          onEdit={handleEdit}
        />
      )}
    </div>
  );
}
