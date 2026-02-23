'use client';

import { use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { BudgetVersionSummary, BudgetDetail } from '@/lib/api-types';

export default function BudgetHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: budget } = useSWR<BudgetDetail>(`/api/budgets/${id}`, fetcher);
  const { data: versions, isLoading } = useSWR<BudgetVersionSummary[]>(
    `/api/budgets/${id}/versions`,
    fetcher
  );

  const projectName = budget ? (budget.project as { name: string })?.name : null;

  return (
    <div className="animate-slide-up">
      {/* Header band */}
      <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 pt-4 md:pt-6 pb-6 mb-6 border-b border-border bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link href="/budgets" className="hover:text-primary transition-colors">
            Presupuestos
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href={`/budgets/${id}`} className="hover:text-primary transition-colors">
            {projectName ?? 'Presupuesto'}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">Historial</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Historial de versiones</h1>
        {projectName && (
          <p className="text-muted-foreground mt-1">{projectName}</p>
        )}
      </div>

      {isLoading && <LoadingTable />}

      {!isLoading && versions && versions.length > 0 && (
        <Card>
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
                <TableRow
                  key={v.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/budgets/${id}?version=${v.version_number}`)}
                >
                  <TableCell>
                    <Badge variant={v.version_number === budget?.current_version ? 'default' : 'secondary'}>
                      v{v.version_number}
                    </Badge>
                    {v.version_number === budget?.current_version && (
                      <span className="ml-2 text-xs text-muted-foreground">actual</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(v.total_amount)}</TableCell>
                  <TableCell>{v.created_by_name}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(v.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
