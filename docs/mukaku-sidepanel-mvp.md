# Mukaku Side Panel MVP

## Scope

Build a Chrome side panel assistant for `https://web5.mukaku.com/` detail pages.

The MVP intentionally does not collect, display, copy, open, or transform magnet links or torrent download URLs. Resource handling is limited to counts, categories, and page state.

## Site Findings

- The site is a Vue SPA branded as `BuTai0`.
- The SPA shell is served for homepage, listing pages, and detail pages.
- Main user-facing routes:
  - `/search?sb=keyword`
  - `/movie/:r.html`
  - `/tvseries/:r.html`
  - `/mv/:id`
  - `/tr/:id.html`
- The actual media detail route is `/mv/:id`.
- API base observed in frontend bundle: `/prod/api/v1/`.
- Public frontend API wrappers include `getVideoList`, `getVideoMovieList`, `getVideoTypeList`, `getVideoDetail`, and `getTrDetail`.
- Detail page DOM exposes media metadata, ratings, summary, tags, and resource count tabs.

## MVP Behavior

1. User opens a Mukaku media detail page such as `/mv/:id`.
2. User clicks the extension action to open the side panel.
3. The side panel asks the content script for a sanitized page snapshot.
   - On detail pages, the content script waits briefly for the Vue-rendered detail DOM before returning.
4. The side panel renders:
   - Poster, title, source URL, and route status.
   - Rating and basic metadata.
   - Summary, creators, cast, and tags.
   - Resource category/count overview only.
5. On non-detail pages, the panel shows the current route and asks the user to open a detail page.

## Data Boundary

Allowed:

- Page URL, route kind, media id.
- Title, poster, year, region, language, duration, episodes.
- Director, writer, actor names.
- Rating text and public metadata already visible on the page.
- Resource tab labels and numeric counts.

Not allowed in this MVP:

- Magnet links.
- Torrent file URLs.
- Netdisk links or extraction codes.
- Copy/open/download actions for resource links.
- Background crawling of API endpoints.

## Implementation

- `entrypoints/content.ts`: WXT content script matched to `https://web5.mukaku.com/*`.
- `lib/mukaku.ts`: shared message constants, route helpers, and snapshot types.
- `entrypoints/sidepanel/main.tsx`: React side panel UI built with shadcn/ui components.

## Verification

Run:

```bash
npm run compile
npm test
npm run build
```
