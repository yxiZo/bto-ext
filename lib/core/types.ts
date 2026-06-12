// ---------------------------------------------------------------------------
// Platform-agnostic domain types — not tied to any specific site or cloud
// ---------------------------------------------------------------------------

/**
 * Route/page type classification.
 * Every site adapter must map its own URL patterns into these four buckets.
 */
export type RouteKind = 'detail' | 'listing' | 'search' | 'other';

/** A single seed / magnet / download resource item */
export type SeedResource = {
  /** Display name (file / release name) */
  name: string;
  /** Magnet link or download URI */
  uri: string;
  /** Human-readable file size (e.g. "10.9 GB") */
  size: string;
  /** Quality label (e.g. "1080P蓝光", "4K") */
  quality: string;
  /** ISO date string when the resource was added, or null */
  addedAt: string | null;
  /** Whether the resource is marked as "new" */
  isNew: boolean;
};

/** Resource count per category */
export type ResourceCategory = {
  label: string;
  count: number | null;
};

/** Complete media snapshot — what the side panel renders */
export type MediaSnapshot = {
  url: string;
  title: string;
  mediaId: string | null;
  posterUrl: string | null;
  originalTitle: string | null;
  year: string | null;
  alias: string | null;
  release: string | null;
  duration: string | null;
  episodes: string | null;
  region: string | null;
  language: string | null;
  genre: string | null;
  directors: string[];
  writers: string[];
  actors: string[];
  tags: string[];
  summary: string | null;
  ratings: {
    sourceA: string | null; // e.g. 豆瓣
    sourceB: string | null; // e.g. IMDb
  };
  resources: {
    seedTotal: number | null;
    netdiskTotal: number | null;
    categories: ResourceCategory[];
    visibleItems: number;
    /** Seeds grouped by quality */
    seedsByQuality: Record<string, SeedResource[]>;
    /** Flat list of all seeds */
    allSeeds: SeedResource[];
    /** URIs of recommended seeds */
    recommendedSeeds: string[];
    /** Reasons keyed by seed URI */
    recommendationReasons: Record<string, string>;
  };
  /** Route kind from the site adapter */
  routeKind: RouteKind;
  /** Whether the page DOM was fully ready when scraped */
  pageReady: boolean;
  /** Whether magnet/resource details have been fetched */
  resourcesReady: boolean;
  /** ISO timestamp of capture */
  capturedAt: string;
};

/** Shorthand to create an empty snapshot shell */
export function emptySnapshot(url: string, routeKind: RouteKind): MediaSnapshot {
  return {
    url,
    title: '',
    mediaId: null,
    posterUrl: null,
    originalTitle: null,
    year: null,
    alias: null,
    release: null,
    duration: null,
    episodes: null,
    region: null,
    language: null,
    genre: null,
    directors: [],
    writers: [],
    actors: [],
    tags: [],
    summary: null,
    ratings: { sourceA: null, sourceB: null },
    resources: {
      seedTotal: null,
      netdiskTotal: null,
      categories: [],
      visibleItems: 0,
      seedsByQuality: {},
      allSeeds: [],
      recommendedSeeds: [],
      recommendationReasons: {},
    },
    routeKind,
    pageReady: false,
    resourcesReady: false,
    capturedAt: new Date().toISOString(),
  };
}
