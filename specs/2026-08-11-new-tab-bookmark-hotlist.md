# Tech Spec: New Tab Bookmark Hot List (tabrc)

**Date:** 2026-08-11
**PRD:** `features/2026-08-11-new-tab-bookmark-hotlist.md`
**Status:** Final — assumptions confirmed 2026-08-11; ready for implementation

## Overview

This is a Chrome Manifest V3 extension consisting of a single static page registered as the browser's new-tab override. There is no server, no background service worker, no build step, and no framework: the page is plain HTML/CSS/JS that, on each load, reads the bookmark tree via `chrome.bookmarks.getTree()`, derives a view model (flat or grouped mode per the PRD), and renders anchor links with favicons served by Chrome's built-in `_favicon` endpoint. Freshness (PRD criterion #8) falls out of the architecture for free — every new tab is a fresh page load that re-queries the bookmark tree — so no event listeners, caching, or invalidation machinery exists. The architectural style is "static page over a local platform API"; the entire risk surface is the selection algorithm and the layout CSS.

## Component Diagram

```
chrome://newtab
      │  (Chrome routes new-tab to the override page)
      ▼
┌─────────────────────────────────────────────────────────┐
│ Extension (unpacked, MV3)                               │
│                                                         │
│  manifest.json      Declares newtab override +          │
│                     "bookmarks" and "favicon" perms.    │
│                                                         │
│  newtab.html        Static shell: empty <main> +        │
│                     <template> nodes; loads CSS/JS.     │
│                                                         │
│  newtab.js          Entry point: orchestrates           │
│                     query → select → render.            │
│    ├─ hotlist.js    Pure selection logic: bookmark      │
│    │                tree in, view model out. No Chrome  │
│    │                APIs — unit-testable in isolation.  │
│    └─ render.js     View model → DOM. Builds anchors,   │
│                     favicon <img> URLs, empty state.    │
│                                                         │
│  newtab.css         Layout: full-width columns,         │
│                     no-horizontal-scroll guarantees.    │
└─────────────────────────────────────────────────────────┘
      │                          │
      ▼                          ▼
chrome.bookmarks.getTree()   chrome-extension://<id>/_favicon/
(source of truth: Chrome's   (Chrome's local favicon cache,
 bookmark store)              no network)
```

- **manifest.json** — declares what the extension is; failure mode: a malformed manifest fails at load time in `chrome://extensions`, never at runtime.
- **newtab.html / newtab.css** — static shell and layout; failure mode: none at runtime (no logic).
- **hotlist.js** — the only non-trivial logic in the system: folder discovery, mode selection, truncation. Pure functions over plain data. Failure mode: a selection bug shows wrong/missing bookmarks; covered by unit tests.
- **render.js** — DOM construction from the view model. Failure mode: render exception → caught by entry point, which falls back to the empty-state message rather than a blank page.
- **newtab.js** — glue; also owns the single runtime error boundary. Failure mode: if `chrome.bookmarks.getTree()` rejects (should not happen with the permission granted), render the empty-state message.
- **chrome.bookmarks / _favicon** — platform dependencies, source of truth for all data; failure mode: unavailable only if Chrome itself is broken; `_favicon` misses render the built-in generic-globe response, which satisfies the placeholder criterion with zero code.

## Data Model

No storage of any kind. Chrome's bookmark store is the sole source of truth; the extension holds data only for the lifetime of one page render.

**Input (from Chrome):** `BookmarkTreeNode` — relevant fields: `id`, `title`, `url` (absent ⇒ node is a folder), `children` (ordered array — this order IS the PRD's "stored order").

**Derived view model (in-memory only):**

```
HotlistView
├─ mode: "flat" | "grouped" | "empty"
└─ groups: Group[]            // flat mode: exactly one group with heading = null
     ├─ heading: string|null  // sub-folder title in grouped mode
     └─ entries: Entry[]
          ├─ title: string    // bookmark title; fall back to url if title is ""
          └─ url: string
```

Derivation rules (all in `hotlist.js`):

1. **Folder discovery:** depth-first, pre-order traversal of `getTree()` output, children in array order; the first folder node with `title === "tabrc-hotlist"` (exact, case-sensitive) wins. Not found ⇒ `mode: "empty"`.
2. **Mode:** any child folder present ⇒ grouped (direct-child bookmarks ignored); otherwise flat.
3. **Grouped:** one group per non-empty sub-folder in stored order; only the sub-folder's direct-child *bookmarks* count (deeper folders ignored). Empty sub-folders omitted. All groups empty ⇒ `mode: "empty"`.
4. **Cap:** total entries across all groups truncated to 50, in traversal order (group by group); a group emptied entirely by truncation is dropped.
5. Bookmarklets and non-http(s) schemes are kept as-is (they are the user's bookmarks); separators (nodes with neither url nor children semantics) are skipped defensively.

**Favicon URL construction (render.js):** `chrome.runtime.getURL("/_favicon/") + "?pageUrl=" + encodeURIComponent(entry.url) + "&size=32"`, set as `<img src>`. `size=32` for crisp rendering on 2x displays at 16px CSS size.

## API Contracts

No network endpoints exist. The contracts are the two internal module boundaries; the engineer implements exactly these signatures:

**`hotlist.js`** (pure, no Chrome imports — receives plain data):

```
selectHotlist(rootNodes: BookmarkTreeNode[], opts?: {folderName?, cap?}) -> HotlistView
```
- `rootNodes` is the array returned by `chrome.bookmarks.getTree()`.
- Defaults: `folderName: "tabrc-hotlist"`, `cap: 50`.
- Total entries across `groups` ≤ cap; never throws on well-formed input; unexpected node shapes are skipped, not fatal.

**`render.js`**:

```
render(view: HotlistView, mainEl: Element) -> void
```
- Idempotent (clears `mainEl` first). `mode: "empty"` renders the PRD #11 message. Entries render as `<a href="{url}">` with a favicon `<img>` and title text — real anchors, default click behavior untouched (PRD #5, #6). Titles are set via `textContent`; URLs only ever assigned to `href` — no HTML string interpolation anywhere (bookmark titles are user data; treat as untrusted).

**`newtab.js`** (entry): `getTree() → selectHotlist → render`, wrapped in one try/catch whose handler renders the empty state with the same guidance message.

**manifest.json contract:**

```
manifest_version: 3
name: tabrc  /  version: 0.1.0
chrome_url_overrides: { newtab: "newtab.html" }
permissions: ["bookmarks", "favicon"]
```
Nothing else — no host permissions, no background, no content scripts (PRD #12).

## Critical Path Walkthrough

**Flow 1 — open a new tab (happy path):**
1. User hits Cmd+T; Chrome loads `newtab.html` from disk (~0ms, local).
2. `newtab.js` runs at `DOMContentLoaded`, calls `chrome.bookmarks.getTree()` — an IPC to Chrome's in-memory bookmark model, single-digit ms even for thousands of bookmarks.
3. `selectHotlist()` walks the tree (O(total bookmarks), trivially fast) and returns the view model.
4. `render()` builds ≤50 anchor nodes inside one detached `<div class="content">` wrapper (which is also the CSS anchor box for vertical placement), appends once. Page is now visible and clickable — well inside the 200ms p95 budget (expected: <30ms).
5. Favicon `<img>`s resolve asynchronously from Chrome's local cache; each has fixed CSS dimensions so no layout shift and no click-target movement. A cache miss renders Chrome's generic icon — the required placeholder.

**Flow 1 error path:** `getTree()` rejects or a render bug throws → catch in `newtab.js` → empty-state message. Never a blank page.

**Flow 2 — user edits the hot list:** User adds/removes/renames/reorders bookmarks or sub-folders in Chrome's bookmark manager. Nothing happens in the extension (no listeners, no state). The next new tab re-runs Flow 1 against the updated store, including flat↔grouped mode flips. Criterion #8 is satisfied structurally.

**Flow 3 — click a bookmark:** Standard anchor navigation. Plain click navigates the current tab; Cmd/Ctrl/middle-click open background tabs via native browser behavior. The extension adds no click handlers, so there is nothing to get wrong.

## Tradeoff Log

| Decision | Options Considered | Choice | Rationale | Risks Accepted |
|---|---|---|---|---|
| Freshness mechanism | (a) re-query on every page load; (b) `chrome.bookmarks.onChanged` listeners + live re-render; (c) cache in `chrome.storage` with invalidation | (a) | PRD requires freshness only "by the next new tab". Query cost is ~ms; caching adds state and staleness bugs for zero user-visible gain. | Already-open new-tab pages show a stale list until reloaded. PRD-compliant. |
| Folder discovery | (a) `chrome.bookmarks.search({title})`; (b) full `getTree()` + DFS | (b) | `search()` result order is unspecified, but the PRD pins "first in standard tree traversal" for duplicate names. DFS over `getTree()` makes that deterministic, and we need the subtree's children anyway. | Walks the whole tree; irrelevant at personal scale (thousands of nodes ≪ 1ms budget). |
| Favicons | (a) MV3 `favicon` permission + `_favicon/` endpoint; (b) fetch `https://site/favicon.ico`; (c) no icons | (a) | (b) violates the zero-network criterion outright. (a) is the platform-blessed local cache and its built-in miss behavior satisfies the placeholder requirement with no code. | `_favicon` cache is cold for never-visited sites → generic icon shown. Acceptable and spec-compliant. |
| UI stack | (a) vanilla JS + `<template>`; (b) React/Preact + bundler; (c) HTML generated by a build step | (a) | ≤50 anchors and two layout modes do not justify a framework or build pipeline. No build step also means "load unpacked" just works and there is no supply chain. | None meaningful at this scope. |
| Layout engine | (a) CSS `column-*` (multicol); (b) CSS grid with explicit column count; (c) JS-measured layout | (a) flat mode, (b) grouped mode | Flat mode is one ordered list that should flow across the full width — exactly what multicol does natively, reading top-to-bottom per column. Grouped mode has explicit per-folder columns — `grid-auto-flow: column` / flex row maps 1:1. JS layout is over-engineering. | Multicol reads down-then-across; if the user expects across-then-down scanning, revisit with `grid-auto-flow: row`. Flagged for the demo. |
| Error handling | (a) let it crash (blank page); (b) single boundary → empty state | (b) | PRD #11 bans blank/error pages; one try/catch at the entry point covers every runtime failure. | A selection bug could masquerade as "no bookmarks". Unit tests on `hotlist.js` mitigate. |
| Truncation across groups | (a) cap per group; (b) global cap in traversal order | (b) | PRD #4 says 50 total in stored traversal order. | Later groups can be partially or fully cut; that is what the PRD specifies. |

## Operational Concerns

- **Install / deploy:** `chrome://extensions` → Developer mode → "Load unpacked" → repo root (the extension IS the repo; manifest at top level). Updates: edit files, press the reload icon. New-tab pages pick up changes on next open.
- **Rollback:** toggle the extension off (instantly restores Chrome's default new tab) or remove it. No data to migrate or clean up in either direction — the extension stores nothing.
- **Monitoring / alerting:** none — single-user local software. Diagnostics: errors surface in the new-tab page's DevTools console; the error boundary logs the caught exception via `console.error` before rendering the empty state, so failures are inspectable but never user-hostile.
- **Perf verification (criterion #9):** a `performance.mark` pair around query→render, logged to console; measure 20 tab opens with a 50-bookmark folder and read the p95 by hand. Remove or leave — it's one line and satisfies the "instrumentation" clause.
- **Capacity:** 50 DOM anchors + 50 cached-image requests per tab open. Nothing to estimate.
- **Security posture:** MV3 default CSP (no inline script, no eval) is inherited by doing nothing special; titles via `textContent` only; two narrow permissions; zero network egress by construction.

## Out of Scope / Future Work

- **Live re-render of open new-tab pages** via `chrome.bookmarks` events — deferred: PRD explicitly requires freshness only on next tab open; adding listeners now buys nothing.
- **Options page** (custom folder name, cap, columns) — the PRD scopes these out; `selectHotlist`'s `opts` parameter leaves the seam so an options page later is additive, not a rewrite.
- **Keyboard navigation, search, frecency ranking, Web Store packaging, non-Chrome browsers** — all excluded by the PRD's Out of Scope list; nothing in this design forecloses them.
- **Icon assets** (`icons` manifest key) — cosmetic for a dev-mode install; add real icons only if the extension is ever packaged.

## Confirmed Assumptions

Both assumptions were confirmed by the requester on 2026-08-11; no open items remain.

1. **Exact, case-sensitive folder-name match** for `tabrc-hotlist` — confirmed. Rationale from requester: the folder name on screen matches exactly how it is named in Bookmarks, so exact matching is the least surprising behavior.
2. **Flat-mode reading order is down-then-across** (native multicol behavior) — confirmed, with the understanding that it can be switched to across-then-down later if it reads poorly in practice (one-line change; see Tradeoff Log).
