'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight } from 'lucide-react';

interface Receipt {
  id: string;
  vendor: string;
  total_amount: number;
  receipt_date: string;
  status: 'pending' | 'confirmed' | 'rejected';
  project: {
    id: string;
    name: string;
  };
}

export function RecentReceipts() {
  const { data, error, isLoading } = useSWR<Receipt[]>('/api/receipts', fetcher);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comprobantes Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comprobantes Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Error cargando comprobantes
          </div>
        </CardContent>
      </Card>
    );
  }

  const recentReceipts = data.slice(0, 5);

  if (recentReceipts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comprobantes Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            No hay comprobantes disponibles
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Comprobantes Recientes</CardTitle>
        <Link
          href="/receipts"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          Ver todos
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentReceipts.map((receipt) => (
            <Link
              key={receipt.id}
              href={`/receipts/${receipt.id}`}
              className="block border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium truncate">{receipt.vendor || 'Sin proveedor'}</p>
                    <StatusBadge status={receipt.status} />
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {receipt.project.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(receipt.receipt_date).toLocaleDateString('es-AR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {formatCurrency(receipt.total_amount)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
