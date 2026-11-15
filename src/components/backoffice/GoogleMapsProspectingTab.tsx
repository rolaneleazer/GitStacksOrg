import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useMap
} from '@vis.gl/react-google-maps';
import {
  CheckCircle2,
  ExternalLink,
  Globe,
  MapPin,
  Phone,
  Search,
  Sparkles,
  Star
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.ts';
import type { CrmLead, GoogleMapsPlaceCandidate } from '../../shared/types.ts';

interface GoogleMapsProspectingTabProps {
  existingDomains: Set<string>;
  onLeadsUpdated: (leads: CrmLead[], noticeText: string) => void;
  onOpenLead: (lead: CrmLead) => void;
  onError: (msg: string) => void;
}

interface ViewportControllerProps {
  places: GoogleMapsPlaceCandidate[];
  activePlace: GoogleMapsPlaceCandidate | null;
}

function MapViewportController({ places, activePlace }: ViewportControllerProps) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (activePlace) {
      map.panTo(activePlace.location);
      if ((map.getZoom() || 11) < 13) {
        map.setZoom(13);
      }
      return;
    }
    if (places.length === 1) {
      map.panTo(places[0].location);
      map.setZoom(14);
      return;
    }
    if (places.length > 1) {
      let north = -90;
      let south = 90;
      let east = -180;
      let west = 180;
      for (const p of places) {
        north = Math.max(north, p.location.lat);
        south = Math.min(south, p.location.lat);
        east = Math.max(east, p.location.lng);
        west = Math.min(west, p.location.lng);
      }
      map.fitBounds({ north, south, east, west }, 56);
    }
  }, [map, places, activePlace]);

  return null;
}

