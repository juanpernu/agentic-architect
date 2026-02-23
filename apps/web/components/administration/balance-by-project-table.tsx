'use client';

import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

interface ProjectBalance {
  projectId: string;
  projectName: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export function BalanceByProjectTable({ data }: { data: ProjectBalance[] }) {
  if (data.length === 0) {
    return null;
  }

  return (
    <Card>
      <div className="px-6 pt-5 pb-2">
        <h3 className="text-lg font-semibold">Balance por proyecto</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Resumen de ingresos, egresos y balance de cada obra.</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Proyecto</TableHead>
            <TableHead className="text-right">Ingresos</TableHead>
            <TableHead className="text-right">Egresos</TableHead>
            <TableHead className="text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.projectId}>
              <TableCell className="font-medium">{row.projectName}</TableCell>
              <TableCell className="text-right">{formatCurrency(row.totalIncome)}</TableCell>
              <TableCell className="text-right">{formatCurrency(row.totalExpense)}</TableCell>
              <TableCell className="text-right">
                <Badge variant={row.balance >= 0 ? 'default' : 'destructive'} className={cn(
                  row.balance >= 0
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                )}>
                  {formatCurrency(row.balance)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
