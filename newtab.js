import { selectHotlist, EMPTY_VIEW } from "./hotlist.js";
import { render } from "./render.js";

// Module scripts run deferred, so the DOM is fully parsed by now.
const mainEl = document.getElementById("hotlist");

async function buildPage() {
  performance.mark("tabrc-start");
  try {
    const rootNodes = await chrome.bookmarks.getTree();
    render(selectHotlist(rootNodes), mainEl);
  } catch (error) {
    // Single error boundary: any failure shows the guidance message, never a
    // blank page (PRD criterion #11).
    console.error("tabrc: failed to build hot list", error);
    render(EMPTY_VIEW, mainEl);
  }
  performance.mark("tabrc-end");
  const measure = performance.measure("tabrc-query-to-render", "tabrc-start", "tabrc-end");
  console.log(`tabrc: query→render ${measure.duration.toFixed(1)}ms`);
}

buildPage();
