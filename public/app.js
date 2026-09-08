const $ = (id) => document.getElementById(id);
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const COLORS = ["#f38ba8", "#a6e3a1", "#f9e2af", "#89b4fa", "#fab387", "#94e2d5", "#cba6f7"];
const color = (name) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
};

let entries = [];
let activeCategory = null; // null = all
let expanded = new Set();

const api = async (method, path = "", body) => {
  const res = await fetch(`/api/entries${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "request failed");
  return data;
};

const load = async () => {
  entries = await api("GET");
  render();
};

function render() {
  const query = $("search").value.trim().toLowerCase();
  $("clear").hidden = !query;

  const cats = [...new Set(entries.map((e) => e.category))].sort();
  $("stat-entries").textContent = entries.length;
  $("stat-categories").textContent = cats.length;
  $("categories").innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join("");

  if (activeCategory && !cats.includes(activeCategory)) activeCategory = null;

  $("rail").innerHTML = [null, ...cats]
    .map((cat, i) => {
      const count = cat ? entries.filter((e) => e.category === cat).length : entries.length;
      const on = cat === activeCategory ? " on" : "";
      const c = cat ? color(cat) : "var(--purple)";
      return `<button type="button" class="rail-item${on}" data-cat="${cat ? esc(cat) : ""}" style="--cat-color:${c}">
        <span class="rail-num">${ROMAN[i] ?? i + 1}</span>${esc(cat ?? "all")}<span class="rail-count">${count}</span>
      </button>`;
    })
    .join("");

  const shown = entries.filter((e) => {
    if (!query && activeCategory && e.category !== activeCategory) return false;
    if (!query) return true;
    return [e.title, e.body, e.tags, e.category, e.date].join(" ").toLowerCase().includes(query);
  });

  $("results").textContent = query
    ? `${shown.length} match${shown.length === 1 ? "" : "es"} for "${query}"`
    : `${shown.length} entr${shown.length === 1 ? "y" : "ies"} in ${activeCategory ?? "all"}`;

  $("empty").hidden = shown.length > 0;
  $("items").innerHTML = shown.map(card).join("");
}

const card = (e) => {
  const open = expanded.has(e.id);
  const tags = e.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return `<li class="card${open ? " expanded" : ""}" style="--cat-color:${color(e.category)}">
    <button type="button" class="card-row" data-toggle="${e.id}">
      <span class="marker">${open ? "▾" : "▸"}</span>
      <span class="card-date">${esc(e.date)}</span>
      <span class="badge">${esc(e.title)}</span>
      <span class="card-full">${esc(e.category)}</span>
    </button>
    ${
      open
        ? `<div class="card-body">
        ${e.body ? `<p class="section-text">${esc(e.body)}</p>` : ""}
        ${tags.length ? `<div class="chips">${tags.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>` : ""}
        <div class="card-actions">
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

const resetForm = () => {
  $("form").reset();
  $("f-id").value = "";
  $("f-date").value = new Date().toISOString().slice(0, 10);
  $("submit").textContent = "add entry";
  $("cancel").hidden = true;
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
  };
  try {
    await api(id ? "PUT" : "POST", id ? `/${id}` : "", payload);
    resetForm();
    await load();
  } catch (err) {
    $("error").textContent = err.message;
  }
});

$("cancel").addEventListener("click", resetForm);
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
  if (edit) {
    const e = entries.find((x) => x.id === Number(edit));
    $("f-id").value = e.id;
    $("f-date").value = e.date;
    $("f-category").value = e.category;
    $("f-title").value = e.title;
    $("f-body").value = e.body;
    $("f-tags").value = e.tags;
    $("submit").textContent = "save entry";
    $("cancel").hidden = false;
    $("form").scrollIntoView({ block: "nearest" });
  }
  if (del && confirm("delete this entry?")) {
    await api("DELETE", `/${del}`);
    expanded.delete(Number(del));
    await load();
  }
});

resetForm();
load();
