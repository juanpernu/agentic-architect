'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Camera, FolderOpen, Image as ImageIcon, Loader2 } from 'lucide-react';
import { sileo } from 'sileo';
import { Button } from '@/components/ui/button';
import { ReceiptReview } from '@/components/receipt-review';
import { CameraCapture } from '@/components/camera-capture';
import { cn } from '@/lib/utils';
import type { ExtractionResult } from '@architech/shared';

type UploadStep = 'upload' | 'processing' | 'review';

const API_SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Normalizes an image file to JPEG if its type is not supported by the AI API
 * (e.g., HEIC from iOS camera). Uses canvas to decode and re-encode.
 * Returns the original file if it's already a supported type.
 */
function normalizeImageToJpeg(file: File): Promise<File> {
  if (API_SUPPORTED_TYPES.includes(file.type)) {
    return Promise.resolve(file);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo crear el contexto de canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            reject(new Error('No se pudo convertir la imagen'));
            return;
          }
          const name = file.name.replace(/\.[^.]+$/, '.jpg');
          resolve(new File([blob], name, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.92
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo decodificar la imagen'));
    };

    img.src = url;
  });
}

const STEPS = ['upload', 'processing', 'review'] as const;

function StepIndicator({ current }: { current: UploadStep }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((s, i) => (
        <div
          key={s}
          className={cn(
            'h-2 w-8 rounded-full transition-colors',
            i <= idx ? 'bg-primary' : 'bg-muted'
          )}
        />
      ))}
    </div>
  );
}

export default function UploadPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project_id');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<UploadStep>('upload');
  const [showCamera, setShowCamera] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [storagePath, setStoragePath] = useState<string>('');
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
      sileo.error({ title: 'Por favor selecciona una imagen válida' });
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

  const processReceipt = useCallback(async () => {
    if (!selectedFile) return;

    setStep('processing');

    try {
      const normalizedFile = await normalizeImageToJpeg(selectedFile);

      const formData = new FormData();
      formData.append('file', normalizedFile);

      const uploadResponse = await fetch('/api/receipts/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Error al subir la imagen');
      }

      const { image_url, storage_path } = await uploadResponse.json();
      setImageUrl(image_url);
      setStoragePath(storage_path);

      const arrayBuffer = await normalizedFile.arrayBuffer();
      const base64Data = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const extractResponse = await fetch('/api/receipts/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64Data,
          mime_type: normalizedFile.type,
        }),
      });

      if (!extractResponse.ok) {
        throw new Error('Error al analizar el comprobante');
      }

      const result: ExtractionResult = await extractResponse.json();
      setExtractionResult(result);
      setStep('review');
    } catch (error) {
      sileo.error({
        title: error instanceof Error ? error.message : 'Error al procesar el comprobante',
      });
      setStep('upload');
    }
  }, [selectedFile]);

  const handleDiscard = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageUrl('');
    setStoragePath('');
    setExtractionResult(null);
    setStep('upload');
  };

  if (showCamera) {
    return (
      <CameraCapture
        onCapture={(file) => {
          setShowCamera(false);
          handleFileSelect(file);
        }}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  if (step === 'review' && extractionResult && imageUrl) {
    return (
      <ReceiptReview
        imageUrl={imageUrl}
        storagePath={storagePath}
        extractionResult={extractionResult}
        preSelectedProjectId={projectId ?? undefined}
        onDiscard={handleDiscard}
      />
    );
  }

  if (step === 'processing') {
    return (
      <div className="max-w-md mx-auto flex flex-col min-h-[60vh] animate-slide-up">
        <StepIndicator current="processing" />
        <div className="flex-1 flex flex-col items-center justify-center py-12">
          <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Analizando comprobante...</h2>
          <p className="text-muted-foreground text-sm text-center">
            Extrayendo información con IA. Esto puede tomar unos segundos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto flex flex-col min-h-[60vh] animate-slide-up">
      <StepIndicator current="upload" />

      {/* Title */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Subí tu factura</h2>
        <p className="text-muted-foreground text-sm">
          Nuestra IA procesará los detalles automáticamente para extraer los ítems.
        </p>
      </div>

      {!selectedFile ? (
        <>
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            aria-label="Seleccionar imagen para subir"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') fileInputRef.current?.click(); }}
            className="flex-1 flex flex-col items-center justify-center bg-card border-2 border-dashed border-border rounded-2xl p-8 mb-6 shadow-sm cursor-pointer group hover:border-primary/50 transition-all active:border-primary active:bg-primary/5"
          >
            <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
              <ImageIcon className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-center mb-2">
              Selecciona o arrastra una imagen
            </h3>
            <p className="text-center text-sm text-muted-foreground">
              JPG, PNG, WebP y fotos de cámara<br />hasta 10MB
            </p>
          </div>

          {/* Action buttons */}
          <div className="space-y-3 mt-auto">
            <Button
              type="button"
              size="lg"
              className="w-full py-4 rounded-xl shadow-lg shadow-primary/30 text-base"
              onClick={() => fileInputRef.current?.click()}
            >
              <FolderOpen className="mr-2 h-5 w-5" />
              Seleccionar Archivo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full py-4 rounded-xl border-2 border-primary text-primary hover:bg-primary/5 text-base md:hidden"
              onClick={() => setShowCamera(true)}
            >
              <Camera className="mr-2 h-5 w-5" />
              Tomar Foto
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </>
      ) : (
        <>
          {/* Preview */}
          <div className="flex-1 flex flex-col">
            <div className="relative rounded-2xl overflow-hidden bg-muted mb-6">
              <img
                src={previewUrl!}
                alt="Preview del comprobante"
                className="w-full h-auto max-h-96 object-contain mx-auto"
              />
            </div>
            <div className="space-y-3 mt-auto">
              <Button
                size="lg"
                className="w-full py-4 rounded-xl shadow-lg shadow-primary/30 text-base"
                onClick={processReceipt}
              >
                Procesar Comprobante
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full py-4 rounded-xl border-2 text-base"
                onClick={handleDiscard}
              >
                Descartar
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
