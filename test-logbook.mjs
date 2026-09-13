// Self-check for the logbook render: grouping, date format, escaping, empty
// state. Runs app.js against a stub DOM so no browser is needed.
//   node test-logbook.mjs
import assert from "node:assert/strict";
import { install } from "./test-dom.mjs";

const entries = [
  { id: 2, date: "2026-09-14", title: "Second week", category: "1st Week Intern", body: "b2", tags: "", remarks: "seen" },
  { id: 1, date: "2026-09-07", title: "Day <one>", category: "1st Day Intern", body: "b1", tags: "", remarks: "" },
];

const { nodes, storage: store } = install({
  fetchImpl: async () => ({ ok: true, json: async () => entries }),
});

await import("./public/app.js");
await new Promise((r) => setTimeout(r, 0));

const html = nodes.get("book-body").innerHTML;
assert.match(html, /07\/09\/2026/, "dates render DD/MM/YYYY");
assert.ok(
  html.indexOf("07/09/2026") < html.indexOf("14/09/2026"),
  "logbook prints oldest first even though the API returns newest first"
);
assert.ok(
  html.indexOf("1st Day Intern") < html.indexOf("07/09/2026"),
  "period heading row comes before the rows it covers"
);
assert.equal((html.match(/class="period"/g) ?? []).length, 2, "one heading row per period");
assert.ok(!html.includes("<one>"), "titles are escaped before reaching innerHTML");
assert.equal(nodes.get("book-empty").hidden, true, "empty state hidden when rows exist");

assert.equal(nodes.get("book-table").hidden, false, "table shown when rows exist");
assert.match(nodes.get("book-summary").textContent, /2 entries across 2 periods/, "summary counts what prints");
assert.match(html, /data-book-edit="1"/, "each row offers a way back into the form");

const feed = nodes.get("items").innerHTML;
assert.match(feed, /class="row-date"[^>]*>07 Sep</, "the feed puts a short date in the gutter");
// The reported bug: switching to the logbook left the log panel on screen.
nodes.get("tab-book").handlers.click();
assert.equal(nodes.get("view-log").hidden, true, "log panel hides when the logbook opens");
assert.equal(nodes.get("view-book").hidden, false, "logbook panel shows when its tab is picked");
nodes.get("tab-log").handlers.click();
assert.equal(nodes.get("view-book").hidden, true, "logbook hides again on the way back");

// Arrow keys move between the two tabs, the standard tablist behaviour.
nodes.get(".views").handlers.keydown({ key: "ArrowRight", preventDefault() {} });
assert.equal(nodes.get("view-book").hidden, false, "ArrowRight opens the logbook");
nodes.get(".views").handlers.keydown({ key: "ArrowLeft", preventDefault() {} });
assert.equal(nodes.get("view-log").hidden, false, "ArrowLeft returns to the log");

// Skins: the house style is dark by definition and hides the mode toggle, the
// desktop skins keep a mode and remember both halves of the choice.
const html_ = document.documentElement;
assert.equal(html_.dataset.theme, "syam", "first visit lands on the house style");
assert.equal(html_.dataset.mode, "dark", "the house style is dark whatever the system says");
assert.equal(nodes.get("skin-mode").hidden, true, "no light/dark toggle on the house style");

nodes.get("skin-theme").handlers.change({ target: { value: "nothing" } });
assert.equal(html_.dataset.theme, "nothing", "picking a skin writes it to the root element");
assert.equal(html_.dataset.mode, "light", "a desktop skin follows the system preference first");
assert.equal(nodes.get("skin-mode").hidden, false, "the desktop skins get a mode toggle");

nodes.get("skin-mode").handlers.click();
assert.equal(html_.dataset.mode, "dark", "the toggle flips the mode");
assert.equal(store.get("skin-mode"), "dark", "and the mode survives a reload");
assert.equal(store.get("skin-theme"), "nothing", "so does the skin");

nodes.get("skin-theme").handlers.change({ target: { value: "syam" } });
assert.equal(html_.dataset.mode, "dark", "back on the house style the mode is forced dark");
assert.equal(store.get("skin-mode"), "dark", "without overwriting the mode the skins remember");

console.log("logbook self-check passed");
