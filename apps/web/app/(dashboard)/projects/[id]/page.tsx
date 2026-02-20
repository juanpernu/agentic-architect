'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Calculator,
  Upload,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  Receipt,
  User,
  Loader2,
} from 'lucide-react';
import { sileo } from 'sileo';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { useCurrentUser } from '@/lib/use-current-user';
import { PROJECT_COLOR_HEX } from '@/lib/project-colors';
import type { BudgetListItem, ProjectDetail, ReceiptWithDetails } from '@/lib/api-types';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingCards } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ProjectFormDialog } from '@/components/project-form-dialog';
import { cn } from '@/lib/utils';

function toArgDate(d: Date): Date {
  return new Date(d.toLocaleString('en-US', { timeZone: 'America/Buenos_Aires' }));
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  const argDate = toArgDate(date);
  const argNow = toArgDate(now);
  const today = new Date(argNow.getFullYear(), argNow.getMonth(), argNow.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const updateDay = new Date(argDate.getFullYear(), argDate.getMonth(), argDate.getDate());

  if (updateDay.getTime() === today.getTime()) return 'Hoy';
  if (updateDay.getTime() === yesterday.getTime()) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin, isAdminOrSupervisor } = useCurrentUser();
  const projectId = params.id as string;

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [receiptsOpen, setReceiptsOpen] = useState(true);

  const { data: project, isLoading: isLoadingProject, error: projectError } = useSWR<ProjectDetail>(
    projectId ? `/api/projects/${projectId}` : null,
    fetcher
  );

  const { data: receipts, isLoading: isLoadingReceipts } = useSWR<ReceiptWithDetails[]>(
    projectId ? `/api/receipts?project_id=${projectId}` : null,
    fetcher
  );

  const { data: budgets } = useSWR<BudgetListItem[]>(
    projectId ? `/api/budgets?project_id=${projectId}` : null,
    fetcher
  );

  const totalSpend = receipts?.reduce((sum, r) => sum + r.total_amount, 0) ?? 0;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al eliminar proyecto');
      }

      sileo.success({ title: 'Proyecto eliminado con éxito' });
      await mutate('/api/projects');
      router.push('/projects');
    } catch (error) {
      sileo.error({
        title: error instanceof Error ? error.message : 'Error al eliminar proyecto',
      });
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (projectError) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <div className="text-red-600">Error al cargar el proyecto</div>
      </div>
    );
  }

  if (isLoadingProject) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <LoadingCards count={2} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <EmptyState
          icon={Building2}
          title="Proyecto no encontrado"
          description="El proyecto que buscas no existe"
          action={
            <Button onClick={() => router.push('/projects')}>
              Volver a Proyectos
            </Button>
          }
        />
      </div>
    );
  }

  const projectColor = project.color ? PROJECT_COLOR_HEX[project.color] : '#3B82F6';

  return (
    <div className="max-w-lg mx-auto flex flex-col min-h-screen bg-background animate-slide-up">
      {/* Nav bar */}
      <header className="bg-card sticky top-0 z-20 px-4 py-3 flex items-center justify-between border-b border-border">
        <button
          onClick={() => router.push('/projects')}
          className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
          aria-label="Volver a proyectos"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {isAdminOrSupervisor && (
          <button
            onClick={() => setShowEditDialog(true)}
            className="text-primary font-medium text-sm"
          >
            Editar
          </button>
        )}
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto pb-40">
        {/* Project header */}
        <section className="px-5 pt-5 pb-4 bg-card border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <StatusBadge status={project.status} />
            <span className="text-xs text-muted-foreground font-mono">
              ID: #{project.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">
            {project.color && (
              <span
                className="inline-block h-3 w-3 rounded-full mr-2 align-middle"
                style={{ backgroundColor: projectColor }}
              />
            )}
            {project.name}
          </h1>
          {project.address && (
            <div className="flex items-center text-muted-foreground text-sm mt-1">
              <MapPin className="h-3.5 w-3.5 mr-1 shrink-0" />
              <p>{project.address}</p>
            </div>
          )}
        </section>

        {/* Stats card */}
        <div className="px-5 py-4">
          <div className="bg-card rounded-xl shadow-sm p-4 border border-border/50 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">
                Gasto Total
              </p>
              <span className="text-xl font-bold">{formatCurrency(totalSpend)}</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Comprobantes</p>
              <p className="text-sm font-medium">{receipts?.length ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Detail fields */}
        <div className="px-5 space-y-5">
          {/* Address */}
          {project.address && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Dirección
              </label>
              <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-3">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm">{project.address}</span>
              </div>
            </div>
          )}

          {/* Architect */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              Arquitecto
            </label>
            <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-3">
              {project.architect ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {getInitials(project.architect.full_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{project.architect.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{project.architect.email}</p>
                  </div>
                </>
              ) : (
                <>
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">Sin arquitecto asignado</span>
                </>
              )}
            </div>
          </div>

          {/* Budget + Total side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Presupuesto
              </label>
              <div className="bg-card border border-border rounded-lg px-3 py-3">
                {budgets && budgets.length > 0 ? (
                  <>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        v{budgets[0].current_version}
                      </Badge>
                    </div>
                    <p className="text-sm font-bold">{formatCurrency(budgets[0].total_amount)}</p>
                  </>
                ) : (
                  <>
                    <Calculator className="h-3.5 w-3.5 text-muted-foreground mb-1" />
                    <p className="text-sm text-muted-foreground">Sin presupuesto</p>
                  </>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Gasto Total
              </label>
              <div className="bg-card border border-border rounded-lg px-3 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    {receipts?.length ?? 0} comp.
                  </span>
                </div>
                <p className="text-sm font-bold">{formatCurrency(totalSpend)}</p>
              </div>
            </div>
          </div>

          {/* Budget link */}
          {budgets && budgets.length > 0 && (
            <Link
              href={`/budgets/${budgets[0].id}`}
              className="block text-center text-primary text-sm font-medium hover:underline"
            >
              Ver presupuesto completo
            </Link>
          )}

          <hr className="border-border my-2" />

          {/* Receipts section */}
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <button
              onClick={() => setReceiptsOpen(!receiptsOpen)}
              className="w-full px-4 py-3 bg-muted/50 flex items-center justify-between text-left focus:outline-none"
            >
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                <span className="font-medium">Comprobantes</span>
                <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full font-bold">
                  {receipts?.length ?? 0}
                </span>
              </div>
              {receiptsOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            {receiptsOpen && (
              <div className="divide-y divide-border/50">
                {isLoadingReceipts && (
                  <div className="p-6 flex justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!isLoadingReceipts && receipts && receipts.length > 0 && receipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="p-4 flex justify-between items-start gap-3 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => router.push(`/receipts/${receipt.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {receipt.vendor ?? 'Sin proveedor'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatRelativeDate(receipt.receipt_date)} · {receipt.uploader.full_name}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">
                        {formatCurrency(receipt.total_amount)}
                      </p>
                      <div className="mt-1">
                        <StatusBadge status={receipt.status} />
                      </div>
                    </div>
                  </div>
                ))}

                {!isLoadingReceipts && (!receipts || receipts.length === 0) && (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No hay comprobantes cargados.
                  </div>
                )}

                <Link
                  href={`/upload?project_id=${projectId}`}
                  className="w-full py-3 text-center text-primary text-sm font-medium hover:bg-muted/50 transition-colors flex items-center justify-center gap-1"
                >
                  <Upload className="h-4 w-4" />
                  Cargar Comprobante
                </Link>
              </div>
            )}
          </div>

          <div className="h-8" />
        </div>
      </main>

      {/* Sticky footer */}
      <footer className="bg-card border-t border-border p-4 pb-8 sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full py-4 rounded-xl shadow-lg shadow-primary/20 text-base"
            asChild
          >
            <Link href={`/upload?project_id=${projectId}`}>
              <Upload className="mr-2 h-5 w-5" />
              Cargar Comprobante
            </Link>
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              size="lg"
              className="w-full py-4 rounded-xl text-base text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-5 w-5" />
              Eliminar Proyecto
            </Button>
          )}
        </div>
      </footer>

      {/* Edit Dialog */}
      <ProjectFormDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        project={project}
      />

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Proyecto</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar el proyecto &quot;{project.name}&quot;?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
