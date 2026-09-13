# Chronos

A single-page daily log for a UiTM internship: what you worked on, what broke,
what you learned. Entries live in a local SQLite file, and a logbook view prints
to the three-column form the university asks for. No build step, no framework,
no dependencies, just Node's standard library and four static files.

## Requirements

- **Node.js 22.5 or newer.** The server uses the built-in `node:sqlite` module,
  which does not exist in earlier versions. Node 24 LTS or newer is recommended;
  on Node 22.x and 23.x you will see an `ExperimentalWarning` on startup, which
  is harmless.

That's the whole list. There is no `npm install` step: `package.json` has no
dependencies.

Check your version:

```sh
node --version
```

## Install Node

### Linux

Most distro repositories ship a Node that is too old. Prefer your distro's
current package, and fall back to nvm if it lags behind 22.5.

```sh
# Debian / Ubuntu
sudo apt install nodejs

# Fedora
sudo dnf install nodejs

# Arch / CachyOS / Manjaro
sudo pacman -S nodejs

# openSUSE
sudo zypper install nodejs22

# Alpine
sudo apk add nodejs
```

If the packaged version is older than 22.5:

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install --lts
```

### macOS

```sh
brew install node
```

Without Homebrew, download the macOS installer from
[nodejs.org](https://nodejs.org/en/download), picking the `.pkg` that matches
your chip (Apple silicon: ARM64; Intel: x64).

### Windows

```powershell
winget install OpenJS.NodeJS.LTS
```

Or download the `.msi` installer from
[nodejs.org](https://nodejs.org/en/download). Close and reopen your terminal
afterwards so `node` lands on your `PATH`.

## Run it

```sh
git clone https://github.com/syamxm/internship-log.git
cd internship-log
npm start
```

Then open <http://127.0.0.1:4173>.

On Windows, the same three commands work in PowerShell, Windows Terminal, and
Git Bash alike.

To use a different port:

```sh
# macOS / Linux
PORT=8080 npm start
```

```powershell
# Windows PowerShell
$env:PORT=8080; npm start
```

```cmd
:: Windows cmd.exe
set PORT=8080 && npm start
```

Stop the server with `Ctrl+C`.

## Two views

- **log**: the entries themselves, newest first, one hairline row per day.
  Search and the period filters sit at the top; the form opens as a panel from
  "new entry" or from a row's edit link, and closes with Escape. `category`
  doubles as the UiTM period heading (`1st Day Intern`, `1st Week Intern`).
- **logbook**: every entry, oldest first, grouped under its period heading, in
  a DATE / EXACT NATURE OF WORK DONE / SUPERVISOR'S REMARKS table. Each row has
  an "edit this day" link back into the form, which never prints.

Left and right arrow keys move between the two tabs.

## Skins

Four looks, picked from the control in the masthead and remembered per browser:

- **Syamxm**, the house style: dark, purple, monospaced. Dark only, by
  definition.
- **Nothing**: one canvas, one ink, one red, and a dot-matrix grid behind the
  page. Approximation, not the real thing: the Ndot typeface is not
  redistributable, so the dot matrix is drawn as the canvas instead.
- **E-Ink Paper**: a warm sheet, one ink, hairline rules, no glow. The tool
  exists to become a printed logbook, so this skin is that paper.
- **Windows 95**: raised and sunken bevels, square corners, teal desktop.

Each skin apart from the house style carries a light and a dark mode, seeded
from your system preference on first visit. Skins are screen-only: the printed
logbook comes out identical whichever one is on.

## Printing the logbook

Open the logbook view, pick whether the remarks column prints filled or blank,
then "send to print dialog" and choose Save as PDF. The print stylesheet sets
A4, drops all screen furniture, repeats the table header on every page, and
keeps rows from splitting across pages.

## Your data

Entries are written to `log.db` in the project folder, created automatically on
first run. This file is listed in `.gitignore` and is never committed: your
internship notes stay on your own machine.

To back it up, copy the file. To start fresh, delete it and restart the server.

Nothing is sent anywhere. The server binds to `127.0.0.1`, so it is reachable
only from your own computer and not from the rest of your network.

## The online demo

[chronos.syamxm.com](https://chronos.syamxm.com) runs a static copy on GitHub
Pages, so it can be tried without installing anything. It is a demo and
nothing more:

- There is no server and no database behind it. Entries are written to the
  browser's **localStorage**.
- That means the data is gone when you clear site data, and never leaves the
  browser you typed it in. No sync, no backup, no export beyond the print
  dialog.
- **Do not keep a real logbook there.** Run it locally for that.

The page detects this on its own: when `/api/entries` answers with anything
other than the real API, it switches to the localStorage store and shows the
disclaimer at the top of the page. The same code runs in both places, so
nothing has to be kept in sync by hand.

Deployment is `.github/workflows/pages.yml`, which uploads `public/` as-is on
every push to `main` that touches it. Enable it once under Settings, Pages,
Source: GitHub Actions. The custom domain comes from `public/CNAME`, so
`chronos.syamxm.com` needs a CNAME record pointing at `syamxm.github.io`.

Bugs, opinions and requests go to [syamxm.com/#contact](https://syamxm.com/#contact).

## Keeping it running

Optional. A [PM2](https://pm2.keymetrics.io) config is included so the server
survives reboots and logouts:

```sh
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup      # macOS / Linux, prints a command to run once
```

On Windows, use [pm2-windows-startup](https://www.npmjs.com/package/pm2-windows-startup)
instead of `pm2 startup`, or run the server from a Task Scheduler entry.

## How it works

| File | Role |
| --- | --- |
| `server.js` | HTTP server, SQLite schema, JSON API, static file serving |
| `public/index.html` | Page structure |
| `public/app.js` | Rendering, search, category filter, form handling, skins, demo store |
| `public/style.css` | Layout and the default skin's tokens |
| `public/themes.css` | The other three skins, screen only |
| `ecosystem.config.cjs` | PM2 process definition |

The API is four routes under `/api/entries`:

| Method | Path | Does |
| --- | --- | --- |
| `GET` | `/api/entries` | List all entries, newest date first |
| `POST` | `/api/entries` | Create an entry |
| `PUT` | `/api/entries/:id` | Replace an entry |
| `DELETE` | `/api/entries/:id` | Delete an entry |

## Self-checks

```sh
npm test
```

Two files, no framework and no dependencies: `test-logbook.mjs` runs the
logbook render against a stub DOM (grouping, date format, escaping, tab
switching, skins), and `test-demo.mjs` runs the same app.js with no API behind
it to check the demo build falls back to localStorage, says so on screen, and
still validates input the way the server does.

## Schema

`entries(id, date, title, category, body, tags, remarks, created_at)`.

An entry is a `date` (`YYYY-MM-DD`, required), a `title` (required), plus
optional `category`, `body`, comma-separated `tags`, and `remarks`. Dates are
stored `YYYY-MM-DD` and rendered `DD/MM/YYYY` in the logbook only. The
`remarks` column is added by a guarded `ALTER TABLE` on startup.

## A note on security

There is no authentication, because there is no need for any: the server listens
on `127.0.0.1` only. If you change that bind address to expose the app on your
network or the internet, you must add authentication first, otherwise anyone
who can reach the port can read, edit, and delete every entry.

## License

[MIT](LICENSE).

JetBrains Mono, bundled in `public/fonts/`, is licensed separately under the
[SIL Open Font License 1.1](public/fonts/OFL.txt).
