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
/** 目录列表 */
const FILES_URL = 'https://webapi.115.com/files';

// ===========================================================================
// 115 会话缓存
// ===========================================================================

const SESSION_CACHE_KEY = 'bt0_115_session';
const SESSION_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CONFIG_KEY = 'bt0_115_config';

type Cached115Session = {
  cookieHeader: string;
  uid: string;
  cachedAt: number;
};

export type Session115Status = {
  connected: boolean;
  source: 'live' | 'cached' | 'none';
  uid?: string;
  cachedAt?: number;
  expiresAt?: number;
};

export type DownloadDir115 = {
  id: string;
  name: string;
  path: string;
};

export type Config115 = {
  downloadDir?: DownloadDir115;
};

export type Directory115 = {
  id: string;
  name: string;
  parentId?: string;
};

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

// ===========================================================================
// 配置
// ===========================================================================

export async function get115Config(): Promise<Config115> {
  try {
    const raw = (await browser.storage.local.get(CONFIG_KEY))[CONFIG_KEY] as Config115 | undefined;
    return raw && typeof raw === 'object' ? raw : {};
  } catch { return {}; }
}

export async function save115DownloadDir(downloadDir: DownloadDir115): Promise<void> {
  const config = await get115Config();
  await browser.storage.local.set({ [CONFIG_KEY]: { ...config, downloadDir } satisfies Config115 });
}

export async function clear115DownloadDir(): Promise<void> {
  const config = await get115Config();
  const nextConfig = { ...config };
  delete nextConfig.downloadDir;
  await browser.storage.local.set({ [CONFIG_KEY]: nextConfig satisfies Config115 });
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

async function getCached115Session(): Promise<Cached115Session | null> {
  try {
    const raw = (await browser.storage.local.get(SESSION_CACHE_KEY))[SESSION_CACHE_KEY] as Cached115Session | undefined;
    if (!raw?.cookieHeader || !raw.uid || !raw.cachedAt) return null;
    if (Date.now() - raw.cachedAt > SESSION_CACHE_TTL_MS) {
      await browser.storage.local.remove(SESSION_CACHE_KEY);
      return null;
    }
    return raw;
  } catch { return null; }
}

async function cache115Session(cookieHeader: string): Promise<void> {
  const uid = extractUid(cookieHeader);
  if (!uid) return;
  await browser.storage.local.set({
    [SESSION_CACHE_KEY]: {
      cookieHeader,
      uid,
      cachedAt: Date.now(),
    } satisfies Cached115Session,
  });
}

async function clearCached115Session(): Promise<void> {
  try {
    await browser.storage.local.remove(SESSION_CACHE_KEY);
  } catch {
    // Ignore cleanup failures; the next live cookie read can overwrite stale data.
  }
}

async function readLive115CookieHeader(): Promise<string | null> {
  try {
    let cookies = await browser.cookies.getAll({ domain: '115.com' });
    if (!cookies.length) cookies = await browser.cookies.getAll({ domain: '.115.com' });
    if (!cookies.length) return null;
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  } catch { return null; }
}

async function get115CookieHeader(): Promise<string | null> {
  const liveCookieHeader = await readLive115CookieHeader();
  if (liveCookieHeader?.includes('UID=')) {
    await cache115Session(liveCookieHeader);
    return liveCookieHeader;
  }

  const cachedSession = await getCached115Session();
  return cachedSession?.cookieHeader ?? null;
}

export async function get115SessionStatus(): Promise<Session115Status> {
  const liveCookieHeader = await readLive115CookieHeader();
  const liveUid = liveCookieHeader ? extractUid(liveCookieHeader) : null;

  if (liveCookieHeader && liveUid) {
    const cachedAt = Date.now();
    await cache115Session(liveCookieHeader);
    return {
      connected: true,
      source: 'live',
      uid: liveUid,
      cachedAt,
      expiresAt: cachedAt + SESSION_CACHE_TTL_MS,
    };
  }

  const cachedSession = await getCached115Session();
  if (cachedSession) {
    return {
      connected: true,
      source: 'cached',
      uid: cachedSession.uid,
      cachedAt: cachedSession.cachedAt,
      expiresAt: cachedSession.cachedAt + SESSION_CACHE_TTL_MS,
    };
  }

  return { connected: false, source: 'none' };
}

export async function clear115SessionCache(): Promise<void> {
  await clearCached115Session();
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
  return { connected: Boolean(extractUid(cookieHeader)) };
}

// ===========================================================================
// 目录
// ===========================================================================

function readDirectoryId(item: Record<string, unknown>): string | null {
  const raw = item.cid ?? item.file_id ?? item.fid ?? item.id;
  if (typeof raw === 'string' && raw) return raw;
  if (typeof raw === 'number') return String(raw);
  return null;
}

function readDirectoryName(item: Record<string, unknown>): string | null {
  const raw = item.n ?? item.name ?? item.file_name ?? item.title;
  return typeof raw === 'string' && raw ? raw : null;
}

function isDirectoryItem(item: Record<string, unknown>): boolean {
  if (item.isdir === 1 || item.isdir === '1' || item.is_dir === 1 || item.is_dir === true) return true;
  if (item.ico === 'folder') return true;
  if (item.fid === '' && item.cid) return true;
  if (item.cid && !item.fid) return true;
  return false;
}

export async function list115Directories(parentId = '0'): Promise<Directory115[]> {
  const cookieHeader = await get115CookieHeader();
  if (!cookieHeader) throw new Error('请先登录 115.com');

  const params = new URLSearchParams({
    aid: '1',
    cid: parentId,
    offset: '0',
    limit: '200',
    show_dir: '1',
    o: 'user_ptime',
    asc: '0',
    format: 'json',
  });

  const resp = await fetch(`${FILES_URL}?${params.toString()}`, {
    headers: { Cookie: cookieHeader, Accept: 'application/json' },
  });

  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) await clearCached115Session();
    throw new Error(`目录读取失败 HTTP ${resp.status}`);
  }

  const data = (await resp.json()) as {
    state?: boolean;
    data?: unknown;
    files?: unknown;
    error?: string;
    error_msg?: string;
  };

  if (data.state === false) throw new Error(data.error_msg || data.error || '目录读取失败');

  const items = Array.isArray(data.data)
    ? data.data
    : Array.isArray(data.files)
      ? data.files
      : [];

  const directories: Directory115[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (!isDirectoryItem(record)) continue;

    const id = readDirectoryId(record);
    const name = readDirectoryName(record);
    if (!id || !name) continue;
    directories.push({ id, name, parentId });
  }

  return directories;
}

