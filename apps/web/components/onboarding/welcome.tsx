'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TableProperties, Camera, BarChart3, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

type OnboardingVariant = 'creator' | 'viewer';

interface OnboardingWelcomeProps {
  open: boolean;
  variant: OnboardingVariant;
  onComplete: () => void;
  onSkip: () => void;
}

function getSlides(variant: OnboardingVariant) {
  return [
    {
      icon: null,
      title: 'Sabé exactamente cuánto ganás en cada obra',
      description:
        'Presupuestos integrados, seguimiento de gastos por rubro y control de rentabilidad en tiempo real. Diseñado para estudios de arquitectura.',
    },
    {
      features: [
        {
          icon: TableProperties,
          title: 'Presupuestos profesionales',
          description: 'Armá presupuestos con rubros, items, unidades y costos. Con versionado automático.',
        },
        {
          icon: Camera,
          title: 'Comprobantes con IA',
          description: 'Sacale una foto a la factura y Agentect extrae proveedor, monto y CUIT.',
        },
        {
          icon: BarChart3,
          title: 'Reportes en tiempo real',
          description: 'Controlá la rentabilidad por rubro y detectá desvíos a tiempo.',
        },
      ],
    },
    {
      icon: Building2,
      title: variant === 'creator'
        ? 'Empecemos creando tu primer proyecto'
        : 'Vamos a conocer la plataforma',
      description: variant === 'creator'
        ? 'En 5 minutos vas a tener tu primer presupuesto armado.'
        : 'Te mostramos las herramientas principales en un minuto.',
      isCta: true,
    },
  ];
}

export function OnboardingWelcome({ open, variant, onComplete, onSkip }: OnboardingWelcomeProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = getSlides(variant);
  const slide = slides[currentSlide];
  const isLast = currentSlide === slides.length - 1;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-lg p-0 gap-0 border-0"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Visually hidden title and description for accessibility */}
        <DialogTitle className="sr-only">Bienvenido a Agentect</DialogTitle>
        <DialogDescription className="sr-only">
          Onboarding de bienvenida con información sobre la plataforma
        </DialogDescription>

        <div className="flex flex-col items-center text-center p-8 min-h-[420px] justify-center">
          {/* Slide 1: Value prop */}
          {currentSlide === 0 && (
            <div className="space-y-6 animate-in fade-in-0 slide-in-from-right-4">
              <Image
                src="/agentect-logo-green.svg"
                alt="Agentect"
                width={180}
                height={40}
                className="mx-auto"
              />
              <h1 className="text-2xl font-bold tracking-tight">{slide.title}</h1>
              <p className="text-muted-foreground max-w-sm">{slide.description}</p>
            </div>
          )}

          {/* Slide 2: Features */}
          {currentSlide === 1 && 'features' in slide && (
            <div className="space-y-6 w-full animate-in fade-in-0 slide-in-from-right-4">
              <h2 className="text-lg font-semibold">Todo lo que necesitás</h2>
              <div className="space-y-4 text-left">
                {slide.features!.map((feat) => (
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
            </div>
          )}

          {/* Slide 3: CTA */}
          {currentSlide === 2 && 'icon' in slide && slide.icon && (
            <div className="space-y-6 animate-in fade-in-0 slide-in-from-right-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <slide.icon className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">{slide.title}</h2>
              <p className="text-muted-foreground">{slide.description}</p>
            </div>
          )}

          {/* Dots */}
          <div className="flex items-center gap-2 mt-8">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  i === currentSlide ? 'bg-primary w-6' : 'bg-muted-foreground/30'
                )}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3 mt-6 w-full justify-center">
            {currentSlide > 0 && (
              <Button variant="ghost" onClick={() => setCurrentSlide((s) => s - 1)}>
                Anterior
              </Button>
            )}
            <Button onClick={isLast ? onComplete : () => setCurrentSlide((s) => s + 1)}>
              {isLast ? 'Empezar' : 'Siguiente'}
            </Button>
          </div>

          {/* Skip link — always visible (WCAG 2.1.2: always-available escape) */}
          <button
            onClick={onSkip}
            className="text-xs text-muted-foreground hover:text-foreground mt-4 transition-colors"
          >
            Omitir onboarding
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
