'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { PlayCircle } from 'lucide-react';

interface OnboardingSnackbarProps {
  onResume: () => void;
  onDismiss: () => void;
}

export function OnboardingSnackbar({ onResume, onDismiss }: OnboardingSnackbarProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const content = (
    <div className="fixed bottom-4 left-0 right-0 z-[10001] flex justify-center pointer-events-none animate-slide-up">
      <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg pointer-events-auto">
        <PlayCircle className="h-5 w-5 text-primary flex-shrink-0" />
        <span className="text-sm font-medium whitespace-nowrap">Tenés un onboarding en curso</span>
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

  if (!mounted) return null;

  return createPortal(content, document.body);
}
