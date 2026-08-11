// Pure selection logic: bookmark tree in, view model out. No Chrome APIs —
// this module must stay importable outside an extension context for testing.

export const DEFAULT_FOLDER_NAME = "tabrc-hotlist";
export const DEFAULT_CAP = 50;

export const EMPTY_VIEW = Object.freeze({ mode: "empty", groups: [] });

/**
 * Derives the hot-list view model from the bookmark tree.
 *
 * @param {Array<object>} rootNodes  Result of chrome.bookmarks.getTree().
 * @param {{folderName?: string, cap?: number}} [opts]
 * @returns {{mode: "flat"|"grouped"|"empty", groups: Array<{heading: string|null, entries: Array<{title: string, url: string}>}>}}
 */
export function selectHotlist(rootNodes, opts = {}) {
  const folderName = opts.folderName ?? DEFAULT_FOLDER_NAME;
  const cap = opts.cap ?? DEFAULT_CAP;

  const hotlistFolder = findFirstFolderByTitle(rootNodes, folderName);
  if (!hotlistFolder) {
    return EMPTY_VIEW;
  }

  const subFolders = childrenOf(hotlistFolder).filter(isFolder);
  const grouped = subFolders.length > 0;

  const groups = grouped
    ? subFolders.map((folder) => ({
        heading: folder.title,
        entries: directChildEntries(folder),
      }))
    : [{ heading: null, entries: directChildEntries(hotlistFolder) }];

  const cappedGroups = capTotalEntries(groups, cap).filter(
    (group) => group.entries.length > 0
  );

  if (cappedGroups.length === 0) {
    return EMPTY_VIEW;
  }

  return { mode: grouped ? "grouped" : "flat", groups: cappedGroups };
}

// Depth-first pre-order, children in array order — this defines "first in
// standard tree traversal" for duplicate folder names (exact, case-sensitive).
function findFirstFolderByTitle(nodes, title) {
  for (const node of childListOf(nodes)) {
    if (isFolder(node) && node.title === title) {
      return node;
    }
    const match = findFirstFolderByTitle(node.children, title);
    if (match) {
      return match;
    }
  }
  return null;
}

function directChildEntries(folder) {
  return childrenOf(folder)
    .filter(isBookmark)
    .map((node) => ({
      title: node.title !== "" ? node.title : node.url,
      url: node.url,
    }));
}

function capTotalEntries(groups, cap) {
  let remaining = cap;
  return groups.map((group) => {
    const entries = group.entries.slice(0, Math.max(remaining, 0));
    remaining -= entries.length;
    return { heading: group.heading, entries };
  });
}

function childrenOf(node) {
  return childListOf(node && node.children);
}

// Unexpected node shapes are skipped, never fatal.
function childListOf(value) {
  return Array.isArray(value) ? value.filter(isNode) : [];
}

function isNode(value) {
  return typeof value === "object" && value !== null;
}

function isFolder(node) {
  return node.url === undefined;
}

function isBookmark(node) {
  return typeof node.url === "string" && node.url !== "";
}
