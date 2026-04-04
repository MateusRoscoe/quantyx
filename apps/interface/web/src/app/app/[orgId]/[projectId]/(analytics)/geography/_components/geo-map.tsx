'use client';

import { memo, useState, useMemo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from 'react-simple-maps';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { countryToFlag, countryName } from '@/lib/country';

const WORLD_TOPO_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';

// ISO 3166-1 alpha-3 to numeric mapping used by topojson
// prettier-ignore
const ALPHA3_TO_NUMERIC: Record<string, string> = {
  AFG:'004',ALB:'008',DZA:'012',AND:'020',AGO:'024',ATG:'028',ARG:'032',ARM:'051',
  AUS:'036',AUT:'040',AZE:'031',BHS:'044',BHR:'048',BGD:'050',BRB:'052',BLR:'112',
  BEL:'056',BLZ:'084',BEN:'204',BTN:'064',BOL:'068',BIH:'070',BWA:'072',BRA:'076',
  BRN:'096',BGR:'100',BFA:'854',BDI:'108',KHM:'116',CMR:'120',CAN:'124',CPV:'132',
  CAF:'140',TCD:'148',CHL:'152',CHN:'156',COL:'170',COM:'174',COG:'178',COD:'180',
  CRI:'188',CIV:'384',HRV:'191',CUB:'192',CYP:'196',CZE:'203',DNK:'208',DJI:'262',
  DMA:'212',DOM:'214',ECU:'218',EGY:'818',SLV:'222',GNQ:'226',ERI:'232',EST:'233',
  SWZ:'748',ETH:'231',FJI:'242',FIN:'246',FRA:'250',GAB:'266',GMB:'270',GEO:'268',
  DEU:'276',GHA:'288',GRC:'300',GRD:'308',GTM:'320',GIN:'324',GNB:'624',GUY:'328',
  HTI:'332',HND:'340',HUN:'348',ISL:'352',IND:'356',IDN:'360',IRN:'364',IRQ:'368',
  IRL:'372',ISR:'376',ITA:'380',JAM:'388',JPN:'392',JOR:'400',KAZ:'398',KEN:'404',
  KIR:'296',PRK:'408',KOR:'410',KWT:'414',KGZ:'417',LAO:'418',LVA:'428',LBN:'422',
  LSO:'426',LBR:'430',LBY:'434',LIE:'438',LTU:'440',LUX:'442',MDG:'450',MWI:'454',
  MYS:'458',MDV:'462',MLI:'466',MLT:'470',MHL:'584',MRT:'478',MUS:'480',MEX:'484',
  FSM:'583',MDA:'498',MCO:'492',MNG:'496',MNE:'499',MAR:'504',MOZ:'508',MMR:'104',
  NAM:'516',NRU:'520',NPL:'524',NLD:'528',NZL:'554',NIC:'558',NER:'562',NGA:'566',
  MKD:'807',NOR:'578',OMN:'512',PAK:'586',PLW:'585',PAN:'591',PNG:'598',PRY:'600',
  PER:'604',PHL:'608',POL:'616',PRT:'620',QAT:'634',ROU:'642',RUS:'643',RWA:'646',
  KNA:'659',LCA:'662',VCT:'670',WSM:'882',SMR:'674',STP:'678',SAU:'682',SEN:'686',
  SRB:'688',SYC:'690',SLE:'694',SGP:'702',SVK:'703',SVN:'705',SLB:'090',SOM:'706',
  ZAF:'710',SSD:'728',ESP:'724',LKA:'144',SDN:'729',SUR:'740',SWE:'752',CHE:'756',
  SYR:'760',TWN:'158',TJK:'762',TZA:'834',THA:'764',TLS:'626',TGO:'768',TON:'776',
  TTO:'780',TUN:'788',TUR:'792',TKM:'795',TUV:'798',UGA:'800',UKR:'804',ARE:'784',
  GBR:'826',USA:'840',URY:'858',UZB:'860',VUT:'548',VEN:'862',VNM:'704',YEM:'887',
  ZMB:'894',ZWE:'716',PSE:'275',XKX:'-99',
};

interface GeoMapProps {
  countries: { country: string; count: number; uniqueUsers: number }[];
  cities: {
    value: string;
    count: number;
    latitude: number;
    longitude: number;
  }[];
  metric: 'events' | 'users';
}

function GeoMapInner({ countries, cities, metric }: GeoMapProps) {
  const [tooltipContent, setTooltipContent] = useState('');

  const countryMap = useMemo(() => {
    const map = new Map<string, { count: number; uniqueUsers: number }>();
    for (const c of countries) {
      const numericId = ALPHA3_TO_NUMERIC[c.country];
      if (numericId) {
        map.set(numericId, { count: c.count, uniqueUsers: c.uniqueUsers });
      }
    }
    return map;
  }, [countries]);

  const maxValue = useMemo(() => {
    if (countries.length === 0) return 1;
    return Math.max(
      ...countries.map((c) => (metric === 'events' ? c.count : c.uniqueUsers)),
    );
  }, [countries, metric]);

  const maxCityValue = useMemo(() => {
    if (cities.length === 0) return 1;
    return Math.max(...cities.map((c) => c.count));
  }, [cities]);

  function getColor(numericId: string): string {
    const data = countryMap.get(numericId);
    if (!data) return 'var(--color-muted)';
    const value = metric === 'events' ? data.count : data.uniqueUsers;
    const intensity = Math.max(0.08, value / maxValue);
    return `oklch(from var(--color-chart-1) calc(l + ${((1 - intensity) * 0.3).toFixed(3)}) c h)`;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={!!tooltipContent}>
        <TooltipTrigger asChild>
          <div>
            <ComposableMap
              projection="geoNaturalEarth1"
              projectionConfig={{ scale: 155 }}
              width={800}
              height={420}
              style={{ width: '100%', height: 'auto' }}
            >
              <Geographies geography={WORLD_TOPO_URL}>
                {({ geographies }) =>
                  geographies.map((geo, i) => {
                    const id = geo.id;
                    const data = countryMap.get(id);
                    const alpha3 = Object.entries(ALPHA3_TO_NUMERIC).find(
                      ([, v]) => v === id,
                    )?.[0];
                    const name = alpha3
                      ? countryName(alpha3)
                      : geo.properties.name;
                    const flag = alpha3 ? countryToFlag(alpha3) : '';

                    return (
                      <Geography
                        key={`${geo.id ?? i}-${geo.rpiid ?? i}`}
                        geography={geo}
                        fill={getColor(id)}
                        stroke="var(--color-border)"
                        strokeWidth={0.4}
                        style={{ outline: 'none', cursor: 'pointer' }}
                        onMouseEnter={(e) => {
                          (e.target as SVGPathElement).style.fill =
                            'var(--color-chart-1)';
                          const val = data
                            ? metric === 'events'
                              ? `${data.count.toLocaleString()} events`
                              : `${data.uniqueUsers.toLocaleString()} users`
                            : 'No data';
                          setTooltipContent(
                            `${flag ?? ''} ${name ?? 'Unknown'} — ${val}`,
                          );
                        }}
                        onMouseLeave={(e) => {
                          (e.target as SVGPathElement).style.fill =
                            getColor(id);
                          setTooltipContent('');
                        }}
                      />
                    );
                  })
                }
              </Geographies>
              {cities
                .filter((c) => c.latitude !== 0 && c.longitude !== 0)
                .map((city) => {
                  const radius = Math.max(
                    2,
                    Math.min(12, (city.count / maxCityValue) * 12),
                  );
                  return (
                    <Marker
                      key={`${city.value}-${city.latitude}-${city.longitude}`}
                      coordinates={[city.longitude, city.latitude]}
                    >
                      <circle
                        r={radius}
                        fill="var(--color-chart-2)"
                        fillOpacity={0.6}
                        stroke="var(--color-chart-2)"
                        strokeWidth={1}
                        strokeOpacity={0.8}
                        onMouseEnter={() =>
                          setTooltipContent(
                            `${city.value} — ${city.count.toLocaleString()} events`,
                          )
                        }
                        onMouseLeave={() => setTooltipContent('')}
                      />
                    </Marker>
                  );
                })}
            </ComposableMap>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="pointer-events-none text-sm">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export const GeoMap = memo(GeoMapInner);
