const $ = (id) => document.getElementById(id);
let entries = [];
let activeCategory = null; // null = all
let expanded = new Set();

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

// ---- demo store ----
// No server on GitHub Pages, so the same calls run against localStorage.
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
    // Private windows and blocked site data throw instead of returning null.
    return DEMO_SEED;
  }
};

const demoSave = (rows) => {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(rows));
  } catch {
    /* read-only storage: the page still works for this session */
  }
};

// Mirrors the server's validation so both builds reject the same input.
const demoClean = (b) => {
  const date = String(b.date ?? "").trim();
  const title = String(b.title ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date must be YYYY-MM-DD");
  if (!title) throw new Error("title required");
  return {
    date,
    title: title.slice(0, 200),
    category: String(b.category ?? "work").trim().slice(0, 40) || "work",
    body: String(b.body ?? "").slice(0, 20000),
    tags: String(b.tags ?? "").trim().slice(0, 200),
    remarks: String(b.remarks ?? "").slice(0, 2000),
  };
};

const demoApi = (method, path = "", body) => {
  const id = Number(path.split("/")[1]);
  const rows = demoAll();

  if (method === "GET") {
    return [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  }
  if (method === "POST") {
    const next = rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
    demoSave([...rows, { id: next, ...demoClean(body) }]);
    return { id: next };
  }
  if (method === "PUT" && id) {
    demoSave(rows.map((r) => (r.id === id ? { id, ...demoClean(body) } : r)));
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
  $("foot-stack").textContent = "no server, nothing saved";
}

const api = async (method, path = "", body) => {
  if (demo) return demoApi(method, path, body);
  try {
    return await serverApi(method, path, body);
  } catch (err) {
    // A static host 404s the API and file:// refuses it: both land here as a
    // parse or network error, never as the server's own validation error.
    if (!(err instanceof TypeError || err instanceof SyntaxError)) throw err;
    enterDemo();
    return demoApi(method, path, body);
  }
};

// Three states for the fetch: loading, loaded, failed. The list and the
// logbook share one status line each so a failure is never a blank page.
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

  $("empty").hidden = shown.length > 0;
  $("items").innerHTML = shown.map(row).join("");
  renderBook();
}

// UiTM writes dates by hand as DD/MM/YYYY; storage stays YYYY-MM-DD.
const uitmDate = (iso) => iso.split("-").reverse().join("/");

// The logbook is the printed artefact, so it ignores the search box and the
// rail filter: it always shows every entry, oldest first, grouped by the
// period heading the owner already types into `category`.
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

  let period = null;
  $("book-body").innerHTML = rows
    .map((e) => {
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
      </tr>`;
    })
    .join("");
}

const showView = (book, focusTab = true) => {
  $("view-book").hidden = !book;
  $("view-log").hidden = book;
  // Switching while scrolled deep into the log would otherwise land the owner
  // in the middle of the table with no idea the view changed.
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

// Unchecked means the remarks column prints empty, leaving room to sign by hand.
$("print-remarks").addEventListener("change", (ev) => {
  document.body.classList.toggle("hide-remarks", !ev.target.checked);
});

$("print").addEventListener("click", () => window.print());

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Day and month in the gutter, year only where it changes nothing to repeat it
// on screen: the printed logbook is where the full date matters.
const dayLabel = (iso) => {
  const [, m, d] = iso.split("-");
  return `${d} ${MONTHS[Number(m) - 1] ?? m}`;
};

const row = (e) => {
  const open = expanded.has(e.id);
  const tags = e.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return `<li class="row${open ? " open" : ""}">
    <button type="button" class="row-main" data-toggle="${e.id}" aria-expanded="${open}">
      <time class="row-date" datetime="${esc(e.date)}">${esc(dayLabel(e.date))}</time>
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

// The form is a panel, not a permanent fixture: the entries are what the page
// is for, so the form opens when there is something to write and closes again.
const openForm = () => {
  $("form").hidden = false;
  $("form").scrollIntoView({ block: "nearest" });
};

const closeForm = () => {
  $("form").hidden = true;
  resetForm();
};

const editEntry = (id) => {
  const e = entries.find((x) => x.id === id);
  if (!e) return;
  openForm();
  $("form-title").textContent = "Edit entry";
  $("f-id").value = e.id;
  $("f-date").value = e.date;
  $("f-category").value = e.category;
  $("f-title").value = e.title;
  $("f-body").value = e.body;
  $("f-tags").value = e.tags;
  $("f-remarks").value = e.remarks ?? "";
  $("submit").textContent = "save entry";
  $("f-title").focus();
};

const resetForm = () => {
  $("form").reset();
  $("f-id").value = "";
  $("f-date").value = new Date().toISOString().slice(0, 10);
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
    closeForm();
    await load();
  } catch (err) {
    $("error").textContent = err.message;
  }
});

$("cancel").addEventListener("click", closeForm);

$("new").addEventListener("click", () => {
  resetForm();
  openForm();
  $("f-title").focus();
});

// Escape closes the panel, the same as any other dialog on the page.
$("form").addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") closeForm();
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
    return render();
  }
  if (edit) editEntry(Number(edit));
  if (del && confirm("delete this entry?")) {
    await api("DELETE", `/${del}`);
    expanded.delete(Number(del));
    await load();
  }
});

resetForm();
load();

// ---- skins ----
// index.html already set the attributes; this keeps the controls in step.
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
  // --bg, not the computed background: two skins paint a gradient only.
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
