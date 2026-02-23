'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
} from '@/hooks/use-organizations';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export default function OrgSettingsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();
  const { data: org, isLoading } = useOrganization(orgId);
  const updateOrg = useUpdateOrganization(orgId);
  const deleteOrg = useDeleteOrganization();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;

    try {
      await updateOrg.mutateAsync({ name });
      toast.success('Organization updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  async function handleDelete() {
    try {
      await deleteOrg.mutateAsync(orgId);
      toast.success('Organization deleted');
      router.push('/organizations');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  if (isLoading) {
    return <Skeleton className="h-8 w-64" />;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Organization Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Update your organization details</CardDescription>
        </CardHeader>
        <form onSubmit={handleUpdate}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                name="name"
                defaultValue={org?.name}
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={updateOrg.isPending}>
              {updateOrg.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>
            Permanently delete this organization and all its data
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">Delete organization</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete organization</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. Type{' '}
                  <strong>{org?.name}</strong> to confirm.
                </DialogDescription>
              </DialogHeader>
              <Input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={org?.name}
              />
              <DialogFooter>
                <Button
                  variant="destructive"
                  disabled={
                    confirmName !== org?.name || deleteOrg.isPending
                  }
                  onClick={handleDelete}
                >
                  {deleteOrg.isPending
                    ? 'Deleting...'
                    : 'Delete organization'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardFooter>
      </Card>
    </div>
  );
}
