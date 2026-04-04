'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DataTable,
  NumberCell,
  CountryNameCell,
} from '@/components/dashboard';
import type { ColumnDef } from '@tanstack/react-table';
import type { GeographyData } from '@/hooks/use-analytics-geography';

type CountryRow = { country: string; count: number; uniqueUsers: number };
type DimensionRow = { value: string; count: number; uniqueUsers: number };

const countryColumns: ColumnDef<CountryRow, unknown>[] = [
  { accessorKey: 'country', header: 'Country', cell: CountryNameCell },
  { accessorKey: 'count', header: 'Events', cell: NumberCell },
  { accessorKey: 'uniqueUsers', header: 'Unique Users', cell: NumberCell },
];

const dimensionColumns: ColumnDef<DimensionRow, unknown>[] = [
  { accessorKey: 'value', header: 'Name' },
  { accessorKey: 'count', header: 'Events', cell: NumberCell },
  { accessorKey: 'uniqueUsers', header: 'Unique Users', cell: NumberCell },
];

interface GeoBreakdownTabsProps {
  data: GeographyData | undefined;
  isLoading: boolean;
}

export function GeoBreakdownTabs({ data, isLoading }: GeoBreakdownTabsProps) {
  return (
    <Tabs defaultValue="countries">
      <TabsList>
        <TabsTrigger value="countries">Countries</TabsTrigger>
        <TabsTrigger value="regions">Regions</TabsTrigger>
        <TabsTrigger value="cities">Cities</TabsTrigger>
      </TabsList>
      <TabsContent value="countries" className="mt-4">
        <DataTable
          columns={countryColumns}
          data={data?.countries ?? []}
          isLoading={isLoading}
          pageSize={20}
        />
      </TabsContent>
      <TabsContent value="regions" className="mt-4">
        <DataTable
          columns={dimensionColumns}
          data={data?.regions ?? []}
          isLoading={isLoading}
          pageSize={20}
        />
      </TabsContent>
      <TabsContent value="cities" className="mt-4">
        <DataTable
          columns={dimensionColumns}
          data={data?.cities ?? []}
          isLoading={isLoading}
          pageSize={20}
        />
      </TabsContent>
    </Tabs>
  );
}
