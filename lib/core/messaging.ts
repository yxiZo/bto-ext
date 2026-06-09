// ---------------------------------------------------------------------------
// Platform-agnostic message protocol between content script ↔ side panel
// ---------------------------------------------------------------------------

import type { RouteKind } from './types.ts';

// --- Message type constants ---

/** Side panel → content script: request a fresh snapshot */
export const MSG_GET_SNAPSHOT = 'BT0_GET_SNAPSHOT';

/** Content script → side panel: the active-tab route changed (SPA navigation) */
export const MSG_ROUTE_CHANGED = 'BT0_ROUTE_CHANGED';

// --- Message payloads ---

export type GetSnapshotRequest = {
  type: typeof MSG_GET_SNAPSHOT;
};

export type RouteChangedMessage = {
  type: typeof MSG_ROUTE_CHANGED;
  url: string;
  routeKind: RouteKind;
};

/** Union of all messages the side panel may receive from runtime.onMessage */
export type IncomingMessage = RouteChangedMessage;
