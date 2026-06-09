import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'BT0 Extension',
    description: 'Mukaku detail-page side panel assistant.',
    permissions: ['sidePanel', 'tabs', 'cookies', 'storage'],
    host_permissions: ['*://*.115.com/*'],
    action: {
      default_title: 'BT0 Extension',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    options_ui: {
      page: 'settings.html',
      open_in_tab: true,
    },
  },
});
