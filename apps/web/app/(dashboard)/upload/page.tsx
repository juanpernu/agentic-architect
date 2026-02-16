'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Camera, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ReceiptReview } from '@/components/receipt-review';
import type { ExtractionResult } from '@obralink/shared';

type UploadStep = 'upload' | 'processing' | 'review';

export default function UploadPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project_id');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<UploadStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen válida');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const processReceipt = async () => {
    if (!selectedFile) return;

    setStep('processing');

    try {
      // Step 1: Upload image to storage
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadResponse = await fetch('/api/receipts/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Error al subir la imagen');
      }

      const { image_url } = await uploadResponse.json();
      setImageUrl(image_url);

      // Step 2: Convert to base64 for AI extraction
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const base64Data = base64.split(',')[1];

          const extractResponse = await fetch('/api/receipts/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image_base64: base64Data,
              mime_type: selectedFile.type,
            }),
          });

          if (!extractResponse.ok) {
            throw new Error('Error al analizar el comprobante');
          }

          const result: ExtractionResult = await extractResponse.json();
          setExtractionResult(result);
          setStep('review');
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : 'Error al procesar el comprobante'
          );
          setStep('upload');
        }
      };

      reader.onerror = () => {
        toast.error('Error al leer el archivo');
        setStep('upload');
      };

      reader.readAsDataURL(selectedFile);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Error al procesar el comprobante'
      );
      setStep('upload');
    }
  };

  const handleDiscard = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageUrl('');
    setExtractionResult(null);
    setStep('upload');
  };

  if (step === 'review' && extractionResult && imageUrl) {
    return (
      <ReceiptReview
        imageUrl={imageUrl}
        extractionResult={extractionResult}
        preSelectedProjectId={projectId ?? undefined}
        onDiscard={handleDiscard}
      />
    );
  }

  if (step === 'processing') {
    return (
      <div className="p-6">
        <PageHeader title="Cargar Comprobante" />
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <h3 className="text-lg font-medium">Analizando comprobante...</h3>
          <p className="text-muted-foreground mt-1">
            Extrayendo información con IA. Esto puede tomar unos segundos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Cargar Comprobante"
        description="Sube una foto del comprobante para procesarlo con IA"
      />

      <div className="max-w-2xl mx-auto">
        {!selectedFile ? (
          <Card>
            <CardContent className="p-8">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="rounded-full bg-primary/10 p-4">
                    <ImageIcon className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">
                      Selecciona o arrastra una imagen
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Soporta JPG, PNG y WebP
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button">
                      <Upload className="mr-2 h-4 w-4" />
                      Seleccionar Archivo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (fileInputRef.current) {
                          fileInputRef.current.setAttribute('capture', 'environment');
                          fileInputRef.current.click();
                        }
                      }}
                      className="md:hidden"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Tomar Foto
                    </Button>
                  </div>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden bg-muted">
                  <img
                    src={previewUrl!}
                    alt="Preview"
                    className="w-full h-auto max-h-96 object-contain mx-auto"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleDiscard}
                    className="flex-1"
                  >
                    Descartar
                  </Button>
                  <Button
                    onClick={processReceipt}
                    className="flex-1"
                  >
                    Procesar Comprobante
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
