'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Users } from 'lucide-react';

export default function UserDetailPage() {
  const { orgId, projectId, userId } = useParams<{
    orgId: string;
    projectId: string;
    userId: string;
  }>();

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <Link
        href={`/app/${orgId}/${projectId}/users`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to users
      </Link>
      <h1 className="font-display text-2xl font-bold">
        User {userId.slice(0, 8)}...
      </h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="font-display text-lg font-medium">
            User profile coming soon
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
