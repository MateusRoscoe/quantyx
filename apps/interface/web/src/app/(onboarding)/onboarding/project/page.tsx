'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCreateProject } from '@/hooks/use-projects';
import { useAnalyticsTrack } from '@/hooks/use-analytics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Suspense } from 'react';

function ProjectForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = searchParams.get('orgId') ?? '';
  const createProject = useCreateProject(orgId);
  const track = useAnalyticsTrack();
  const [name, setName] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!orgId) {
      toast.error('Missing organization. Please start from the beginning.');
      router.push('/onboarding');
      return;
    }

    try {
      const project = await createProject.mutateAsync({ name });
      track('onboarding_project_created');
      router.push(
        `/onboarding/setup?orgId=${orgId}&projectId=${project.id}`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create project',
      );
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <FolderOpen className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="font-display text-2xl">
          Create your first project
        </CardTitle>
        <CardDescription>
          A project represents one application or website you want to track.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} className="space-y-6">
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="proj-name">Project name</Label>
            <Input
              id="proj-name"
              placeholder="Production Website"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            type="submit"
            className="w-full"
            disabled={createProject.isPending || !name.trim()}
          >
            {createProject.isPending ? 'Creating...' : 'Continue'}
          </Button>
          <StepIndicator current={2} total={3} />
        </CardFooter>
      </form>
    </Card>
  );
}

function StepIndicator({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 w-6 rounded-full ${
            i < current ? 'bg-primary' : 'bg-border'
          }`}
        />
      ))}
    </div>
  );
}

export default function OnboardingProjectPage() {
  return (
    <Suspense>
      <ProjectForm />
    </Suspense>
  );
}
