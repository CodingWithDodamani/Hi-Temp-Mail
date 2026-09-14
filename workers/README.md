# Hi Temp Mail — own mail relay on Cloudflare (optional, ~10 minutes)

## Why

Mail.tm IP-bans shared serverless egress (notably Vercel: every proxied request dies with an empty 500), and browsers can't call `api.mail.tm` directly (it only sends CORS headers to its own `mail.tm` origin). When both bundled paths fail, the app shows "Mail servers are down".

This Worker runs the same relay logic on **Cloudflare's edge** — different IPs, different reputation — so it can reach the mail upstreams where Vercel cannot. Free tier (100k requests/day) is plenty.

## Setup

1. Create a free Cloudflare account → **Workers & Pages** → note your `*.workers.dev` subdomain.
2. Install wrangler once: `npm i -g wrangler` → `wrangler login`.
3. From the repo root: `cd workers && wrangler deploy`.
4. Copy the printed URL, e.g. `https://hi-temp-mail-relay.<you>.workers.dev`.
5. **Prove it works** (this is the moment of truth — if Cloudflare IPs are also banned, you'll know in 5 seconds):
   `curl "https://hi-temp-mail-relay.<you>.workers.dev/domains?page=1"`
   Expect HTTP 200 with a JSON domain list. If you get an empty 500, Cloudflare egress is banned too — stop here and tell the maintainer.
6. Wire the app: in `index.html`, set
   `const EDGE_RELAY = 'https://hi-temp-mail-relay.<you>.workers.dev';`
   then mirror the file (`Copy-Item index.html public/ar-tempmail.html`), commit, push.
7. The app now tries, in order: direct Mail.tm → **your Worker** → bundled Vercel relay, advancing automatically on network/CORS/timeout failures. No UI changes needed.

## Notes

- The Worker forwards `Content-Type` + `Authorization` only, passes bodies/bytes through untouched, falls back `mail.tm` → `mail.gw`, and caches nothing (`no-store`).
- Never commit secrets here — there are none; the relay is intentionally keyless.
- If you outgrow the free tier, the same file deploys unchanged on Workers Paid.
