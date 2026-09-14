# Hi Temp Mail — Project Brain

> Single source of truth for developers and AI assistants. Read ONLY this file before making changes; it encodes every verified fact about the system. Anything marked `[UNKNOWN]` was not verifiable in code.

**Last Updated:** 2026-09-06
**Changelog:**
- 2026-09-06 — Added: blog system (20 posts), landing guides section, tool-page SEO block, ad-slot placeholders, mobile perf fixes (Geist removal, Early Hints), HMR dev fix.
- 2026-09-05 — Added: MCP server, Markdown negotiation (proxy), custom 404, trust pages + rewrites, openapi.json/docs.html, Organization schema, verify-agentic script.
- 2026-09-05 — Fixed: Vercel 500 on `/api/mailtm` (mail.tm blocks Vercel IPs → mail.gw fallback).
- 2026-09-05 — Removed: Prisma/SQLite, 46 orphan shadcn components, 65+ unused deps, `tailwind.config.ts`, `bun.lock` → `package-lock.json`.
- 2026-09-05 — Added: precompiled `landing.css` (dropped Tailwind CDN), async fonts.

---

## 1. Project Overview

| Item | Fact |
|---|---|
| App name | Hi Temp Mail (v6.0) |
| Purpose | Free disposable/temporary email: instant inbox, OTP auto-detection, restorable saved mailboxes. No login, no signup, no tracking |
| Target users | Anyone needing low-risk signups (trials, OTPs, downloads, forums, Wi-Fi portals, QA testing) |
| Core value prop | "Free temporary email. Instant OTPs. Zero spam." Real working inbox in seconds; codes as one-tap chips; addresses can be saved and restored days later |
| Status | **Production** (live at `https://hitempmail.vercel.app/`; canonical domain `https://hitempmail.app/` is `[UNREGISTERED — DNS NXDOMAIN as of 2026-09-05]`) |
| Business model | Free forever; Google AdSense planned (15 approval-safe placeholder slots, no live ad code) |

---

## 2. Tech Stack

| Layer | Choice (version) | Why |
|---|---|---|
| Framework | Next.js `^16.1.1` (running 16.3.4, Turbopack) |Hosts shell + API relay + SEO; Vercel-native deploys |
| UI runtime | React `^19.0.0` / React-DOM `^19.0.0` | Thin shell only (iframe orchestration, toaster) |
| Language | TypeScript `^5` (+ `@types/react`, `@types/react-dom`, `@types/node` 26.4.1) | Type safety; `@types/node` required by Next 16 |
| Styling (shell) | Tailwind CSS `^4` + `@tailwindcss/postcss` + `tw-animate-css` | CSS-first v4 config; no `tailwind.config.ts` (deleted) |
| Styling (app/landing) | Zero-dependency single-file CSS: app uses Tailwind Play CDN inline; landing uses precompiled `public/landing.css` built from `landing-src.css` | App = 1 file portability; landing = instant paint, no render-blocking JS |
| Toast system | `@radix-ui/react-toast` + `class-variance-authority` + `clsx` + `tailwind-merge` + `lucide-react` | Only Radix package actually used (via `ui/toast.tsx`) |
| Lint | ESLint `^9` + `eslint-config-next` | `npm run lint` |
| Mail backend | Mail.tm free REST API (`https://api.mail.tm`), fallback `https://api.mail.gw` (identical API) | Free, no keys; gw fallback exists because **Mail.tm returns empty 500 to Vercel datacenter IPs** |
| Database | **None.** (Prisma/SQLite removed 2026-09-05; stray local `.env` `DATABASE_URL` is an orphan, ignored) | Privacy architecture: browser localStorage + provider storage only |
| Hosting | Vercel (GitHub auto-deploy on `main`); self-host via `output: standalone` + Caddy example (`Caddyfile`, `:81` → `:3000`) | Vercel for prod; standalone for Docker/VPS |
| Fonts | Google Fonts: Inter, Space Grotesk, JetBrains Mono, Instrument Serif (landing only), Material Symbols (landing subset = 23 icons) | Async/non-blocking loads; shell uses system stacks (Geist removed for perf) |
| Package mgr | npm + `package-lock.json` (376 pkgs, 0 vulns at last install) | `bun.lock` deleted; local Node v26.8.1 (min supported: Node 20.9+) |

---

## 3. Architecture

### System flow (ASCII)

```
                    ┌─────────────────────────────┐
                    │  Next.js shell  (/ page.tsx) │
                    │  landing iframe ⇄ app iframe │
                    │  postMessage: HI_TEMPMAIL_   │
                    │  LAUNCH / HI_TEMPMAIL_HOME  │
                    └──────┬──────────────┬───────┘
                           │              │ Bearer JWT (memory)
              /landing.html│              │ /ar-tempmail.html (== index.html)
              (marketing)  │              │ direct Mail.tm API first,
                           │              │ CORS-fail → same-origin relay
                           │         ┌────▼────────────────────────┐
                           │         │ /api/mailtm/[...path] relay │
                           │         │ mail.tm →(500-empty)→mail.gw│
                           │         └────┬───────────────┬────────┘
                           │              │               │ health?health=1
                           │     api.mail.tm      api.mail.gw
                           │
                    ┌──────▼───────────────────────────────────┐
                    │ Agents/machines: llms.txt, llms-full.txt │
                    │ openapi.json, docs.html, /.well-known/mcp│
                    │ Accept: text/markdown → markdown (proxy) │
                    └──────────────────────────────────────────┘
```

### Folder structure (one line each)

