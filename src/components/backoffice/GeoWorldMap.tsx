import React, { useMemo, useState } from 'react';
import type { AnalyticsGeoCityItem, AnalyticsGeoCountryItem } from '../../shared/types.ts';

interface GeoWorldMapProps {
  countries: AnalyticsGeoCountryItem[];
  cities: AnalyticsGeoCityItem[];
  title?: string;
}

interface MapRegionDef {
  id: string;
  label: string;
  codes: string[];
  names: string[];
  d: string;
  labelX: number;
  labelY: number;
}

const WORLD_REGIONS: MapRegionDef[] = [
  {
    id: 'US_NA',
    label: 'United States & Canada',
    codes: ['US', 'CA', 'MX'],
    names: ['united states', 'usa', 'canada', 'mexico'],
    d: 'M 42 52 L 185 38 L 228 65 L 210 120 L 175 135 L 145 162 L 105 152 L 72 115 L 40 85 Z',
    labelX: 132,
    labelY: 95
  },
  {
    id: 'SA',
    label: 'Latin America',
    codes: ['BR', 'AR', 'CL', 'CO', 'PE'],
    names: ['brazil', 'argentina', 'chile', 'colombia', 'peru'],
    d: 'M 178 168 L 235 180 L 258 228 L 222 292 L 190 296 L 175 235 L 168 188 Z',
    labelX: 210,
    labelY: 226
  },
  {
    id: 'EU',
    label: 'Europe',
    codes: ['GB', 'UK', 'DE', 'FR', 'NL', 'ES', 'IT', 'PL', 'SE', 'NO', 'FI', 'IE', 'CH', 'UA'],
    names: ['united kingdom', 'germany', 'france', 'netherlands', 'spain', 'italy', 'poland', 'sweden', 'norway', 'ireland'],
    d: 'M 335 46 L 430 38 L 452 72 L 432 108 L 365 112 L 332 95 Z',
    labelX: 392,
    labelY: 82
  },
  {
    id: 'AF',
    label: 'Africa & Middle East',
    codes: ['ZA', 'NG', 'EG', 'KE', 'MA', 'AE', 'SA', 'IL', 'TR'],
    names: ['south africa', 'nigeria', 'egypt', 'kenya', 'united arab emirates', 'saudi arabia', 'israel', 'turkey'],
    d: 'M 338 122 L 458 118 L 485 165 L 450 245 L 405 276 L 374 224 L 332 170 Z',
    labelX: 405,
    labelY: 185
  },
  {
    id: 'RU_CA',
    label: 'Northern Eurasia',
    codes: ['RU', 'KZ'],
    names: ['russia', 'kazakhstan'],
    d: 'M 438 35 L 675 34 L 705 72 L 642 102 L 478 96 L 444 74 Z',
    labelX: 565,
    labelY: 66
  },
  {
    id: 'EA_SA',
    label: 'East & South Asia',
    codes: ['CN', 'IN', 'JP', 'KR', 'TW', 'HK', 'VN', 'TH'],
    names: ['china', 'india', 'japan', 'south korea', 'taiwan', 'hong kong', 'vietnam', 'thailand'],
    d: 'M 480 102 L 648 106 L 675 152 L 625 186 L 542 182 L 488 148 Z',
    labelX: 572,
    labelY: 145
  },
  {
    id: 'SEA',
    label: 'Southeast Asia (PH / SG / ID / MY)',
    codes: ['PH', 'SG', 'ID', 'MY'],
    names: ['philippines', 'singapore', 'indonesia', 'malaysia'],
    d: 'M 578 184 L 664 182 L 672 225 L 575 224 Z',
    labelX: 622,
    labelY: 205
  },
  {
    id: 'OC',
    label: 'Australia & New Zealand',
    codes: ['AU', 'NZ'],
    names: ['australia', 'new zealand'],
    d: 'M 606 238 L 710 235 L 745 288 L 698 308 L 605 292 Z',
    labelX: 668,
    labelY: 274
  }
];

function getRegionIntensityFill(users: number, maxUsers: number): string {
  if (users <= 0) return '#E2E8F0';
  const ratio = users / Math.max(1, maxUsers);
  if (ratio >= 0.65) return '#1D4ED8';
  if (ratio >= 0.35) return '#3B82F6';
  if (ratio >= 0.15) return '#60A5FA';
  return '#93C5FD';
}

