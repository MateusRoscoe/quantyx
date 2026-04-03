'use client';

import { useRouter } from 'next/navigation';
import { useOrganizations } from '@/hooks/use-organizations';
import { useProjects } from '@/hooks/use-projects';
import { useMembership } from '@/hooks/use-membership';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Building2,
  Settings,
  Users,
  FolderOpen,
  Check,
  Plus,
} from 'lucide-react';

interface ProjectSwitcherProps {
  orgId?: string;
  projectId?: string;
}

export function ProjectSwitcher({ orgId, projectId }: ProjectSwitcherProps) {
  const router = useRouter();
  const { data: orgs } = useOrganizations();
  const { data: projects } = useProjects(orgId ?? '');
  const membership = useMembership(orgId ?? '');

  const currentOrg = orgs?.find((o) => o.id === orgId);
  const orgInitial = currentOrg?.name?.charAt(0).toUpperCase() ?? 'Q';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-sidebar-accent">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
              {orgInitial}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-56" sideOffset={8}>
        {orgId ? (
          <>
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-semibold">{currentOrg?.name}</p>
              <p className="text-xs text-muted-foreground">
                {projects?.length ?? 0} project
                {projects?.length !== 1 ? 's' : ''}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {membership.isAdmin && (
              <>
                <DropdownMenuItem onClick={() => router.push(`/app/${orgId}/settings`)}>
                  <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                  Organization Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/app/${orgId}/settings/members`)}>
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  Members
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                Switch Project
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-48">
                {projects?.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => router.push(`/app/${orgId}/${project.id}`)}
                  >
                    <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{project.name}</span>
                    {project.id === projectId && (
                      <Check className="ml-2 h-3.5 w-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push(`/app/${orgId}`)}>
                  <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
                  New project
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                Switch Organization
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-48">
                {orgs?.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => router.push(`/app/${org.id}`)}
                  >
                    <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{org.name}</span>
                    {org.id === orgId && (
                      <Check className="ml-2 h-3.5 w-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/app/organizations')}>
                  <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
                  New organization
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        ) : (
          <>
            <DropdownMenuLabel>Organizations</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {orgs?.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => router.push(`/app/${org.id}`)}
              >
                <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                {org.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/app/organizations')}>
              <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
              New organization
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
