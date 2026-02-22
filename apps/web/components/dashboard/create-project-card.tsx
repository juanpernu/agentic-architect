'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ProjectFormDialog } from '@/components/project-form-dialog';

export function CreateProjectCard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border-2 border-dashed border-border bg-card/50 p-6 flex flex-col items-center justify-center gap-3 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer min-h-[180px]"
      >
        <div className="h-12 w-12 rounded-full border-2 border-dashed border-primary/40 flex items-center justify-center">
          <Plus className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm">Crear Nuevo Proyecto</p>
          <p className="text-xs text-muted-foreground mt-1">
            Comenzá a gestionar una nueva obra desde cero.
          </p>
        </div>
      </button>
      <ProjectFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
