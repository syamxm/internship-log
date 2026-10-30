import assert from "node:assert/strict";
import { install } from "./test-dom.mjs";

const entries = [
  { id: 2, date: "2026-09-14", title: "Second week", category: "1st Week Intern", body: "b2", tags: "", remarks: "seen" },
  { id: 1, date: "2026-09-07", title: "Day <one>", category: "1st Day Intern", body: "b1", tags: "", remarks: "" },
];

const { nodes, storage: store } = install({
  fetchImpl: async () => ({ ok: true, json: async () => entries }),
});

const { missingDays } = await import("./public/app.js");
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
assert.equal((html.match(/class="sign"/g) ?? []).length, 2, "one signature row per period");
assert.ok(
  html.indexOf('class="sign"') > html.indexOf("07/09/2026") &&
    html.indexOf('class="sign"') < html.indexOf("1st Week Intern"),
  "the signature row closes its period, before the next heading"
);
assert.ok(!html.includes("<one>"), "titles are escaped before reaching innerHTML");
assert.equal(nodes.get("book-empty").hidden, true, "empty state hidden when rows exist");

assert.equal(nodes.get("book-table").hidden, false, "table shown when rows exist");
assert.match(nodes.get("book-summary").textContent, /2 entries across 2 periods/, "summary counts what prints");
assert.match(html, /data-book-edit="1"/, "each row offers a way back into the form");

const feed = nodes.get("items").innerHTML;
assert.match(feed, /class="row-date"[^>]*>Mon 07 Sep</, "the feed puts the weekday and date in the gutter");
nodes.get("tab-book").handlers.click();
assert.equal(nodes.get("view-log").hidden, true, "log panel hides when the logbook opens");
assert.equal(nodes.get("view-book").hidden, false, "logbook panel shows when its tab is picked");
nodes.get("tab-log").handlers.click();
assert.equal(nodes.get("view-book").hidden, true, "logbook hides again on the way back");

nodes.get(".views").handlers.keydown({ key: "ArrowRight", preventDefault() {} });
assert.equal(nodes.get("view-book").hidden, false, "ArrowRight opens the logbook");
nodes.get(".views").handlers.keydown({ key: "ArrowLeft", preventDefault() {} });
assert.equal(nodes.get("view-log").hidden, false, "ArrowLeft returns to the log");

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

const fri = new Date(2026, 9, 30, 15, 0);
assert.deepEqual(missingDays([{ date: "2026-10-30" }], fri), [], "one entry logs the whole week");
assert.deepEqual(missingDays([{ date: "2026-10-23" }], fri).length, 5, "last week's entry does not log this week");
assert.deepEqual(missingDays([], new Date(2026, 9, 27, 9, 0)), ["2026-10-26", "2026-10-27"], "days after today are not missed yet");
assert.equal(missingDays([], new Date(2026, 10, 1)).length, 5, "weekends never count as missed");

assert.equal(nodes.get("gaps").hidden, false, "missed days show above the feed");
assert.match(nodes.get("gaps").innerHTML, /data-gap="\d{4}-\d{2}-\d{2}"/, "each missed day is a button");
const gap = missingDays(entries, new Date())[0];
nodes.get("gaps").handlers.click({ target: { closest: () => ({ dataset: { gap } }) } });
assert.equal(nodes.get("entry-dialog").open, true, "a missed day opens a new entry");
assert.equal(nodes.get("f-date").value, gap, "dated that day");
assert.equal(nodes.get("f-category").value, "1st Week Intern", "in the latest period");
nodes.get("cancel").handlers.click();

assert.match(nodes.get("book-remarks").textContent, /1 day has no typed remarks/, "the logbook counts blank remarks before printing");

const key = (k, extra = {}) =>
  document.handlers.keydown({ key: k, target: { matches: () => false }, preventDefault() {}, ...extra });
key("n");
assert.equal(nodes.get("entry-dialog").open, true, "n opens a new entry");
nodes.get("cancel").handlers.click();
key("n", { ctrlKey: true });
assert.equal(nodes.get("entry-dialog").open, false, "Ctrl+N stays the browser's");
key("n", { target: { matches: () => true } });
assert.equal(nodes.get("entry-dialog").open, false, "typing n in a field types n");
nodes.get("tab-book").handlers.click();
key("/");
assert.equal(nodes.get("view-log").hidden, false, "/ returns to the log");
assert.equal(nodes.get("search").focused, true, "and focuses search");

let sent = false;
nodes.get("form").handlers.submit = () => { sent = true; };
nodes.get("form").handlers.keydown({ key: "Enter", ctrlKey: true, preventDefault() {} });
assert.ok(sent, "Ctrl+Enter saves the form");

console.log("logbook self-check passed");
