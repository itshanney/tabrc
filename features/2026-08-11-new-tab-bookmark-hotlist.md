# New Tab Bookmark Hot List (Chrome Extension)

**Date:** 2026-08-11
**Status:** Final — all open questions resolved 2026-08-11; ready for technical design
**Requested by:** Justin Hanney

## Problem Statement

Chrome's default new-tab page surfaces content the user did not choose (search box, promoted shortcuts, feed). The user opens new tabs many times a day and wants that moment to land on the links they actually use — a curated "hot list" of their 30–50 most important bookmarks. Today, reaching a bookmark requires opening the bookmarks bar, a folder, or the bookmark manager, which adds friction to the most common navigation action in the browser.

## Proposed Solution

A Chrome extension that replaces the browser's new-tab page with a single, self-contained HTML page displaying up to 50 of the user's bookmarks, sourced from a designated Chrome bookmarks folder named **`tabrc-hotlist`**. Each entry shows the bookmark's locally cached favicon and title, and links to its URL. The page loads instantly, works offline, and involves no external services. The user curates the list entirely through Chrome's native bookmark manager: what is in the folder is what appears on the page.

The page has two mutually exclusive rendering modes, chosen automatically by the folder's structure:

- **Flat mode** — `tabrc-hotlist` contains no sub-folders: its direct child bookmarks render as one list flowed across multiple columns spanning the full viewport width, in stored order.
- **Grouped mode** — `tabrc-hotlist` contains one or more sub-folders: each sub-folder renders as a labeled column (folder name as heading, its bookmarks beneath, in stored order), and **direct child bookmarks of `tabrc-hotlist` are ignored entirely**. Sub-folders are exclusive: their presence replaces the flat list.

This is a personal-use, unpublished (developer-mode / local install) extension unless stated otherwise.

## User Stories

1. As the browser user, I want every new tab to show my bookmark hot list instead of Chrome's default page, so that my most-used destinations are one click away.
2. As the browser user, I want the list to reflect my actual Chrome bookmarks, so that I do not have to maintain a second, separate list by hand.
3. As the browser user, I want the page to render immediately with no network dependency, so that opening a tab never feels slower than the stock new-tab page.
4. As the browser user, I want each entry to open in the current tab when clicked (standard link behavior, with Cmd/Ctrl-click opening a background tab as usual), so that navigation behaves the way links normally do.
5. As the browser user, I want the list capped at a bounded count (30–50), so that the page stays scannable rather than becoming a dump of every bookmark I have.

## Acceptance Criteria

All criteria are pass/fail as written.

1. With the extension installed and enabled, opening a new tab (Cmd/Ctrl+T, the "+" button, or `chrome://newtab`) displays the extension's page instead of Chrome's default new-tab page.
2. When `tabrc-hotlist` contains no sub-folders (flat mode), the page displays exactly its direct child bookmarks, in stored order; no other bookmarks appear.
3. When `tabrc-hotlist` contains at least one sub-folder (grouped mode), the page displays one labeled column per non-empty sub-folder — the sub-folder's name as its heading and its direct child bookmarks beneath, in stored order — and displays none of the direct child bookmarks of `tabrc-hotlist`. Folders nested deeper than one level below `tabrc-hotlist` are ignored.
4. The page displays at most **50** bookmark entries in total across the page; entries beyond 50 (in stored traversal order) are truncated. If fewer qualify, all are shown.
5. Each displayed entry shows the bookmark's locally cached favicon (or a generic placeholder when Chrome has none cached) and its title, and clicking it navigates the current tab to the bookmark's URL.
6. Cmd/Ctrl-clicking an entry opens the URL in a new background tab (i.e., entries are real anchor links, not JavaScript click handlers that break modifier keys).
7. The page makes zero network requests to origins other than the sites the user navigates to by clicking (verify via DevTools Network panel on page load: no external requests). Favicons come only from Chrome's local favicon cache.
8. Adding, removing, renaming, or re-ordering a bookmark or sub-folder inside `tabrc-hotlist` in Chrome — including changes that switch the page between flat and grouped mode — is reflected on the page no later than the next new tab opened after the change (no manual refresh/rebuild step).
9. Time from tab open to the list being visible and clickable is under 200 ms at p95 on the user's machine with 50 entries (measure via DevTools Performance or `performance.now()` instrumentation across 20 trials).
10. The layout uses the full viewport width (columns distribute across it; no single narrow column with dead space beside it). At a window size of 1440×900 or larger with 50 entries, all entries are visible without any scrolling. Horizontal scrolling never occurs at window widths from 800 px to 2560 px; at windows too short to fit all entries, the page scrolls vertically only.
11. If the `tabrc-hotlist` folder does not exist, or yields zero displayable bookmarks (empty in flat mode, or all sub-folders empty in grouped mode), the page renders a message explaining that bookmarks placed in a folder named `tabrc-hotlist` will appear here — not a blank page or an error. Empty sub-folders are omitted rather than rendered as empty columns.
12. The extension requests only the Chrome permissions strictly required for the above; installing it prompts for nothing beyond bookmark access, favicon access, and new-tab override.

## Out of Scope

- Search box, address-bar-like input, or filtering on the page.
- Automatic ranking by visit frequency/recency ("frecency"), history analysis, or any use of browsing history.
- Editing, adding, or deleting bookmarks from the page (read-only view; management stays in Chrome's native UI).
- Options/settings page, theming controls, or user-configurable layout.
- Folder nesting deeper than one level below `tabrc-hotlist` (sub-sub-folders and their contents are ignored).
- Remote favicon fetching or any third-party service integration.
- Sync of any extension-specific state across machines (Chrome's own bookmark sync is untouched and sufficient).
- Publishing to the Chrome Web Store (listing assets, review process, privacy policy).
- Support for browsers other than desktop Chrome (Firefox, Edge, Safari, mobile).
- Keyboard-shortcut navigation of the list (e.g., pressing 1–9 to jump).

## Resolved Decisions

1. **Hot-list source (decided 2026-08-11):** the direct children of a Chrome bookmarks folder named **`tabrc-hotlist`**, in stored order. The folder may live anywhere in the bookmark tree (Bookmarks Bar, Other Bookmarks, etc.); if multiple folders share the name, the first one found in a standard tree traversal is used. Curation and ordering happen exclusively in Chrome's native bookmark manager.
2. **Cap N = 50.** The user controls the real count via the folder's contents; entries past 50 are truncated.
3. **Favicons (decided 2026-08-11):** shown next to each title, sourced exclusively from Chrome's local favicon cache — no network fetches.
4. **Layout (decided 2026-08-11):** the page maximizes horizontal use of the screen so entries fit without scrolling (see criterion #10 for the testable form).
5. **Sub-folders are exclusive (decided 2026-08-11):** if `tabrc-hotlist` contains any sub-folders, the page renders only those sub-folders — one labeled column per sub-folder — and ignores the direct child bookmarks of `tabrc-hotlist`. With no sub-folders, the page is a flat multi-column list of direct children. Nesting deeper than one level is ignored.

## Open Questions

None. All questions raised in drafting were resolved on 2026-08-11 and recorded above.

## Dependencies

- Google Chrome (desktop) with extension developer mode available for local install.
- Chrome extension platform capabilities: new-tab page override and read access to the user's bookmarks. (Both are standard, stable platform features; no third-party APIs, teams, or services involved.)
- A bookmarks folder named `tabrc-hotlist` created by the user (the empty/missing-folder state is handled per criterion #10, so this is not a hard blocker).
