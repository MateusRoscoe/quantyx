'use client';

import { useState } from 'react';
import { useSession } from '@/lib/auth-client';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export default function AccountPage() {
  const { data: session, isPending } = useSession();
  const [saving, setSaving] = useState(false);

  async function handleUpdateProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;

    try {
      await api.post('/api/auth/update-user', { name });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update profile',
      );
    } finally {
      setSaving(false);
    }
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-screen-xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const user = session?.user;
  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?';

  return (
    <div className="mx-auto max-w-screen-xl space-y-6">
      <h1 className="font-display text-2xl font-bold">Account</h1>

      {/* Profile header */}
      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-display text-lg font-semibold">{user?.name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* Update name */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your display name</CardDescription>
        </CardHeader>
        <form onSubmit={handleUpdateProfile}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={user?.name ?? ''}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user?.email ?? ''}
                disabled
                className="text-muted-foreground"
              />
            </div>
          </CardContent>
          <CardFooter className="pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
