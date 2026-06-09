// ---------------------------------------------------------------------------
// Mukaku / BT0 mirror sites — all share the same backend & page structure
// ---------------------------------------------------------------------------

import type { SiteAdapter } from '../types.ts';
import type { MediaSnapshot, ResourceCategory, RouteKind, SeedResource } from '../../core/types.ts';
import { emptySnapshot } from '../../core/types.ts';

// ===========================================================================
// Constants
// ===========================================================================

/** All known BT0 mirror hostnames */
export const MIRROR_HOSTNAMES = [
  'web5.mukaku.com',
  'www.0bt0.com', 'www.1bt0.com', 'www.2bt0.com', 'www.3bt0.com', 'www.4bt0.com',
  'www.5bt0.com', 'www.6bt0.com', 'www.7bt0.com', 'www.8bt0.com', 'www.9bt0.com',
];

const MUKAKU_ORIGIN = `https://${MIRROR_HOSTNAMES[0]}`;
const API_BASE = '/prod/api/v1';
const APP_ID = '83768d9ad4';
const IDENTITY = '23734adac0301bccdcb107c4aa21f96c';

function isMirrorHost(hostname: string) { return MIRROR_HOSTNAMES.includes(hostname); }

export const MUKAKU_CONSTANTS = {
  ORIGIN: MUKAKU_ORIGIN,
  API_BASE, APP_ID, IDENTITY,
  MIRROR_HOSTNAMES,
} as const;

// ===========================================================================
// Route detection
// ===========================================================================

function detectRouteKind(url: string): RouteKind {
  try {
    const parsed = new URL(url);
    if (!isMirrorHost(parsed.hostname)) return 'other';

    if (/^\/mv\/[^/]+/.test(parsed.pathname)) return 'detail';
    if (parsed.pathname === '/search') return 'search';
    if (/^\/(movie|tvseries)\/.+\.html$/.test(parsed.pathname)) return 'listing';

    return 'other';
  } catch {
    return 'other';
  }
}

