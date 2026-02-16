'use client';

import { RouteError } from '@/components/ui/route-error';

export default function UploadError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} heading="Error en la carga" />;
}
