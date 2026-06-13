import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';

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
// Page update notifications (debounced, deduped by page signature)
// ---------------------------------------------------------------------------

let updateTimer: ReturnType<typeof setTimeout> | null = null;
let lastUpdateSignature = '';

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
    const signature = activeAdapter.pageSignature();
    if (signature === lastUpdateSignature) return;
    lastUpdateSignature = signature;
    notifyPageUpdated(reason);
  }, 250);
}

// ---------------------------------------------------------------------------
// DOM observation — only while on a detail route
// ---------------------------------------------------------------------------

function installPageUpdateListeners(ctx: ContentScriptContext) {
  const observer = new MutationObserver(() => schedulePageUpdated('dom'));
  let observing = false;

  const syncObserver = () => {
    const isDetail = activeAdapter.detectRouteKind(location.href) === 'detail';
    if (isDetail && !observing) {
      observer.observe(document.body, { childList: true, subtree: true });
      observing = true;
    } else if (!isDetail && observing) {
      observer.disconnect();
      observing = false;
    }
  };

  ctx.addEventListener(window, 'load', () => schedulePageUpdated('load'));
  ctx.addEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'visible') schedulePageUpdated('visibility');
  });

  // SPA navigation — WXT watches location changes from the isolated world
  // (monkey-patching history here would never see the page's own pushState calls).
  ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => {
    syncObserver();
    notifyRouteChanged(newUrl.toString());
    schedulePageUpdated('dom');
  });

  ctx.onInvalidated(() => {
    observer.disconnect();
    if (updateTimer) clearTimeout(updateTimer);
  });

  syncObserver();
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export default defineContentScript({
  matches: activeAdapter.matchPatterns,
  main(ctx) {
    installPageUpdateListeners(ctx);
    schedulePageUpdated('dom');

    browser.runtime.onMessage.addListener((message: GetSnapshotRequest, _sender, sendResponse) => {
      if (message?.type !== MSG_GET_SNAPSHOT) return;

      void activeAdapter.buildSnapshot(message.mode)
        .then((snapshot) => {
          // Non-blocking validation — logs to console if debug mode
          const validation = validateSnapshot(snapshot);
          if (!validation.valid || validation.warnings.length) {
            console.debug(`[BT0:${activeAdapter.id}] snapshot validation:`, validation);
          }
          sendResponse(snapshot);
        })
        .catch(() => sendResponse(null));

      // Keep the message channel open for the async response
      // (Chrome does not honor a Promise returned from the listener).
      return true;
    });
  },
});