function extractMediaId(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.pathname.match(/^\/mv\/([^/?#]+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

// ===========================================================================
// DOM helpers (mukaku-specific selectors)
// ===========================================================================

function cleanText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() || null;
}

function text(...selectors: string[]) {
  for (const sel of selectors) {
    const value = cleanText(document.querySelector(sel)?.textContent);
    if (value) return value;
  }
  return null;
}

function imageUrl(...selectors: string[]) {
  for (const sel of selectors) {
    const img = document.querySelector<HTMLImageElement>(sel);
    const src = img?.currentSrc || img?.src || img?.getAttribute('src');
    if (src) {
      try { return new URL(src, location.href).toString(); } catch { return src; }
    }
  }
  return null;
}

function listText(selector: string, limit = 16) {
  return Array.from(document.querySelectorAll(selector))
    .map((el) => cleanText(el.textContent))
    .filter((v): v is string => Boolean(v))
    .slice(0, limit);
}

function fieldValue(label: string) {
  const paragraphs = Array.from(document.querySelectorAll('.info p'));
  const match = paragraphs.find((p) => cleanText(p.textContent)?.startsWith(label));
  const value = cleanText(match?.textContent)?.replace(label, '').replace(/^[:：]/, '');
  return cleanText(value);
}

function firstMatchingText(pattern: RegExp, root: ParentNode = document) {
  const el = Array.from(root.querySelectorAll<HTMLElement>('span, p, div, a'))
    .find((e) => pattern.test(cleanText(e.textContent) ?? ''));
  return cleanText(el?.textContent);
}

function parseCount(value: string | null): number | null {
  if (!value) return null;
  const count = value.match(/\((\d+)\)/)?.[1];
  return count ? Number(count) : null;
}

function resourceCategories(): ResourceCategory[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.resource-nav-wrapper .nav-item'))
    .map((el) => {
      const v = cleanText(el.textContent);
      if (!v) return null;
      return { label: v.replace(/\(\d+\)/, '').trim(), count: parseCount(v) };
    })
    .filter((c): c is ResourceCategory => Boolean(c))
    .slice(0, 12);
}

// ===========================================================================
// DOM wait
// ===========================================================================

const TITLE_SELECTORS = [
  '.media-details-area .info h1',
  '.media-details-area h1',
  'h1',
];

function waitForSelector(selectors: string[], timeoutMs = 5000): Promise<Element | null> {
  const check = () => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  };

  const existing = check();
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let resolved = false;
    const observer = new MutationObserver(() => {
      if (resolved) return;
      const el = check();
      if (el) { resolved = true; observer.disconnect(); resolve(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { if (!resolved) { observer.disconnect(); resolve(check()); } }, timeoutMs);
  });
}

async function waitForDetailDom(routeKind: RouteKind): Promise<boolean> {
  if (routeKind !== 'detail') return false;
  const el = await waitForSelector(TITLE_SELECTORS);
  return el !== null;
}

// ===========================================================================
// Seed extraction
// ===========================================================================

const SEED_CACHE_TTL_MS = 30_000;
const FETCH_TIMEOUT_MS = 5_000;
const MAX_RETRIES = 1;

type CacheEntry = { seeds: SeedResource[]; ts: number };
const seedCache = new Map<string, CacheEntry>();

function getCached(mediaId: string): SeedResource[] | null {
  const entry = seedCache.get(mediaId);
  if (!entry || Date.now() - entry.ts > SEED_CACHE_TTL_MS) {
    seedCache.delete(mediaId);
    return null;
  }
  return entry.seeds;
}

async function fetchWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json;charset=UTF-8' },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i <= MAX_RETRIES; i++) {
    try { return await fetchWithTimeout(url, FETCH_TIMEOUT_MS); } catch (e) {
      lastErr = e;
      if (i < MAX_RETRIES) await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
    }
  }
  throw lastErr;
}

async function fetchSeedsFromApi(mediaId: string): Promise<SeedResource[]> {
  const apiUrl = `${API_BASE}/getVideoDetail?id=${encodeURIComponent(mediaId)}&app_id=${APP_ID}&identity=${IDENTITY}`;
  const res = await fetchWithRetry(apiUrl);
  if (!res.ok) throw new Error(`API ${res.status}`);

  const body = (await res.json()) as {
    success: boolean;
    data?: { all_seeds?: Array<{ zname?: string; zlink?: string; zsize?: string; zqxd?: string; ezt?: string; new?: number }> };
  };

  if (!body.success || !body.data?.all_seeds) return [];
  return body.data.all_seeds.map((s) => ({
    name: s.zname ?? '未知',
    uri: s.zlink ?? '',
    size: s.zsize ?? '未知',
    quality: s.zqxd ?? '未知',
    addedAt: s.ezt ?? null,
    isNew: s.new === 1,
  }));
}

function extractSeedsFromDom(): SeedResource[] {
  return Array.from(document.querySelectorAll('.resource-item-card-modern'))
    .map((card) => {
      const magnet = card.querySelector<HTMLAnchorElement>('a[href^="magnet:"]')?.href ?? '';
      const name = cleanText(card.querySelector<HTMLElement>('.resource-item-title a, .title-link')?.textContent) ?? '未知';
      const metaTexts = Array.from(card.querySelectorAll<HTMLElement>('.meta-tag, .arco-tag'))
        .map((el) => cleanText(el.textContent))
        .filter((v): v is string => v !== null);

      let size = '未知', quality = '未知';
      let addedAt: string | null = null;
      for (const t of metaTexts) {
        if (/\d+(\.\d+)?\s*(GB|MB|TB|KB)/i.test(t)) size = t;
        else if (/\d{4}-\d{2}-\d{2}/.test(t)) addedAt = t;
        else if (!['新', '磁力', '种子', '详情'].includes(t)) quality = t;
      }
      return { name, uri: magnet, size, quality, addedAt, isNew: metaTexts.includes('新') };
    })
    .filter((s) => s.uri !== '');
}

async function fetchSeeds(mediaId: string): Promise<SeedResource[]> {
  const cached = getCached(mediaId);
  if (cached) return cached;

  let seeds: SeedResource[] = [];
  try {
    seeds = await fetchSeedsFromApi(mediaId);
  } catch { /* fall through */ }
  if (!seeds.length) seeds = extractSeedsFromDom();
  if (seeds.length) seedCache.set(mediaId, { seeds, ts: Date.now() });
  return seeds;
}

// ===========================================================================
// Smart recommendation — scores seeds within each quality group
// ===========================================================================

/** Per-seed recommendation metadata */
export type SeedRecommendation = {
  /** Whether this seed is the recommended pick in its quality group */
  isRecommended: boolean;
  /** Human-readable reason for the recommendation */
  reason: string;
  /** Numeric score (higher = better) */
  score: number;
};

/** Extended seed resource with recommendation attached */
export type RecommendedSeed = SeedResource & { recommendation: SeedRecommendation };

/** Score a single seed. Higher = better pick. */
function scoreSeed(seed: SeedResource, allInGroup: SeedResource[]): { score: number; reasons: string[] } {
  let score = 50;
  const reasons: string[] = [];

  const name = seed.name;
  const sizeStr = seed.size;

  // --- Audio tracks ---
  const hasMultiAudio = /国粤|多音轨|双音轨|双語|国英|中日/i.test(name);
  const hasAudioHint = /音轨|audio/i.test(name);
  if (hasMultiAudio) { score += 15; reasons.push('多音轨'); }
  else if (hasAudioHint) { score += 5; }

  // --- Subtitles ---
  const hasSubs = /简繁|字幕|中字|中英|CHS|CHT|SUBS?/i.test(name);
  if (hasSubs) { score += 10; reasons.push('含字幕'); }

  // --- Size: prefer moderate (not largest, not smallest in group) ---
  if (allInGroup.length >= 3) {
    const sizes = allInGroup.map((s) => parseSizeGB(s.size)).filter((s) => s > 0).sort((a, b) => a - b);
    const ownSize = parseSizeGB(sizeStr);
    if (sizes.length >= 3 && ownSize > 0) {
      const q1 = sizes[Math.floor(sizes.length * 0.25)];
      const q3 = sizes[Math.floor(sizes.length * 0.75)];
      if (ownSize >= q1 && ownSize <= q3) {
        score += 8;
        reasons.push('大小适中');
      } else if (ownSize < sizes[0] * 0.5) {
        score -= 10; // suspiciously small
      }
    }
  }

  // --- Prefer newer ---
  if (seed.isNew) { score += 3; }
  if (seed.addedAt) {
    const ageDays = (Date.now() - new Date(seed.addedAt).getTime()) / 86400000;
    if (ageDays < 30) { score += 5; }
    else if (ageDays < 90) { score += 2; }
  }

  // --- Encoding hints ---
  if (/x265|HEVC|H\.?265/i.test(name)) { score += 3; reasons.push('H.265'); }
  if (/DTS|DDP|TrueHD|Atmos|FLAC/i.test(name)) { score += 2; }
  if (/CHD|WiKi|DreamHD|SSDSSE|TAGWEB/i.test(name)) { score += 2; }

  return { score, reasons };
}

function parseSizeGB(sizeStr: string): number {
  const m = sizeStr.match(/([\d.]+)\s*(GB|TB|MB)/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (m[2].toUpperCase() === 'TB') return n * 1024;
  if (m[2].toUpperCase() === 'MB') return n / 1024;
  return n;
}

function recommendSeeds(seeds: SeedResource[]): RecommendedSeed[] {
  // Group by quality for relative scoring
  const byQuality = groupSeedsByQuality(seeds);

  const recommendedUris = new Set<string>();
  // Pick the best in each quality group
  for (const [, group] of Object.entries(byQuality)) {
    if (group.length === 0) continue;
    const scored = group.map((s) => ({ seed: s, ...scoreSeed(s, group) }));
    scored.sort((a, b) => b.score - a.score);
    if (scored[0]) recommendedUris.add(scored[0].seed.uri);
  }

  return seeds.map((seed) => {
    const { score, reasons } = scoreSeed(seed, seeds);
    const isRecommended = recommendedUris.has(seed.uri);
    return {
      ...seed,
      recommendation: {
        isRecommended,
        reason: isRecommended ? reasons.slice(0, 3).join(' · ') : '',
        score,
      },
    };
  });
}

function groupSeedsByQuality(seeds: SeedResource[]): Record<string, SeedResource[]> {
  return seeds.reduce<Record<string, SeedResource[]>>((acc, s) => {
    (acc[s.quality || '其他'] ??= []).push(s);
    return acc;
  }, {});
}

// ===========================================================================
// Snapshot builder
// ===========================================================================

async function buildSnapshot(): Promise<MediaSnapshot> {
  const url = location.href;
  const routeKind = detectRouteKind(url);
  const mediaId = extractMediaId(url);
  const pageReady = await waitForDetailDom(routeKind);

  const snapshot = emptySnapshot(url, routeKind);

  snapshot.title = text(...TITLE_SELECTORS) ?? document.title;
  snapshot.mediaId = mediaId;
  snapshot.posterUrl = imageUrl('.media-details-area .poster img', '.poster img', 'img.poster');
  snapshot.originalTitle = text('.original-title');
  snapshot.year = text('.year');
  snapshot.alias = fieldValue('又名');
  snapshot.release = fieldValue('上映日期') ?? fieldValue('首播');
  snapshot.duration = fieldValue('片长');
  snapshot.episodes = fieldValue('集数');
  snapshot.region = fieldValue('制片国家/地区');
  snapshot.language = fieldValue('语言');
  snapshot.genre = fieldValue('类型');
  snapshot.directors = listText('.cast-info-group:nth-of-type(1) .name-cast-link, .info p:nth-of-type(1) a', 8);
  snapshot.writers = listText('.cast-info-group:nth-of-type(2) .name-cast-link', 8);
  snapshot.actors = listText('.cast-info-group:nth-of-type(3) .name-cast-link, .info p a', 16);
  snapshot.tags = listText('.tag-list .tag-item', 12);
  snapshot.summary = text('.summary p', '.abstract');
  snapshot.ratings = {
    sourceA: text('.rating-link.douban', '[class*="douban"]'),
    sourceB: text('.rating-link.imdb', '[class*="imdb"]'),
  };

  const seedTab = firstMatchingText(/^种子资源\s*\(\d+\)/);
  const netdiskTab = firstMatchingText(/^网盘资源\s*\(\d+\)/);

  if (mediaId && routeKind === 'detail') {
    try {
      const seeds = await fetchSeeds(mediaId);
      const recommended = recommendSeeds(seeds);
      snapshot.resources.allSeeds = recommended;
      snapshot.resources.seedsByQuality = groupSeedsByQuality(recommended);
      snapshot.resources.recommendedSeeds = recommended
        .filter((s) => s.recommendation.isRecommended)
        .map((s) => s.uri);
      snapshot.resources.recommendationReasons = Object.fromEntries(
        recommended.filter((s) => s.recommendation.isRecommended && s.recommendation.reason)
          .map((s) => [s.uri, s.recommendation.reason]),
      );
    } catch { /* seeds are optional */ }
  }

  snapshot.resources.seedTotal = parseCount(seedTab);
  snapshot.resources.netdiskTotal = parseCount(netdiskTab);
  snapshot.resources.categories = resourceCategories();
  snapshot.resources.visibleItems = document.querySelectorAll('.resource-item-card-modern').length;
  snapshot.pageReady = pageReady;
  snapshot.capturedAt = new Date().toISOString();

  return snapshot;
}

// ===========================================================================
// Adapter instance
// ===========================================================================

export const mukakuAdapter: SiteAdapter = {
  id: 'mukaku',
  name: 'Mukaku',
  origin: MUKAKU_ORIGIN,
  matchPatterns: MIRROR_HOSTNAMES.flatMap((h) => [`https://${h}/*`, `http://${h}/*`]),

  detectRouteKind,
  extractMediaId,
  buildSnapshot,
  fetchSeeds,
  groupSeedsByQuality,
};
