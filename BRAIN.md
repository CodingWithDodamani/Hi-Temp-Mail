# Hi Temp Mail — Project Brain

> Single source of truth for developers and AI assistants. Read ONLY this file before making changes; it encodes every verified fact about the system. Anything marked `[UNKNOWN]` was not verifiable in code.

**Last Updated:** 2026-09-06
**Changelog:**
- 2026-09-06 — Fixed: gateway auto-retry + human outage message (no more raw 502 in UI); live upstream probes in `?health=1`. (mail.gw outage ongoing.)
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
| Body (app) | Inter, system fallback | `text-sm/xs/[13px]/[11px]/[10px]`; 400–800 |
| Display | Space Grotesk (`.font-display`) | App `lg/xl/3xl`; landing hero `2.6rem→6xl→4.2rem`, sections `3xl→5xl`; 500–800 |
| Mono (codes/addresses/timers) | JetBrains Mono, tabular-nums | Addresses 15–16px bold; OTP chips 12px + `.1em` tracking |
| Editorial accent | Instrument Serif italic (`.fancy`, landing only) | Single headline words |
| Icons | Material Symbols Outlined (500/FILL0/opsz24); landing subset 23 names | `!text-[13–22px]` overrides; `.icon-fill` variant |

### Layout / responsive

- App: `max-w-md` centered, `px-4`, `pb-32` (bottom-nav clearance); sticky `h-14` header; bottom tab bar.
- Landing: `max-w-6xl` (features/guides), `max-w-3xl` (FAQ), `max-w-2xl` (content/blog); grids `sm:grid-cols-2`, `lg:grid-cols-3/4`; hamburger under `md`.
- Content pages: `max-w-2xl` article column, shared header/footer shell.

### Components (variants × states)

| Component | Variants | States |
|---|---|---|
| Primary btn | Gradient (`btn-shine` sweep on hover), dark (`zinc-900⇄white`), danger-ghost rose | `hover` shadow/opacity, `active:scale-[.98]`, `focus-visible:ring-2` pink, `.btn-spinner` hides icon |
| Icon btn | `h-9 w-9` / `h-11 w-11`, `rounded-xl`, bordered | hover pink border/text, `active:scale-95` |
| Switch 46×26 | `data-on=true` → gradient bg, knob +20px | .2s transition; dark track `#2b2439` |
| Segmented `.seg` | Buttons; `.active` white/pink pill + shadow | — |
| OTP chip | Dashed pink border, mono bold 12px | hover deepen; sheen (landing) |
| Cards | `rounded-2xl/3xl`, border-line, `shadow-card`; landing `card-lift` (−6px + glow on hover) | hover lift |
| Timer ring | Conic `--p` 0–100; `.warn` amber, `.danger` rose | — |
| Tab pill | Gradient `::before` bar scales in on `.active` | — |
| Toast (Radix) | `toast-in/out` .3s; destructive variant | swipe/dismiss |
| Sheets/dialogs | `.sheet-pop` .3s spring | — |
| Email body | Sanitized type: h1–3, lists, quotes, code, tables; blocked-img striped grayscale | per-message image allow |
| Privacy blur | `body.privacy-blur:not(.revealed) .blur-target {blur(7px)}` + eye toggle | — |
| Landing extras | CTA-only preloader, aurora orbs, grid-mask, mock-inbox sim, conic-border CTA, 30s marquee, tilt/magnetic (pointer:fine only) | — |

### Motion & a11y

- Standard easing `cubic-bezier(.22,1,.36,1)`; entrances `.28–.55s`; toasts `.3s`; ambient `1.4–36s`.
- `prefers-reduced-motion` → animations ~off, no smooth scroll, reveals forced visible.
- Pink `focus-visible` rings; `aria-label/live/roles`, `role=timer/switch`; decorative `aria-hidden`.

---

## 5. App Flow & Navigation

### Journeys

1. **First visit:** open → auto-generate → Copy → paste in signup → OTP chip → done. Optional: bookmark (vault), Extend, Delete.
2. **Return:** Saved tab → Open → same address restored → new mail arrives.
3. **Explore:** Settings (theme/refresh/sound/blur/backup) → info tabs; landing → Guides → blog → Open app.
4. **Failure:** gateway outage → auto-retry ×3 (4s backoff, RETRYING badge) → friendly "Mail servers are down — tap Change Mail" (RETRY badge) or OFFLINE for true network loss.
5. **Exits:** Delete Mail (provider delete + regenerate), Clear all, timer expiry, site-data wipe.

### Routes

