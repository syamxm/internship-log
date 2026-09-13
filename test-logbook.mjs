// Self-check for the logbook render: grouping, date format, escaping, empty
// state. Runs app.js against a stub DOM so no browser is needed.
//   node test-logbook.mjs
import assert from "node:assert/strict";

const el = () => ({
  handlers: {},
  innerHTML: "",
  textContent: "",
  value: "",
  hidden: false,
  dataset: {},
  classList: { toggle() {}, add() {}, remove() {} },
  setAttribute() {},
  focus() {},
  addEventListener(type, fn) {
    this.handlers[type] = fn;
  },
  scrollIntoView() {},
  reset() {},
});

const nodes = new Map();
globalThis.document = {
  getElementById: (id) => nodes.get(id) ?? nodes.set(id, el()).get(id),
  querySelector: (sel) => nodes.get(sel) ?? nodes.set(sel, el()).get(sel),
  body: el(),
};

const entries = [
  { id: 2, date: "2026-09-14", title: "Second week", category: "1st Week Intern", body: "b2", tags: "", remarks: "seen" },
  { id: 1, date: "2026-09-07", title: "Day <one>", category: "1st Day Intern", body: "b1", tags: "", remarks: "" },
];
globalThis.fetch = async () => ({ ok: true, json: async () => entries });

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
assert.ok(!feed.includes("style=\"--cat-color"), "no per-category colour is emitted any more");
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

console.log("logbook self-check passed");
