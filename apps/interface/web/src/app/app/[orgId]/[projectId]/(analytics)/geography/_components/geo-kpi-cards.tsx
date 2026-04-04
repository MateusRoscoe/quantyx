'use client';

import { Globe, Zap, Users, MapPin } from 'lucide-react';
import { StatCard } from '@/components/dashboard';
import { countryToFlag, countryName } from '@/lib/country';
import type { GeographyData } from '@/hooks/use-analytics-geography';

interface GeoKpiCardsProps {
  data: GeographyData | undefined;
  isLoading: boolean;
}

export function GeoKpiCards({ data, isLoading }: GeoKpiCardsProps) {
  const totalCountries = data?.countries.length ?? 0;
  const totalEvents =
    data?.countries.reduce((sum, c) => sum + c.count, 0) ?? 0;
  const totalUsers =
    data?.countries.reduce((sum, c) => sum + c.uniqueUsers, 0) ?? 0;
  const topCountry = data?.countries[0];
  const topLabel = topCountry
    ? `${countryToFlag(topCountry.country) ?? ''} ${countryName(topCountry.country) ?? topCountry.country}`
    : '-';

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Countries"
        value={totalCountries}
        icon={Globe}
        isLoading={isLoading}
      />
      <StatCard
        label="Total Events"
        value={totalEvents}
        icon={Zap}
        isLoading={isLoading}
      />
      <StatCard
        label="Unique Users"
        value={totalUsers}
        icon={Users}
        isLoading={isLoading}
      />
      <StatCard
        label="Top Country"
        value={topLabel}
        icon={MapPin}
        isLoading={isLoading}
      />
    </div>
  );
}
