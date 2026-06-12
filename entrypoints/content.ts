import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';

import { mukakuAdapter } from '@/lib/adapters/sites/mukaku';
import { validateSnapshot } from '@/lib/core/validate';
import {
  MSG_GET_SNAPSHOT,
  MSG_PAGE_UPDATED,
  MSG_ROUTE_CHANGED,
  type GetSnapshotRequest,
  type PageUpdatedMessage,
  type RouteChangedMessage,
} from '@/lib/core/messaging';

// ---------------------------------------------------------------------------
// Currently active site adapter
// When adding more sites, pick the right adapter based on location.hostname.
// ---------------------------------------------------------------------------

const activeAdapter = mukakuAdapter;

// ---------------------------------------------------------------------------
// SPA route change detection
// ---------------------------------------------------------------------------

let lastKnownUrl = location.href;
let updateTimer: ReturnType<typeof setTimeout> | null = null;
let lastUpdateSignature = '';

function pageUpdateSignature() {
  const title = document.querySelector('.media-details-area .info h1, .media-details-area h1, h1')?.textContent?.trim() ?? '';
  const visibleResources = document.querySelectorAll('.resource-item-card-modern').length;
  const categoryText = document.querySelector('.resource-nav-wrapper')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  return `${location.href}|${title}|${visibleResources}|${categoryText}`;
}

function notifyRouteChanged(url: string) {
  const routeKind = activeAdapter.detectRouteKind(url);
  browser.runtime
    .sendMessage({
      type: MSG_ROUTE_CHANGED,
      url,
      routeKind,
    } satisfies RouteChangedMessage)
    .catch(() => {
      // Side panel may not be open — that's fine
    });
}

function notifyPageUpdated(reason: PageUpdatedMessage['reason']) {
  const url = location.href;
  const routeKind = activeAdapter.detectRouteKind(url);
  browser.runtime
    .sendMessage({
      type: MSG_PAGE_UPDATED,
      url,
      routeKind,
      reason,
    } satisfies PageUpdatedMessage)
    .catch(() => {
      // Side panel may not be open — that's fine
    });
}

function schedulePageUpdated(reason: PageUpdatedMessage['reason']) {
  if (activeAdapter.detectRouteKind(location.href) !== 'detail') return;
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(() => {
    updateTimer = null;
    const signature = pageUpdateSignature();
    if (signature === lastUpdateSignature) return;
    lastUpdateSignature = signature;
    notifyPageUpdated(reason);
  }, 250);
}

function installSpaListeners() {
  const originalPushState = history.pushState.bind(history);
  history.pushState = function (...args) {
    originalPushState(...args);
    const newUrl = location.href;
    if (newUrl !== lastKnownUrl) {
      lastKnownUrl = newUrl;
      notifyRouteChanged(newUrl);
      schedulePageUpdated('dom');
    }
  };

  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = function (...args) {
    originalReplaceState(...args);
    const newUrl = location.href;
    if (newUrl !== lastKnownUrl) {
      lastKnownUrl = newUrl;
      notifyRouteChanged(newUrl);
      schedulePageUpdated('dom');
    }
  };

  window.addEventListener('popstate', () => {
    const newUrl = location.href;
    if (newUrl !== lastKnownUrl) {
      lastKnownUrl = newUrl;
      notifyRouteChanged(newUrl);
      schedulePageUpdated('dom');
    }
  });
}

function installPageUpdateListeners() {
  window.addEventListener('load', () => schedulePageUpdated('load'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedulePageUpdated('visibility');
  });

  const observer = new MutationObserver(() => schedulePageUpdated('dom'));
  observer.observe(document.body, { childList: true, subtree: true });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export default defineContentScript({
  matches: activeAdapter.matchPatterns,
  main() {
    installSpaListeners();
    installPageUpdateListeners();
    schedulePageUpdated('dom');

    browser.runtime.onMessage.addListener(async (message: GetSnapshotRequest) => {
      if (message?.type !== MSG_GET_SNAPSHOT) return;

      const snapshot = await activeAdapter.buildSnapshot(message.mode);

      // Non-blocking validation — logs to console if debug mode
      const validation = validateSnapshot(snapshot);
      if (!validation.valid || validation.warnings.length) {
        console.debug(`[BT0:${activeAdapter.id}] snapshot validation:`, validation);
      }

      return snapshot;
    });
  },
});
