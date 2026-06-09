// ---------------------------------------------------------------------------
// 115 网盘 CloudAdapter
//
// Uses browser.cookies to read the user's 115.com session, then calls 115's
// offline download API to submit magnet / ed2k links.
//
// NOTE: Cookie names and API endpoints may change. If push fails, open
// 115.com in the browser, log in, then try again.
// ---------------------------------------------------------------------------

import { browser } from 'wxt/browser';
import type { CloudAdapter, CloudConnectionStatus, CloudTaskResult } from '../types.ts';

// ===========================================================================
// Configuration
// ===========================================================================

/** 115 offline download — add task endpoint */
const OFFLINE_ADD_URL = 'https://webapi.115.com/offline/addtask';

/** Cookies required for 115 API auth */
const REQUIRED_COOKIES = ['UID', 'CID', 'SEID'];

/** Push history TTL (7 days — used for dedup, not for permanent storage) */
const PUSH_HISTORY_KEY = 'bt0_push_history';
const HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ===========================================================================
// Cookie helpers
// ===========================================================================

async function get115CookieHeader(): Promise<string | null> {
  const cookies = await browser.cookies.getAll({ domain: '.115.com' });
  if (!cookies.length) {
    cookies.push(...(await browser.cookies.getAll({ domain: '115.com' })));
  }

  const found: string[] = [];
  for (const name of REQUIRED_COOKIES) {
    const c = cookies.find((c) => c.name === name);
    if (c) found.push(`${c.name}=${c.value}`);
  }

  return found.length >= 2 ? found.join('; ') : null;
}

// ===========================================================================
// Push history (chrome.storage.local)
// ===========================================================================

type PushRecord = {
  uriHash: string;
  cloudId: string;
  taskId?: string;
  success: boolean;
  pushedAt: number; // epoch ms
};

async function getPushHistory(): Promise<PushRecord[]> {
  try {
    const raw = (await browser.storage.local.get(PUSH_HISTORY_KEY))[PUSH_HISTORY_KEY];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

async function addPushRecord(record: PushRecord): Promise<void> {
  const history = await getPushHistory();
  // Remove expired entries
  const cutoff = Date.now() - HISTORY_TTL_MS;
  const fresh = history.filter((r) => r.pushedAt > cutoff);
  fresh.push(record);
  await browser.storage.local.set({ [PUSH_HISTORY_KEY]: fresh.slice(-500) });
}

/** Simple string hash (not crypto-secure — just for dedup lookup) */
function hashUri(uri: string): string {
  let h = 0;
  for (let i = 0; i < uri.length; i++) {
    h = ((h << 5) - h + uri.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

/** Check if this URI has already been pushed successfully */
async function wasAlreadyPushed(uri: string): Promise<boolean> {
  const hash = hashUri(uri);
  const history = await getPushHistory();
  return history.some((r) => r.uriHash === hash && r.success);
}

// ===========================================================================
// API call
// ===========================================================================

async function submitOfflineTask(uri: string, fileName?: string): Promise<CloudTaskResult> {
  // Check if already pushed
  if (await wasAlreadyPushed(uri)) {
    return { success: false, error: '该磁力链接已推送过' };
  }

  const cookieHeader = await get115CookieHeader();
  if (!cookieHeader) {
    return { success: false, error: '未检测到 115 登录状态，请先登录 115.com' };
  }

  try {
    const body = new URLSearchParams();
    body.set('url', uri);
    if (fileName) body.set('wp_path_id', fileName);

    const response = await fetch(OFFLINE_ADD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieHeader,
        'Accept': 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      return { success: false, error: `115 API 返回 HTTP ${response.status}` };
    }

    const data = (await response.json()) as {
      state?: boolean;
      errno?: number;
      error_msg?: string;
      task_id?: string;
    };

    const ok = data.state === true || data.errno === 0;
    const record: PushRecord = {
      uriHash: hashUri(uri),
      cloudId: '115',
      taskId: data.task_id,
      success: ok,
      pushedAt: Date.now(),
    };
    await addPushRecord(record);

    if (ok) {
      return { success: true, taskId: data.task_id };
    }
    return { success: false, error: data.error_msg || '提交离线任务失败' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}

// ===========================================================================
// Connection check
// ===========================================================================

async function checkConnection(): Promise<CloudConnectionStatus> {
  const cookieHeader = await get115CookieHeader();
  return { connected: cookieHeader !== null };
}

// ===========================================================================
// Adapter instance
// ===========================================================================

export const adapter115: CloudAdapter = {
  id: '115',
  name: '115网盘',
  hostPermissions: ['*://*.115.com/*'],

  checkConnection,
  submitOfflineTask,
};
