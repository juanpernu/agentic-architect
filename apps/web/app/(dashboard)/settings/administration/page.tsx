'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Pencil, Trash2, ShieldAlert, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { sileo } from 'sileo';
import { fetcher } from '@/lib/fetcher';
import { useCurrentUser } from '@/lib/use-current-user';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { IncomeType, ExpenseType } from '@architech/shared';

type TypeCategory = 'income' | 'expense';

interface TypeFormState {
  open: boolean;
  category: TypeCategory;
  editingId: string | null;
  name: string;
}

interface DeleteState {
  open: boolean;
  category: TypeCategory;
  id: string | null;
}

const API_PATHS: Record<TypeCategory, string> = {
  income: '/api/income-types',
  expense: '/api/expense-types',
};

export default function AdministrationPage() {
  const { role } = useCurrentUser();
  const isAdmin = role === 'admin';

  const { data: incomeTypes, error: incomeError } = useSWR<IncomeType[]>(
    isAdmin ? '/api/income-types' : null,
    fetcher,
  );
  const { data: expenseTypes, error: expenseError } = useSWR<ExpenseType[]>(
    isAdmin ? '/api/expense-types' : null,
    fetcher,
  );

  const [formState, setFormState] = useState<TypeFormState>({
    open: false,
    category: 'income',
    editingId: null,
    name: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const [deleteState, setDeleteState] = useState<DeleteState>({
    open: false,
    category: 'income',
    id: null,
  });
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isAdmin) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acceso denegado"
        description="No tenés permisos para acceder a la administración."
      />
    );
  }

  const handleAdd = (category: TypeCategory) => {
    setFormState({ open: true, category, editingId: null, name: '' });
  };

  const handleEdit = (category: TypeCategory, id: string, name: string) => {
    setFormState({ open: true, category, editingId: id, name });
  };

  const handleSave = async () => {
    const trimmed = formState.name.trim();
    if (!trimmed) return;

    setIsSaving(true);
    const apiPath = API_PATHS[formState.category];

    try {
      if (formState.editingId) {
        const response = await fetch(`${apiPath}/${formState.editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!response.ok) {
          const errorBody = await response.json();
          throw new Error(errorBody.error ?? 'Error al guardar');
        }
        sileo.success({ title: 'Tipo actualizado' });
      } else {
        const response = await fetch(apiPath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!response.ok) {
          const errorBody = await response.json();
          throw new Error(errorBody.error ?? 'Error al crear');
        }
        sileo.success({ title: 'Tipo creado' });
      }
      await mutate(apiPath);
      setFormState((prev) => ({ ...prev, open: false }));
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al guardar' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (category: TypeCategory, id: string) => {
    setDeleteState({ open: true, category, id });
  };

  const handleDelete = async () => {
    if (!deleteState.id) return;
    setIsDeleting(true);
    const apiPath = API_PATHS[deleteState.category];

    try {
      const response = await fetch(`${apiPath}/${deleteState.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al eliminar');
      }
      sileo.success({ title: 'Tipo eliminado' });
      await mutate(apiPath);
      setDeleteState((prev) => ({ ...prev, open: false }));
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al eliminar' });
    } finally {
      setIsDeleting(false);
      setDeleteState((prev) => ({ ...prev, id: null }));
    }
  };

  const renderTypeSection = (
    category: TypeCategory,
    title: string,
    icon: React.ElementType,
    types: (IncomeType | ExpenseType)[] | undefined,
    error: unknown,
  ) => {
    const Icon = icon;

    let content: React.ReactNode;

    if (!types && !error) {
      content = <LoadingTable />;
    } else if (error) {
      content = (
        <EmptyState
          icon={Icon}
          title={`Error al cargar ${title.toLowerCase()}`}
          description="Hubo un problema. Por favor, intentá de nuevo."
        />
      );
    } else if (!types || types.length === 0) {
      content = (
        <EmptyState
          icon={Icon}
          title={`No hay ${title.toLowerCase()}`}
          description={`Agregá tu primer tipo para empezar.`}
          action={<Button onClick={() => handleAdd(category)}>Agregar tipo</Button>}
        />
      );
    } else {
      content = (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map((type) => (
              <TableRow key={type.id}>
                <TableCell className="font-medium">{type.name}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(category, type.id, type.name)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(category, type.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    return (
      <div className="flex-1 min-w-0">
        <Card>
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">{title}</h3>
            </div>
            {types && types.length > 0 && (
              <Button size="sm" onClick={() => handleAdd(category)}>
                Agregar tipo
              </Button>
            )}
          </div>
          <div className="p-0">{content}</div>
        </Card>
      </div>
    );
  };

  const formTitle = formState.editingId ? 'Editar tipo' : 'Agregar tipo';

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderTypeSection('income', 'Tipos de Ingreso', ArrowDownCircle, incomeTypes, incomeError)}
        {renderTypeSection('expense', 'Tipos de Egreso', ArrowUpCircle, expenseTypes, expenseError)}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={formState.open} onOpenChange={(open) => setFormState((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formTitle}</DialogTitle>
            <DialogDescription>
              {formState.editingId
                ? 'Modificá el nombre del tipo.'
                : 'Ingresá el nombre del nuevo tipo.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="type-name">Nombre</Label>
            <Input
              id="type-name"
              value={formState.name}
              onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Ej: Anticipo, Certificado..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormState((prev) => ({ ...prev, open: false }))}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formState.name.trim()}>
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteState.open} onOpenChange={(open) => setDeleteState((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar este tipo?</DialogTitle>
            <DialogDescription>
              Esta acción es irreversible. Los registros existentes conservarán la referencia.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteState((prev) => ({ ...prev, open: false }))}
              disabled={isDeleting}
            >
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
