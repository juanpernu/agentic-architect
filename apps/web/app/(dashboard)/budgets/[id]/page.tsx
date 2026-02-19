'use client';

import { use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { ArrowLeft, History } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { LoadingCards } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { BudgetEditor } from '@/components/budget-editor';
import type { BudgetDetail } from '@/lib/api-types';

export default function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: budget, isLoading, error } = useSWR<BudgetDetail>(
    `/api/budgets/${id}`,
    fetcher
  );

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
      </div>
      <BudgetEditor budget={budget} />
    </div>
  );
}
