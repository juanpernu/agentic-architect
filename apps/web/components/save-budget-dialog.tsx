'use client';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SaveBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSaving: boolean;
}

export function SaveBudgetDialog({ open, onOpenChange, onConfirm, isSaving }: SaveBudgetDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Guardar presupuesto</AlertDialogTitle>
          <AlertDialogDescription>
            Una vez guardado, esta version no se puede modificar. Queres guardar el presupuesto?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar version'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
