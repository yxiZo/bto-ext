import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'BT0 Extension',
    description: 'Mukaku detail-page side panel assistant.',
    permissions: ['sidePanel', 'tabs'],
    action: {
      default_title: 'BT0 Extension',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
  },
});
