'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MailCheck } from 'lucide-react';

export default function VerifyEmailPage() {
  return (
    <Card>
      <CardHeader className="justify-items-center text-center">
        <MailCheck className="h-12 w-12 text-muted-foreground" />
        <CardTitle className="font-display text-2xl">Check your email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-muted-foreground">
          We&apos;ve sent a verification link to your email address. Please
          click the link to verify your account.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
