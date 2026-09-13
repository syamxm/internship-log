// Self-check for the demo build: no API, so app.js falls back to localStorage,
// says so on screen, and still validates what it writes.
//   node test-demo.mjs
import assert from "node:assert/strict";
import { install } from "./test-dom.mjs";

// A static host answers /api/entries with a 404 page: res.json() throws.
const { nodes, storage } = install({
  fetchImpl: async () => ({
    ok: false,
    json: async () => {
      throw new SyntaxError("Unexpected token '<'");
    },
  }),
});

await import("./public/app.js");
await new Promise((r) => setTimeout(r, 0));

assert.equal(nodes.get("demo-note").hidden, false, "the disclaimer is shown when there is no server");
assert.equal(nodes.get("stat-store").textContent, "localStorage", "the masthead stops claiming a SQLite file");
assert.match(nodes.get("foot-where").textContent, /demo/, "the footer says which build this is");

const seeded = nodes.get("items").innerHTML;
assert.match(seeded, /Traced a failing nightly job/, "the demo starts with something to read");
assert.ok(
  seeded.indexOf("Traced a failing nightly job") < seeded.indexOf("First day"),
  "the demo store sorts newest first, the way the server does"
);

const submit = async (fields) => {
  for (const [id, value] of Object.entries(fields)) document.getElementById(id).value = value;
  await nodes.get("form").handlers.submit({ preventDefault() {} });
  await new Promise((r) => setTimeout(r, 0));
};

// A bad date has to fail here exactly as it fails on the server.
nodes.get("new").handlers.click();
assert.equal(nodes.get("entry-dialog").open, true, "new entry opens a modal");
await submit({ "f-id": "", "f-date": "14-09-2026", "f-title": "Wrong date format", "f-category": "", "f-body": "", "f-tags": "", "f-remarks": "" });
assert.match(nodes.get("error").textContent, /date must be YYYY-MM-DD/, "the demo rejects a bad date with the server's message");
assert.equal(nodes.get("entry-dialog").open, true, "validation errors keep the modal open");
assert.ok(!nodes.get("items").innerHTML.includes("Wrong date format"), "and writes nothing");

await submit({ "f-id": "", "f-date": "2026-07-08", "f-title": "Wrote the deploy checklist", "f-category": "1st Week Intern", "f-body": "notes", "f-tags": "deploy", "f-remarks": "" });
assert.match(nodes.get("items").innerHTML, /Wrote the deploy checklist/, "a new entry lands in the list");
assert.equal(nodes.get("entry-dialog").open, false, "saving closes the modal");

const saved = JSON.parse(storage.get("internship-log-demo"));
assert.equal(saved.length, 3, "the seed plus the new entry are persisted");
assert.equal(saved.at(-1).id, 3, "ids continue from the highest one stored");
assert.equal(saved.at(-1).tags, "deploy", "every field survives the round trip");

await nodes.get("items").handlers.click({
  target: { closest: () => ({ dataset: { edit: "3" } }) },
});
assert.equal(nodes.get("entry-dialog").open, true, "editing uses the same modal");
assert.equal(nodes.get("f-title").value, "Wrote the deploy checklist", "editing fills the existing entry");
nodes.get("entry-dialog").handlers.cancel({ preventDefault() {} });
assert.equal(nodes.get("entry-dialog").open, false, "Escape closes the modal");
assert.equal(nodes.get("f-id").value, "", "closing clears the editing state");
nodes.get("new").handlers.click();
nodes.get("cancel").handlers.click();
assert.equal(nodes.get("entry-dialog").open, false, "the close button closes the modal");

// Deleting goes through the same path, and what is left is what reloads.
await nodes.get("items").handlers.click({
  target: { closest: () => ({ dataset: { del: "3" } }) },
});
await new Promise((r) => setTimeout(r, 0));
assert.equal(JSON.parse(storage.get("internship-log-demo")).length, 2, "delete removes the row from storage");
assert.ok(!nodes.get("items").innerHTML.includes("Wrote the deploy checklist"), "and from the page");

// Storage failures must keep the draft and report failure, never claim success.
localStorage.setItem = () => { throw new Error("storage blocked"); };
nodes.get("new").handlers.click();
await submit({ "f-id": "", "f-date": "2026-07-09", "f-title": "Unsaved draft" });
assert.equal(nodes.get("entry-dialog").open, true, "failed storage keeps the form open");
assert.equal(nodes.get("f-title").value, "Unsaved draft", "failed storage preserves the draft");
assert.match(nodes.get("error").textContent, /Could not save in this browser/);
assert.equal(JSON.parse(storage.get("internship-log-demo")).length, 2, "failed writes leave stored entries intact");
await nodes.get("items").handlers.click({
  target: { closest: () => ({ dataset: { del: "1" } }) },
});
assert.match(nodes.get("results").textContent, /could not delete entry:/, "failed deletion is reported");
assert.match(nodes.get("items").innerHTML, /First day/, "failed deletion leaves the entry visible");

console.log("demo build self-check passed");
