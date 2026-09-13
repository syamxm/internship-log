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
await submit({ "f-id": "", "f-date": "14-09-2026", "f-title": "Wrong date format", "f-category": "", "f-body": "", "f-tags": "", "f-remarks": "" });
assert.match(nodes.get("error").textContent, /date must be YYYY-MM-DD/, "the demo rejects a bad date with the server's message");
assert.ok(!nodes.get("items").innerHTML.includes("Wrong date format"), "and writes nothing");

await submit({ "f-id": "", "f-date": "2026-07-08", "f-title": "Wrote the deploy checklist", "f-category": "1st Week Intern", "f-body": "notes", "f-tags": "deploy", "f-remarks": "" });
assert.match(nodes.get("items").innerHTML, /Wrote the deploy checklist/, "a new entry lands in the list");

const saved = JSON.parse(storage.get("internship-log-demo"));
assert.equal(saved.length, 3, "the seed plus the new entry are persisted");
assert.equal(saved.at(-1).id, 3, "ids continue from the highest one stored");
assert.equal(saved.at(-1).tags, "deploy", "every field survives the round trip");

// Deleting goes through the same path, and what is left is what reloads.
await nodes.get("items").handlers.click({
  target: { closest: () => ({ dataset: { del: "3" } }) },
});
await new Promise((r) => setTimeout(r, 0));
assert.equal(JSON.parse(storage.get("internship-log-demo")).length, 2, "delete removes the row from storage");
assert.ok(!nodes.get("items").innerHTML.includes("Wrote the deploy checklist"), "and from the page");

console.log("demo build self-check passed");
