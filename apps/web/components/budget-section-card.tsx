'use client';

import { useState } from 'react';
import { Trash2, Plus, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BudgetSection, BudgetItem } from '@architech/shared';

interface BudgetSectionCardProps {
  section: BudgetSection;
  onUpdate: (section: BudgetSection) => void;
  onRemove: () => void;
  readOnly: boolean;
}

export function BudgetSectionCard({ section, onUpdate, onRemove, readOnly }: BudgetSectionCardProps) {
  const [isOpen, setIsOpen] = useState(true);

  const updateItem = (index: number, field: keyof BudgetItem, value: string | number) => {
    const items = [...section.items];
    const item = { ...items[index], [field]: value };
    item.subtotal = Number(item.quantity) * Number(item.unit_price);
    items[index] = item;
    const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
    onUpdate({ ...section, items, subtotal });
  };

  const addItem = () => {
    const items = [...section.items, { description: '', quantity: 1, unit: 'unidad', unit_price: 0, subtotal: 0 }];
    onUpdate({ ...section, items });
  };

  const removeItem = (index: number) => {
    const items = section.items.filter((_, i) => i !== index);
    const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
    onUpdate({ ...section, items, subtotal });
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="py-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-base flex items-center gap-2">
                <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
                {section.cost_center_name}
              </CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{formatCurrency(section.subtotal)}</span>
                {!readOnly && (
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="h-8 w-8">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Descripcion</TableHead>
                  <TableHead className="w-[12%]">Cantidad</TableHead>
                  <TableHead className="w-[12%]">Unidad</TableHead>
                  <TableHead className="w-[15%] text-right">Precio Unit.</TableHead>
                  <TableHead className="w-[15%] text-right">Subtotal</TableHead>
                  {!readOnly && <TableHead className="w-[6%]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        placeholder="Descripcion del item"
                        disabled={readOnly}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        disabled={readOnly}
                        className="h-8"
                        min={0}
                        step="any"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.unit}
                        onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        placeholder="unidad"
                        disabled={readOnly}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        disabled={readOnly}
                        className="h-8 text-right"
                        min={0}
                        step="any"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.subtotal)}
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-8 w-8">
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!readOnly && (
              <Button variant="ghost" size="sm" onClick={addItem} className="mt-2">
                <Plus className="mr-1 h-3 w-3" />
                Agregar item
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
