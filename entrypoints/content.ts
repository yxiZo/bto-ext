import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';

import {
  getMukakuMediaId,
  getMukakuRouteKind,
  MUKAKU_API_BASE,
  MUKAKU_APP_ID,
  MUKAKU_IDENTITY,
  MUKAKU_SNAPSHOT_MESSAGE,
  type MukakuMediaSnapshot,
  type MukakuSeedResource,
  type MukakuSnapshotRequest,
} from '@/lib/mukaku';

// ---------------------------------------------------------------------------
// Text / DOM helpers
// ---------------------------------------------------------------------------

function cleanText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() || null;
}

function text(selector: string, root: ParentNode = document) {
  return cleanText(root.querySelector(selector)?.textContent);
}

function imageUrl(selector: string) {
  const image = document.querySelector<HTMLImageElement>(selector);
  const source = image?.currentSrc || image?.src || image?.getAttribute('src');

  if (!source) {
    return null;
  }

  try {
    return new URL(source, location.href).toString();
  } catch {
    return source;
  }
}

function listText(selector: string, limit = 16) {
  return Array.from(document.querySelectorAll(selector))
    .map((item) => cleanText(item.textContent))
    .filter((item): item is string => Boolean(item))
    .slice(0, limit);
}

function fieldValue(label: string) {
  const paragraphs = Array.from(document.querySelectorAll('.info p'));
  const match = paragraphs.find((item) => cleanText(item.textContent)?.startsWith(label));
  const value = cleanText(match?.textContent)?.replace(label, '').replace(/^[:：]/, '');
  return cleanText(value);
}

function firstMatchingText(pattern: RegExp, root: ParentNode = document) {
  const element = Array.from(root.querySelectorAll<HTMLElement>('span, p, div, a')).find((item) =>
    pattern.test(cleanText(item.textContent) ?? ''),
  );

  return cleanText(element?.textContent);
}

function parseCount(value: string | null) {
  if (!value) {
    return null;
  }

  const count = value.match(/\((\d+)\)/)?.[1];
  return count ? Number(count) : null;
}

function resourceCategories() {
  return Array.from(document.querySelectorAll<HTMLElement>('.resource-nav-wrapper .nav-item'))
    .map((item) => {
      const value = cleanText(item.textContent);

      if (!value) {
        return null;
      }

      return {
        label: value.replace(/\(\d+\)/, '').trim(),
        count: parseCount(value),
      };
    })
    .filter((item): item is { label: string; count: number | null } => Boolean(item))
    .slice(0, 12);
}

function hasDetailDom() {
  return Boolean(document.querySelector('.media-details-area .info h1, .media-details-area h1'));
}

async function waitForDetailDom(routeKind: ReturnType<typeof getMukakuRouteKind>) {
  if (routeKind !== 'detail' || hasDetailDom()) {
    return hasDetailDom();
  }

  const deadline = Date.now() + 2500;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (hasDetailDom()) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// API-based seed extraction (primary)
// ---------------------------------------------------------------------------

/** Fetch seed data directly from the site's getVideoDetail API */
async function fetchSeedsFromApi(mediaId: string): Promise<MukakuSeedResource[]> {
  const url = `${MUKAKU_API_BASE}/getVideoDetail?id=${encodeURIComponent(mediaId)}&app_id=${MUKAKU_APP_ID}&identity=${MUKAKU_IDENTITY}`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json;charset=UTF-8',
    },
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  const body = (await response.json()) as {
    success: boolean;
    data?: {
      all_seeds?: Array<{
        zname?: string;
        zlink?: string;
        zsize?: string;
        zqxd?: string;
        ezt?: string;
        new?: number;
      }>;
    };
  };

  if (!body.success || !body.data?.all_seeds) {
    return [];
  }

  return body.data.all_seeds.map((seed) => ({
    name: seed.zname ?? '未知',
    magnet: seed.zlink ?? '',
    size: seed.zsize ?? '未知',
    quality: seed.zqxd ?? '未知',
    addedAt: seed.ezt ?? null,
    isNew: seed.new === 1,
  }));
}

// ---------------------------------------------------------------------------
// DOM-based seed extraction (fallback)
// ---------------------------------------------------------------------------

