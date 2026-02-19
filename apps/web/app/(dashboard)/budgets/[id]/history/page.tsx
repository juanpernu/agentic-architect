'use client';

import { use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { BudgetVersionSummary, BudgetDetail } from '@/lib/api-types';

export default function BudgetHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: budget } = useSWR<BudgetDetail>(`/api/budgets/${id}`, fetcher);
  const { data: versions, isLoading } = useSWR<BudgetVersionSummary[]>(
    `/api/budgets/${id}/versions`,
    fetcher
  );

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/budgets/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Historial de versiones</h1>
          {budget && (
            <p className="text-muted-foreground">{(budget.project as { name: string })?.name}</p>
          )}
        </div>
      </div>

      {isLoading && <LoadingTable />}

      {!isLoading && versions && versions.length > 0 && (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Guardado por</TableHead>
                <TableHead className="text-right">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <Link
                      href={`/budgets/${id}?version=${v.version_number}`}
                      className="hover:underline"
                    >
                      <Badge variant={v.version_number === budget?.current_version ? 'default' : 'secondary'}>
                        v{v.version_number}
                      </Badge>
                      {v.version_number === budget?.current_version && (
                        <span className="ml-2 text-xs text-muted-foreground">actual</span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(v.total_amount)}</TableCell>
                  <TableCell>{v.created_by_name}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(v.created_at).toLocaleString('es-AR')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
