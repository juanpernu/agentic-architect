'use client';

import { RouteError } from '@/components/ui/route-error';

export default function SettingsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} heading="Error al cargar configuración" />;
}
