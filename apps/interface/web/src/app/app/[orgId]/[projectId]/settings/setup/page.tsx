'use client';

import { useParams } from 'next/navigation';
import { useApiKeys } from '@/hooks/use-api-keys';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

export default function SdkSetupPage() {
  const { projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data: apiKeys, isLoading } = useApiKeys(projectId);

  const firstKey = apiKeys?.[0];
  const keyDisplay = firstKey ? `${firstKey.prefix}...` : 'YOUR_API_KEY';
  const endpoint = 'https://ingest.your-domain.com';

  const installSnippet = `npm install @quantyx/react-sdk`;

  const reactSnippet = `import { QuantyxProvider } from '@quantyx/react-sdk/react';

// Wrap your app with the provider
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

  const trackSnippet = `import { useTrack, useIdentify } from '@quantyx/react-sdk/react';

function MyComponent() {
  const track = useTrack();
  const identify = useIdentify();

  // Identify logged-in users
  useEffect(() => {
    identify(user.id);
  }, [user.id]);

  // Track custom events
  function handleClick() {
    track('button_clicked', {
      props_str: { button_name: 'cta' },
    });
  }
}`;

  const jsSnippet = `import { QuantyxClient } from '@quantyx/react-sdk';

const quantyx = new QuantyxClient({
  apiKey: '${keyDisplay}',
  endpoint: '${endpoint}',
});

// Identify a user
quantyx.identify('user-123');

// Track events
quantyx.track('page_view', {
  props_str: { path: window.location.pathname },
});`;

  const curlSnippet = `# Single event
curl -X POST ${endpoint}/ingest \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${keyDisplay}" \\
  -d '{
    "event_name": "page_view",
    "timestamp": "2026-04-03T12:00:00Z",
    "props_str": { "path": "/home" }
  }'

# Bulk events
curl -X POST ${endpoint}/ingest-bulk \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${keyDisplay}" \\
  -d '{
    "events": [
      { "event_name": "page_view", "timestamp": "..." },
      { "event_name": "click", "timestamp": "..." }
    ]
  }'`;

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="max-w-3xl space-y-6">
      {!firstKey && (
        <Card className="border-warning">
          <CardContent className="pt-6">
            <p className="text-sm text-warning">
              No API keys found. Create one in the <strong>API Keys</strong> tab
              before integrating the SDK.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>1. Install the SDK</CardTitle>
          <CardDescription>Add the Quantyx SDK to your project</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm">
            {installSnippet}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Initialize tracking</CardTitle>
          <CardDescription>Choose your integration method</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="react">
            <TabsList>
              <TabsTrigger value="react">React</TabsTrigger>
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="rest">REST API</TabsTrigger>
            </TabsList>
            <TabsContent value="react" className="space-y-4">
              <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed">
                <code>{reactSnippet}</code>
              </pre>
            </TabsContent>
            <TabsContent value="javascript">
              <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed">
                <code>{jsSnippet}</code>
              </pre>
            </TabsContent>
            <TabsContent value="rest">
              <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed">
                <code>{curlSnippet}</code>
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Track events</CardTitle>
          <CardDescription>
            Use hooks to identify users and track custom events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed">
            <code>{trackSnippet}</code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
