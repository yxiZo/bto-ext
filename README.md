# BT0 Extension

WXT + React + shadcn/ui Chrome extension with a side panel MVP.

## Current Flow

- Click the extension action to open the Chrome side panel.
- The side panel reads the active tab title and URL.
- Add an optional note and save the page to `chrome.storage.local`.
- Saved pages are listed in the panel and can be opened or deleted.

## Development

```bash
npm install
npm run compile
npm run dev
```

Load `.output/chrome-mv3` in Chrome's extension page.

## Build

```bash
npm run build
```