| Route | Type | Behavior |
|---|---|---|
| `/` | Client shell | Landing iframe; `HI_TEMPMAIL_LAUNCH` mounts + crossfades app iframe (stays mounted); `HI_TEMPMAIL_HOME` back. Hidden SSR crawler div + JSON-LD + noscript |
| `/landing.html` | Static | Hero+mock sim, stats, marquee, features, how-it-works, FAQ (7), guides (6 cards), CTA, footer (10-article index) |
| `/ar-tempmail.html` (= `index.html`) | Static app | 4 screens below; all mailbox logic; SEO block under inbox |
| `/about\|contact\|privacy\|faq\|disclaimer\|docs\|blog` | Rewrites → `.html` | Trust/dev content (500–8000 chars each) |
| `/blog.html` + `/blog/*.html` (20) | Static | Index (Blog JSON-LD) + articles (BlogPosting+Breadcrumb JSON-LD, FAQs, related links) |
| `/api` | Route | Hello-world placeholder (dead, keep) |
| `/api/mailtm/[...path]` | Route, dynamic, nodejs, `maxDuration: 25` | Relay — see §7 |
| `/.well-known/mcp` | Route | MCP manifest (GET) + JSON-RPC (POST) |
| unmatched | `not-found.tsx` | HTTP 404 + links + markdown recovery `<pre>` |

### App screens (`index.html`)

- **mailScreen** (default): tip, Change/Delete, identity card (Copy/save/share), timer ring + Extend, inbox (search/refresh/mark-read/eye/list), SEO block.
- **savedScreen**: vault list (Open/Delete), explainer.
- **settingsScreen**: Appearance (dark), Mailbox (remember session, 5/10/30s), Notifications (vibrate/sound/auto-copy), Privacy (blur), Data (counts, Clear all, Export/Import), Security notes, legal → infoScreen.
- **infoScreen**: About/FAQ/Privacy/Disclaimer tabs (JS-rendered).

### State (all client-side)

| State | Where | Why |
|---|---|---|
| `account {id,address,password,token}` | JS memory (+ `ar_active_session` if remember on) | Token must not persist by default |
| `messages/seenIds/hiddenIds` | Memory (+ read/hidden ids in localStorage) | Inbox re-polled; only read-state persists |
| `settings {autoRefresh:10,…}` | `ar_settings` | Survive reloads |
| Vault `[{address,password,savedAt}]` | `ar_saved_mails` | Cross-session restore = core feature |
| `theme` | localStorage + pre-paint `dark` class | No flash |

### Auth flow

No login system. "Auth" = per-mailbox Mail.tm JWT from `POST /token`, held in memory (or active session if remembered). All routes public.

---

## 6. Implementation Details

| Feature | How |
|---|---|
| Instant mailbox | `getNewEmail()`: domains → random `letter+7–10 alnum` local + random domain → `randString(16)` via `crypto.getRandomValues` (rejection sampling) → create (4× retry on 400/422) → token → poll |
| Gateway auto-retry | `isGatewayError()` (status 502/504, `50x` in msg, `/relay error/i`) wraps generation: 3 rounds, 4s backoff, RETRYING badge; final failure → human message (never raw 502) |
| OTP detect | `extractOtp()`: keyword-anchored `(\d{3}[\s-]?\d{3}\|\d{4,8})` → spaced-3+3 → bare-6 → bare-4..8; tags stripped, space collapsed |
| Polling/alerts | Interval per `autoRefresh`; id-diff → toast + WebAudio chime (880/1318Hz, gesture-unlocked) + `vibrate(60)` + optional auto-copy |
| Sanitization | Strip scripts/frames/forms/handlers; remote imgs blocked w/ placeholder class; links `noopener`, `no-referrer` meta |
| Timer | `TIMER_SECONDS=600`; 1s tick → `mm:ss` + `--p` ring; warn/danger tones; Extend resets |
| Backup | Export vault JSON to clipboard; import parses+merges (dedupe by address) |
| Relay | 8s timeout (Hobby-safe), tm→gw fallback on empty-500/502-504, probe params stripped, `arrayBuffer()` passthrough, `no-store` + `X-Relay-Upstream`, throws → JSON 502/504 |
| Browser→relay | Direct `api.mail.tm` first; `TypeError` → switch to `/api/mailtm` + toast. `AbortError` rethrown (no fallback by design) |
| MCP | Stateless: `initialize` (negotiate 2025-06-18/2025-03-26/2024-11-05) → `tools/list` → `tools/call` (`get_domains` = parallel upstream race, `server_health`); `notifications/initialized`→202 |
| Markdown | `src/proxy.ts` (Next16 renamed middleware→proxy): `Accept: text/markdown` on `/` → markdown + `Vary: Accept`; Vary appended on HTML passthrough too |
| SW | `VERSION` bump invalidates; precache shell; navigations network-first→cache→offline; assets SWR; `/api/*` bypass; only `res.ok` navigations cached (poison-guard) |
| Landing sim | Mock-mail cycle, IO counters, cached-rect tilt (measure on `pointerenter`, never at load) |

### Decisions + reasoning

- Iframe shell: keeps single-file app portable; app stays mounted so mailbox survives round-trips.
- No database ever: privacy story + zero ops; provider + localStorage suffice.
- mail.gw fallback (not retry): Mail.tm 500s are IP-bans, not flakes.
- Precompiled landing CSS + subset fonts: killed 124KB blocking JIT + 3.9MB icons → 79KB + 23 icons.
- Geist removed: 2 preloads served only invisible text; hurt Slow-4G.
- Empty ad divs (never `display:none`, never ad code): zero layout impact + zero policy risk.
- Human-voice blog, SEO skeleton untouched (H1/keywords/links/schema).

