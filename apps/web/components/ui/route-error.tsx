'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  heading: string;
}

export function RouteError({ error, reset, heading }: RouteErrorProps) {
  useEffect(() => {
    console.error(heading, error);
  }, [error, heading]);

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <h2 className="text-lg font-semibold">{heading}</h2>
      <p className="text-muted-foreground mt-1">
        Ocurrió un error inesperado. Por favor, intentá de nuevo.
      </p>
      <Button onClick={reset} className="mt-4">Reintentar</Button>
    </div>
  );
}
