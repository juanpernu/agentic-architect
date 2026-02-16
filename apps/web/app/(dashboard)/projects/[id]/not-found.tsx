import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ProjectNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <h2 className="text-lg font-semibold">Proyecto no encontrado</h2>
      <p className="text-muted-foreground mt-1">El proyecto que buscás no existe o no tenés acceso.</p>
      <Link href="/projects">
        <Button className="mt-4">Volver a Proyectos</Button>
      </Link>
    </div>
  );
}
