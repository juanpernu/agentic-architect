'use client';

import { Button } from '@/components/ui/button';
import { PlayCircle } from 'lucide-react';

interface OnboardingSnackbarProps {
  onResume: () => void;
  onDismiss: () => void;
}

export function OnboardingSnackbar({ onResume, onDismiss }: OnboardingSnackbarProps) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9990] animate-in slide-in-from-bottom-4 fade-in-0">
      <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg">
        <PlayCircle className="h-5 w-5 text-primary flex-shrink-0" />
        <span className="text-sm font-medium">Tenés un onboarding en curso</span>
        <Button size="sm" onClick={onResume}>
          Continuar
        </Button>
        <button
          onClick={onDismiss}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Omitir
        </button>
      </div>
    </div>
  );
}
