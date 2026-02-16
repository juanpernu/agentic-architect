'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useUser } from '@clerk/nextjs';
import { ShieldAlert, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCurrentUser } from '@/lib/use-current-user';
import { fetcher } from '@/lib/fetcher';
import { toast } from 'sonner';
import type { UserRole } from '@obralink/shared';

interface User {
  id: string;
  clerk_user_id: string;
  organization_id: string;
  role: UserRole;
  full_name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  architect: 'Arquitecto',
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  supervisor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  architect: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0]?.slice(0, 2).toUpperCase() || '?';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export default function SettingsPage() {
  const { isAdmin, isLoaded } = useCurrentUser();
  const { user: clerkUser } = useUser();
  const { data: users, error, mutate } = useSWR<User[]>('/api/users', fetcher);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingUserId(userId);
    try {
      const response = await fetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar el rol');
      }

      const updatedUser = await response.json();

      // Optimistically update the cache
      mutate(
        users?.map((u) => (u.id === userId ? updatedUser : u)),
        false
      );

      toast.success(`Rol actualizado a ${ROLE_LABELS[newRole]}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar el rol');
      mutate(); // Revalidate on error
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Loading state
  if (!isLoaded) {
    return (
      <div>
        <PageHeader title="Ajustes" description="Gestiona tu equipo y configuración" />
        <LoadingTable />
      </div>
    );
  }

  // Access denied for non-admins
  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Ajustes" />
        <EmptyState
          icon={ShieldAlert}
          title="Acceso denegado"
          description="Solo los administradores pueden acceder a esta página."
        />
      </div>
    );
  }

  // Loading users
  if (!users && !error) {
    return (
      <div>
        <PageHeader title="Ajustes" description="Gestiona tu equipo y configuración" />
        <LoadingTable />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div>
        <PageHeader title="Ajustes" description="Gestiona tu equipo y configuración" />
        <EmptyState
          icon={ShieldAlert}
          title="Error al cargar usuarios"
          description="Hubo un problema al cargar los usuarios. Por favor, intenta de nuevo."
        />
      </div>
    );
  }

  // Empty state
  if (!users || users.length === 0) {
    return (
      <div>
        <PageHeader title="Ajustes" description="Gestiona tu equipo y configuración" />
        <EmptyState
          icon={Users}
          title="No hay usuarios"
          description="No se encontraron usuarios en tu organización."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Ajustes" description="Gestiona tu equipo y configuración" />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Usuario</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="hidden lg:table-cell">Fecha de registro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const isUpdating = updatingUserId === user.id;
              const isCurrentUser = clerkUser?.id === user.clerk_user_id;

              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url || undefined} alt={user.full_name} />
                        <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.full_name}</span>
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-xs">
                              Tú
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground md:hidden">
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-sm">{user.email}</span>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
                      disabled={isUpdating || isCurrentUser}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue>
                          <Badge
                            variant="secondary"
                            className={ROLE_COLORS[user.role]}
                          >
                            {ROLE_LABELS[user.role]}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          <Badge
                            variant="secondary"
                            className={ROLE_COLORS.admin}
                          >
                            Admin
                          </Badge>
                        </SelectItem>
                        <SelectItem value="supervisor">
                          <Badge
                            variant="secondary"
                            className={ROLE_COLORS.supervisor}
                          >
                            Supervisor
                          </Badge>
                        </SelectItem>
                        <SelectItem value="architect">
                          <Badge
                            variant="secondary"
                            className={ROLE_COLORS.architect}
                          >
                            Arquitecto
                          </Badge>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {formatDate(user.created_at)}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
