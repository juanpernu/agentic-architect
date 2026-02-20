'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Building2, MapPin, MoreHorizontal, Plus, Search } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { useCurrentUser } from '@/lib/use-current-user';
import { usePlan } from '@/lib/use-plan';
import { PROJECT_COLOR_HEX } from '@/lib/project-colors';
import type { ProjectWithDetails } from '@/lib/api-types';
import type { ProjectStatus } from '@architech/shared';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingCards } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProjectFormDialog } from '@/components/project-form-dialog';
import { UpgradeBanner } from '@/components/upgrade-banner';
import { cn } from '@/lib/utils';

const STATUS_DOT_COLORS: Record<string, string> = {
  active: 'bg-blue-500 ring-blue-100 dark:ring-blue-900',
  paused: 'bg-slate-400 ring-slate-100 dark:ring-slate-700',
  completed: 'bg-green-500 ring-green-100 dark:ring-green-900',
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  paused: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  paused: 'Pausado',
  completed: 'Completado',
};

const COUNTER_LABELS: Record<string, string> = {
  active: 'Activos',
  paused: 'Pausados',
  completed: 'Completados',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const AVATAR_COLORS = [
  { bg: 'bg-indigo-100 dark:bg-indigo-900', text: 'text-indigo-700 dark:text-indigo-300' },
  { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-700 dark:text-purple-300' },
  { bg: 'bg-pink-100 dark:bg-pink-900', text: 'text-pink-700 dark:text-pink-300' },
  { bg: 'bg-teal-100 dark:bg-teal-900', text: 'text-teal-700 dark:text-teal-300' },
  { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-700 dark:text-amber-300' },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function toArgDate(d: Date): Date {
  return new Date(d.toLocaleString('en-US', { timeZone: 'America/Buenos_Aires' }));
}

function formatRelativeUpdate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  const argDate = toArgDate(date);
  const argNow = toArgDate(now);
  const today = new Date(argNow.getFullYear(), argNow.getMonth(), argNow.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const updateDay = new Date(argDate.getFullYear(), argDate.getMonth(), argDate.getDate());

  if (updateDay.getTime() === today.getTime()) return 'Ult. act. hoy';
  if (updateDay.getTime() === yesterday.getTime()) return 'Ult. act. ayer';
  if (diffDays < 7) return `Ult. act. ${diffDays}d`;
  if (diffDays < 30) return `Ult. act. ${Math.floor(diffDays / 7)}w`;
  return `Ult. act. ${Math.floor(diffDays / 30)}m`;
}

export default function ProjectsPage() {
  const { isAdminOrSupervisor } = useCurrentUser();
  const { canCreateProject } = usePlan();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: projects, isLoading, error } = useSWR<ProjectWithDetails[]>(
    '/api/projects',
    fetcher
  );

  const filteredProjects = projects?.filter((project) => {
    const matchesSearch = project.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Count by status from all projects (not filtered)
  const statusCounts = projects?.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {}) ?? {};

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tight">Proyectos</h1>
        <div className="text-red-600 mt-4">Error al cargar proyectos</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Proyectos</h1>
        {isAdminOrSupervisor && (
          <Button onClick={() => setShowCreateDialog(true)} disabled={!canCreateProject}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Proyecto
          </Button>
        )}
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar obra..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            aria-label="Buscar proyectos"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-auto min-w-[120px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="paused">Pausado</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status counters */}
      {!isLoading && projects && projects.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(['active', 'paused', 'completed'] as ProjectStatus[])
            .filter((s) => (statusCounts[s] ?? 0) > 0)
            .map((status) => (
              <div
                key={status}
                className="bg-card p-3 rounded-xl border border-border/50 shadow-sm"
              >
                <p className="text-xs text-muted-foreground font-medium">
                  {COUNTER_LABELS[status]}
                </p>
                <p className="text-xl font-bold mt-1">{statusCounts[status]}</p>
              </div>
            ))}
        </div>
      )}

      {!canCreateProject && isAdminOrSupervisor && (
        <UpgradeBanner message="Alcanzaste el límite de proyectos en tu plan." />
      )}

      {isLoading && <LoadingCards count={6} />}

      {!isLoading && filteredProjects?.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No hay proyectos"
          description={
            searchQuery || statusFilter !== 'all'
              ? 'No se encontraron proyectos con los filtros seleccionados'
              : 'Comienza creando tu primer proyecto'
          }
          action={
            !searchQuery && statusFilter === 'all' && isAdminOrSupervisor ? (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Crear Proyecto
              </Button>
            ) : undefined
          }
        />
      )}

      {!isLoading && filteredProjects && filteredProjects.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
          {filteredProjects.map((project) => {
            const isPaused = project.status === 'paused';
            const avatarColor = project.architect
              ? getAvatarColor(project.architect.full_name)
              : null;

            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card
                  className={cn(
                    'shadow-soft border-border/50 p-4 hover:border-primary/50 transition-all cursor-pointer h-full',
                    isPaused && 'opacity-75'
                  )}
                >
                  {/* Status row */}
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-3 h-3 rounded-full ring-2',
                          project.color
                            ? 'ring-border/30'
                            : STATUS_DOT_COLORS[project.status]
                        )}
                        style={
                          project.color
                            ? { backgroundColor: PROJECT_COLOR_HEX[project.color] }
                            : undefined
                        }
                      />
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                          STATUS_BADGE_STYLES[project.status]
                        )}
                      >
                        {STATUS_LABELS[project.status] ?? project.status}
                      </span>
                    </div>
                    <button
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      onClick={(e) => e.preventDefault()}
                      aria-label="Opciones"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Name + Address */}
                  <h3 className="text-lg font-bold leading-tight mb-1">
                    {project.name}
                  </h3>
                  {project.address && (
                    <div className="flex items-center text-muted-foreground text-sm mb-4">
                      <MapPin className="h-3.5 w-3.5 mr-1 shrink-0" />
                      <p className="truncate">{project.address}</p>
                    </div>
                  )}

                  {/* Divider + Architect + Last update */}
                  <div className="border-t border-border pt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {project.architect && avatarColor ? (
                        <>
                          <div
                            className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold',
                              avatarColor.bg,
                              avatarColor.text
                            )}
                          >
                            {getInitials(project.architect.full_name)}
                          </div>
                          <span className="text-xs font-medium">
                            {project.architect.full_name}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Sin asignar
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatRelativeUpdate(project.updated_at)}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <ProjectFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}
