// ---------------------------------------------------------------------------
// Adapter interfaces — site adapters (resource sites) and cloud adapters (offline storage)
// ---------------------------------------------------------------------------

import type { MediaSnapshot, RouteKind, SeedResource } from '../core/types.ts';
import type { SnapshotMode } from '../core/messaging.ts';

// ===========================================================================
// Site Adapter — one implementation per supported resource site
// ===========================================================================

export interface SiteAdapter {
  /** Unique identifier, e.g. "mukaku" */
  readonly id: string;
  /** Human-readable display name, e.g. "Mukaku" */
  readonly name: string;
  /** Site origin (scheme + host), e.g. "https://web5.mukaku.com" */
  readonly origin: string;
  /** URL match patterns for content script registration */
  readonly matchPatterns: string[];

  /** Classify a URL into one of the four route kinds */
  detectRouteKind(url: string): RouteKind;

  /** Extract the media identifier from a detail page URL, or null */
  extractMediaId(url: string): string | null;

  /** Build a full MediaSnapshot from the current page DOM / API */
  buildSnapshot(mode?: SnapshotMode): Promise<MediaSnapshot>;

  /** Fetch seed/magnet resources for a media item (API → DOM fallback) */
  fetchSeeds(mediaId: string): Promise<SeedResource[]>;

  /** Group seeds by quality definition */
  groupSeedsByQuality(seeds: SeedResource[]): Record<string, SeedResource[]>;

  /**
   * Cheap signature of the current page content (site-specific selectors).
   * Content script uses it to decide whether the page changed enough to notify.
   */
  pageSignature(): string;
}

// ===========================================================================
// Cloud Adapter — one implementation per supported cloud storage
// ===========================================================================

export type CloudConnectionStatus = {
  connected: boolean;
  username?: string;
  spaceUsed?: number;
  spaceTotal?: number;
};

export type CloudTaskResult = {
  success: boolean;
  taskId?: string;
  error?: string;
  /** 同一链接近期已成功推送过（不算失败） */
  duplicate?: boolean;
};

export interface CloudAdapter {
  /** Unique identifier, e.g. "115" */
  readonly id: string;
  /** Human-readable name, e.g. "115网盘" */
  readonly name: string;
  /** Manifest host_permissions required, e.g. ["*://*.115.com/*"] */
  readonly hostPermissions: string[];

  /** Check if user is logged in and retrieve basic account info */
  checkConnection(): Promise<CloudConnectionStatus>;

  /** Submit a magnet/ed2k link for offline download */
  submitOfflineTask(uri: string, fileName?: string): Promise<CloudTaskResult>;
}
