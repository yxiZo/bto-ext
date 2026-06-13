// ---------------------------------------------------------------------------
// 推送历史 — 各云盘适配器共享，按 cloudId 去重
// ---------------------------------------------------------------------------

import { browser } from 'wxt/browser';

const PUSH_HISTORY_KEY = 'bt0_push_history';
const HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HISTORY_MAX_RECORDS = 500;

export type PushRecord = {
  uriHash: string;
  cloudId: string;
  infoHash?: string;
  success: boolean;
  error?: string;
  pushedAt: number;
};

export function hashUri(uri: string): string {
  let h = 0;
  for (let i = 0; i < uri.length; i++) h = ((h << 5) - h + uri.charCodeAt(i)) | 0;
  return h.toString(36);
}

async function getPushHistory(): Promise<PushRecord[]> {
  try {
    const raw = (await browser.storage.local.get(PUSH_HISTORY_KEY))[PUSH_HISTORY_KEY];
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

export async function addPushRecord(record: PushRecord): Promise<void> {
  const history = await getPushHistory();
  const cutoff = Date.now() - HISTORY_TTL_MS;
  const fresh = history.filter((r) => r.pushedAt > cutoff);
  fresh.push(record);
  await browser.storage.local.set({ [PUSH_HISTORY_KEY]: fresh.slice(-HISTORY_MAX_RECORDS) });
}

export async function wasAlreadyPushed(cloudId: string, uri: string): Promise<boolean> {
  const h = hashUri(uri);
  const history = await getPushHistory();
  const cutoff = Date.now() - HISTORY_TTL_MS;
  return history.some((r) => r.cloudId === cloudId && r.uriHash === h && r.success && r.pushedAt > cutoff);
}
