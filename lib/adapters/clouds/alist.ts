// ---------------------------------------------------------------------------
// AList CloudAdapter — 通过 AList 网关推送离线下载
//
// AList 是中间层，不直接接触网盘 API，稳定可靠。
// 用户配置 AList 地址 + Token 即可使用。
// ---------------------------------------------------------------------------

import { browser } from 'wxt/browser';
import type { CloudAdapter, CloudConnectionStatus, CloudTaskResult } from '../types.ts';

// ===========================================================================
// 配置存储
// ===========================================================================

const CONFIG_KEY = 'bt0_alist_config';

type AlistConfig = {
  url: string;    // e.g. "https://alist.example.com"
  token: string;  // AList admin token
  path: string;   // 离线下载目标路径，e.g. "/115/云下载"
};

async function getConfig(): Promise<AlistConfig | null> {
  try {
    const result = await browser.storage.local.get(CONFIG_KEY);
    const raw = result[CONFIG_KEY] as AlistConfig | undefined;
    if (!raw?.url || !raw?.token) return null;
    return raw;
  } catch { return null; }
}

export async function saveConfig(config: AlistConfig): Promise<void> {
  // Trim trailing slash
  const cfg = { ...config, url: config.url.replace(/\/+$/, '') };
  await browser.storage.local.set({ [CONFIG_KEY]: cfg });
}

// ===========================================================================
// 推送历史
// ===========================================================================

const PUSH_HISTORY_KEY = 'bt0_push_history';
const HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type PushRecord = {
  uriHash: string;
  cloudId: string;
  success: boolean;
  error?: string;
  pushedAt: number;
};

function hashUri(uri: string): string {
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

async function addPushRecord(record: PushRecord): Promise<void> {
  const history = await getPushHistory();
  const cutoff = Date.now() - HISTORY_TTL_MS;
  const fresh = history.filter((r) => r.pushedAt > cutoff);
  fresh.push(record);
  await browser.storage.local.set({ [PUSH_HISTORY_KEY]: fresh.slice(-500) });
}

async function wasAlreadyPushed(uri: string): Promise<boolean> {
  const h = hashUri(uri);
  const history = await getPushHistory();
  const cutoff = Date.now() - HISTORY_TTL_MS;
  return history.some((r) => r.uriHash === h && r.success && r.pushedAt > cutoff);
}

// ===========================================================================
// API 调用
// ===========================================================================

/** GET /api/me — 验证连接 */
async function checkConnection(): Promise<CloudConnectionStatus> {
  const config = await getConfig();
  if (!config) return { connected: false };

  try {
    const resp = await fetch(`${config.url}/api/me`, {
      headers: { 'Authorization': config.token, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    const data = await resp.json() as { code?: number; data?: { username?: string; id?: number } };
    if (resp.ok && (data.code === 200 || data.data?.id)) {
      return { connected: true, username: data.data?.username };
    }
    // Fallback: just having a non-401 response means connected
    if (resp.ok && data.code !== 401) return { connected: true };
    return { connected: false };
  } catch { return { connected: false }; }
}

/** POST /api/fs/add_offline_download */
async function submitOfflineTask(uri: string, _fileName?: string): Promise<CloudTaskResult> {
  if (!uri.startsWith('magnet:')) return { success: false, error: '不是有效的磁力链接' };
  if (await wasAlreadyPushed(uri)) return { success: false, error: '已推送过' };

  const config = await getConfig();
  if (!config) return { success: false, error: '请先配置 AList' };

  try {
    const body = JSON.stringify({
      path: config.path || '/',
      urls: [uri],
      tool: '115 Cloud',
      delete_policy: 'delete_on_upload_succeed',
    });

    const resp = await fetch(`${config.url}/api/fs/add_offline_download`, {
      method: 'POST',
      headers: {
        'Authorization': config.token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body,
      signal: AbortSignal.timeout(8000),
    });

    const data = await resp.json() as { code?: number; message?: string };

    const ok = data.code === 200;

    await addPushRecord({
      uriHash: hashUri(uri),
      cloudId: 'alist',
      success: ok,
      error: ok ? undefined : data.message,
      pushedAt: Date.now(),
    });

    if (ok) return { success: true };
    return { success: false, error: data.message || '提交失败' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}

// ===========================================================================
// Adapter
// ===========================================================================

export const adapterAlist: CloudAdapter = {
  id: 'alist',
  name: 'AList',
  hostPermissions: [],

  checkConnection,
  submitOfflineTask,
};
