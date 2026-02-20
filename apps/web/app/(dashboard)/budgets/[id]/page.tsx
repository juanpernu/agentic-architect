'use client';

import { use, useCallback, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { ArrowLeft, History } from 'lucide-react';
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
    return (
      <div className="p-6">
        <LoadingCards count={3} />
      </div>
    );
  }

  if (error || !budget) {
    return (
      <div className="p-6">
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
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/budgets">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <Link href={`/budgets/${id}/history`}>
          <Button variant="outline" size="sm">
            <History className="mr-2 h-4 w-4" />
            Historial
          </Button>
        </Link>
        {isHistoricalVersion && (
          <Link href={`/budgets/${id}`}>
            <Button variant="outline" size="sm">
              Volver a version actual
            </Button>
          </Link>
        )}
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
