'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
} from '@/hooks/use-api-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
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
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Copy, Trash2, Key } from 'lucide-react';
import { toast } from 'sonner';

export default function ApiKeysPage() {
  const { projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data: apiKeys, isLoading } = useApiKeys(projectId);
  const createKey = useCreateApiKey(projectId);
  const deleteKey = useDeleteApiKey(projectId);

  const [createOpen, setCreateOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  async function handleCreateKey(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;

    try {
      const result = await createKey.mutateAsync({ name });
      setCreatedKey(result.key);
      toast.success('API key created');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create API key',
      );
    }
  }

  async function handleDeleteKey(id: string) {
    try {
      await deleteKey.mutateAsync(id);
      toast.success('API key deleted');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete API key',
      );
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <Dialog
          open={createOpen}
          onOpenChange={(v) => {
            setCreateOpen(v);
            if (!v) setCreatedKey(null);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New API key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {createdKey ? 'API key created' : 'Create API key'}
              </DialogTitle>
              {createdKey && (
                <DialogDescription>
                  Copy this key now. You won&apos;t be able to see it again.
                </DialogDescription>
              )}
            </DialogHeader>
            {createdKey ? (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-2">
                  <Input value={createdKey} readOnly className="font-mono" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(createdKey)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setCreateOpen(false);
                      setCreatedKey(null);
                    }}
                  >
                    Done
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <form onSubmit={handleCreateKey}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="key-name">Name</Label>
                    <Input
                      id="key-name"
                      name="name"
                      placeholder="Production key"
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createKey.isPending}>
                    {createKey.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : apiKeys?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Key className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              No API keys yet. Create one to start ingesting events.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Active keys</CardTitle>
            <CardDescription>
              Keys used to authenticate event ingestion requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys?.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {key.prefix}...
                    </TableCell>
                    <TableCell>
                      {key.lastUsedAt
                        ? new Date(key.lastUsedAt).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      {new Date(key.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteKey(key.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
