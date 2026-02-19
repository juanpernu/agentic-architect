import Link from 'next/link';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';
import { ArrowRight } from 'lucide-react';
import { getAuthContext } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import type { ReceiptStatus } from '@architech/shared';

interface RecentReceipt {
  id: string;
  vendor: string | null;
  total_amount: number;
  receipt_date: string;
  status: ReceiptStatus;
  project: { id: string; name: string };
}

async function fetchRecentReceipts(): Promise<RecentReceipt[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];

  const db = getDb();

  let query = db
    .from('receipts')
    .select('id, vendor, total_amount, receipt_date, status, project:projects!project_id(id, name)')
    .order('created_at', { ascending: false })
    .limit(5);

  // Architects only see own receipts
  if (ctx.role === 'architect') {
    query = query.eq('uploaded_by', ctx.dbUserId);
  }

  const { data } = await query;
  return (data as unknown as RecentReceipt[]) ?? [];
}

export async function RecentReceipts() {
  const receipts = await fetchRecentReceipts();

  if (receipts.length === 0) {
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
      <CardHeader>
        <CardTitle>Comprobantes Recientes</CardTitle>
        <CardAction>
          <Link
            href="/receipts"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Ver todos
            <ArrowRight className="h-4 w-4" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {receipts.map((receipt) => (
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
