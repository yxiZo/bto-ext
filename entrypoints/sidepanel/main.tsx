import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  AlertCircle,
  BadgeInfo,
  Check,
  Clapperboard,
  Copy,
  ExternalLink,
  Film,
  Magnet,
  RefreshCw,
  ShieldCheck,
  Tags,
  Users,
} from 'lucide-react';
import { browser } from 'wxt/browser';

import '../style.css';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getMukakuRouteKind,
  MUKAKU_ORIGIN,
  MUKAKU_SNAPSHOT_MESSAGE,
  type MukakuMediaSnapshot,
  type MukakuSnapshotRequest,
} from '@/lib/mukaku';

type ActiveTab = {
  id: number;
  title: string;
  url: string;
};

type PanelState = {
  activeTab: ActiveTab | null;
  snapshot: MukakuMediaSnapshot | null;
  error: string | null;
  status: string;
  isLoading: boolean;
};

const initialState: PanelState = {
  activeTab: null,
  snapshot: null,
  error: null,
  status: '正在读取当前标签页',
  isLoading: true,
};

async function getActiveTab(): Promise<ActiveTab | null> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0] ?? (await browser.tabs.query({ active: true, lastFocusedWindow: true }))[0];

  if (!tab?.id || !tab.url) {
    return null;
  }

  return {
    id: tab.id,
    title: tab.title?.trim() || tab.url,
    url: tab.url,
  };
}

async function requestSnapshot(tabId: number) {
  return browser.tabs.sendMessage(tabId, {
    type: MUKAKU_SNAPSHOT_MESSAGE,
  } satisfies MukakuSnapshotRequest) as Promise<MukakuMediaSnapshot>;
}

function routeLabel(snapshot: MukakuMediaSnapshot | null, activeTab: ActiveTab | null) {
  const routeKind = snapshot?.routeKind ?? (activeTab ? getMukakuRouteKind(activeTab.url) : 'other');

  switch (routeKind) {
    case 'detail':
      return '详情页';
    case 'listing':
      return '列表页';
    case 'search':
      return '搜索页';
    default:
      return '非目标页';
  }
}

function compactText(value: string | null | undefined) {
  return value && value !== 'N/A' ? value : '未提供';
}

function joinPeople(items: string[]) {
  return items.length ? items.join(' / ') : '未提供';
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}

function CopyButton({ text, label = '复制' }: { text: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <Button
      aria-label={copied ? '已复制' : label}
      className="h-7 gap-1 text-xs"
      size="sm"
      variant={copied ? 'default' : 'outline'}
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? '已复制' : label}
    </Button>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right leading-5">{value}</span>
    </div>
  );
}

function LoadingView() {
  return (
    <main className="flex min-h-screen flex-col gap-4 bg-background p-4 text-foreground">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-48 w-full rounded-lg" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    </main>
  );
}

