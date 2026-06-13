import React from 'react';
import { createRoot } from 'react-dom/client';
import { Check, ChevronLeft, Clock, Folder, Link2, LogOut, RefreshCw, Server, Trash2 } from 'lucide-react';

import '../style.css';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  clear115DownloadDir,
  clear115SessionCache,
  get115Config,
  get115SessionStatus,
  list115Directories,
  save115DownloadDir,
  type Config115,
  type Directory115,
  type Session115Status,
} from '@/lib/adapters/clouds/115';
import {
  adapterAlist,
  ALIST_TOOLS,
  clearAlistConfig,
  getAlistConfig,
  saveAlistConfig,
  type AlistConfig,
} from '@/lib/adapters/clouds/alist';

type DirectoryCrumb = {
  id: string;
  name: string;
};

function formatDateTime(value?: number) {
  if (!value) return '未知';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function sourceLabel(source: Session115Status['source']) {
  switch (source) {
    case 'live':
      return '浏览器登录态';
    case 'cached':
      return '本地缓存会话';
    default:
      return '未连接';
  }
}

function buildDirectoryPath(items: DirectoryCrumb[]) {
  const names = items.map((item) => item.name).filter((name) => name !== '根目录');
  return names.length ? `/${names.join('/')}` : '根目录';
}

const EMPTY_ALIST_FORM: AlistConfig = { url: '', token: '', path: '/', tool: ALIST_TOOLS[0] };

function AlistSection() {
  const [form, setForm] = React.useState<AlistConfig>(EMPTY_ALIST_FORM);
  const [configured, setConfigured] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<'idle' | 'ok' | 'fail'>('idle');
  const [username, setUsername] = React.useState<string | undefined>();

  React.useEffect(() => {
    void getAlistConfig().then((config) => {
      if (config) {
        setForm({ ...EMPTY_ALIST_FORM, ...config });
        setConfigured(true);
      }
    });
  }, []);

  const updateField = (key: keyof AlistConfig) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setTestResult('idle');
  };

  const saveAndTest = React.useCallback(async () => {
    setTesting(true);
    setTestResult('idle');
    try {
      await saveAlistConfig(form);
      setConfigured(true);
      const status = await adapterAlist.checkConnection();
      setUsername(status.username);
      setTestResult(status.connected ? 'ok' : 'fail');
    } finally {
      setTesting(false);
    }
  }, [form]);

  const clearAll = React.useCallback(async () => {
    await clearAlistConfig();
    setForm(EMPTY_ALIST_FORM);
    setConfigured(false);
    setTestResult('idle');
    setUsername(undefined);
  }, []);

  const canSave = Boolean(form.url.trim() && form.token.trim());

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">AList 连接（可选）</h2>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            <span className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              AList 网关
            </span>
            <Badge
              variant="outline"
              className={
                testResult === 'ok'
                  ? 'text-green-600 border-green-300'
                  : testResult === 'fail'
                    ? 'text-destructive border-destructive/40'
                    : 'text-muted-foreground'
              }
            >
              {testResult === 'ok' ? `已连接${username ? ` · ${username}` : ''}` : testResult === 'fail' ? '连接失败' : configured ? '已配置' : '未配置'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            通过自建 AList 网关推送离线下载，作为 115 直连之外的备选通道。
          </p>

          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">服务地址</span>
              <Input
                placeholder="https://alist.example.com"
                value={form.url}
                onChange={updateField('url')}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">Token</span>
              <Input
                type="password"
                placeholder="AList 管理员 Token"
                value={form.token}
                onChange={updateField('token')}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">保存路径</span>
              <Input
                placeholder="/115/云下载"
                value={form.path}
                onChange={updateField('path')}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">离线下载工具</span>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.tool ?? ALIST_TOOLS[0]}
                onChange={updateField('tool')}
              >
                {ALIST_TOOLS.map((tool) => (
                  <option key={tool} value={tool}>{tool}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button className="gap-1" size="sm" disabled={!canSave || testing} onClick={() => void saveAndTest()}>
              {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {testing ? '测试中' : '保存并测试连接'}
            </Button>
            <Button className="gap-1" size="sm" variant="outline" disabled={!configured} onClick={() => void clearAll()}>
              <Trash2 className="h-4 w-4" />
              清除配置
            </Button>
          </div>

          {testResult === 'fail' ? (
            <Alert variant="destructive">
              <AlertTitle>连接失败</AlertTitle>
              <AlertDescription>
                请检查地址、Token 是否正确，以及扩展能否访问该地址（自签证书需先在浏览器中信任）。
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function OptionsPage() {
  const [status, setStatus] = React.useState<Session115Status>({ connected: false, source: 'none' });
  const [config, setConfig] = React.useState<Config115>({});
  const [checking, setChecking] = React.useState(false);
  const [currentDir, setCurrentDir] = React.useState<DirectoryCrumb>({ id: '0', name: '根目录' });
  const [dirStack, setDirStack] = React.useState<DirectoryCrumb[]>([]);
  const [directories, setDirectories] = React.useState<Directory115[]>([]);
  const [loadingDirs, setLoadingDirs] = React.useState(false);
  const [dirError, setDirError] = React.useState('');

  const checkConnection = React.useCallback(async () => {
    setChecking(true);
    try {
      const [conn, nextConfig] = await Promise.all([get115SessionStatus(), get115Config()]);
      setStatus(conn);
      setConfig(nextConfig);
    } finally {
      setChecking(false);
    }
  }, []);

  const clearCache = React.useCallback(async () => {
    await clear115SessionCache();
    await checkConnection();
  }, [checkConnection]);

  React.useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  const loadDirectories = React.useCallback(async (dir: DirectoryCrumb) => {
    setLoadingDirs(true);
    setDirError('');
    try {
      const items = await list115Directories(dir.id);
      setDirectories(items);
      setCurrentDir(dir);
    } catch (err) {
      setDirError(err instanceof Error ? err.message : '目录读取失败');
    } finally {
      setLoadingDirs(false);
    }
  }, []);

  React.useEffect(() => {
    if (status.connected) {
      void loadDirectories({ id: '0', name: '根目录' });
    } else {
      setDirectories([]);
      setDirStack([]);
      setCurrentDir({ id: '0', name: '根目录' });
    }
  }, [loadDirectories, status.connected]);

  const enterDirectory = React.useCallback((dir: Directory115) => {
    const nextDir = { id: dir.id, name: dir.name };
    setDirStack((items) => [...items, currentDir]);
    void loadDirectories(nextDir);
  }, [currentDir, loadDirectories]);

  const goBackDirectory = React.useCallback(() => {
    setDirStack((items) => {
      const previous = items.at(-1);
      if (!previous) return items;
      void loadDirectories(previous);
      return items.slice(0, -1);
    });
  }, [loadDirectories]);

  const saveCurrentDirectory = React.useCallback(async () => {
    if (currentDir.id === '0') {
      await clear115DownloadDir();
      setConfig((current) => {
        const nextConfig = { ...current };
        delete nextConfig.downloadDir;
        return nextConfig;
      });
      return;
    }

    const path = buildDirectoryPath([...dirStack, currentDir]);
    const downloadDir = { id: currentDir.id, name: currentDir.name, path };
    await save115DownloadDir(downloadDir);
    setConfig((current) => ({ ...current, downloadDir }));
  }, [currentDir, dirStack]);

  const clearDownloadDir = React.useCallback(async () => {
    await clear115DownloadDir();
    setConfig((current) => {
      const nextConfig = { ...current };
      delete nextConfig.downloadDir;
      return nextConfig;
    });
  }, []);

  const isConnected = status.connected;
  const isCached = status.source === 'cached';
  const selectedDir = config.downloadDir;

  return (
    <main className="min-h-screen bg-background text-foreground p-8">
      <div className="flex flex-col gap-6" style={{ maxWidth: 640 }}>
        <header className="border-b pb-4">
          <h1 className="text-2xl font-bold tracking-tight">BT0 设置</h1>
          <p className="text-sm text-muted-foreground mt-2">
            连接 115（浏览器登录态）或自建 AList 网关，将磁力链接一键推送到离线下载。
          </p>
        </header>

        <section>
          <h2 className="text-lg font-semibold mb-3">115 连接状态</h2>
          <Card className={isConnected ? 'border-green-200' : 'border-border'}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-base">
                <span className="flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  账号状态
                </span>
                <Badge
                  variant="outline"
                  className={isConnected ? 'text-green-600 border-green-300' : 'text-muted-foreground'}
                >
                  {sourceLabel(status.source)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {isConnected ? '已连接 115' : '未检测到 115 登录态'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {status.source === 'live'
                      ? '正在使用浏览器 Cookie，已同步刷新本地缓存'
                      : status.source === 'cached'
                        ? '当前未读到浏览器 Cookie，正在复用本地缓存会话'
                        : '请打开 115.com 登录后返回此处重新检测；登录成功后会自动缓存'}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">UID</span>
                  <span className="font-medium">{status.uid ?? '未获取'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">会话来源</span>
                  <span className="font-medium">{sourceLabel(status.source)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">缓存时间</span>
                  <span className="font-medium">{formatDateTime(status.cachedAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">缓存有效期</span>
                  <span className="font-medium">{formatDateTime(status.expiresAt)}</span>
                </div>
              </div>

              {isCached ? (
                <Alert className="border-amber-500/30 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
                  <Clock className="h-4 w-4" />
                  <AlertTitle>正在使用缓存会话</AlertTitle>
                  <AlertDescription>
                    如果 115 服务端已让会话失效，推送时会提示重新登录并清除缓存。
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-wrap items-center gap-3">
          <Button className="gap-1" size="default" onClick={() => void checkConnection()} disabled={checking}>
            {checking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {checking ? '检测中' : '重新检测'}
          </Button>
          <Button
            className="gap-1"
            size="default"
            variant="outline"
            onClick={() => void window.open('https://115.com/', '_blank')}
          >
            <Server className="h-4 w-4" />
            打开 115.com
          </Button>
          <Button
            className="gap-1"
            size="default"
            variant="outline"
            disabled={!isCached}
            onClick={() => void clearCache()}
          >
            <LogOut className="h-4 w-4" />
            清除缓存并重检
          </Button>
          {isConnected ? (
            <Badge variant="outline" className="gap-1 h-8 px-3 text-green-600 border-green-300">
              <Check className="h-4 w-4" />
              可推送
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">未连接，请先登录 115.com</span>
          )}
        </section>

        <Separator />

        <section>
          <h2 className="text-lg font-semibold mb-3">离线下载保存目录</h2>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-base">
                <span className="flex items-center gap-2">
                  <Folder className="h-4 w-4" />
                  目标目录
                </span>
                <Badge variant="outline" className={selectedDir ? 'text-green-600 border-green-300' : 'text-muted-foreground'}>
                  {selectedDir ? '已设置' : '默认目录'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">当前保存到</span>
                  <span className="min-w-0 truncate font-medium">{selectedDir?.path ?? '115 默认离线下载目录'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">目录 ID</span>
                  <span className="font-medium">{selectedDir?.id ?? '未指定'}</span>
                </div>
              </div>

              {!isConnected ? (
                <Alert>
                  <Server className="h-4 w-4" />
                  <AlertTitle>需要先连接 115</AlertTitle>
                  <AlertDescription>登录或恢复缓存会话后才能读取目录列表。</AlertDescription>
                </Alert>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      className="gap-1"
                      size="sm"
                      variant="outline"
                      disabled={!dirStack.length || loadingDirs}
                      onClick={goBackDirectory}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      返回上级
                    </Button>
                    <Button
                      className="gap-1"
                      size="sm"
                      variant="outline"
                      disabled={loadingDirs}
                      onClick={() => void loadDirectories(currentDir)}
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingDirs ? 'animate-spin' : ''}`} />
                      刷新目录
                    </Button>
                    <Button
                      className="gap-1"
                      size="sm"
                      onClick={() => void saveCurrentDirectory()}
                    >
                      <Check className="h-4 w-4" />
                      保存当前目录
                    </Button>
                    <Button
                      className="gap-1"
                      size="sm"
                      variant="outline"
                      disabled={!selectedDir}
                      onClick={() => void clearDownloadDir()}
                    >
                      默认目录
                    </Button>
                  </div>

                  <div className="rounded-md border">
                    <div className="border-b bg-muted/30 px-3 py-2 text-sm font-medium">
                      {buildDirectoryPath([...dirStack, currentDir])}
                    </div>
                    <div className="max-h-64 overflow-auto p-2">
                      {dirError ? (
                        <p className="px-2 py-3 text-sm text-destructive">{dirError}</p>
                      ) : loadingDirs ? (
                        <p className="px-2 py-3 text-sm text-muted-foreground">正在读取目录...</p>
                      ) : directories.length ? (
                        <div className="grid gap-1">
                          {directories.map((dir) => (
                            <button
                              key={dir.id}
                              className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                              type="button"
                              onClick={() => enterDirectory(dir)}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="truncate">{dir.name}</span>
                              </span>
                              <span className="shrink-0 text-xs text-muted-foreground">进入</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="px-2 py-3 text-sm text-muted-foreground">当前目录没有子目录，可直接保存为目标目录。</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <Separator />

        <AlistSection />

        <section>
          <h2 className="text-lg font-semibold mb-3">工作方式</h2>
          <Card>
            <CardContent className="p-4">
              <ol className="flex flex-col gap-3 text-sm leading-relaxed list-decimal list-inside">
                <li>优先读取当前浏览器的 115.com Cookie</li>
                <li>读取成功后缓存会话，扩展重载或临时读不到 Cookie 时会复用缓存</li>
                <li>保存目录会作为 115 的 <code className="text-xs bg-muted px-1 rounded">wp_path_id</code> 提交</li>
                <li>推送接口返回登录失效时，会自动清除缓存并要求重新登录</li>
                <li>在 BT0 影片详情页的资源区，点击种子旁的「115」按钮即可一键推送</li>
              </ol>
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">状态说明</h2>
          <div className="grid gap-3">
            <Card>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="mt-1 h-3 w-3 rounded-full bg-green-500" />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">浏览器登录态</span>
                  <span className="text-xs text-muted-foreground">
                    当前浏览器能直接读取到 115 Cookie，这是最稳定的状态。
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="mt-1 h-3 w-3 rounded-full bg-amber-500" />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">本地缓存会话</span>
                  <span className="text-xs text-muted-foreground">
                    当前使用最近一次成功读取的 Cookie，能减少扩展状态丢失造成的重复登录。
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="mt-1 h-3 w-3 rounded-full bg-gray-300" />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">未连接</span>
                  <span className="text-xs text-muted-foreground">
                    没有浏览器登录态，也没有可用缓存，需要重新登录 115.com。
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');
createRoot(root).render(
  <React.StrictMode>
    <OptionsPage />
  </React.StrictMode>,
);
