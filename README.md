# internship-log

Local daily log for a UiTM internship, with a logbook view that prints to the
three-column form the university asks for.

## Run

```sh
npm start          # node server.js, binds 127.0.0.1:4173
```

No dependencies, no build step. Node 26 `node:sqlite` and `node:http` only.
Data lives in `log.db` next to the server.

## Two views

- **log**: the entries themselves, newest first, one hairline row per day.
  Search and the period filters sit at the top; the form opens as a panel from
  "new entry" or from a row's edit link, and closes with Escape. `category`
  doubles as the UiTM period heading (`1st Day Intern`, `1st Week Intern`).
- **logbook**: every entry, oldest first, grouped under its period heading, in
  a DATE / EXACT NATURE OF WORK DONE / SUPERVISOR'S REMARKS table. Each row has
  an "edit this day" link back into the form, which never prints.

Left and right arrow keys move between the two tabs.

## Printing the logbook

Open the logbook view, pick whether the remarks column prints filled or blank,
then "send to print dialog" and choose Save as PDF. The print stylesheet sets
A4, drops all screen furniture, repeats the table header on every page, and
keeps rows from splitting across pages.

## Schema

`entries(id, date, title, category, body, tags, remarks, created_at)`.
Dates are stored `YYYY-MM-DD` and rendered `DD/MM/YYYY` in the logbook only.
The `remarks` column is added by a guarded `ALTER TABLE` on startup.
