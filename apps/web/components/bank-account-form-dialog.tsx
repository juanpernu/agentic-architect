'use client';

import { useState, useEffect } from 'react';
import { mutate } from 'swr';
import { sileo } from 'sileo';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { BankAccount } from '@architech/shared';

interface BankAccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankAccount?: BankAccount;
}

export function BankAccountFormDialog({ open, onOpenChange, bankAccount }: BankAccountFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    bank_name: string;
    cbu: string;
    alias: string;
    currency: string;
  }>({ name: '', bank_name: '', cbu: '', alias: '', currency: 'ARS' });

  useEffect(() => {
    if (bankAccount) {
      setFormData({
        name: bankAccount.name,
        bank_name: bankAccount.bank_name,
        cbu: bankAccount.cbu ?? '',
        alias: bankAccount.alias ?? '',
        currency: bankAccount.currency,
      });
    } else {
      setFormData({ name: '', bank_name: '', cbu: '', alias: '', currency: 'ARS' });
    }
  }, [bankAccount, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        bank_name: formData.bank_name,
        cbu: formData.cbu || null,
        alias: formData.alias || null,
        currency: formData.currency,
      };

      const response = await fetch(
        bankAccount ? `/api/bank-accounts/${bankAccount.id}` : '/api/bank-accounts',
        {
          method: bankAccount ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al guardar');
      }

      sileo.success({ title: bankAccount ? 'Cuenta bancaria actualizada' : 'Cuenta bancaria creada' });
      await mutate('/api/bank-accounts');
      onOpenChange(false);
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al guardar' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{bankAccount ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'}</DialogTitle>
          <DialogDescription>
            {bankAccount ? 'Actualiza los datos de la cuenta bancaria' : 'Registra una nueva cuenta bancaria de la organización'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="border border-border rounded-xl p-4 bg-muted/30 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ba-name">Nombre <span className="text-red-500">*</span></Label>
                <Input
                  id="ba-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Cuenta Corriente Macro"
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ba-bank-name">Banco <span className="text-red-500">*</span></Label>
                <Input
                  id="ba-bank-name"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="Ej: Banco Macro"
                  maxLength={100}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ba-cbu">CBU</Label>
                <Input
                  id="ba-cbu"
                  value={formData.cbu}
                  onChange={(e) => setFormData({ ...formData, cbu: e.target.value })}
                  placeholder="22 dígitos"
                  maxLength={22}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ba-alias">Alias</Label>
                <Input
                  id="ba-alias"
                  value={formData.alias}
                  onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                  placeholder="Ej: obra.macro"
                  maxLength={50}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ba-currency">Moneda</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger id="ba-currency" className="w-full">
                  <SelectValue placeholder="Seleccionar moneda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS — Peso Argentino</SelectItem>
                  <SelectItem value="USD">USD — Dólar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : bankAccount ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
