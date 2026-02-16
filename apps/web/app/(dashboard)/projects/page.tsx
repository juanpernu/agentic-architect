'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Building2, Plus, Search } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { useCurrentUser } from '@/lib/use-current-user';
import type { ProjectWithDetails } from '@/lib/api-types';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingCards } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ProjectFormDialog } from '@/components/project-form-dialog';

export default function ProjectsPage() {
  const { isAdminOrSupervisor } = useCurrentUser();
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

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Proyectos" />
        <div className="text-red-600">Error al cargar proyectos</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Proyectos"
        description="Gestiona tus proyectos de construcción"
        action={
          isAdminOrSupervisor ? (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2" />
              Nuevo Proyecto
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar proyectos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
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
                <Plus className="mr-2" />
                Crear Proyecto
              </Button>
            ) : undefined
          }
        />
      )}

      {!isLoading && filteredProjects && filteredProjects.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <StatusBadge status={project.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Arquitecto:</span>{' '}
                    {project.architect?.full_name ?? 'Sin asignar'}
                  </div>
                  <div className="text-lg font-bold text-primary">
                    {formatCurrency(project.total_spend)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Gasto total
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <ProjectFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}
