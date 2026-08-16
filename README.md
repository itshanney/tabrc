# tabrc

A Chrome extension that replaces the new-tab page with a hot list of your favorite bookmarks — the 30–50 links you actually use, one click away every time you open a tab.

No search box, no feed, no accounts, no network. Just your bookmarks, loaded instantly from a folder you control.

## Install

The extension isn't on the Chrome Web Store; you load it directly from this folder:

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select this repository's folder.
5. Open a new tab (⌘T / Ctrl+T) — tabrc is now your new-tab page.

## Set up your hot list

1. Open Chrome's Bookmark Manager (⌥⌘B / Ctrl+Shift+O).
2. Create a folder named exactly **`tabrc-hotlist`** (case-sensitive). It can live anywhere — the Bookmarks Bar, Other Bookmarks, or inside another folder.
3. Put bookmarks in it. That's it — the next new tab you open shows them.

Everything is managed from the Bookmark Manager: add, remove, rename, or drag to reorder there, and the page updates the next time you open a tab. The page shows up to 50 bookmarks.

### Two layouts, chosen automatically

- **Flat list** — if `tabrc-hotlist` contains only bookmarks, they flow across the full width of the page in the order you keep them.
- **Grouped columns** — if `tabrc-hotlist` contains sub-folders, each sub-folder becomes a labeled column (the folder name is the heading). In this mode, only the sub-folders are shown — bookmarks sitting directly in `tabrc-hotlist` are ignored, so commit to one style or the other. Folders nested deeper than one level are ignored.

Either way the list sits a little above the middle of the screen, roughly where your eyes land when a tab opens. Grouped columns are a fixed width and laid out three across, centered as a block; a fourth folder starts a second row. A row that isn't full is centered, so a leftover column sits in the middle and later ones fan out to the sides.

Each entry shows the site's icon from Chrome's local cache; sites you haven't visited yet get a generic icon until Chrome caches theirs.

## Privacy

tabrc makes zero network requests. It reads your bookmarks locally to display them, uses Chrome's locally cached favicons, stores nothing, and sends nothing anywhere. Its only permissions are bookmark access, favicon access, and the new-tab override.

## Uninstall / pause

- **Pause:** toggle tabrc off in `chrome://extensions` — Chrome's default new-tab page returns instantly.
- **Remove:** click **Remove** in `chrome://extensions`. Your bookmarks are untouched either way; tabrc never modifies them.

## Troubleshooting

- **"Your hot list is empty" message** — the `tabrc-hotlist` folder doesn't exist yet, is spelled or capitalized differently, or contains no bookmarks (or only empty sub-folders).
- **A bookmark is missing** — in grouped mode, bookmarks placed directly in `tabrc-hotlist` (outside any sub-folder) aren't shown; move them into a sub-folder. Beyond 50 bookmarks, the rest are cut off.
- **Changes not showing** — changes appear on the next new tab you open; already-open tabs don't refresh themselves.
- **Long bookmark names are cut off** — titles are trimmed to fit the column. Either rename the bookmark to something shorter, or widen the columns (see below).

## Tweak the look

Since you loaded the extension from a folder you control, you can edit it. The layout settings live at the top of `newtab.css`:

```css
:root {
  --column-width: 250px;  /* how wide each column is */
  --column-gap: 50px;     /* space between columns */
  --row-gap: 24px;        /* space between rows, when columns wrap */
  --content-anchor: 40vh; /* how high on the screen the list sits; 50vh = dead center */
  --max-columns: 3;       /* columns per row before wrapping to the next one */
}
```

Change a value, then click the reload icon on the tabrc card in `chrome://extensions` and open a new tab. Text size is the `font-size` on the `body` rule just below. Keep `--content-anchor` at 50vh or lower.
