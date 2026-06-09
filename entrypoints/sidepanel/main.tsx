import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertCircle,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import { browser } from 'wxt/browser';

import '../style.css';
import { Button } from '@/components/ui/button';

type SavedPage = {
  id: string;
  title: string;
  url: string;
  note: string;
  createdAt: string;
};

type ActivePage = {
  title: string;
  url: string;
};

const STORAGE_KEY = 'bt0.savedPages';

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normaliseStoredPages(value: unknown): SavedPage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is SavedPage => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const page = item as Partial<SavedPage>;
    return (
      typeof page.id === 'string' &&
      typeof page.title === 'string' &&
      typeof page.url === 'string' &&
      typeof page.note === 'string' &&
      typeof page.createdAt === 'string'
    );
  });
}

async function getActivePage(): Promise<ActivePage | null> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0] ?? (await browser.tabs.query({ active: true, lastFocusedWindow: true }))[0];

  if (!tab?.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
    return null;
  }

  return {
    title: tab.title?.trim() || tab.url,
    url: tab.url,
  };
}

function formatSavedTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function SidePanel() {
  const [activePage, setActivePage] = React.useState<ActivePage | null>(null);
  const [savedPages, setSavedPages] = React.useState<SavedPage[]>([]);
  const [note, setNote] = React.useState('');
  const [status, setStatus] = React.useState('正在读取当前标签页');
  const [error, setError] = React.useState<string | null>(null);
  const [isBusy, setIsBusy] = React.useState(true);

  const loadState = React.useCallback(async () => {
    setIsBusy(true);
    setError(null);

    try {
      const [page, stored] = await Promise.all([
        getActivePage(),
        browser.storage.local.get(STORAGE_KEY) as Promise<Record<string, unknown>>,
      ]);

      setActivePage(page);
      setSavedPages(normaliseStoredPages(stored[STORAGE_KEY]));
      setStatus(page ? '当前页已就绪' : '当前页面不可保存');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '读取扩展状态失败');
      setStatus('读取失败');
    } finally {
      setIsBusy(false);
    }
  }, []);

  React.useEffect(() => {
    void loadState();
  }, [loadState]);

  async function persistPages(nextPages: SavedPage[]) {
    setSavedPages(nextPages);
    await browser.storage.local.set({ [STORAGE_KEY]: nextPages });
  }

  async function saveCurrentPage() {
    if (!activePage) {
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const nextPages = [
        {
          id: createId(),
          title: activePage.title,
          url: activePage.url,
          note: note.trim(),
          createdAt: new Date().toISOString(),
        },
        ...savedPages,
      ];

      await persistPages(nextPages);
      setNote('');
      setStatus('已保存当前页');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败');
      setStatus('保存失败');
    } finally {
      setIsBusy(false);
    }
  }

  async function removePage(id: string) {
    const nextPages = savedPages.filter((page) => page.id !== id);
    await persistPages(nextPages);
    setStatus('已删除记录');
  }

  async function openPage(url: string) {
    await browser.tabs.create({ url });
  }

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">BT0 采集箱</h1>
          <p className="mt-1 truncate text-xs text-muted-foreground">{status}</p>
        </div>
        <Button aria-label="刷新当前页" size="icon" variant="outline" onClick={() => void loadState()} disabled={isBusy}>
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </header>

      {error ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="mb-5 space-y-3 border-b pb-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Link2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-medium">
              {activePage?.title ?? '未读取到可保存页面'}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{activePage?.url ?? '打开普通网页后刷新侧边栏'}</p>
          </div>
        </div>

        <textarea
          className="min-h-24 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          maxLength={240}
          placeholder="给当前页加一条备注"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />

        <Button className="w-full gap-2" onClick={() => void saveCurrentPage()} disabled={!activePage || isBusy}>
          <Save className="h-4 w-4" />
          保存当前页
        </Button>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">已保存</h2>
          <span className="text-xs text-muted-foreground">{savedPages.length} 条</span>
        </div>

        {savedPages.length === 0 ? (
          <div className="flex min-h-32 flex-col items-center justify-center rounded-md border border-dashed px-5 text-center text-sm text-muted-foreground">
            <FileText className="mb-3 h-5 w-5" />
            暂无记录
          </div>
        ) : (
          <div className="space-y-3">
            {savedPages.map((page) => (
              <article key={page.id} className="rounded-md border bg-card p-3 text-card-foreground shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 text-sm font-medium leading-5">{page.title}</h3>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{page.url}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button aria-label="打开记录" size="icon" variant="ghost" onClick={() => void openPage(page.url)}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button aria-label="删除记录" size="icon" variant="ghost" onClick={() => void removePage(page.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {page.note ? <p className="mt-3 text-sm leading-6">{page.note}</p> : null}
                <p className="mt-3 text-xs text-muted-foreground">{formatSavedTime(page.createdAt)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element #root was not found.');
}

createRoot(root).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>,
);
