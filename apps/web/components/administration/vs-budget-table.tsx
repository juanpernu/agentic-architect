'use client';

import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

interface RubroComparison {
  rubroId: string;
  rubroName: string;
  budgeted: number;
  actual: number;
  difference: number;
  percentage: number;
}

interface VsBudgetTableProps {
  rubros: RubroComparison[];
  totalBudgeted: number;
  totalActual: number;
  totalDifference: number;
  globalPercentage: number;
}

export function VsBudgetTable({ rubros, totalBudgeted, totalActual, totalDifference, globalPercentage }: VsBudgetTableProps) {
  return (
    <div className="space-y-4">
      {/* Global progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Avance global</span>
          <span className={cn(
            'font-bold',
            globalPercentage > 100 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
          )}>
            {globalPercentage}%
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              globalPercentage > 100 ? 'bg-red-500' : globalPercentage > 80 ? 'bg-amber-500' : 'bg-green-500'
            )}
            style={{ width: `${Math.min(globalPercentage, 100)}%` }}
          />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Presupuestado</div>
          <div className="text-xl font-bold mt-1">{formatCurrency(totalBudgeted)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Ejecutado</div>
          <div className="text-xl font-bold mt-1">{formatCurrency(totalActual)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Disponible</div>
          <div className={cn(
            'text-xl font-bold mt-1',
            totalDifference >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          )}>
            {formatCurrency(totalDifference)}
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rubro</TableHead>
              <TableHead className="text-right">Presupuestado</TableHead>
              <TableHead className="text-right">Ejecutado</TableHead>
              <TableHead className="text-right">Diferencia</TableHead>
              <TableHead className="w-[150px]">Avance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rubros.map((rubro) => (
              <TableRow key={rubro.rubroId}>
                <TableCell className="font-medium">{rubro.rubroName}</TableCell>
                <TableCell className="text-right">{formatCurrency(rubro.budgeted)}</TableCell>
                <TableCell className="text-right">{formatCurrency(rubro.actual)}</TableCell>
                <TableCell className="text-right">
                  <span className={cn(
                    rubro.difference >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  )}>
                    {formatCurrency(rubro.difference)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          rubro.percentage > 100 ? 'bg-red-500' : rubro.percentage > 80 ? 'bg-amber-500' : 'bg-green-500'
                        )}
                        style={{ width: `${Math.min(rubro.percentage, 100)}%` }}
                      />
                    </div>
                    <span className={cn(
                      'text-xs font-medium w-10 text-right',
                      rubro.percentage > 100 ? 'text-red-600 dark:text-red-400' : ''
                    )}>
                      {rubro.percentage}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
