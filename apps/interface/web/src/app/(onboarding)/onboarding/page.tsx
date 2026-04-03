'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateOrganization } from '@/hooks/use-organizations';
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
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';

export default function OnboardingCreateOrgPage() {
  const router = useRouter();
  const createOrg = useCreateOrganization();
  const track = useAnalyticsTrack();
  const [name, setName] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const org = await createOrg.mutateAsync({ name });
      track('onboarding_org_created');
      router.push(`/onboarding/project?orgId=${org.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create organization',
      );
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="font-display text-2xl">
          Welcome to Quantyx
        </CardTitle>
        <CardDescription>
          Let&apos;s set up your workspace. Start by creating an organization.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} className="space-y-6">
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization name</Label>
            <Input
              id="org-name"
              placeholder="My Company"
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
            disabled={createOrg.isPending || !name.trim()}
          >
            {createOrg.isPending ? 'Creating...' : 'Continue'}
          </Button>
          <StepIndicator current={1} total={3} />
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
