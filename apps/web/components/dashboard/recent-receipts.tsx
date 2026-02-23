import Link from 'next/link';
import { MoreVertical } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { formatRelativeWithTime } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { getAuthContext } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
          href="/administration/receipts"
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Proyecto</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Monto (ARS)</TableHead>
              <TableHead className="text-right">Estado</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipts.map((receipt) => {
              const vendor = receipt.vendor || 'Sin proveedor';
              return (
                <TableRow key={receipt.id} className="group relative cursor-pointer">
                  <TableCell className="font-medium text-xs">
                    <Link
                      href={`/receipts/${receipt.id}`}
                      className="absolute inset-0"
                      aria-label={`Ver comprobante de ${vendor}`}
                    />
                    #{receipt.id.slice(0, 8)}
                  </TableCell>
                  <TableCell>{receipt.project.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                        {getInitials(vendor)}
                      </div>
                      <span className="truncate">{vendor}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(receipt.receipt_date)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(receipt.total_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      STATUS_STYLES[receipt.status] ?? STATUS_STYLES.pending
                    )}>
                      {STATUS_LABELS[receipt.status] ?? receipt.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-muted-foreground inline-flex items-center justify-center h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
