import React from 'react';
import { createRoot } from 'react-dom/client';
import { CheckCircle2, Layers3, PanelRightOpen } from 'lucide-react';

import '../style.css';
import { Button } from '@/components/ui/button';

function SidePanel() {
  return (
    <main className="min-h-screen bg-background p-5 text-foreground">
      <section className="space-y-6 rounded-2xl border bg-card p-5 text-card-foreground shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Layers3 className="h-6 w-6" />
          </div>
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">BT0 Extension</p>
            <h1 className="text-xl font-semibold tracking-tight">侧边栏已就绪</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              这里是唯一保留的扩展界面入口，可以放置持久化工具、页面分析或工作流面板。
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          {['Chrome Side Panel 入口', 'React 渲染已启用', 'shadcn/ui + Tailwind 样式系统'].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-xl border bg-background p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>{item}</span>
            </div>
          ))}
        </div>

        <Button variant="outline" className="w-full gap-2" disabled>
          <PanelRightOpen className="h-4 w-4" />
          Popup 已移除，当前为 Side Panel
        </Button>
      </section>

      <footer className="mt-4 flex items-center justify-center text-xs text-muted-foreground">
        点击浏览器工具栏图标打开此侧边栏
      </footer>
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
