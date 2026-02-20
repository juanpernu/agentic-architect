'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import { useRouter } from 'next/navigation';
import { sileo } from 'sileo';
import { Upload, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Project } from '@architech/shared';
import type { BudgetListItem } from '@/lib/api-types';

interface ImportBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
}

type Step = 'select' | 'processing' | 'error';

const ACCEPTED_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/pdf',
];
const MAX_SIZE = 10 * 1024 * 1024;

export function ImportBudgetDialog({ open, onOpenChange, projectId: preselectedProjectId }: ImportBudgetDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('select');
  const [selectedProjectId, setSelectedProjectId] = useState(preselectedProjectId ?? '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const { data: projects = [] } = useSWR<Project[]>(open && !preselectedProjectId ? '/api/projects' : null, fetcher);
  const { data: budgets = [] } = useSWR<BudgetListItem[]>(open && !preselectedProjectId ? '/api/budgets' : null, fetcher);

  const projectsWithBudget = new Set(budgets.map((b) => b.project_id));
  const availableProjects = projects.filter((p) => !projectsWithBudget.has(p.id));

  useEffect(() => {
    if (open) {
      setStep('select');
      setSelectedProjectId(preselectedProjectId ?? '');
      setSelectedFile(null);
      setErrorMessage('');
    }
  }, [open, preselectedProjectId]);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Formato no soportado. Usa Excel (.xlsx, .xls) o PDF.';
    }
    if (file.size > MAX_SIZE) {
      return 'El archivo supera los 10MB.';
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setErrorMessage(error);
      setStep('error');
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleSubmit = async () => {
    const projectToUse = preselectedProjectId || selectedProjectId;
    if (!projectToUse || !selectedFile) return;

    setStep('processing');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('project_id', projectToUse);

      const response = await fetch('/api/budgets/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al procesar el archivo');
      }

      const result = await response.json();

      sileo.success({
        title: `Presupuesto importado: ${result.sections_count} rubros, ${result.items_count} items`,
      });

      await mutate('/api/budgets');
      onOpenChange(false);
      router.push(`/budgets/${result.budget_id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Error al procesar el archivo');
      setStep('error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Presupuesto</DialogTitle>
          <DialogDescription>
            Subi un archivo Excel o PDF y la IA extraerá los rubros e items automáticamente
          </DialogDescription>
        </DialogHeader>

        {step === 'processing' ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Analizando presupuesto...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Esto puede tomar unos segundos
              </p>
            </div>
          </div>
        ) : step === 'error' ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div className="text-center">
              <p className="font-medium text-destructive">{errorMessage}</p>
            </div>
            <Button variant="outline" onClick={() => { setStep('select'); setSelectedFile(null); setErrorMessage(''); }}>
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {!preselectedProjectId && (
                <Field>
                  <FieldLabel htmlFor="import-project">Proyecto <span className="text-red-500">*</span></FieldLabel>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger id="import-project" className="w-full">
                      <SelectValue placeholder="Seleccionar proyecto" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : selectedFile
                    ? 'border-green-400 bg-green-50'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter') fileInputRef.current?.click(); }}
                tabIndex={0}
                role="button"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.pdf"
                  onChange={handleInputChange}
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet className="h-8 w-8 text-green-600" />
                    <p className="font-medium text-green-700">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(0)} KB — Click para cambiar
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="font-medium">Arrastrá un archivo o hacé click para seleccionar</p>
                    <p className="text-xs text-muted-foreground">Excel (.xlsx, .xls) o PDF — máx 10MB</p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!(preselectedProjectId || selectedProjectId) || !selectedFile}
              >
                <Upload className="mr-2 h-4 w-4" />
                Importar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
