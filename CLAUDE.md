# CLAUDE.md

Chrome MV3 extension that overrides the new-tab page with a bookmark hot list
sourced from a Chrome bookmarks folder named `tabrc-hotlist`.

## Ground rules

- **No build step, no dependencies, no framework.** The repo root IS the
  unpacked extension. Plain HTML/CSS/JS (ES modules). Keep it that way unless a
  spec says otherwise. The Gradle script is *packaging only* — it zips the
  existing files for the Web Store and never transforms them. Nothing in the
  extension may come to depend on having run it.
- **Zero network egress** is a hard product guarantee (PRD criterion #7).
  Favicons come only from Chrome's `_favicon/` endpoint. Never add remote
  fetches, CDNs, or analytics.
- **No storage, no background worker, no listeners.** Freshness is achieved by
  re-querying `chrome.bookmarks.getTree()` on every page load. Don't add
  caching or `chrome.bookmarks.on*` listeners; that's a deliberate design
  decision (see tradeoff log in the tech spec).
- **XSS discipline:** bookmark titles are untrusted — assign via `textContent`
  only; URLs only to `href`/`src`. No HTML string interpolation anywhere.
- Permissions stay exactly `["bookmarks", "favicon"]` (PRD criterion #12).

## Layout

| Path | Role |
|---|---|
| `manifest.json` | MV3 manifest; new-tab override |
| `newtab.html` | Static shell: empty `<main>` + `<template>` nodes |
| `newtab.js` | Entry point; the single runtime error boundary (any failure → empty-state message, never a blank page) |
| `hotlist.js` | **Pure** selection logic: bookmark tree in, view model out. No Chrome APIs, no DOM — must stay runnable in plain Node for tests |
| `render.js` | View model → DOM via template clones; builds `_favicon` URLs |
| `newtab.css` | Flat mode = full-width multicol; grouped mode = wrapping flex columns. All layout knobs are `:root` custom properties — see below |
| `features/` | PRDs (product specs) |
| `specs/` | Tech specs |
| `build.gradle` | Web Store packaging only (`gradle package`) — see below |
| `settings.gradle` | Roots the Gradle project here so it doesn't search parent dirs |

### Layout knobs (`:root` in `newtab.css`)

Tune these rather than editing the rules that consume them:

| Property | Current | Effect |
|---|---|---|
| `--column-width` | `250px` | Grouped columns are `flex: 0 0` this width — fixed, no grow/shrink |
| `--column-gap` | `50px` | Horizontal space between columns (both modes) |
| `--row-gap` | `45px` | Vertical space when grouped columns wrap to a second row |
| `--content-anchor` | `40vh` | Where the vertical midpoint of the content block sits |
| `--max-columns` | `3` | Grouped columns per row before wrapping (grouped mode only) |
| `--page-padding-x` | `32px` | `main`'s horizontal padding; folded into the grouped-mode `max-width` |

Three mechanics worth knowing before touching this:

- **Vertical anchoring.** `main` is `min-height: 100vh` with `box-sizing:
  border-box`, and each mode centers its content inside main's *content* box.
  The extra bottom padding (`calc(24px + 100vh - 2 * var(--content-anchor))`)
  shrinks that box from the bottom, moving the midpoint from 50vh to the
  anchor. Values above `50vh` invert the math — keep it ≤ 50vh.
- **The 3-column cap is a container width, not a grid template.** Grouped mode
  stays a wrapping flex row; `main` is capped at `--max-columns` columns wide
  (plus gaps, plus `2 * --page-padding-x` because of `border-box`), which is
  what forces the wrap independent of viewport width. `justify-content: center`
  then centers a partial row — the leftover column lands in the middle and
  further ones spread to the sides. A real `grid-template-columns` would
  left-align that last row instead.
- **Fixed width is grouped-mode only.** Flat mode is CSS multicol, where
  `column-width` is a *minimum*: columns stretch to fill the viewport. Pinning
  flat columns to an exact width would require constraining the container to a
  computed multiple, which needs JS — deliberately not done.

## Behavior invariants (from the PRD — don't change casually)

- Source folder: first folder titled exactly `tabrc-hotlist` (case-sensitive)
  in DFS pre-order of the bookmark tree.
- Any sub-folder present ⇒ grouped mode: one labeled column per non-empty
  sub-folder; direct-child bookmarks ignored entirely. No sub-folders ⇒ flat
  multicol list of direct children. Nesting deeper than one level ignored.
- Global cap of 50 entries, truncated in traversal order across groups.
- Empty/missing folder ⇒ guidance message (rendered from `#empty-template`).
- Entries are real `<a>` anchors with no click handlers (modifier-key behavior
  must stay native).

## Workflow

- **Run it:** `chrome://extensions` → Developer mode → Load unpacked → repo
  root. After edits, hit the reload icon there; new tabs pick up changes.
- **Sanity-check logic without Chrome:** `hotlist.js` is import-safe in Node
  (copy to `.mjs` or use `--input-type=module`); feed it hand-built trees.
- **Package it:** `gradle package` → `build/distributions/tabrc-<version>.zip`,
  ready to upload to the Web Store. Requires a locally installed Gradle (there
  is no wrapper). Three things to know before touching `build.gradle`:
  - The zip's file list is an **explicit allowlist** of runtime files, not an
    exclude list — so docs, `.git`, and the build script can't leak into an
    upload. **Adding a new runtime file means adding it to `runtimeFiles`**, or
    it silently won't ship.
  - `version` is parsed out of `manifest.json`, so the manifest stays the only
    place a version is bumped.
  - Archives are reproducible (`preserveFileTimestamps = false`), which is why
    zip entries show a 1980 timestamp. That's expected, not a clock bug.
- **Docs flow:** product changes go through a PRD in `features/`, then a tech
  spec in `specs/` (filenames `YYYY-MM-DD-<idea>.md`), then implementation.
  Update the relevant doc when behavior changes.
- Perf instrumentation (`performance.mark` in `newtab.js`) logs
  query→render time to the console; PRD budget is <200ms p95, actual is ~ms.

## Known deferred items

- Icons (`icons/` + manifest `"icons"` key) — required only if publishing to
  the Chrome Web Store, which is currently out of scope. `gradle package` warns
  about the missing `"icons"` key and packages `icons/` automatically once the
  directory exists.
- Flat-mode reading order is down-then-across (multicol). If it ever feels
  wrong, the agreed fallback is a grid with `grid-auto-flow: row` — one-line
  change in `newtab.css`.
- No unit test suite yet; when one is added, it targets `selectHotlist()` in
  `hotlist.js`.
