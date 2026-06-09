import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';

import { mukakuAdapter } from '@/lib/adapters/sites/mukaku';
import { validateSnapshot } from '@/lib/core/validate';
import { MSG_GET_SNAPSHOT, MSG_ROUTE_CHANGED, type GetSnapshotRequest } from '@/lib/core/messaging';

// ---------------------------------------------------------------------------
// Currently active site adapter
// When adding more sites, pick the right adapter based on location.hostname.
// ---------------------------------------------------------------------------

const activeAdapter = mukakuAdapter;

// ---------------------------------------------------------------------------
// SPA route change detection
// ---------------------------------------------------------------------------

let lastKnownUrl = location.href;

function notifyRouteChanged(url: string) {
  const routeKind = activeAdapter.detectRouteKind(url);
  browser.runtime
    .sendMessage({
      type: MSG_ROUTE_CHANGED,
      url,
      routeKind,
    })
    .catch(() => {
      // Side panel may not be open — that's fine
    });
}

function installSpaListeners() {
  const originalPushState = history.pushState.bind(history);
  history.pushState = function (...args) {
    originalPushState(...args);
    const newUrl = location.href;
    if (newUrl !== lastKnownUrl) {
      lastKnownUrl = newUrl;
      notifyRouteChanged(newUrl);
    }
  };

  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = function (...args) {
    originalReplaceState(...args);
    const newUrl = location.href;
    if (newUrl !== lastKnownUrl) {
      lastKnownUrl = newUrl;
      notifyRouteChanged(newUrl);
    }
  };

  window.addEventListener('popstate', () => {
    const newUrl = location.href;
    if (newUrl !== lastKnownUrl) {
      lastKnownUrl = newUrl;
      notifyRouteChanged(newUrl);
    }
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export default defineContentScript({
  matches: activeAdapter.matchPatterns,
  main() {
    installSpaListeners();

    browser.runtime.onMessage.addListener(async (message: GetSnapshotRequest) => {
      if (message?.type !== MSG_GET_SNAPSHOT) return;

      const snapshot = await activeAdapter.buildSnapshot();

      // Non-blocking validation — logs to console if debug mode
      const validation = validateSnapshot(snapshot);
      if (!validation.valid || validation.warnings.length) {
        console.debug(`[BT0:${activeAdapter.id}] snapshot validation:`, validation);
      }

      return snapshot;
    });
  },
});