export function GeoWorldMap({ countries, cities, title }: GeoWorldMapProps) {
  const [hoveredRegion, setHoveredRegion] = useState<{
    label: string;
    users: number;
  } | null>(null);

  const regionStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const region of WORLD_REGIONS) {
      let total = 0;
      for (const c of countries) {
        const code = (c.countryCode || '').toUpperCase();
        const name = (c.country || '').toLowerCase();
        if (
          (code && region.codes.includes(code)) ||
          region.names.some((n) => name.includes(n))
        ) {
          total += c.activeUsers;
        }
      }
      map.set(region.id, total);
    }
    return map;
  }, [countries]);

  const maxRegionUsers = Math.max(1, ...Array.from(regionStats.values()));
  const maxCountryUsers = Math.max(1, ...countries.map((c) => c.activeUsers));
  const maxCityUsers = Math.max(1, ...cities.map((c) => c.activeUsers));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* World Map + Country List */}
      <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">
              {title || 'Active Users by Country'}
            </h3>
            <p className="text-[11px] text-slate-500">
              Edge IP geolocation &amp; GA4 country breakdown
            </p>
          </div>
          {hoveredRegion ? (
            <span className="font-mono text-xs text-slate-700 tabular-nums">
              {hoveredRegion.label}: <strong>{hoveredRegion.users.toLocaleString()}</strong> users
            </span>
          ) : (
            <span className="font-mono text-[11px] text-slate-500 tabular-nums">
              {countries.length} regions tracked
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-12 items-start">
          <div className="md:col-span-7 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <svg
              viewBox="0 0 780 330"
              className="w-full h-auto select-none"
              role="img"
              aria-label="Global Visitor Distribution Map"
            >
              <rect x="0" y="0" width="780" height="330" fill="#F8FAFC" rx="6" />
              {WORLD_REGIONS.map((region) => {
                const count = regionStats.get(region.id) || 0;
                const fill = getRegionIntensityFill(count, maxRegionUsers);
                const isHovered = hoveredRegion?.label === region.label;
                return (
                  <g
                    key={region.id}
                    onMouseEnter={() =>
                      setHoveredRegion({ label: region.label, users: count })
                    }
                    onMouseLeave={() => setHoveredRegion(null)}
                    className="cursor-pointer transition-opacity"
                  >
                    <path
                      d={region.d}
                      fill={fill}
                      stroke={isHovered ? '#0F172A' : '#FFFFFF'}
                      strokeWidth={isHovered ? 2 : 1.5}
                      strokeLinejoin="round"
                    />
                    {count > 0 && (
                      <text
                        x={region.labelX}
                        y={region.labelY}
                        textAnchor="middle"
                        className="font-mono text-[11px] font-bold fill-white pointer-events-none"
                        style={{ textShadow: '0 1px 2px rgba(15,23,42,0.5)' }}
                      >
                        {count}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>Low density</span>
              <div className="flex items-center gap-1">
                <span className="h-2 w-4 bg-[#E2E8F0] rounded-xs" />
                <span className="h-2 w-4 bg-[#93C5FD] rounded-xs" />
                <span className="h-2 w-4 bg-[#60A5FA] rounded-xs" />
                <span className="h-2 w-4 bg-[#3B82F6] rounded-xs" />
                <span className="h-2 w-4 bg-[#1D4ED8] rounded-xs" />
              </div>
              <span>High density</span>
            </div>
          </div>

          <div className="md:col-span-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <span>Country</span>
              <span>Active Users</span>
            </div>
            <div className="divide-y divide-slate-200">
              {countries.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  No country geo events recorded in selected window.
                </div>
              ) : (
                countries.slice(0, 8).map((c) => {
                  const pct = Math.max(4, Math.round((c.activeUsers / maxCountryUsers) * 100));
                  return (
                    <div key={c.country} className="py-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800 truncate">
                          {c.country}
                          {c.countryCode && c.countryCode !== 'LOCAL' && (
                            <span className="ml-1.5 font-mono text-[10px] text-slate-400">
                              {c.countryCode}
                            </span>
                          )}
                        </span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                          {c.activeUsers.toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 h-1 w-full bg-slate-100 rounded-xs overflow-hidden">
                        <div
                          className="h-full bg-[var(--gs-primary)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* City Breakdown */}
      <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">
              Active Users by City
            </h3>
            <p className="text-[11px] text-slate-500">
              City resolution via edge geo headers &amp; GA4 Data API
            </p>
          </div>
          <span className="font-mono text-[11px] text-slate-500 tabular-nums">
            {cities.length} cities
          </span>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>City</span>
            <span>Active Users</span>
          </div>
          <div className="divide-y divide-slate-200">
            {cities.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No city telemetry recorded in this window yet.
              </div>
            ) : (
              cities.slice(0, 10).map((ct) => {
                const pct = Math.max(4, Math.round((ct.activeUsers / maxCityUsers) * 100));
                return (
                  <div key={`${ct.city}-${ct.country}`} className="py-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-800 truncate">
                        <span className="font-medium">{ct.city}</span>
                        {ct.country && (
                          <span className="text-slate-400"> · {ct.country}</span>
                        )}
                      </span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                        {ct.activeUsers.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 h-1 w-full bg-slate-100 rounded-xs overflow-hidden">
                      <div
                        className="h-full bg-[#3B82F6]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
