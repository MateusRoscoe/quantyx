'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useOrganization } from '@/hooks/use-organizations';
import { useProjects, useCreateProject } from '@/hooks/use-projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';

export default function OrgDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { data: org, isLoading: orgLoading } = useOrganization(orgId);
  const { data: projects, isLoading: projLoading } = useProjects(orgId);
  const createProject = useCreateProject(orgId);
  const [open, setOpen] = useState(false);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;

    try {
      await createProject.mutateAsync({ name });
      setOpen(false);
      toast.success('Project created');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create project',
      );
    }
  }

  if (orgLoading) {
    return <Skeleton className="h-8 w-64" />;
  }

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">{org?.name}</h1>
        <p className="text-sm text-muted-foreground">
          Select a project to view analytics
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Projects</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create project</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="proj-name">Name</Label>
                  <Input
                    id="proj-name"
                    name="name"
                    placeholder="My Project"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createProject.isPending}>
                  {createProject.isPending ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {projLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : projects?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              No projects yet. Create one to start tracking events.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project) => (
            <Link key={project.id} href={`/app/${orgId}/${project.id}`}>
              <Card className="transition-all duration-150 hover:border-primary/20 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5" />
                    {project.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
