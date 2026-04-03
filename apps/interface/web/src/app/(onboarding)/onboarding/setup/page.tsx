'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCreateApiKey } from '@/hooks/use-api-keys';
import { useAnalyticsTrack } from '@/hooks/use-analytics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Copy, Rocket } from 'lucide-react';
import { toast } from 'sonner';

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = searchParams.get('orgId') ?? '';
  const projectId = searchParams.get('projectId') ?? '';
  const createKey = useCreateApiKey(projectId);
  const track = useAnalyticsTrack();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-create API key on mount
  useEffect(() => {
    if (!projectId || apiKey) return;

    createKey
      .mutateAsync({ name: 'Default key' })
      .then((result) => {
        setApiKey(result.key);
        track('onboarding_api_key_created');
      })
      .catch(() => {
        toast.error('Failed to create API key');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function handleCopy() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }

  function handleGoToDashboard() {
    track('onboarding_completed');
    router.push(`/app/${orgId}/${projectId}`);
  }

  const endpoint = 'http://localhost:3002';
  const keyDisplay = apiKey ?? 'your-api-key';

  const reactSnippet = `import { QuantyxProvider } from '@quantyx/react-sdk/react';

function App({ children }) {
  return (
    <QuantyxProvider
      config={{
        apiKey: '${keyDisplay}',
        endpoint: '${endpoint}',
      }}
    >
      {children}
    </QuantyxProvider>
  );
}`;

  const jsSnippet = `import { QuantyxClient } from '@quantyx/react-sdk';

const quantyx = new QuantyxClient({
  apiKey: '${keyDisplay}',
  endpoint: '${endpoint}',
});

// Track an event
quantyx.track('page_view', {
  props_str: { path: window.location.pathname },
});`;

  const curlSnippet = `curl -X POST ${endpoint}/ingest \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${keyDisplay}" \\
  -d '{
    "event_name": "test_event",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'`;

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Rocket className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="font-display text-2xl">
          Set up your SDK
        </CardTitle>
        <CardDescription>
          Install the Quantyx SDK in your application to start tracking events.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* API Key display */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Your API Key</p>
          <div className="flex items-center gap-2">
            <Input
              value={apiKey ?? 'Generating...'}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              disabled={!apiKey}
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Save this key — you won&apos;t be able to see it again.
          </p>
        </div>

        {/* Code snippets */}
        <Tabs defaultValue="react">
          <TabsList className="w-full">
            <TabsTrigger value="react" className="flex-1">
              React
            </TabsTrigger>
            <TabsTrigger value="javascript" className="flex-1">
              JavaScript
            </TabsTrigger>
            <TabsTrigger value="curl" className="flex-1">
              cURL
            </TabsTrigger>
          </TabsList>
          <TabsContent value="react">
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
              <code>{reactSnippet}</code>
            </pre>
          </TabsContent>
          <TabsContent value="javascript">
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
              <code>{jsSnippet}</code>
            </pre>
          </TabsContent>
          <TabsContent value="curl">
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
              <code>{curlSnippet}</code>
            </pre>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button className="w-full" onClick={handleGoToDashboard}>
          Go to dashboard
        </Button>
        <StepIndicator current={3} total={3} />
      </CardFooter>
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

export default function OnboardingSetupPage() {
  return (
    <Suspense>
      <SetupContent />
    </Suspense>
  );
}