function EmptyRouteView({ activeTab, onRefresh }: { activeTab: ActiveTab | null; onRefresh: () => void }) {
  return (
    <main className="flex min-h-screen flex-col gap-4 bg-background p-4 text-foreground">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">BT0 详情助手</h1>
          <p className="mt-1 truncate text-xs text-muted-foreground">{activeTab?.url ?? '未读取到当前页面'}</p>
        </div>
        <Button aria-label="刷新" size="icon" variant="outline" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </header>

      <Alert>
        <BadgeInfo className="h-4 w-4" />
        <AlertTitle>打开影视详情页后使用</AlertTitle>
        <AlertDescription>
          当前页面是{routeLabel(null, activeTab)}。MVP 只在 {MUKAKU_ORIGIN}/mv/:id 页面展示详情快照。
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">合规边界</CardTitle>
          <CardDescription>资源区域只展示分类和数量，不读取具体下载链接。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">元信息</Badge>
            <Badge variant="secondary">评分</Badge>
            <Badge variant="secondary">简介</Badge>
            <Badge variant="outline">资源概览</Badge>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function ErrorView({ message, onRefresh }: { message: string; onRefresh: () => void }) {
  return (
    <main className="flex min-h-screen flex-col gap-4 bg-background p-4 text-foreground">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">BT0 详情助手</h1>
          <p className="mt-1 text-xs text-muted-foreground">读取失败</p>
        </div>
        <Button aria-label="重试" size="icon" variant="outline" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </header>

      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>无法读取页面快照</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </main>
  );
}

function DetailView({
  snapshot,
  activeTab,
  status,
  onRefresh,
}: {
  snapshot: MukakuMediaSnapshot;
  activeTab: ActiveTab;
  status: string;
  onRefresh: () => void;
}) {
  const seedTotal = snapshot.resources.seedTotal ?? 0;
  const netdiskTotal = snapshot.resources.netdiskTotal ?? 0;
  const totalResources = seedTotal + netdiskTotal;
  const heroTags = [snapshot.year, snapshot.region, snapshot.genre].filter((item): item is string => Boolean(item));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <ScrollArea className="h-screen">
        <div className="flex flex-col gap-4 p-4">
          <header className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight">BT0 详情助手</h1>
              <p className="mt-1 truncate text-xs text-muted-foreground">{status}</p>
            </div>
            <Button aria-label="刷新详情" size="icon" variant="outline" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </header>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex gap-3 p-3">
                <div className="aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-md border bg-muted">
                  {snapshot.posterUrl ? (
                    <img
                      alt={snapshot.title}
                      className="h-full w-full object-cover"
                      src={snapshot.posterUrl}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Film className="h-7 w-7" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Badge>{routeLabel(snapshot, activeTab)}</Badge>
                    <Badge variant="outline">ID {snapshot.mediaId ?? '未知'}</Badge>
                  </div>
                  <h2 className="line-clamp-3 text-base font-semibold leading-6">{snapshot.title}</h2>
                  {snapshot.originalTitle ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{snapshot.originalTitle}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {heroTags.slice(0, 5).map((item) => (
                      <Badge key={item} variant="secondary">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {!snapshot.pageReady ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>页面还没有完全渲染</AlertTitle>
              <AlertDescription>如果信息缺失，等待页面加载完成后点击右上角刷新。</AlertDescription>
            </Alert>
          ) : null}

          <Tabs defaultValue="detail" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="detail">详情</TabsTrigger>
              <TabsTrigger value="resources">资源</TabsTrigger>
              <TabsTrigger value="page">页面</TabsTrigger>
            </TabsList>

            <TabsContent value="detail" className="mt-4">
              <div className="flex flex-col gap-4">
                <Card>
                  <CardHeader className="p-4 pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clapperboard className="h-4 w-4" />
                      影视信息
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 p-4 pt-0">
                    <StatRow label="豆瓣" value={compactText(snapshot.ratings.douban)} />
                    <StatRow label="IMDb" value={compactText(snapshot.ratings.imdb)} />
                    <Separator />
                    <StatRow label="上映" value={compactText(snapshot.release)} />
                    <StatRow label="片长" value={compactText(snapshot.duration)} />
                    <StatRow label="集数" value={compactText(snapshot.episodes)} />
                    <StatRow label="语言" value={compactText(snapshot.language)} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-4 pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="h-4 w-4" />
                      演职员
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 p-4 pt-0">
                    <StatRow label="导演" value={joinPeople(snapshot.directors)} />
                    <StatRow label="编剧" value={joinPeople(snapshot.writers)} />
                    <StatRow label="演员" value={joinPeople(snapshot.actors)} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-4 pb-3">
                    <CardTitle className="text-base">剧情简介</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-sm leading-6 text-muted-foreground">{compactText(snapshot.summary)}</p>
                  </CardContent>
                </Card>

                {snapshot.tags.length ? (
                  <Card>
                    <CardHeader className="p-4 pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Tags className="h-4 w-4" />
                        标签
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2 p-4 pt-0">
                      {snapshot.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="resources" className="mt-4">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-2">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xl font-semibold">{totalResources}</p>
                      <p className="mt-1 text-xs text-muted-foreground">总数</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xl font-semibold">{seedTotal}</p>
                      <p className="mt-1 text-xs text-muted-foreground">种子</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xl font-semibold">{netdiskTotal}</p>
                      <p className="mt-1 text-xs text-muted-foreground">网盘</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Magnet links — grouped by quality */}
                {snapshot.resources.allSeeds.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Magnet className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">磁力链接</h3>
                      <Badge variant="secondary" className="text-xs">
                        {snapshot.resources.allSeeds.length}
                      </Badge>
                    </div>

                    {Object.entries(snapshot.resources.seedsByQuality).length > 0
                      ? Object.entries(snapshot.resources.seedsByQuality).map(([quality, seeds]) => (
                          <Card key={quality}>
                            <CardHeader className="p-3 pb-2">
                              <CardTitle className="flex items-center gap-2 text-sm">
                                <Badge variant="outline">{quality}</Badge>
                                <span className="text-xs text-muted-foreground">{seeds.length} 个资源</span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2 p-3 pt-0">
                              {seeds.map((seed, idx) => (
                                <div
                                  key={`${seed.magnet.slice(-20)}-${idx}`}
                                  className="flex flex-col gap-1 rounded-md border p-2 text-xs"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="line-clamp-2 font-medium leading-5">{seed.name}</span>
                                    <CopyButton
                                      label="复制磁力"
                                      text={seed.magnet}
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <span>{seed.size}</span>
                                    {seed.addedAt ? (
                                      <>
                                        <span>·</span>
                                        <span>{seed.addedAt}</span>
                                      </>
                                    ) : null}
                                    {seed.isNew ? (
                                      <Badge className="h-4 px-1 text-[10px]" variant="default">
                                        新
                                      </Badge>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        ))
                      : /* Flat list when no quality grouping */
                        snapshot.resources.allSeeds.map((seed, idx) => (
                          <div
                            key={`${seed.magnet.slice(-20)}-${idx}`}
                            className="flex flex-col gap-1 rounded-md border p-2 text-xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="line-clamp-2 font-medium leading-5">{seed.name}</span>
                              <CopyButton label="复制磁力" text={seed.magnet} />
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span>{seed.size}</span>
                              {seed.addedAt ? <span>· {seed.addedAt}</span> : null}
                              {seed.isNew ? (
                                <Badge className="h-4 px-1 text-[10px]" variant="default">新</Badge>
                              ) : null}
                            </div>
                          </div>
                        ))}
                  </div>
                ) : (
                  <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>未读取到磁力链接</AlertTitle>
                    <AlertDescription>
                      当前页面可能尚未完全加载，请等待页面渲染完成后点击刷新。
                    </AlertDescription>
                  </Alert>
                )}

                {/* Category overview */}
                {snapshot.resources.categories.length > 0 ? (
                  <Card>
                    <CardHeader className="p-4 pb-3">
                      <CardTitle className="text-base">分类概览</CardTitle>
                      <CardDescription>来自当前页面可见资源分类栏。</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 p-4 pt-0">
                      {snapshot.resources.categories.map((category) => (
                        <div
                          key={`${category.label}-${category.count}`}
                          className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                        >
                          <span className="truncate">{category.label}</span>
                          <Badge variant="outline">{category.count ?? '未知'}</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="page" className="mt-4">
              <Card>
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-base">页面状态</CardTitle>
                  <CardDescription>用于确认插件是否识别到了正确页面。</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 p-4 pt-0">
                  <StatRow label="路由" value={routeLabel(snapshot, activeTab)} />
                  <StatRow label="采集时间" value={formatTime(snapshot.capturedAt)} />
                  <StatRow label="可见资源项" value={snapshot.resources.visibleItems} />
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">当前 URL</p>
                    <p className="break-all rounded-md border bg-muted p-2 text-xs leading-5">{snapshot.url}</p>
                  </div>
                  <Button variant="outline" className="gap-2" onClick={() => void browser.tabs.create({ url: snapshot.url })}>
                    <ExternalLink className="h-4 w-4" />
                    打开新标签
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </main>
  );
}

function SidePanel() {
  const [state, setState] = React.useState<PanelState>(initialState);

  const loadState = React.useCallback(async () => {
    setState((current) => ({
      ...current,
      error: null,
      isLoading: true,
      status: '正在读取当前标签页',
    }));

    try {
      const activeTab = await getActiveTab();

      if (!activeTab) {
        setState({
          activeTab: null,
          snapshot: null,
          error: null,
          isLoading: false,
          status: '未读取到当前标签页',
        });
        return;
      }

      const routeKind = getMukakuRouteKind(activeTab.url);

      if (routeKind !== 'detail') {
        setState({
          activeTab,
          snapshot: null,
          error: null,
          isLoading: false,
          status: '当前不是 Mukaku 详情页',
        });
        return;
      }

      const snapshot = await requestSnapshot(activeTab.id);

      setState({
        activeTab,
        snapshot,
        error: null,
        isLoading: false,
        status: snapshot.pageReady ? '详情快照已就绪' : '详情页仍在渲染',
      });
    } catch (cause) {
      setState((current) => ({
        ...current,
        snapshot: null,
        error: cause instanceof Error ? cause.message : '读取页面快照失败',
        isLoading: false,
        status: '读取失败',
      }));
    }
  }, []);

  React.useEffect(() => {
    void loadState();
  }, [loadState]);

  if (state.isLoading) {
    return <LoadingView />;
  }

  if (state.error) {
    return <ErrorView message={state.error} onRefresh={() => void loadState()} />;
  }

  if (!state.snapshot || !state.activeTab) {
    return <EmptyRouteView activeTab={state.activeTab} onRefresh={() => void loadState()} />;
  }

  return (
    <DetailView
      activeTab={state.activeTab}
      snapshot={state.snapshot}
      status={state.status}
      onRefresh={() => void loadState()}
    />
  );
}

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element #root was not found.');
}

const rootStore = globalThis as typeof globalThis & {
  __BT0_SIDE_PANEL_ROOT__?: Root;
};

const reactRoot = rootStore.__BT0_SIDE_PANEL_ROOT__ ?? createRoot(root);
rootStore.__BT0_SIDE_PANEL_ROOT__ = reactRoot;

reactRoot.render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>,
);
