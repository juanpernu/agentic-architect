import Link from 'next/link';
import { ArrowRight, Receipt as ReceiptIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { formatRelativeWithTime } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { getAuthContext } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import type { ReceiptStatus } from '@architech/shared';

interface RecentReceipt {
  id: string;
  vendor: string | null;
  total_amount: number;
  receipt_date: string;
  created_at: string;
  status: ReceiptStatus;
  project: { id: string; name: string; organization_id: string };
}

async function fetchRecentReceipts(): Promise<RecentReceipt[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];

  const db = getDb();

  let query = db
    .from('receipts')
    .select('id, vendor, total_amount, receipt_date, created_at, status, project:projects!project_id!inner(id, name, organization_id)')
    .eq('projects.organization_id', ctx.orgId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (ctx.role === 'architect') {
    query = query.eq('uploaded_by', ctx.dbUserId);
  }

  const { data } = await query;
  return (data as unknown as RecentReceipt[]) ?? [];
}

const STATUS_STYLES: Record<ReceiptStatus, string> = {
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_LABELS: Record<ReceiptStatus, string> = {
  confirmed: 'Confirmado',
  pending: 'Pendiente',
  rejected: 'Rechazado',
};

export async function RecentReceipts() {
  const receipts = await fetchRecentReceipts();

  if (receipts.length === 0) {
    return (
      <section>
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="font-bold text-lg">Comprobantes Recientes</h3>
        </div>
        <Card className="shadow-soft border-border/50 p-6">
          <p className="text-sm text-muted-foreground">No hay comprobantes disponibles</p>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <div className="flex justify-between items-center mb-4 px-1">
        <h3 className="font-bold text-lg">Comprobantes Recientes</h3>
        <Link href="/receipts" className="text-sm text-primary font-medium hover:underline">
          Ver Todos
        </Link>
      </div>
      <Card className="shadow-soft border-border/50 overflow-hidden p-0">
        <ul className="divide-y divide-border">
          {receipts.map((receipt) => (
            <li key={receipt.id}>
              <Link
                href={`/receipts/${receipt.id}`}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <ReceiptIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{receipt.vendor || 'Sin proveedor'}</p>
                    <p className="text-xs text-muted-foreground">{formatRelativeWithTime(receipt.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{formatCurrency(receipt.total_amount)}</p>
                  <span className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium mt-1',
                    STATUS_STYLES[receipt.status] ?? STATUS_STYLES.pending
                  )}>
                    {STATUS_LABELS[receipt.status] ?? receipt.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <div className="bg-muted/30 p-3 text-center border-t">
          <Link
            href="/receipts"
            className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1"
          >
            Ver historial completo <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>
    </section>
  );
}
