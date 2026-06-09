// ---------------------------------------------------------------------------
// 115 网盘 CloudAdapter — 磁力链接离线下载
//
// 抓包自 real 115.com 请求 (2026-06-09)
// ---------------------------------------------------------------------------

import { browser } from 'wxt/browser';
import type { CloudAdapter, CloudConnectionStatus, CloudTaskResult } from '../types.ts';

// ===========================================================================
// API（真实端点）
// ===========================================================================

/** Step 1: 获取签名 */
const CLOUD_SPACE_URL = 'https://115.com/?ct=clouddownload&ac=space';
/** Step 2: 提交离线任务 */
const ADD_TASK_URL = 'https://clouddownload.115.com/web/?ac=add_task_urls';

// ===========================================================================
// 推送历史
// ===========================================================================

const PUSH_HISTORY_KEY = 'bt0_push_history';
const HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type PushRecord = {
  uriHash: string;
  cloudId: string;
  infoHash?: string;
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
// Cookie & uid
// ===========================================================================

async function get115CookieHeader(): Promise<string | null> {
  try {
    let cookies = await browser.cookies.getAll({ domain: '115.com' });
    if (!cookies.length) cookies = await browser.cookies.getAll({ domain: '.115.com' });
    if (!cookies.length) return null;
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  } catch { return null; }
}

function extractUid(cookieHeader: string): string | null {
  const m = cookieHeader.match(/UID=([^;]+)/);
  return m ? m[1].split('_')[0] : null;
}

// ===========================================================================
// 连接状态
// ===========================================================================

async function checkConnection(): Promise<CloudConnectionStatus> {
  const cookieHeader = await get115CookieHeader();
  if (!cookieHeader) return { connected: false };
  return { connected: cookieHeader.includes('UID=') };
}

// ===========================================================================
// 提交离线任务
// ===========================================================================

async function submitOfflineTask(uri: string, fileName?: string): Promise<CloudTaskResult> {
  if (!uri.startsWith('magnet:')) return { success: false, error: '不是有效的磁力链接' };
  if (await wasAlreadyPushed(uri)) return { success: false, error: '已推送过' };

  const cookieHeader = await get115CookieHeader();
  if (!cookieHeader) return { success: false, error: '请先登录 115.com' };

  const uid = extractUid(cookieHeader);
  if (!uid) return { success: false, error: '未找到 UID' };

  try {
    // Step 1: 获取 sign
    const signResp = await fetch(CLOUD_SPACE_URL, {
      headers: { Cookie: cookieHeader, Accept: 'application/json' },
    });
    if (!signResp.ok) return { success: false, error: `sign 获取失败 HTTP ${signResp.status}` };

    const signData = (await signResp.json()) as { state?: boolean; sign?: string; time?: number; data?: string };
    if (!signData.state || !signData.sign) return { success: false, error: 'sign 获取失败' };

    // Step 2: 提交任务
    const body = new URLSearchParams();
    body.set('sign', signData.sign);
    body.set('time', String(signData.time ?? Math.floor(Date.now() / 1000)));
    body.set('uid', uid);
    body.set('url[0]', uri);
    body.set('savepath', '');
    if (fileName) body.set('wp_path_id', fileName);

    const resp = await fetch(ADD_TASK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Cookie': cookieHeader,
      },
      body: body.toString(),
    });

    if (!resp.ok) return { success: false, error: `HTTP ${resp.status}` };

    const data = (await resp.json()) as {
      state?: boolean;
      errno?: number;
      errcode?: number;
      error_msg?: string;
      result?: Array<{ info_hash?: string; url?: string; state?: boolean }>;
    };

    const ok = data.state === true || data.errno === 0 || data.errcode === 0;
    const infoHash = data.result?.[0]?.info_hash;

    await addPushRecord({
      uriHash: hashUri(uri),
      cloudId: '115',
      infoHash,
      success: ok,
      error: ok ? undefined : data.error_msg,
      pushedAt: Date.now(),
    });

    if (ok) return { success: true, taskId: infoHash };
    return { success: false, error: data.error_msg || '提交失败' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}

// ===========================================================================
// Adapter
// ===========================================================================

export const adapter115: CloudAdapter = {
  id: '115',
  name: '115网盘',
  hostPermissions: ['*://*.115.com/*'],

  checkConnection,
  submitOfflineTask,
};
