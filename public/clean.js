export const clean = (b) => {
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
