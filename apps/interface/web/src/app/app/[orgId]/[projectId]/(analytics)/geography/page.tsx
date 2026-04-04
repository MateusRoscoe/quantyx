'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAnalyticsGeography } from '@/hooks/use-analytics-geography';
import { ChartCard, PageHeader } from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GeoMap } from './_components/geo-map';
import { GeoKpiCards } from './_components/geo-kpi-cards';
import { TopCountriesChart } from './_components/top-countries-chart';
import { ContinentsChart } from './_components/continents-chart';
import { GeoBreakdownTabs } from './_components/geo-breakdown-tabs';

export default function GeographyPage() {
  const { projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data, isLoading } = useAnalyticsGeography(projectId);
  const [mapMetric, setMapMetric] = useState<'events' | 'users'>('events');

  return (
    <div className="space-y-6">
      <PageHeader title="Geography" />

      <GeoKpiCards data={data} isLoading={isLoading} />

      <ChartCard
        title="Visitor Map"
        isLoading={isLoading}
        isEmpty={!data?.countries?.length}
        action={
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={mapMetric === 'events' ? 'default' : 'ghost'}
              onClick={() => setMapMetric('events')}
            >
              Events
            </Button>
            <Button
              size="sm"
              variant={mapMetric === 'users' ? 'default' : 'ghost'}
              onClick={() => setMapMetric('users')}
            >
              Users
            </Button>
          </div>
        }
      >
        <GeoMap
          countries={data?.countries ?? []}
          cities={data?.cities ?? []}
          metric={mapMetric}
        />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Top Countries"
          isLoading={isLoading}
          isEmpty={!data?.countries?.length}
        >
          <TopCountriesChart countries={data?.countries ?? []} />
        </ChartCard>

        <ChartCard
          title="Continents"
          isLoading={isLoading}
          isEmpty={!data?.continents?.length}
        >
          <ContinentsChart continents={data?.continents ?? []} />
        </ChartCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Geographic Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GeoBreakdownTabs data={data} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
