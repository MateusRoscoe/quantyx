'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();

  // The invite flow requires a backend endpoint to validate the token
  // and add the user as a member. This is a placeholder UI for when
  // the invite system is implemented in the backend.

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="font-display text-2xl">Team Invitation</CardTitle>
        <CardDescription>
          You&apos;ve been invited to join an organization on Quantyx.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-sm text-muted-foreground">
          The invite system is not yet available. Please ask the organization
          admin to add you as a member directly from the Members settings page.
        </p>
        <p className="mt-2 font-mono text-xs text-muted-foreground/50">
          Token: {token?.slice(0, 12)}...
        </p>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button asChild>
          <Link href="/login">Go to sign in</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
