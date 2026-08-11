// View model → DOM. Titles are user data: only ever assigned via textContent;
// URLs only ever assigned to href/src attributes. No HTML string interpolation.

const FAVICON_SIZE = "32"; // 2x the 16px CSS size, for crisp 2x displays

export function render(view, mainEl) {
  mainEl.textContent = "";
  mainEl.dataset.mode = view.mode;

  if (view.mode === "empty") {
    mainEl.append(cloneTemplate("empty-template"));
    return;
  }

  const fragment = document.createDocumentFragment();
  if (view.mode === "flat") {
    fragment.append(buildEntryList(view.groups[0].entries));
  } else {
    for (const group of view.groups) {
      fragment.append(buildGroup(group));
    }
  }
  mainEl.append(fragment);
}

function buildGroup(group) {
  const section = cloneTemplate("group-template");
  section.querySelector(".group-heading").textContent = group.heading;
  section
    .querySelector(".group-entries")
    .replaceWith(buildEntryList(group.entries));
  return section;
}

function buildEntryList(entries) {
  const list = document.createElement("ul");
  list.className = "group-entries";
  for (const entry of entries) {
    list.append(buildEntry(entry));
  }
  return list;
}

function buildEntry(entry) {
  const item = cloneTemplate("entry-template");
  const link = item.querySelector(".entry-link");
  link.href = entry.url;
  item.querySelector(".entry-favicon").src = faviconUrl(entry.url);
  item.querySelector(".entry-title").textContent = entry.title;
  return item;
}

function faviconUrl(pageUrl) {
  return (
    chrome.runtime.getURL("/_favicon/") +
    "?pageUrl=" +
    encodeURIComponent(pageUrl) +
    "&size=" +
    FAVICON_SIZE
  );
}

function cloneTemplate(templateId) {
  const template = document.getElementById(templateId);
  if (!template) {
    throw new Error(`tabrc: missing template #${templateId}`);
  }
  return template.content.firstElementChild.cloneNode(true);
}
