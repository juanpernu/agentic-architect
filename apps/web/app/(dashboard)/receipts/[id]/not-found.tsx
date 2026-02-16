import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ReceiptNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <h2 className="text-lg font-semibold">Comprobante no encontrado</h2>
      <p className="text-muted-foreground mt-1">El comprobante que buscás no existe o no tenés acceso.</p>
      <Link href="/receipts">
        <Button className="mt-4">Volver a Comprobantes</Button>
      </Link>
    </div>
  );
}
