export const MUKAKU_ORIGIN = 'https://web5.mukaku.com';
export const MUKAKU_SNAPSHOT_MESSAGE = 'BT0_GET_MUKAKU_SNAPSHOT';

export type MukakuRouteKind = 'detail' | 'listing' | 'search' | 'other';

export type MukakuResourceSummary = {
  label: string;
  count: number | null;
};

export type MukakuMediaSnapshot = {
  isMukaku: boolean;
  routeKind: MukakuRouteKind;
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
    douban: string | null;
    imdb: string | null;
  };
  resources: {
    seedTotal: number | null;
    netdiskTotal: number | null;
    categories: MukakuResourceSummary[];
    visibleItems: number;
  };
  pageReady: boolean;
  capturedAt: string;
};

export type MukakuSnapshotRequest = {
  type: typeof MUKAKU_SNAPSHOT_MESSAGE;
};

export function getMukakuRouteKind(url: string): MukakuRouteKind {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname !== 'web5.mukaku.com') {
      return 'other';
    }

    if (/^\/mv\/[^/]+/.test(parsedUrl.pathname)) {
      return 'detail';
    }

    if (parsedUrl.pathname === '/search') {
      return 'search';
    }

    if (/^\/(movie|tvseries)\/.+\.html$/.test(parsedUrl.pathname)) {
      return 'listing';
    }

    return 'other';
  } catch {
    return 'other';
  }
}

export function getMukakuMediaId(url: string) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.pathname.match(/^\/mv\/([^/?#]+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}
