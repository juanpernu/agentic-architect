'use client';

import { Button } from '@/components/ui/button';

export default function ProjectDetailError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <h2 className="text-lg font-semibold">Error al cargar el proyecto</h2>
      <p className="text-muted-foreground mt-1">{error.message}</p>
      <Button onClick={reset} className="mt-4">Reintentar</Button>
    </div>
  );
}
