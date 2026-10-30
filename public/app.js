import { clean } from "./clean.js";

const $ = (id) => document.getElementById(id);
let entries = [];
let activeCategory = null;
let expanded = new Set();
let deleted = null;
const DRAFT_KEY = "entry-draft";
const DRAFT_FIELDS = ["f-category", "f-title", "f-body", "f-tags", "f-remarks"];

const isoDay = (d) => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const missingDays = (entries, today) => {
  const logged = new Set(entries.map((e) => e.date));
  const monday = today.getDate() - ((today.getDay() + 6) % 7);
  const week = [];
  for (let i = 0; i < 5; i++) {
    const day = new Date(today.getFullYear(), today.getMonth(), monday + i);
    if (day <= today) week.push(isoDay(day));
  }
  return week.some((d) => logged.has(d)) ? [] : week;
};

const serverApi = async (method, path = "", body) => {
  const res = await fetch(`/api/entries${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "request failed");
  return data;
};

const DEMO_KEY = "internship-log-demo";
let demo = false;

const DEMO_SEED = [
  {
    id: 1,
    date: "2026-07-06",
    title: "First day, access and orientation",
    category: "1st Week Intern",
    body: "Collected the laptop, got added to the internal GitLab group and the deployment channel. Spent the afternoon reading the runbook for the billing service, which is the thing I will be working on.",
    tags: "onboarding, gitlab",
    remarks: "",
  },
  {
    id: 2,
    date: "2026-07-07",
    title: "Traced a failing nightly job",
    category: "1st Week Intern",
    body: "The nightly reconciliation job had been red for four days. It was a timezone assumption: the cron runs in UTC, the report window was written in local time, so every run before 08:00 read an empty range. Filed the fix and wrote the test that catches it.",
    tags: "cron, timezones, bug",
    remarks: "Good catch. Walk the team through it on Monday.",
  },
];

const demoAll = () => {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    return raw ? JSON.parse(raw) : DEMO_SEED;
  } catch {
    return DEMO_SEED;
  }
};

const demoSave = (rows) => {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(rows));
  } catch {
    throw new Error("Could not save in this browser. Allow site storage and try again.");
  }
};

const demoApi = (method, path = "", body) => {
  const id = Number(path.split("/")[1]);
  const rows = demoAll();

  if (method === "GET") {
    return [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  }
  if (method === "POST") {
    const next = rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
    demoSave([...rows, { id: next, ...clean(body) }]);
    return { id: next };
  }
  if (method === "PUT" && id) {
    demoSave(rows.map((r) => (r.id === id ? { id, ...clean(body) } : r)));
    return { id };
  }
  if (method === "DELETE" && id) {
    demoSave(rows.filter((r) => r.id !== id));
    return { id };
  }
  throw new Error("method not allowed");
};

function enterDemo() {
  demo = true;
  $("demo-note").hidden = false;
  $("stat-store").textContent = "localStorage";
  $("foot-where").textContent = "internship-log, demo build";
  $("foot-stack").textContent = "stored in this browser";
}

const api = async (method, path = "", body) => {
  if (demo) return demoApi(method, path, body);
  try {
    return await serverApi(method, path, body);
  } catch (err) {
    if (!(err instanceof TypeError || err instanceof SyntaxError)) throw err;
    enterDemo();
    return demoApi(method, path, body);
  }
};

const load = async () => {
  $("results").textContent = "loading entries";
  try {
    entries = await api("GET");
    render();
  } catch (err) {
    entries = [];
    render();
    $("results").textContent = `could not load entries: ${err.message}`;
    $("empty").hidden = true;
    $("book-empty").hidden = false;
    $("book-empty").textContent = `Could not load entries: ${err.message}`;
  }
};

function render() {
  const query = $("search").value.trim().toLowerCase();
  $("clear").hidden = !query;

  const cats = [...new Set(entries.map((e) => e.category))].sort();
  $("stat-entries").textContent = entries.length;
  $("unit-entries").textContent = entries.length === 1 ? "entry" : "entries";
  $("stat-categories").textContent = cats.length;
  $("unit-periods").textContent = cats.length === 1 ? "period" : "periods";
  $("categories").innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join("");

  if (activeCategory && !cats.includes(activeCategory)) activeCategory = null;

  $("rail").innerHTML = [null, ...cats]
    .map((cat) => {
      const count = cat ? entries.filter((e) => e.category === cat).length : entries.length;
      const on = cat === activeCategory;
      return `<button type="button" class="chip${on ? " on" : ""}" data-cat="${
        cat ? esc(cat) : ""
      }" aria-pressed="${on}">${esc(cat ?? "everything")}<span class="chip-count">${count}</span></button>`;
    })
    .join("");

  const shown = entries.filter((e) => {
    if (!query && activeCategory && e.category !== activeCategory) return false;
    if (!query) return true;
    return [e.title, e.body, e.tags, e.category, e.date].join(" ").toLowerCase().includes(query);
  });

  $("results").textContent = query
    ? `${shown.length} match${shown.length === 1 ? "" : "es"} for "${query}"`
    : activeCategory
      ? `${shown.length} entr${shown.length === 1 ? "y" : "ies"} in ${activeCategory}`
      : "";

  const gaps = entries.length ? missingDays(entries, new Date()) : [];
  $("gaps").hidden = gaps.length === 0;
  $("gaps").innerHTML = `not logged this week:${gaps
    .map((d) => `<button type="button" data-gap="${d}">${weekday(d)}</button>`)
    .join("")}`;

  $("empty").hidden = shown.length > 0;
  $("items").innerHTML = shown.map(row).join("");
  renderBook();
}