export function GoogleMapsProspectingTab({
  existingDomains,
  onLeadsUpdated,
  onOpenLead,
  onError
}: GoogleMapsProspectingTabProps) {
  const [configApiKey, setConfigApiKey] = useState('');
  const [configLoaded, setConfigLoaded] = useState(false);

  const [query, setQuery] = useState('software consulting & clinics in San Francisco');
  const [regionCode, setRegionCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [places, setPlaces] = useState<GoogleMapsPlaceCandidate[]>([]);
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [autoAnalyzeGemini, setAutoAnalyzeGemini] = useState(true);
  const [importing, setImporting] = useState(false);
  const [lastImportedLeads, setLastImportedLeads] = useState<CrmLead[]>([]);

  const envViteKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const activeMapsKey = envViteKey || configApiKey;

  useEffect(() => {
    api
      .getGoogleMapsConfig()
      .then((res) => {
        if (res.apiKey) setConfigApiKey(res.apiKey);
      })
      .catch(() => {})
      .finally(() => setConfigLoaded(true));
  }, []);

  const activePlace = useMemo(
    () => places.find((p) => p.place_id === activePlaceId) || null,
    [places, activePlaceId]
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setActivePlaceId(null);
    setLastImportedLeads([]);
    try {
      const res = await api.searchGoogleMapsPlaces(query.trim(), regionCode.trim());
      setPlaces(res.places);
      if (res.places.length > 0) {
        setActivePlaceId(res.places[0].place_id);
        setSelectedIds(new Set(res.places.slice(0, 3).map((p) => p.place_id)));
      } else {
        setSelectedIds(new Set());
        onError('No establishments matched that search query. Try adding a city or industry.');
      }
    } catch (err) {
      const typed = err as Error & { quotaExceeded?: boolean; status?: number };
      const msg = typed.message || 'Google Maps search failed.';
      if (
        typed.quotaExceeded ||
        typed.status === 429 ||
        /RESOURCE_EXHAUSTED|quota|429/i.test(msg)
      ) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      onError(msg);
    } finally {
      setSearching(false);
    }
  };

  const handleImportPlaces = async (targetPlaces: GoogleMapsPlaceCandidate[]) => {
    if (targetPlaces.length === 0) return;
    setImporting(true);
    try {
      const res = await api.importGoogleMapsPlaces(
        targetPlaces,
        autoAnalyzeGemini,
        query.trim()
      );
      setLastImportedLeads(res.importedLeads);
      onLeadsUpdated(
        res.leads,
        `Google Maps Places: +${res.insertedCount} added, ${res.mergedCount} merged (${res.mxVerifiedCount} MX verified${
          autoAnalyzeGemini ? ' · Gemini AI analyzed' : ''
        }).`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save establishments to CRM.');
    } finally {
      setImporting(false);
    }
  };

  const toggleSelected = (placeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
  };

  const extractDomain = (url: string): string => {
    try {
      return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Controls Header */}
      <form
        onSubmit={handleSearch}
        className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[var(--gs-primary)]" />
              <h3 className="font-display text-sm font-bold text-slate-900">
                Google Maps Establishment Finder &amp; AI Lead Analyzer
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Search local businesses and commercial establishments on Google Maps, extract public
              phones &amp; websites, scrape contact emails with DNS MX checks, and score fit with Gemini.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={autoAnalyzeGemini}
              onChange={(e) => setAutoAnalyzeGemini(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span>Auto-scrape emails &amp; analyze with Gemini</span>
          </label>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. logistics companies in Chicago, dental clinics in Austin, SaaS agencies in London"
              className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3.5 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
            />
          </div>
          <input
            type="text"
            maxLength={2}
            value={regionCode}
            onChange={(e) => setRegionCode(e.target.value.toUpperCase())}
            placeholder="Region (US)"
            aria-label="Two-letter country region code"
            className="min-h-[42px] w-full sm:w-28 rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs uppercase text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="min-h-[42px] whitespace-nowrap shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
          >
            <Search className="h-3.5 w-3.5" />
            <span>{searching ? 'Searching Places...' : 'Find Establishments'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span>Quick searches:</span>
          {[
            'IT managed service providers in Austin',
            'freight logistics companies in Singapore',
            'private medical clinics in Sydney',
            'ecommerce agencies in New York'
          ].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setQuery(preset)}
              className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700 hover:bg-slate-100"
            >
              {preset}
            </button>
          ))}
        </div>
      </form>

      {/* Recently Analyzed Leads Strip */}
      {lastImportedLeads.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            <span>
              Saved &amp; Analyzed {lastImportedLeads.length} Establishment
              {lastImportedLeads.length === 1 ? '' : 's'} into CRM
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {lastImportedLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">{lead.company_name}</div>
                  <div className="text-[11px] text-slate-600 truncate">
                    <span className="font-mono">{lead.email || 'No email'}</span> · Fit{' '}
                    <span className="font-mono font-semibold">{lead.fit_score}%</span> ·{' '}
                    {lead.recommended_service}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenLead(lead)}
                  className="shrink-0 rounded-lg bg-[var(--gs-primary)] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                >
                  Open Dossier
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Split Pane: Map Canvas + Establishment List */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Interactive Google Map */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
          <div className="border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800">Interactive Establishment Map</span>
            <span className="font-mono text-[11px] text-slate-500 tabular-nums">
              {places.length} marker{places.length === 1 ? '' : 's'} loaded
            </span>
          </div>

          <div className="h-[500px] w-full relative bg-slate-100">
            {!configLoaded && !activeMapsKey ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">
                Initializing Google Maps Platform...
              </div>
            ) : !activeMapsKey ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center space-y-2">
                <MapPin className="h-6 w-6 text-slate-400" />
                <div className="text-xs font-bold text-slate-800">
                  Google Maps key is activating in your server environment
                </div>
                <p className="max-w-sm text-[11px] text-slate-600">
                  Wait a moment or refresh after server restart for the provisioned Google Maps key to
                  take effect.
                </p>
              </div>
            ) : (
              <APIProvider apiKey={activeMapsKey}>
                <GoogleMap
                  defaultCenter={{ lat: 37.7749, lng: -122.4194 }}
                  defaultZoom={11}
                  mapId="DEMO_MAP_ID"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  gestureHandling="greedy"
                  className="h-full w-full"
                >
                  <MapViewportController places={places} activePlace={activePlace} />

                  {places.map((place) => {
                    const isActive = place.place_id === activePlaceId;
                    const isChecked = selectedIds.has(place.place_id);
                    return (
                      <AdvancedMarker
                        key={place.place_id}
                        position={place.location}
                        onClick={() => setActivePlaceId(place.place_id)}
                        title={place.name}
                      >
                        <Pin
                          background={isActive ? '#0F172A' : isChecked ? '#2563EB' : '#475569'}
                          borderColor="#FFFFFF"
                          glyphColor="#FFFFFF"
                        />
                      </AdvancedMarker>
                    );
                  })}

                  {activePlace && (
                    <InfoWindow
                      position={activePlace.location}
                      onCloseClick={() => setActivePlaceId(null)}
                    >
                      <div className="max-w-[260px] space-y-1.5 p-0.5 text-slate-900">
                        <div className="font-bold text-xs">{activePlace.name}</div>
                        <div className="text-[11px] text-slate-600">
                          {activePlace.primary_type}
                          {activePlace.rating ? ` · ${activePlace.rating}★ (${activePlace.user_rating_count || 0})` : ''}
                        </div>
                        <div className="text-[11px] text-slate-600">
                          {activePlace.formatted_address}
                        </div>
                        {activePlace.phone && (
                          <div className="font-mono text-[11px] text-slate-700">
                            {activePlace.phone}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={importing}
                            onClick={() => handleImportPlaces([activePlace])}
                            className="rounded bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {importing ? 'Analyzing...' : 'Save & Analyze'}
                          </button>
                          <a
                            href={activePlace.google_maps_uri}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-medium text-blue-700 hover:underline"
                          >
                            View on Google Maps
                          </a>
                        </div>
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              </APIProvider>
            )}
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Google Maps Places API (New) · Advanced Markers</span>
            <span>Public establishment data only</span>
          </div>
        </div>

        {/* Right: Establishment Results & Batch Import */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white flex flex-col max-h-[580px]">
          <div className="border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-800">
                Establishments Found ({places.length})
              </h4>
              <div className="text-[11px] text-slate-500">
                Select businesses to scrape emails &amp; analyze
              </div>
            </div>
            <button
              type="button"
              disabled={importing || selectedIds.size === 0}
              onClick={() =>
                handleImportPlaces(places.filter((p) => selectedIds.has(p.place_id)))
              }
              className="min-h-[36px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>
                {importing
                  ? 'Analyzing...'
                  : `Import Selected (${selectedIds.size})`}
              </span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
            {places.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <div>Search any category &amp; city above to load local businesses onto the map.</div>
                <div className="text-[11px] text-slate-400">
                  Importing scrapes the establishment&rsquo;s public website for contact emails, verifies
                  MX records, and drafts a tailored GitStack proposal.
                </div>
              </div>
            ) : (
              places.map((place) => {
                const isSelected = selectedIds.has(place.place_id);
                const isActive = activePlaceId === place.place_id;
                const domain = extractDomain(place.website_url);
                const alreadyInCrm = Boolean(domain && existingDomains.has(domain));
                return (
                  <div
                    key={place.place_id}
                    onClick={() => setActivePlaceId(place.place_id)}
                    className={`p-3.5 space-y-2 cursor-pointer transition-colors ${
                      isActive ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        aria-label={`Select ${place.name}`}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelected(place.place_id)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="font-semibold text-xs text-slate-900 truncate">
                            {place.name}
                          </span>
                          {alreadyInCrm && (
                            <span className="text-[10px] font-semibold text-emerald-700">
                              In CRM
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <span>{place.primary_type}</span>
                          {place.rating && (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-0.5 font-mono text-slate-700">
                                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                                {place.rating} ({place.user_rating_count || 0})
                              </span>
                            </>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-600">
                          {place.formatted_address}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                          {place.phone && (
                            <span className="inline-flex items-center gap-1 font-mono text-slate-700">
                              <Phone className="h-3 w-3 text-slate-400" />
                              {place.phone}
                            </span>
                          )}
                          {place.website_url && (
                            <a
                              href={place.website_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[var(--gs-primary)] hover:underline"
                            >
                              <Globe className="h-3 w-3" />
                              <span className="truncate max-w-[140px]">
                                {domain || 'Website'}
                              </span>
                            </a>
                          )}
                          <a
                            href={place.google_maps_uri}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-0.5 text-slate-500 hover:text-slate-800"
                          >
                            <span>Maps</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="pl-6 flex justify-end">
                      <button
                        type="button"
                        disabled={importing}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImportPlaces([place]);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                      >
                        <Sparkles className="h-3 w-3 text-[var(--gs-primary)]" />
                        <span>
                          {alreadyInCrm ? 'Re-Enrich & Merge' : 'Save & Analyze Lead'}
                        </span>
                      </button>
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
