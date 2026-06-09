import react from '@vitejs/plugin-react';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [react()],
  }),
  manifest: {
    name: 'BT0 Extension',
    description: 'WXT Chrome extension with a React side panel powered by shadcn/ui.',
    permissions: ['sidePanel'],
    action: {
      default_title: 'BT0 Extension',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
  },
});
