import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';

import {
  getMukakuMediaId,
  getMukakuRouteKind,
  MUKAKU_SNAPSHOT_MESSAGE,
  type MukakuMediaSnapshot,
  type MukakuSnapshotRequest,
} from '@/lib/mukaku';

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

async function buildSnapshot(): Promise<MukakuMediaSnapshot> {
  const url = location.href;
  const routeKind = getMukakuRouteKind(url);
  const pageReady = await waitForDetailDom(routeKind);
  const seedTab = firstMatchingText(/^种子资源\s*\(\d+\)/);
  const netdiskTab = firstMatchingText(/^网盘资源\s*\(\d+\)/);

  return {
    isMukaku: location.hostname === 'web5.mukaku.com',
    routeKind,
    url,
    title: text('.media-details-area .info h1, .media-details-area h1') ?? document.title,
    mediaId: getMukakuMediaId(url),
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
    },
    pageReady,
    capturedAt: new Date().toISOString(),
  };
}

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