```
hi-temp-mail/
├── index.html                    # APP MASTER (vanilla JS+CSS, ~2678 lines). Edit here, then mirror ↓
├── public/ar-tempmail.html       # Served app copy. MUST equal index.html (rule: cp after every edit)
├── public/landing.html           # Marketing/landing doc (own inline CSS+JS, talks to shell via postMessage)
├── public/landing-src.css        # Tailwind v4 source for landing (theme tokens, class-dark, @source landing.html)
├── public/landing.css            # Built artifact (npm run build:landing; ALSO rebuilt by `npm run build`)
├── public/about|faq|privacy|disclaimer|contact|docs|offline.html  # Static trust/dev pages (shared shell)
├── public/blog.html + blog/*.html (20 posts)  # Blog system (Blog/BlogPosting JSON-LD each)
├── public/openapi.json           # OpenAPI 3.1 for the relay (6 paths)
├── public/sw.js                  # SW: precache shell, network-first navigations, SWR assets, NEVER /api/*
├── public/manifest.webmanifest + icons + robots.txt + sitemap.xml (28 URLs) + llms.txt/full
├── scripts/build-landing-css.js  # PostCSS build (bare-specifier requires ONLY — Node26 quirk, see §9)
├── scripts/verify-agentic.mjs    # 8 agentic-readiness checks (`npm run verify:agentic`, BASE_URL overridable)
├── src/app/page.tsx              # Shell: landing⇄app crossfade, static crawler div, full JSON-LD graph
├── src/app/layout.tsx            # SEO metadata, system fonts, Toaster + SW registrar (NO next/font — perf)
├── src/app/not-found.tsx         # 404 with human links + markdown recovery <pre> block
├── src/app/.well-known/mcp/route.ts  # Stateless MCP: initialize/tools.list+call (get_domains, server_health)
├── src/app/api/mailtm/[...path]/route.ts  # Relay (20s timeout, binary-safe, ?health=1 probe, ?debug removed)
├── src/app/api/route.ts          # Hello-world placeholder (dead route, keep)
├── src/proxy.ts                  # Next16 proxy: Accept:text/markdown → markdown + Vary:Accept (matcher: "/")
├── src/components/service-worker-registrar.tsx  # Prod-only SW register, failures swallowed
├── src/components/ui/{toast,toaster}.tsx + hooks/use-toast.ts + lib/utils.ts(cn)  # ONLY kept UI chain
├── next.config.ts                # No standalone on Vercel; security headers; rewrites (/about→.html etc.); allowedDevOrigins; Link preload header for /
├── vercel.json                   # framework+buildCommand; edge Vary:Accept for /; CORS for /api/mailtm/*
├── Caddyfile                     # Self-host example
└── BRAIN.md (this file) + README.md + AGENTS.md/CLAUDE.md (Next-generated, untracked)
```

### Data flow

- **Mailbox lifecycle (all in `index.html` JS):** `getNewEmail()` → `GET /domains` → `POST /accounts {address,password}` (retry 4× on 400/422 collision) → `POST /token` → poll `GET /messages` every 10s (5/10/30s setting) → OTP extract → render. Delete = `DELETE /accounts/{id}` + regenerate.
- **Relay:** forwards method+path+query; forwards only `Content-Type` + `Authorization`; tries `api.mail.tm`, on empty-500 retries `api.mail.gw`; `arrayBuffer()` passthrough (attachments safe); throws → JSON 502.
- **Browser→relay fallback:** app tries direct `https://api.mail.tm` first; on `TypeError` (CORS/network) switches `API_BASE` to `/api/mailtm` with toast. NOTE: `AbortError` (timeout) is rethrown as plain Error → NO fallback.
- **Persistence:** `localStorage` only — `theme`, `ar_saved_mails`, `ar_active_session`, `ar_settings`, read/hidden message ids. Mail bodies live on Mail.tm servers.

---

## 4. UX/UI Design System

**Philosophy:** Friendly premium minimalism — soft-tinted surfaces humming with the brand hue, one signature gradient (rose→pink→blue) reused everywhere, playful motion that always respects reduced-motion, mobile-first max-w-md app inside a max-w-6xl marketing site. No login walls, no clutter, every action one tap.

### Colors

| Token | Light | Dark | Used for |
|---|---|---|---|
| `paper` (bg) | `#f5f3fb` | `#0b0912` | Page backgrounds, theme-color meta |
| `card` (surface) | `#ffffff` | `#16131f` | Cards, header, inbox rows |
| `line` (border) | `#e8e4f2` | `#262133` | Borders, dividers |
| Brand gradient | `#f43f5e → #ec4899 → #3b82f6` (dark: rose-400/pink-400/blue-400) | same | Logo, primary buttons, headings span, timer ring, pills, focus accents |
| Success | emerald-500 | ACTIVE/LIVE badges, confirmations |
| Warning | amber-500 | Tip banner, timer warn state |
| Danger | rose-500/600 | Delete, timer danger, destructive toast |
| Text | zinc-900 / zinc-600 / zinc-400 | Headings / body / muted (zinc-100/300/500 dark) |
| Misc | `#db2777` theme-color meta; `pink-500/25` selection | App chrome |
| Sender avatars `av-0..7` | Deterministic hash gradients, e.g. av-0 `#f43f5e→#3b82f6`, av-4 `#14b8a6→#10b981` (full map in `index.html` `<style>`) | Message avatars |

### Typography

| Role | Font | Scale / weights |
|---|---|---|
| Body (app) | Inter, sys
...[truncated 9113 chars]