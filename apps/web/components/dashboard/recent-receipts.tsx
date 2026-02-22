import Link from 'next/link';
import { MoreVertical } from 'lucide-react';
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Buenos_Aires',
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export async function RecentReceipts() {
  const receipts = await fetchRecentReceipts();

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="p-6 flex flex-row items-center justify-between pb-4 border-b border-border/50">
        <div className="space-y-1">
          <h3 className="font-semibold leading-none tracking-tight">Comprobantes Recientes</h3>
          <p className="text-sm text-muted-foreground">Gestione las últimas facturas recibidas.</p>
        </div>
        <Link
          href="/receipts"
          className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Ver todos
        </Link>
      </div>

      {receipts.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-muted-foreground">No hay comprobantes disponibles</p>
        </div>
      ) : (
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="h-12 px-6 text-left align-middle font-medium text-muted-foreground">ID</th>
                <th className="h-12 px-6 text-left align-middle font-medium text-muted-foreground">Proyecto</th>
                <th className="h-12 px-6 text-left align-middle font-medium text-muted-foreground">Proveedor</th>
                <th className="h-12 px-6 text-left align-middle font-medium text-muted-foreground">Fecha</th>
                <th className="h-12 px-6 text-right align-middle font-medium text-muted-foreground">Monto (ARS)</th>
                <th className="h-12 px-6 text-right align-middle font-medium text-muted-foreground">Estado</th>
                <th className="h-12 px-2 align-middle"></th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => {
                const vendor = receipt.vendor || 'Sin proveedor';
                return (
                  <tr
                    key={receipt.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/50"
                  >
                    <td className="p-6 align-middle font-medium text-xs">
                      #{receipt.id.slice(0, 8)}
                    </td>
                    <td className="p-6 align-middle">{receipt.project.name}</td>
                    <td className="p-6 align-middle">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                          {getInitials(vendor)}
                        </div>
                        <span className="truncate">{vendor}</span>
                      </div>
                    </td>
                    <td className="p-6 align-middle text-muted-foreground">
                      {formatDate(receipt.receipt_date)}
                    </td>
                    <td className="p-6 align-middle text-right font-medium">
                      {formatCurrency(receipt.total_amount)}
                    </td>
                    <td className="p-6 align-middle text-right">
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        STATUS_STYLES[receipt.status] ?? STATUS_STYLES.pending
                      )}>
                        {STATUS_LABELS[receipt.status] ?? receipt.status}
                      </span>
                    </td>
                    <td className="p-2 align-middle text-right">
                      <Link
                        href={`/receipts/${receipt.id}`}
                        className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
