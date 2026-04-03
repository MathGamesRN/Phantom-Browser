# ◈ Phantom — Server-Side Proxy Browser

A sleek Node.js browser proxy that routes **all traffic through the server**, not the client.

## Features

- 🔍 **DuckDuckGo search** — search the web without the client making any requests
- 🌐 **URL navigation** — visit any site through the server proxy
- 🔗 **Link rewriting** — all links on proxied pages continue through the proxy
- 🖼 **Resource proxying** — images, CSS, JS all fetched server-side
- 🛡 **Inline toolbar** — navigate without returning to the home page
- ⚡ **Quick access** — one-click Wikipedia, Hacker News, Archive.org, GitHub

## Codespaces setup
Log into your personal github account and go to this repo.
Click on the green "code" button, and go into the codespaces tab.
Click on Create codespace on main, and wait for it to load.
Once you have done that, you can follow the normal setup

## Running

### 1. Install dependencies

```bash
npm install
```

### 2. Start the server

```bash
# Production
npm start

# Development (auto-restart)
npm run dev
```

### 3. Open your browser

Navigate to **http://localhost:3000**

## How It Works

```
Client Browser ──→ Phantom Server (Node.js)
                        │
                        ├──→ DuckDuckGo
                        ├──→ Target websites
                        ├──→ Images / CSS / JS
                        └──→ All external resources
```

The client only ever talks to `localhost:3000`. All outbound HTTP requests are made by the Node.js server using `axios`. HTML is parsed with `cheerio` and all links/resources are rewritten to go through the proxy.

## Routes

| Route | Description |
|-------|-------------|
| `GET /` | Home page with search & URL bar |
| `GET /search?q=...` | Redirect to DuckDuckGo via proxy |
| `GET /proxy?url=...` | Fetch & rewrite HTML through server |
| `GET /resource?url=...` | Proxy static resources (images, CSS, JS) |

## Limitations

- JavaScript-heavy SPAs may not work perfectly (JS runs on the client after load)
- HTTPS sites work fine; the server fetches them and serves over HTTP locally
- Some sites block non-browser User-Agents or detect proxy behavior
