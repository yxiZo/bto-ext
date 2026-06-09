import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'BT0 Extension',
    description: 'Save the current tab from a Chrome side panel.',
    permissions: ['sidePanel', 'storage', 'tabs'],
    action: {
      default_title: 'BT0 Extension',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
  },
});
