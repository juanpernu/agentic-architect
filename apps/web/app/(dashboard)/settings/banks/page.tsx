'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Landmark, Pencil, Trash2, ShieldAlert } from 'lucide-react';
import { sileo } from 'sileo';
import { fetcher } from '@/lib/fetcher';
import { useCurrentUser } from '@/lib/use-current-user';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { BankAccountFormDialog } from '@/components/bank-account-form-dialog';
import type { BankAccount } from '@architech/shared';

export default function BanksPage() {
  const { role, isAdminOrSupervisor } = useCurrentUser();
  const isAdmin = role === 'admin';
  const { data: bankAccounts, error } = useSWR<BankAccount[]>(
    isAdminOrSupervisor ? '/api/bank-accounts' : null,
    fetcher
  );

  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | undefined>();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isAdminOrSupervisor) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acceso denegado"
        description="No tenés permisos para ver las cuentas bancarias."
      />
    );
  }

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setShowFormDialog(true);
  };

  const handleCreate = () => {
    setEditingAccount(undefined);
    setShowFormDialog(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/bank-accounts/${deletingId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al eliminar');
      }
      sileo.success({ title: 'Cuenta bancaria eliminada' });
      await mutate('/api/bank-accounts');
      setShowDeleteDialog(false);
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al eliminar' });
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  let content: React.ReactNode;

  if (!bankAccounts && !error) {
    content = <LoadingTable />;
  } else if (error) {
    content = (
      <EmptyState
        icon={Landmark}
        title="Error al cargar cuentas bancarias"
        description="Hubo un problema. Por favor, intenta de nuevo."
      />
    );
  } else if (!bankAccounts || bankAccounts.length === 0) {
    content = (
      <EmptyState
        icon={Landmark}
        title="No hay cuentas bancarias"
        description="Registra tu primera cuenta bancaria para vincular egresos."
        action={
          isAdmin ? (
            <Button onClick={handleCreate}>Crear cuenta bancaria</Button>
          ) : undefined
        }
      />
    );
  } else {
    content = (
      <>
        {isAdmin && (
          <div className="flex justify-end mb-4">
            <Button onClick={handleCreate}>Nueva cuenta bancaria</Button>
          </div>
        )}

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead className="hidden md:table-cell">CBU</TableHead>
                <TableHead className="hidden md:table-cell">Alias</TableHead>
                <TableHead>Moneda</TableHead>
                {isAdmin && <TableHead className="w-[100px]">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {bankAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.name}</TableCell>
                  <TableCell>{account.bank_name}</TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-xs">
                    {account.cbu || '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {account.alias || '—'}
                  </TableCell>
                  <TableCell>{account.currency}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(account)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(account.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    );
  }

  return (
    <>
      {content}

      <BankAccountFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        bankAccount={editingAccount}
      />

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Cuenta Bancaria</DialogTitle>
            <DialogDescription>
              ¿Estás seguro? Los comprobantes vinculados conservarán la referencia pero no se podrá seleccionar en nuevos comprobantes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
