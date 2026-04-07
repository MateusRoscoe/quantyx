import maxmind from 'maxmind';
import { resolve, dirname } from 'node:path';
import { getLogger } from '@quantyx/shared-backend';
import {
  COUNTRY_A2_TO_A3,
  COUNTRY_A2_TO_CONTINENT,
  COUNTRY_A2_TO_REGION,
  ISO3_CODES,
} from '@quantyx/shared';
import { environment } from '../helpers/env';

const logger = getLogger('geo-service');

export interface GeoFields {
  country: string;
  continent: string;
  region: string;
  state: string;
  city: string;
  latitude: number;
  longitude: number;
}

// DB-IP Lite MMDB returns this flat structure (different from MaxMind's nested format)
interface DbIpCityResult {
  city?: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
  state1?: string;
  state2?: string;
  postcode?: string;
  timezone?: string;
}

interface MmdbReader {
  get(ip: string): DbIpCityResult | null;
}

let ipv4Reader: MmdbReader | null = null;
let ipv6Reader: MmdbReader | null = null;

function getDefaultDbPath(variant: 'ipv4' | 'ipv6'): string {
  // require.resolve works in CJS (esbuild output) to find the installed package
  const pkgPath =
    require.resolve('@ip-location-db/dbip-city-mmdb/package.json');
  return resolve(dirname(pkgPath), `dbip-city-${variant}.mmdb`);
}

export async function initGeoService(): Promise<void> {
  const customPath = environment.GEOIP_DB_PATH;

  if (customPath) {
    // Custom path: single MMDB file (e.g., MaxMind GeoLite2-City.mmdb handles both)
    logger.info({ path: customPath }, 'Loading custom GeoIP database');
    const reader = (await maxmind.open(customPath)) as unknown as MmdbReader;
    ipv4Reader = reader;
    ipv6Reader = reader;
  } else {
    // Default: DB-IP Lite has separate IPv4 and IPv6 files
    const ipv4Path = getDefaultDbPath('ipv4');
    const ipv6Path = getDefaultDbPath('ipv6');
    logger.info('Loading DB-IP Lite GeoIP databases');
    const [v4, v6] = await Promise.all([
      maxmind.open(ipv4Path),
      maxmind.open(ipv6Path),
    ]);
    ipv4Reader = v4 as unknown as MmdbReader;
    ipv6Reader = v6 as unknown as MmdbReader;
  }

  logger.info('GeoIP databases loaded');
}

function lookupIp(ip: string): DbIpCityResult | null {
  if (!ipv4Reader || !ipv6Reader) return null;

  try {
    const isV6 = ip.includes(':');
    const reader = isV6 ? ipv6Reader : ipv4Reader;
    return reader.get(ip) as DbIpCityResult | null;
  } catch {
    return null;
  }
}

function toAlpha3(alpha2: string): string {
  return COUNTRY_A2_TO_A3[alpha2] ?? '';
}

function toContinent(alpha2: string): string {
  return COUNTRY_A2_TO_CONTINENT[alpha2] ?? '';
}

function toRegion(alpha2: string): string {
  return COUNTRY_A2_TO_REGION[alpha2] ?? '';
}

export function enrichGeo(
  ip: string,
  existing: Partial<GeoFields>,
  eventId?: string,
): GeoFields {
  const result = lookupIp(ip);

  const inferred: GeoFields = {
    country: result?.country_code ? toAlpha3(result.country_code) : '',
    continent: result?.country_code ? toContinent(result.country_code) : '',
    region: result?.country_code ? toRegion(result.country_code) : '',
    state: result?.state1 ?? '',
    city: result?.city ?? '',
    latitude: result?.latitude ?? 0,
    longitude: result?.longitude ?? 0,
  };

  const hasValidClientCountry =
    !!existing.country && ISO3_CODES.has(existing.country);

  // Log mismatches when client sent geo data but IP lookup disagrees
  if (
    hasValidClientCountry &&
    inferred.country &&
    existing.country !== inferred.country
  ) {
    logger.warn(
      {
        eventId,
        ip,
        clientCountry: existing.country,
        inferredCountry: inferred.country,
        clientCity: existing.city,
        inferredCity: inferred.city,
      },
      'Geo mismatch: client-provided country differs from IP lookup',
    );
  }

  // IP is the source of truth — use inferred data when available,
  // fall back to client-provided data only when the lookup fails
  return {
    country: inferred.country || existing.country || '',
    continent: inferred.continent || existing.continent || '',
    region: inferred.region || existing.region || '',
    state: inferred.state || existing.state || '',
    city: inferred.city || existing.city || '',
    latitude: inferred.latitude || existing.latitude || 0,
    longitude: inferred.longitude || existing.longitude || 0,
  };
}