const uitmDate = (iso) => iso.split("-").reverse().join("/");

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const weekday = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${DAYS[new Date(y, m - 1, d).getDay()]} ${d} ${MONTHS[m - 1]}`;
};

function renderBook() {
  const rows = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  $("book-empty").hidden = rows.length > 0;
  $("book-table").hidden = rows.length === 0;

  const periods = new Set(rows.map((e) => e.category));
  $("book-summary").textContent = rows.length
    ? `${rows.length} entr${rows.length === 1 ? "y" : "ies"} across ${periods.size} period${
        periods.size === 1 ? "" : "s"
      }, ${uitmDate(rows[0].date)} to ${uitmDate(rows[rows.length - 1].date)}`
    : "";

  const blank = rows.filter((e) => !e.remarks?.trim()).length;
  $("book-remarks").textContent = blank
    ? `${blank} day${blank === 1 ? " has" : "s have"} no typed remarks. They print as empty boxes to sign by hand.`
    : "";

  const sign = `<tr class="sign"><td colspan="3">Supervisor's signature<span class="sign-line"></span>Date<span class="sign-line short"></span></td></tr>`;
  let period = null;
  $("book-body").innerHTML = rows
    .map((e, i) => {
      const head =
        e.category === period
          ? ""
          : `<tr class="period"><th scope="colgroup" colspan="3">${esc(e.category)}</th></tr>`;
      period = e.category;
      return `${head}<tr>
        <td class="col-date">${esc(uitmDate(e.date))}<button type="button" class="row-edit" data-book-edit="${e.id}">edit this day</button></td>
        <td class="col-work"><strong>${esc(e.title)}</strong>${
          e.body ? `<span class="work-body">${esc(e.body)}</span>` : ""
        }</td>
        <td class="col-remarks"><span class="remark-text">${esc(e.remarks ?? "")}</span></td>
      </tr>${rows[i + 1]?.category === e.category ? "" : sign}`;
    })
    .join("");
}

const showView = (book, focusTab = true) => {
  $("view-book").hidden = !book;
  $("view-log").hidden = book;
  document.querySelector(".views").scrollIntoView({ block: "start" });
  for (const [tab, on] of [["tab-book", book], ["tab-log", !book]]) {
    $(tab).classList.toggle("on", on);
    $(tab).setAttribute("aria-selected", String(on));
    $(tab).tabIndex = on ? 0 : -1;
  }
  if (focusTab) $(book ? "tab-book" : "tab-log").focus();
};

$("tab-log").addEventListener("click", () => showView(false));
$("tab-book").addEventListener("click", () => showView(true));

document.querySelector(".views").addEventListener("keydown", (ev) => {
  if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
  ev.preventDefault();
  showView(ev.key === "ArrowRight");
});

$("book-body").addEventListener("click", (ev) => {
  const btn = ev.target.closest("[data-book-edit]");
  if (!btn) return;
  showView(false, false);
  editEntry(Number(btn.dataset.bookEdit));
});

$("print-remarks").addEventListener("change", (ev) => {
  document.body.classList.toggle("hide-remarks", !ev.target.checked);
});

$("print").addEventListener("click", () => window.print());

