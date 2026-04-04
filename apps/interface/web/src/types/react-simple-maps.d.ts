declare module 'react-simple-maps' {
  import type { ComponentType, ReactNode, SVGAttributes } from 'react';
  import type { GeoPermissibleObjects } from 'd3-geo';

  export interface ProjectionConfig {
    center?: [number, number];
    rotate?: [number, number, number];
    scale?: number;
    parallels?: [number, number];
  }

  export interface ComposableMapProps extends SVGAttributes<SVGSVGElement> {
    projection?: string;
    projectionConfig?: ProjectionConfig;
    width?: number;
    height?: number;
    children?: ReactNode;
  }

  export interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    translateExtent?: [[number, number], [number, number]];
    onMoveStart?: (event: { coordinates: [number, number]; zoom: number }) => void;
    onMove?: (event: { coordinates: [number, number]; zoom: number }) => void;
    onMoveEnd?: (event: { coordinates: [number, number]; zoom: number }) => void;
    children?: ReactNode;
  }

  export interface GeographiesChildrenProps {
    geographies: GeographyType[];
  }

  export interface GeographiesProps {
    geography: string | Record<string, unknown> | string[];
    children: (data: GeographiesChildrenProps) => ReactNode;
  }

  export interface GeographyType {
    rpiid: string;
    svgPath: string;
    type: string;
    id: string;
    properties: Record<string, string>;
    geometry: GeoPermissibleObjects;
  }

  export interface GeographyProps extends SVGAttributes<SVGPathElement> {
    geography: GeographyType;
  }

  export interface MarkerProps extends SVGAttributes<SVGGElement> {
    coordinates: [number, number];
    children?: ReactNode;
  }

  export interface GraticuleProps extends SVGAttributes<SVGPathElement> {
    step?: [number, number];
  }

  export interface SphereProps extends SVGAttributes<SVGPathElement> {}

  export const ComposableMap: ComponentType<ComposableMapProps>;
  export const ZoomableGroup: ComponentType<ZoomableGroupProps>;
  export const Geographies: ComponentType<GeographiesProps>;
  export const Geography: ComponentType<GeographyProps>;
  export const Marker: ComponentType<MarkerProps>;
  export const Graticule: ComponentType<GraticuleProps>;
  export const Sphere: ComponentType<SphereProps>;
}
