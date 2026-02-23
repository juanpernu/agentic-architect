'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Building2, MapPin, Plus, Search } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatRelativeCompact } from '@/lib/date-utils';
import { getInitials, getAvatarColor } from '@/lib/avatar-utils';
import { useCurrentUser } from '@/lib/use-current-user';
import { usePlan } from '@/lib/use-plan';
import { PROJECT_COLOR_HEX } from '@/lib/project-colors';
import type { ProjectWithDetails } from '@/lib/api-types';
import type { ProjectStatus } from '@architech/shared';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingCards } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProjectFormDialog } from '@/components/project-form-dialog';
import { CreateProjectCard } from '@/components/dashboard/create-project-card';
import { UpgradeBanner } from '@/components/upgrade-banner';
import { cn } from '@/lib/utils';

const STATUS_DOT_COLORS: Record<ProjectStatus, string> = {
  active: 'bg-blue-500 ring-blue-100 dark:ring-blue-900',
  paused: 'bg-slate-400 ring-slate-100 dark:ring-slate-700',
  completed: 'bg-green-500 ring-green-100 dark:ring-green-900',
};

const STATUS_BADGE_STYLES: Record<ProjectStatus, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  paused: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Activo',
  paused: 'Pausado',
  completed: 'Completado',
};

const COUNTER_LABELS: Record<ProjectStatus, string> = {
  active: 'Activos',
  paused: 'Pausados',
  completed: 'Completados',
};

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
    <div className="animate-slide-up">
      {/* Header band */}
      <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 pt-4 md:pt-6 pb-6 mb-6 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Proyectos</h1>
          <p className="text-muted-foreground mt-1">Gestión de obras y proyectos</p>
          {isAdminOrSupervisor && (
            <Button onClick={() => setShowCreateDialog(true)} disabled={!canCreateProject}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Proyecto
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6">
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
          {isAdminOrSupervisor && canCreateProject && (
            <CreateProjectCard />
          )}
          {filteredProjects.map((project) => {
            const isPaused = project.status === 'paused';
            const avatarColor = project.architect
              ? getAvatarColor(project.architect.full_name)
              : null;

            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card
                  className={cn(
                    'shadow-soft border-border/50 hover:border-primary/50 transition-all cursor-pointer h-full',
                    isPaused && 'opacity-75'
                  )}
                >
                  <CardHeader className="pb-0">
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
                  </CardHeader>

                  <CardContent>
                    <h3 className="text-2xl font-bold leading-tight">
                      {project.name}
                    </h3>
                    {project.address && (
                      <div className="flex items-center text-muted-foreground text-sm mt-1">
                        <MapPin className="h-3.5 w-3.5 mr-1 shrink-0" />
                        <p className="truncate">{project.address}</p>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="border-t border-border justify-between">
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
                      {formatRelativeCompact(project.updated_at)}
                    </div>
                  </CardFooter>
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
    </div>
  );
}
