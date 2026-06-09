# BT0 Extension

WXT + React + shadcn/ui Chrome extension with a Mukaku side panel MVP.

## Current Flow

- Open a Mukaku media detail page at `https://web5.mukaku.com/mv/:id`.
- Click the extension action to open the Chrome side panel.
- The side panel reads a sanitized snapshot from the page content script.
- The panel displays media metadata, ratings, summary, tags, and resource counts only.
- Magnet, torrent, netdisk links, and extraction codes are intentionally not collected or displayed.

See `docs/mukaku-sidepanel-mvp.md` for the MVP scope and data boundary.

## Development

```bash
npm install
npm test
npm run compile
npm run dev
```

Load `.output/chrome-mv3` in Chrome's extension page.

## Build

```bash
npm run build
```