function extractSeedsFromDom(): MukakuSeedResource[] {
  const cards = document.querySelectorAll('.resource-item-card-modern');

  return Array.from(cards)
    .map((card) => {
      // Extract magnet link from the action button
      const magnetLink = card.querySelector<HTMLAnchorElement>('a[href^="magnet:"]');
      const magnet = magnetLink?.href ?? '';

      // Extract resource name from the title link
      const titleEl = card.querySelector<HTMLElement>('.resource-item-title a, .title-link');
      const name = cleanText(titleEl?.textContent) ?? '未知';

      // Extract size info
      const sizeElements = card.querySelectorAll<HTMLElement>('.meta-tag, .arco-tag');
      let size = '未知';
      let quality = '未知';
      let addedAt: string | null = null;

      const metaTexts = Array.from(sizeElements).map((el) => cleanText(el.textContent)).filter(Boolean);

      // Size usually looks like "10.9 GB"
      for (const t of metaTexts) {
        if (t && /\d+(\.\d+)?\s*(GB|MB|TB|KB)/i.test(t)) {
          size = t;
        } else if (t && /\d{4}-\d{2}-\d{2}/.test(t)) {
          addedAt = t;
        } else if (t && !['新', '磁力', '种子', '详情'].includes(t)) {
          quality = t;
        }
      }

      return {
        name,
        magnet,
        size,
        quality,
        addedAt,
        isNew: metaTexts.includes('新'),
      };
    })
    .filter((seed) => seed.magnet !== '');
}

async function fetchSeeds(mediaId: string): Promise<{ seeds: MukakuSeedResource[]; source: 'api' | 'dom' }> {
  // Try API first
  try {
    const seeds = await fetchSeedsFromApi(mediaId);
    if (seeds.length > 0) {
      return { seeds, source: 'api' };
    }
  } catch {
    // API failed — fall through to DOM
  }

  // DOM fallback
  const seeds = extractSeedsFromDom();
  return { seeds, source: 'dom' };
}

// ---------------------------------------------------------------------------
// Group seeds by quality (used by side panel for display)
// ---------------------------------------------------------------------------

function groupSeedsByQuality(seeds: MukakuSeedResource[]): Record<string, MukakuSeedResource[]> {
  return seeds.reduce<Record<string, MukakuSeedResource[]>>((acc, seed) => {
    const key = seed.quality || '其他';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(seed);
    return acc;
  }, {});
}

// ---------------------------------------------------------------------------
// Build snapshot
// ---------------------------------------------------------------------------

async function buildSnapshot(): Promise<MukakuMediaSnapshot> {
  const url = location.href;
  const routeKind = getMukakuRouteKind(url);
  const mediaId = getMukakuMediaId(url);
  const pageReady = await waitForDetailDom(routeKind);
  const seedTab = firstMatchingText(/^种子资源\s*\(\d+\)/);
  const netdiskTab = firstMatchingText(/^网盘资源\s*\(\d+\)/);

  // Fetch seeds (API → DOM fallback)
  const allSeeds: MukakuSeedResource[] = [];
  let seedsByQuality: Record<string, MukakuSeedResource[]> = {};

  if (mediaId && routeKind === 'detail') {
    try {
      const result = await fetchSeeds(mediaId);
      allSeeds.push(...result.seeds);
      seedsByQuality = groupSeedsByQuality(result.seeds);
    } catch {
      // Seeds are optional — don't block the snapshot
    }
  }

  return {
    isMukaku: location.hostname === 'web5.mukaku.com',
    routeKind,
    url,
    title: text('.media-details-area .info h1, .media-details-area h1') ?? document.title,
    mediaId,
    posterUrl: imageUrl('.media-details-area .poster img, .poster img'),
    originalTitle: text('.original-title'),
    year: text('.year'),
    alias: fieldValue('又名'),
    release: fieldValue('上映日期') ?? fieldValue('首播'),
    duration: fieldValue('片长'),
    episodes: fieldValue('集数'),
    region: fieldValue('制片国家/地区'),
    language: fieldValue('语言'),
    genre: fieldValue('类型'),
    directors: listText('.cast-info-group:nth-of-type(1) .name-cast-link, .info p:nth-of-type(1) a', 8),
    writers: listText('.cast-info-group:nth-of-type(2) .name-cast-link', 8),
    actors: listText('.cast-info-group:nth-of-type(3) .name-cast-link, .info p a', 16),
    tags: listText('.tag-list .tag-item', 12),
    summary: text('.summary p'),
    ratings: {
      douban: text('.rating-link.douban'),
      imdb: text('.rating-link.imdb'),
    },
    resources: {
      seedTotal: parseCount(seedTab),
      netdiskTotal: parseCount(netdiskTab),
      categories: resourceCategories(),
      visibleItems: document.querySelectorAll('.resource-item-card-modern').length,
      allSeeds,
      seedsByQuality,
    },
    pageReady,
    capturedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export default defineContentScript({
  matches: ['https://web5.mukaku.com/*'],
  main() {
    browser.runtime.onMessage.addListener((message: MukakuSnapshotRequest) => {
      if (message?.type !== MUKAKU_SNAPSHOT_MESSAGE) {
        return;
      }

      return buildSnapshot();
    });
  },
});