// ===========================================================================
// 提交离线任务
// ===========================================================================

async function submitOfflineTask(uri: string, _fileName?: string): Promise<CloudTaskResult> {
  if (!uri.startsWith('magnet:')) return { success: false, error: '不是有效的磁力链接' };
  if (await wasAlreadyPushed(uri)) return { success: false, error: '已推送过' };

  const cookieHeader = await get115CookieHeader();
  if (!cookieHeader) return { success: false, error: '请先登录 115.com' };

  const uid = extractUid(cookieHeader);
  if (!uid) return { success: false, error: '未找到 UID' };
  const config = await get115Config();

  try {
    // Step 1: 获取 sign
    const signResp = await fetch(CLOUD_SPACE_URL, {
      headers: { Cookie: cookieHeader, Accept: 'application/json' },
    });
    if (!signResp.ok) {
      if (signResp.status === 401 || signResp.status === 403) await clearCached115Session();
      return { success: false, error: `sign 获取失败 HTTP ${signResp.status}` };
    }

    const signData = (await signResp.json()) as { state?: boolean; sign?: string; time?: number; data?: string };
    if (!signData.state || !signData.sign) {
      await clearCached115Session();
      return { success: false, error: 'sign 获取失败，请重新登录 115.com' };
    }

    // Step 2: 提交任务
    const body = new URLSearchParams();
    body.set('sign', signData.sign);
    body.set('time', String(signData.time ?? Math.floor(Date.now() / 1000)));
    body.set('uid', uid);
    body.set('url[0]', uri);
    body.set('savepath', '');
    if (config.downloadDir?.id) body.set('wp_path_id', config.downloadDir.id);

    const resp = await fetch(ADD_TASK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Cookie': cookieHeader,
      },
      body: body.toString(),
    });

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) await clearCached115Session();
      return { success: false, error: `HTTP ${resp.status}` };
    }

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

    if (ok) {
      await cache115Session(cookieHeader);
      return { success: true, taskId: infoHash };
    }
    if (data.errno === 401 || data.errno === 403 || data.errcode === 401 || data.errcode === 403) {
      await clearCached115Session();
    }
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
