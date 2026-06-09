// ===========================================================================
// Backward-compatible barrel — used by sidepanel, exists for migration ease.
//
// Prefer importing from the new module structure:
//   @/lib/core/types / validate / messaging
//   @/lib/adapters/sites/mukaku
//   @/lib/adapters/types
// ===========================================================================

export const MUKAKU_ORIGIN = 'https://web5.mukaku.com';
export const MUKAKU_SNAPSHOT_MESSAGE = 'BT0_GET_SNAPSHOT';
export const MUKAKU_ROUTE_CHANGED_MESSAGE = 'BT0_ROUTE_CHANGED';

export function getMukakuRouteKind(url: string): import('@/lib/core/types').RouteKind {
  try {
    const p = new URL(url);
    if (p.hostname !== 'web5.mukaku.com') return 'other';
    if (/^\/mv\/[^/]+/.test(p.pathname)) return 'detail';
    if (p.pathname === '/search') return 'search';
    if (/^\/(movie|tvseries)\/.+\.html$/.test(p.pathname)) return 'listing';
    return 'other';
  } catch { return 'other'; }
}

export type MukakuMediaSnapshot = import('@/lib/core/types').MediaSnapshot;
export type MukakuSnapshotRequest = import('@/lib/core/messaging').GetSnapshotRequest;
export type MukakuRouteChangedMessage = import('@/lib/core/messaging').RouteChangedMessage;
