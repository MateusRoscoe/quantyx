'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useOrganizations, useCreateOrganization } from '@/hooks/use-organizations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Building2 } from 'lucide-react';
import { toast } from 'sonner';

export default function OrganizationsPage() {
  const { data: orgs, isLoading } = useOrganizations();
  const createOrg = useCreateOrganization();
  const [open, setOpen] = useState(false);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;

    try {
      await createOrg.mutateAsync({ name });
      setOpen(false);
      toast.success('Organization created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create organization');
    }
  }

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Organizations</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create organization</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Name</Label>
                  <Input
                    id="org-name"
                    name="name"
                    placeholder="My Organization"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createOrg.isPending}>
                  {createOrg.isPending ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : orgs?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              No organizations yet. Create one to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orgs?.map((org) => (
            <Link key={org.id} href={`/app/${org.id}`}>
              <Card className="transition-all duration-150 hover:border-primary/20 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {org.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Created {new Date(org.createdAt).toLocaleDateString()}
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
