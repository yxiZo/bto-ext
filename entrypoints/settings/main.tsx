import React from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { Server, Check } from 'lucide-react';

import '../style.css';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { adapterAlist, saveConfig } from '@/lib/adapters/clouds/alist';
import type { CloudConnectionStatus } from '@/lib/adapters/types';

function OptionsPage() {
  const [url, setUrl] = React.useState('');
  const [token, setToken] = React.useState('');
  const [path, setPath] = React.useState('/');
  const [status, setStatus] = React.useState<CloudConnectionStatus>({ connected: false });
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const result = await browser.storage.local.get('bt0_alist_config');
      const cfg = result.bt0_alist_config as { url?: string; token?: string; path?: string } | undefined;
      if (cfg?.url) setUrl(cfg.url);
      if (cfg?.token) setToken(cfg.token);
      if (cfg?.path) setPath(cfg.path);
      const conn = await adapterAlist.checkConnection();
      setStatus(conn);
    })();
  }, []);

  const handleSave = async () => {
    if (!url || !token) return;
    await saveConfig({ url, token, path });
    const conn = await adapterAlist.checkConnection();
    setStatus(conn);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <main className="min-h-screen bg-background text-foreground p-8">
      <div className="flex flex-col gap-6" style={{ maxWidth: 640 }}>
        <header className="border-b pb-4">
          <h1 className="text-2xl font-bold tracking-tight">BT0 设置</h1>
          <p className="text-sm text-muted-foreground mt-2">
            配置 AList 网关连接，将磁力链接推送到网盘离线下载。
          </p>
        </header>

        <section>
          <h2 className="text-lg font-semibold mb-3">AList 连接配置</h2>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4" />
                连接信息
              </CardTitle>
              <CardDescription>
                需要部署 AList 并挂载网盘（如 115），再从后台获取 Token。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-[80px_1fr] items-center gap-3">
                <span className="text-sm font-medium">地址</span>
                <input
                  className="rounded-md border px-3 py-2 text-sm bg-background w-full"
                  placeholder="https://alist.example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-[80px_1fr] items-center gap-3">
                <span className="text-sm font-medium">Token</span>
                <div className="flex flex-col gap-1">
                  <input
                    className="rounded-md border px-3 py-2 text-sm bg-background"
                    placeholder="alist-xxxxxxxx"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">
                    在 AList 后台 → 设置 → 其他 → 令牌 获取
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-[80px_1fr] items-center gap-3">
                <span className="text-sm font-medium">路径</span>
                <div className="flex flex-col gap-1">
                  <input
                    className="rounded-md border px-3 py-2 text-sm bg-background"
                    placeholder="/115/云下载"
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">
                    推送后的文件保存目录
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="flex items-center gap-3">
          <Button className="gap-1" size="default" onClick={handleSave} disabled={!url || !token}>
            {saved ? <Check className="h-4 w-4" /> : <Server className="h-4 w-4" />}
            {saved ? '已保存' : '保存并测试连接'}
          </Button>
          {status.connected ? (
            <Badge variant="outline" className="gap-1 h-8 px-3 text-green-600 border-green-300">
              <Check className="h-4 w-4" />
              已连接{status.username ? ` — ${status.username}` : ''}
            </Badge>
          ) : url ? (
            <span className="text-sm text-muted-foreground">连接失败，请检查地址和 Token</span>
          ) : null}
        </section>

        <Separator />

        <section>
          <h2 className="text-lg font-semibold mb-3">使用说明</h2>
          <Card>
            <CardContent className="p-4">
              <ol className="flex flex-col gap-3 text-sm leading-relaxed list-decimal list-inside">
                <li>部署 AList，在存储中添加网盘（115 / 百度 / 阿里等）</li>
                <li>进入 AList 后台 <code className="text-xs bg-muted px-1 rounded">/@manage</code> → 设置 → 其他 → 令牌</li>
                <li>复制 Token，填入上方配置区，点击保存并测试连接</li>
                <li>在 BT0 影片详情页的资源区，点击种子旁的「AList」按钮即可一键推送</li>
              </ol>
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">连接状态</h2>
          <Card className={status.connected ? 'border-green-200' : 'border-border'}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${status.connected ? 'bg-green-500' : 'bg-gray-300'}`} />
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {status.connected ? '已连接' : url ? '未连接' : '未配置'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {status.connected
                    ? `已连接到 AList${status.username ? `（${status.username}）` : ''}`
                    : url
                      ? '请检查地址和 Token 是否正确'
                      : '请先填写上方的配置信息'
                  }
                </span>
              </div>
            </CardContent>
          </Card>
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
