import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PORT = process.env.PORT || 4173;
const ROOT = new URL(".", import.meta.url).pathname;

const db = new DatabaseSync(join(ROOT, "log.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'work',
    body TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const list = db.prepare("SELECT * FROM entries ORDER BY date DESC, id DESC");
const insert = db.prepare(
  "INSERT INTO entries (date, title, category, body, tags) VALUES (?, ?, ?, ?, ?)"
);
const update = db.prepare(
  "UPDATE entries SET date = ?, title = ?, category = ?, body = ?, tags = ? WHERE id = ?"
);
const remove = db.prepare("DELETE FROM entries WHERE id = ?");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

const json = (res, code, data) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 1e6) reject(new Error("body too large"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        reject(new Error("invalid JSON"));
      }
    });
  });

// date required as YYYY-MM-DD, title non-empty; everything else defaults to "".
const clean = (b) => {
  const date = String(b.date ?? "").trim();
  const title = String(b.title ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date must be YYYY-MM-DD");
  if (!title) throw new Error("title required");
  return [
    date,
    title.slice(0, 200),
    String(b.category ?? "work").trim().slice(0, 40) || "work",
    String(b.body ?? "").slice(0, 20000),
    String(b.tags ?? "").trim().slice(0, 200),
  ];
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  if (path.startsWith("/api/entries")) {
    const id = Number(path.split("/")[3]);
    try {
      if (req.method === "GET") return json(res, 200, list.all());
      if (req.method === "POST") {
        const info = insert.run(...clean(await readBody(req)));
        return json(res, 201, { id: Number(info.lastInsertRowid) });
      }
      if (req.method === "PUT" && id) {
        update.run(...clean(await readBody(req)), id);
        return json(res, 200, { id });
      }
      if (req.method === "DELETE" && id) {
        remove.run(id);
        return json(res, 200, { id });
      }
      return json(res, 405, { error: "method not allowed" });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  // static: normalize kills ../ traversal, then everything is served from public/
  const rel = normalize(path === "/" ? "/index.html" : path).replace(/^(\.\.[/\\])+/, "");
  try {
    const file = await readFile(join(ROOT, "public", rel));
    res.writeHead(200, { "content-type": MIME[extname(rel)] ?? "application/octet-stream" });
    res.end(file);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  }
});

server.listen(PORT, "127.0.0.1", () =>
  console.log(`internship-log → http://127.0.0.1:${PORT}`)
);