### Edge cases

- Collision (400/422) → regenerate; dead-code resends invalidate priors (documented); blocked domains → fresh mailbox → permanent-inbox advice.
- Expiry mid-flow → Extend; saved restore after provider prune → honest error.
- SW failures swallowed; audio needs first gesture; clipboard absence → `[UNKNOWN — fallback unverified]`.

---

## 7. Data Layer

**Database: none.** Logical models = `ar_saved_mails[] {address,password,savedAt(,lastUsedAt)}`, `ar_active_session`.

| Method | Path | Purpose | Req / Res | Auth |
|---|---|---|---|---|
| GET | `/api` | Health placeholder | — / `{message}` | none |
| ANY | `/api/mailtm/[...path]?…` | 1:1 Mail.tm mirror | Forwards CT+Auth only; binary-safe; 502/504 JSON on failure | Upstream JWT passthrough |
| GET | `…?health=1` | Relay + LIVE upstream probe (parallel 6s) | — / `{ok,relay,upstreams:{mail_tm,mail_gw},anyUpstream}` | none |
| GET | `/.well-known/mcp` | MCP manifest | — / server/tools/usage JSON | none |
| POST | `/.well-known/mcp` | JSON-RPC | initialize/tools.list+call / `-32700/-32600/-32601/-32602` | none |
| GET | `/` + `Accept: text/markdown` | Markdown homepage | — / `text/markdown`, `Vary: Accept` | none |

---

## 8. Conventions & Patterns

- Commits: Conventional Commits (`feat|fix|chore|docs|style|perf` + scope); amend only unpushed; push only on explicit approval.
- App JS: one script scope, `state` object, `el` cache, `PascalCase` screens, `ar_` storage prefix, `data-*` hooks (`data-launch`, `data-ad-slot`).
- CSS: utilities + small custom classes; `dark:` everywhere; `!`-important + arbitrary values OK in landing source.
- Files: kebab-case pages; blog slugs = titles; **mirror rule** `Copy-Item index.html public/ar-tempmail.html` + hash check; rebuild CSS after landing markup (`npm run build:landing`, chained in build); never hand-edit `landing.css`.
- Node scripts: bare-specifier `require()` only (absolute scoped-dir require breaks on Node 26).
- Docs: README + `llms.txt`/`llms-full.txt` + `docs.html` + `openapi.json` — update together when adding pages/endpoints.

---

## 9. Known Issues & TODOs

| # | Issue / debt | Status (2026-09-06) |
|---|---|---|
| 1 | **mail.gw DOWN (502 empty, direct-verified); mail.tm IP-bans Vercel** → generation 502s from Vercel; app auto-retries ×3 + human message; heals when gw recovers | ACTIVE OUTAGE — no code fix exists; monitor `?health=1` |
| 2 | Upstream `POST /accounts` intermittent `400 Syntax error` (both providers, direct-verified) | Provider-side; app surfaces toast |
| 3 | HTML `Vary: Accept` stripped by Vercel edge on documents (check 3b) | Accepted; markdown direction correct |
| 4 | `hitempmail.app` unregistered; canonicals point at it | Buy → connect → rewire + redirect |
| 5 | Blog 20/25 posts; India 6-month AdSense age rule | 2 posts/week; apply only when all 5 signals green |
| 6 | `contact@hitempmail.app` + `IN` in Organization schema are placeholders | Verify |
| 7 | `src/app/api/route.ts` hello-world dead weight | Keep as monitor or remove — open |
| 8 | Workspace junk (`tailwindcss-cli.exe`, `tw_*.txt`, logs) must never be committed | Pending cleanup |
| 9 | Local `.env` `DATABASE_URL` orphan; stale `node` processes after restarts | Harmless |
| 10 | `ads.txt` + unit code need real publisher ID post-approval | 15 slots + README plan ready |

---

## 10. Run & Deploy

| Need | Value |
|---|---|
| Env | `NEXT_PUBLIC_SITE_URL` (optional, default `https://hitempmail.app`); `VERCEL` auto (disables standalone); `.env` `DATABASE_URL` = unused orphan |
| Install | `npm install` (376 pkgs, 0 vulns) → `package-lock.json` |
| Dev | `npm run dev` → `http://127.0.0.1:3000/` (IP, not localhost — HMR guard) |
| Build | `npm run build` (= `build:landing` + `next build`); standalone `build:standalone` + `npm start` |
| Verify | `npm run verify:agentic` (local) · `BASE_URL=https://hitempmail.vercel.app …` (prod) — 7/8, 3b excepted |
| Deploy | Push `main` → Vercel auto-build; confirm `/`, `/api/mailtm/domains`, new pages |
| After landing markup | `npm run build:landing`; never hand-edit `landing.css` |
| After app edits | `Copy-Item index.html public/ar-tempmail.html` + hash-compare |
| Troubleshoot | HMR ws fail → use 127.0.0.1; relay 500/502 → `?health=1` tells relay-vs-provider; mailbox fail during outage → wait, auto-retry handles it |

---
...[truncated 9113 chars]