'use client';

import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, ArrowUpDown, BarChart3, FolderOpen, Settings } from 'lucide-react';
import { VisuallyHidden } from 'radix-ui';

type OnboardingVariant = 'creator' | 'viewer';

interface OnboardingSummaryProps {
  open: boolean;
  variant: OnboardingVariant;
  onComplete: () => void;
}

const creatorFeatures = [
  {
    icon: Camera,
    title: 'Comprobantes',
    description: 'Subi fotos de facturas y tiques. La IA extrae los datos por vos.',
  },
  {
    icon: ArrowUpDown,
    title: 'Administracion',
    description: 'Registra ingresos y egresos. Controla el cashflow de cada obra.',
  },
  {
    icon: BarChart3,
    title: 'Reportes',
    description: 'Visualiza gastos por rubro y detecta desvios a tiempo.',
  },
];

const viewerFeatures = [
  {
    icon: Camera,
    title: 'Comprobantes',
    description: 'Subi fotos de facturas y tiques. La IA extrae los datos por vos.',
  },
  {
    icon: FolderOpen,
    title: 'Presupuestos',
    description: 'Consulta presupuestos de tus proyectos asignados.',
  },
  {
    icon: Settings,
    title: 'Configuracion',
    description: 'Personaliza tu perfil y preferencias.',
  },
];

export function OnboardingSummary({ open, variant, onComplete }: OnboardingSummaryProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-lg p-0 gap-0 border-0"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <VisuallyHidden.Root>
          <DialogTitle>Resumen de onboarding</DialogTitle>
          <DialogDescription>
            Resumen de las funcionalidades disponibles en tu cuenta.
          </DialogDescription>
        </VisuallyHidden.Root>

        <div className="flex flex-col items-center text-center p-8">
          <h2 className="text-2xl font-bold mb-2">Tu estudio esta listo</h2>
          <p className="text-muted-foreground mb-8">Ahora descubri el resto:</p>

          <div className="space-y-4 w-full text-left mb-8">
            {(variant === 'creator' ? creatorFeatures : viewerFeatures).map((feat) => (
              <div key={feat.title} className="flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <feat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{feat.title}</h3>
                  <p className="text-sm text-muted-foreground">{feat.description}</p>
                </div>
              </div>
            ))}
          </div>

          <Button className="w-full" onClick={onComplete}>
            Empezar a usar Agentect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