const row = (e) => {
  const open = expanded.has(e.id);
  const tags = e.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return `<li class="row${open ? " open" : ""}">
    <button type="button" class="row-main" data-toggle="${e.id}" aria-expanded="${open}">
      <time class="row-date" datetime="${esc(e.date)}">${esc(weekday(e.date))}</time>
      <span class="row-title">${esc(e.title)}</span>
      <span class="row-period">${esc(e.category)}</span>
    </button>
    ${
      open
        ? `<div class="row-detail">
        ${e.body ? `<p class="row-text">${esc(e.body)}</p>` : ""}
        ${
          e.remarks
            ? `<p class="row-remarks"><span>supervisor</span>${esc(e.remarks)}</p>`
            : ""
        }
        ${tags.length ? `<ul class="tags">${tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
        <div class="row-actions">
          <button type="button" data-edit="${e.id}">edit</button>
          <button type="button" data-del="${e.id}">delete</button>
        </div>
      </div>`
        : ""
    }
  </li>`;
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const openForm = () => {
  $("entry-dialog").showModal();
};

const closeForm = () => {
  $("entry-dialog").close();
  resetForm();
};

const editEntry = (id) => {
  const e = entries.find((x) => x.id === id);
  if (!e) return;
  $("form-title").textContent = "Edit entry";
  $("f-id").value = e.id;
  $("f-date").value = e.date;
  $("f-category").value = e.category;
  $("f-title").value = e.title;
  $("f-body").value = e.body;
  $("f-tags").value = e.tags;
  $("f-remarks").value = e.remarks ?? "";
  $("submit").textContent = "save entry";
  openForm();
};

const newEntry = (date) => {
  resetForm();
  if (date) $("f-date").value = date;
  const draft = JSON.parse(localStorage.getItem(DRAFT_KEY)) ?? { "f-category": entries[0]?.category ?? "" };
  for (const id of DRAFT_FIELDS) $(id).value = draft[id] ?? "";
  openForm();
};

const resetForm = () => {
  $("form").reset();
  $("f-id").value = "";
  $("f-date").value = isoDay(new Date());
  $("submit").textContent = "add entry";
  $("form-title").textContent = "New entry";
  $("error").textContent = "";
};

$("form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const id = $("f-id").value;
  const payload = {
    date: $("f-date").value,
    title: $("f-title").value,
    category: $("f-category").value || "work",
    body: $("f-body").value,
    tags: $("f-tags").value,
    remarks: $("f-remarks").value,
  };
  try {
    await api(id ? "PUT" : "POST", id ? `/${id}` : "", payload);
    if (!id) localStorage.removeItem(DRAFT_KEY);
    closeForm();
    await load();
  } catch (err) {
    $("error").textContent = err.message;
  }
});

$("cancel").addEventListener("click", closeForm);

$("form").addEventListener("input", () => {
  if ($("f-id").value) return;
  const draft = Object.fromEntries(DRAFT_FIELDS.map((id) => [id, $(id).value]));
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
});

$("form").addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) $("form").requestSubmit();
});

$("new").addEventListener("click", () => newEntry());

$("gaps").addEventListener("click", (ev) => {
  const btn = ev.target.closest("[data-gap]");
  if (btn) newEntry(btn.dataset.gap);
});

document.addEventListener("keydown", (ev) => {
  if (ev.ctrlKey || ev.metaKey || ev.altKey || $("entry-dialog").open) return;
  if (ev.target.matches("input, textarea, select")) return;
  if (ev.key === "n") {
    ev.preventDefault();
    newEntry();
  }
  if (ev.key === "/") {
    ev.preventDefault();
    showView(false, false);
    $("search").focus();
  }
});

$("entry-dialog").addEventListener("cancel", (ev) => {
  ev.preventDefault();
  closeForm();
});
$("search").addEventListener("input", render);
$("clear").addEventListener("click", () => {
  $("search").value = "";
  render();
});

$("rail").addEventListener("click", (ev) => {
  const btn = ev.target.closest("[data-cat]");
  if (!btn) return;
  activeCategory = btn.dataset.cat || null;
  render();
});

$("items").addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-toggle],[data-edit],[data-del]");
  if (!btn) return;
  const { toggle, edit, del } = btn.dataset;
  if (toggle) {
    const id = Number(toggle);
    expanded.has(id) ? expanded.delete(id) : expanded.add(id);
    render();
    return document.querySelector(`[data-toggle="${id}"] + .row-detail`)?.classList.add("opening");
  }
  if (edit) editEntry(Number(edit));
  if (del) {
    try {
      const entry = entries.find((e) => e.id === Number(del));
      await api("DELETE", `/${del}`);
      expanded.delete(Number(del));
      showUndo(entry);
      await load();
    } catch (err) {
      $("results").textContent = `could not delete entry: ${err.message}`;
    }
  }
});

const showUndo = (entry) => {
  deleted = entry;
  $("toast-text").textContent = `Deleted "${entry.title}".`;
  $("toast").hidden = false;
  $("toast").animate([{ opacity: 1 }, { opacity: 1, offset: 0.9 }, { opacity: 0, visibility: "hidden" }], {
    duration: 8000,
    fill: "forwards",
  });
};

$("toast-undo").addEventListener("click", async () => {
  $("toast").hidden = true;
  try {
    await api("POST", "", deleted);
    await load();
  } catch (err) {
    $("results").textContent = `could not restore entry: ${err.message}`;
  }
});

resetForm();
load();

const root = document.documentElement;

function applySkin(theme, mode) {
  const dark = theme === "syam" ? "dark" : mode;
  root.dataset.theme = theme;
  root.dataset.mode = dark;
  localStorage.setItem("skin-theme", theme);
  if (theme !== "syam") localStorage.setItem("skin-mode", mode);

  $("skin-theme").value = theme;
  $("skin-mode").hidden = theme === "syam";
  $("skin-mode").textContent = dark;
  $("skin-mode").setAttribute("aria-pressed", String(dark === "dark"));
  document
    .querySelector('meta[name="theme-color"]')
    .setAttribute("content", getComputedStyle(root).getPropertyValue("--bg").trim());
}

const savedMode = () =>
  localStorage.getItem("skin-mode") ||
  (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

$("skin-theme").addEventListener("change", (ev) => applySkin(ev.target.value, savedMode()));
$("skin-mode").addEventListener("click", () =>
  applySkin(root.dataset.theme, root.dataset.mode === "dark" ? "light" : "dark"),
);

applySkin(localStorage.getItem("skin-theme") || "syam", savedMode());
