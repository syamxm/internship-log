# Internship Log

A single-page daily log for an internship: what you worked on, what broke, what
you learned. Entries live in a local SQLite file. No build step, no framework,
no dependencies — just Node's standard library and three static files.

## Requirements

- **Node.js 22.5 or newer** — the server uses the built-in `node:sqlite` module,
  which does not exist in earlier versions. Node 24 LTS or newer is recommended;
  on Node 22.x and 23.x you will see an `ExperimentalWarning` on startup, which
  is harmless.

That's the whole list. There is no `npm install` step — `package.json` has no
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
[nodejs.org](https://nodejs.org/en/download) — pick the `.pkg` matching your
chip (Apple silicon: ARM64; Intel: x64).

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

## Your data

Entries are written to `log.db` in the project folder, created automatically on
first run. This file is listed in `.gitignore` and is never committed — your
internship notes stay on your own machine.

To back it up, copy the file. To start fresh, delete it and restart the server.

Nothing is sent anywhere: the server binds to `127.0.0.1`, so it is reachable
only from your own computer and not from the rest of your network.

## Keeping it running

Optional. A [PM2](https://pm2.keymetrics.io) config is included so the server
survives reboots and logouts:

```sh
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup      # macOS / Linux — prints a command to run once
```

On Windows, use [pm2-windows-startup](https://www.npmjs.com/package/pm2-windows-startup)
instead of `pm2 startup`, or run the server from a Task Scheduler entry.

## How it works

| File | Role |
| --- | --- |
| `server.js` | HTTP server, SQLite schema, JSON API, static file serving |
| `public/index.html` | Page structure |
| `public/app.js` | Rendering, search, category filter, form handling |
| `public/style.css` | Styling |
| `ecosystem.config.cjs` | PM2 process definition |

The API is four routes under `/api/entries`:

| Method | Path | Does |
| --- | --- | --- |
| `GET` | `/api/entries` | List all entries, newest date first |
| `POST` | `/api/entries` | Create an entry |
| `PUT` | `/api/entries/:id` | Replace an entry |
| `DELETE` | `/api/entries/:id` | Delete an entry |

An entry is a `date` (`YYYY-MM-DD`, required), a `title` (required), plus
optional `category`, `body`, and comma-separated `tags`.

## A note on security

There is no authentication, because there is no need for any: the server listens
on `127.0.0.1` only. If you change that bind address to expose the app on your
network or the internet, you must add authentication first — otherwise anyone
who can reach the port can read, edit, and delete every entry.

## License

[MIT](LICENSE).

JetBrains Mono, bundled in `public/fonts/`, is licensed separately under the
[SIL Open Font License 1.1](public/fonts/OFL.txt).
