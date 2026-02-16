'use client';

import { useRef, useState, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('La cámara no está disponible en este navegador. Se requiere HTTPS.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setError(null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          setError('Permiso de cámara denegado. Habilitalo en Ajustes del navegador.');
        } else {
          setError('No se pudo acceder a la cámara. Verificá los permisos.');
        }
      }
    };

    setReady(false);
    start();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' });

        // Stop camera before returning
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        onCapture(file);
      },
      'image/jpeg',
      0.92
    );
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-white p-6">
        <p className="text-center mb-4">{error}</p>
        <Button variant="outline" onClick={onClose} className="text-white border-white">
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {!ready ? (
        <div className="flex-1 flex items-center justify-center text-white">
          Iniciando cámara...
        </div>
      ) : null}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onPlaying={() => setReady(true)}
        className={`flex-1 w-full object-cover ${ready ? '' : 'hidden'}`}
      />
      <div
        className="absolute bottom-0 inset-x-0"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-center gap-8 p-6 bg-gradient-to-t from-black/80 to-transparent">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white h-12 w-12"
          >
            <X className="h-6 w-6" />
          </Button>
          <button
            onClick={handleCapture}
            disabled={!ready}
            className="h-[4.5rem] w-[4.5rem] rounded-full border-4 border-white bg-white/20 active:bg-white/50 transition-colors disabled:opacity-50"
            aria-label="Tomar foto"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
            className="text-white h-12 w-12"
          >
            <RotateCcw className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
