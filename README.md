# 🦍 ApeCheck

**Scan before you ape.** ApeCheck is a Solana token rug-pull risk scanner for degen traders. Paste a fresh token's contract address and get an instant, trustworthy pre-buy read: mint/freeze authority, LP lock/burn, dev-wallet holdings, holder concentration, socials & domain age — plus where to buy and one-tap dev-dump alerts.

Web (Next.js on Vercel) + Mobile (Expo / React Native) share one TypeScript core and one design-token set. Everything runs on free tiers.

> **Not financial advice.** ApeCheck surfaces risk signals, not guarantees. *Only buy what you can afford to lose.*

---

## What you get

- **Two separate scores, never merged.** A **Risk Score** (0–100, higher = safer) and a **Potential Score** (0–100, upside *signal strength* only). They are always shown as two distinct badges.
- **Transparent breakdowns.** Every score is itemized in a terminal-style log: what passed, what failed, what couldn't be determined (unknown free-tier data is treated as *risk*, never as safe).
- **Where to buy.** Jupiter as the primary aggregated "Buy Now," plus per-DEX cards (Raydium, Orca, Meteora, Pump.fun) with slippage guidance, step-by-step instructions, and deep-links.
- **Watchlist + dev-dump alerts.** Watch a token and get a push notification if the dev wallet dumps past the threshold (default **20%**).
- **Shareable scan cards.** Dynamic OpenGraph images for every scanned token.

### Risk Score weights (sum to 100)

| Check | Weight |
|---|---|
| Mint authority renounced | 20 |
| Freeze authority renounced | 15 |
| LP locked / burned | 25 |
| Dev wallet holding | 20 |
| Top-10 holder concentration | 10 |
| Token age | 10 |

**Bands:** 80–100 Low Risk (green) · 50–79 Medium Risk (amber) · 0–49 High Risk / Likely Rug (red).

### Potential Score weights (sum to 100)

| Signal | Weight |
|---|---|
| Liquidity depth | 25 |
| Holder growth | 25 |
| Social completeness | 20 |
| Social health | 15 |
| Volume-to-liquidity ratio | 15 |

> Potential is always labeled **"Signal strength only — not financial advice, not a price prediction."**

---

## Monorepo layout

```
apecheck/
├── apps/
│   ├── web/          Next.js App Router — API routes + all screens (Vercel)
│   └── mobile/       Expo (React Native) — tabs, scan, watchlist, alerts (EAS)
├── packages/
│   ├── core/         Types, scoring formulas, scan engine, formatters, DEX templates
│   ├── api-clients/  RugCheck, DexScreener, Birdeye, Jupiter, Solana RPC, RDAP
│   └── ui/           Shared design tokens (colors/type/spacing) + Tailwind preset
├── cron/             Portable dev-wallet dump watcher (GitHub Actions / any Node host)
├── supabase/
│   └── schema.sql    Tables + Row Level Security policies
└── .github/workflows/dev-wallet-watch.yml
```

The shared packages are consumed **raw** (no build step) — the web app transpiles them via `transpilePackages`, and Metro resolves them for mobile. Design tokens live once in `packages/ui` and feed both Tailwind (web) and NativeWind (mobile).

---

## Prerequisites

- **Node.js ≥ 18.17** and npm ≥ 9 (workspaces).
- A free **[Supabase](https://supabase.com)** project (Postgres + Auth).
- A free **[Helius](https://helius.dev)** API key (Solana RPC).
- Optional: **[Birdeye](https://birdeye.so)** key (liquidity/volume), **[RugCheck](https://rugcheck.xyz)** JWT (higher limits), **[OneSignal](https://onesignal.com)** app (web push).
- For mobile: the **Expo Go** app on your phone (dev), or an **[EAS](https://expo.dev)** account (builds).

DexScreener and Jupiter need no key.

---

## 1. Install

```bash
git clone <your-repo-url> apecheck
cd apecheck
npm install        # installs all workspaces and links @apecheck/* packages
```

## 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run the contents of [`supabase/schema.sql`](supabase/schema.sql). This creates the tables and — importantly — enables **Row Level Security**:
   - `scans` — **global** scan cache (written by the server via the service-role key).
   - `scan_history` — **per-user** scan log (RLS: `auth.uid()`).
   - `watchlist`, `alerts`, `push_tokens` — **per-user**, all RLS-scoped to `auth.uid()`.
3. Under **Authentication → Providers**, enable **Email** (magic-link / OTP is used by both clients).
4. Grab your **Project URL**, **anon key**, and **service_role key** from **Project Settings → API**.

## 3. Configure environment

**Web** — copy the root example to the web app and fill it in:

```bash
cp .env.example apps/web/.env.local
```

All third-party data keys are **server-side only** — never prefixed with `NEXT_PUBLIC_`. See [`.env.example`](.env.example) for the full annotated list. Minimum to boot:

```ini
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...            # server only
HELIUS_API_KEY=...                       # server only
CRON_SECRET=<long-random-string>         # protects the cron endpoint
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Mobile** — copy its example:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Mobile only ever holds **public** values (`EXPO_PUBLIC_*`): the web API base URL and the Supabase URL + anon key. It never ships a data-provider key.

## 4. Run the web app

```bash
npm run dev:web        # http://localhost:3000
```

## 5. Run the mobile app

```bash
npm run dev:mobile     # Expo dev server; scan the QR with Expo Go
```

> **Testing on a physical device?** `localhost` won't reach your dev machine. Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to your machine's LAN IP (e.g. `http://192.168.1.20:3000`) and restart the Expo server.

---

## Architecture: how data flows

**All third-party API calls happen server-side only. Provider keys are never exposed to any client.**

```
                    ┌───────────────────────────────┐
   Web browser ───► │  Next.js API (apps/web)        │ ──► Helius RPC, RugCheck,
                    │  • POST /api/scan  (public)    │     DexScreener, Birdeye,
   Mobile app  ───► │    → scan engine, keys stay    │     Jupiter, RDAP/WHOIS
   (scan only)      │      on the server             │
                    │  • writes global `scans` cache │
                    └───────────────────────────────┘

   Web browser ───► Supabase (cookie session, RLS)  ┐
   Mobile app  ───► Supabase (anon key + JWT, RLS)  ┘ watchlist / alerts / push_tokens
```

- **Scanning** goes through the web `/api/scan` route so provider keys stay on the server. The mobile app calls the same endpoint.
- **User-scoped data** (watchlist, alerts, push tokens) is read/written **directly against Supabase under RLS** — the web app via a cookie session, the mobile app via the anon key + the user's JWT. This avoids a cookie/bearer auth mismatch and keeps every row access enforced by the database.
- **The service-role key** (bypasses RLS) is used only server-side: to write the global `scans` cache and to run the dump detector.

### Web API routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/scan` | POST | public | Run/refresh a scan (cached 5 min) |
| `/api/watchlist` | GET/POST | user | List / add watch |
| `/api/watchlist/[id]` | PATCH/DELETE | user | Toggle alert / remove |
| `/api/alerts` | GET | user | Dump-alert history |
| `/api/push-tokens` | POST | user | Register a device push token |
| `/api/scan-history` | GET | user | Per-user scan log |
| `/api/share/[tokenAddress]` | GET | public | Share metadata |
| `/api/internal/check-dumps` | GET/POST | `CRON_SECRET` | Dump detector (cron) |

---

## Dev-wallet dump alerts

A watched token's dev wallet is polled on a schedule; if its balance drops more than `DEV_DUMP_THRESHOLD_PERCENT` (**20%**) from the captured baseline, an alert row is inserted and a push is sent to the user's devices (Expo for mobile, OneSignal for web). There are **two ways** to run it — pick one (or both, for redundancy):

**A) Vercel Cron (canonical).** Already configured in [`apps/web/vercel.json`](apps/web/vercel.json) to hit `/api/internal/check-dumps` every 15 minutes. Set `CRON_SECRET` in your Vercel project so only the cron can trigger it. Nothing else to do.

**B) Portable worker.** [`cron/dev-wallet-watch.ts`](cron/dev-wallet-watch.ts) does the same work as a standalone Node script, depending only on the shared packages — run it anywhere:

```bash
npm run cron:dumps                 # single pass (ideal for scheduled cron / CI)
npm run watch --workspace @apecheck/cron   # resident loop (every 15 min)
```

A ready-to-use GitHub Actions schedule lives in [`.github/workflows/dev-wallet-watch.yml`](.github/workflows/dev-wallet-watch.yml) — add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `HELIUS_API_KEY` as repo secrets to enable it.

---

## Deploy

### Web → Vercel

1. Import the repo into [Vercel](https://vercel.com). Set the **Root Directory** to `apps/web`.
2. Add every server env var from `.env.example` in **Project Settings → Environment Variables** (including `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`).
3. Set `NEXT_PUBLIC_APP_URL` to your production URL.
4. Deploy. The cron in `vercel.json` starts running automatically.

### Mobile → EAS

1. `npm i -g eas-cli && eas login`
2. In `apps/mobile/app.json`, replace the placeholder `extra.eas.projectId` (run `eas init` to generate one).
3. Set public config via EAS env or `app.json → extra`: `apiUrl`, `supabaseUrl`, `supabaseAnonKey`.
4. Build: `eas build -p android` / `eas build -p ios` (from `apps/mobile`).

> **Icons/splash** in `apps/mobile/assets/` are branded *placeholders* generated by [`scripts/generate-icons.ps1`](apps/mobile/scripts/generate-icons.ps1). Replace them with final artwork before store submission.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev:web` | Next.js dev server |
| `npm run dev:mobile` | Expo dev server |
| `npm run build:web` | Production web build |
| `npm run build:packages` | Build shared packages (if a package build is needed) |
| `npm run cron:dumps` | Run the dump detector once |
| `npm run typecheck` | Type-check every workspace |
| `npm run lint` | Lint every workspace |

---

## Security & safety guarantees

These are enforced in code, not just convention:

- **No provider keys client-side.** Every RugCheck/DexScreener/Birdeye/Jupiter/RPC/WHOIS call runs on the server. The mobile bundle carries only public values.
- **Row Level Security on all user data.** `watchlist`, `alerts`, `push_tokens`, and `scan_history` are scoped to `auth.uid()`; the anon key cannot read another user's rows.
- **Risk and Potential are never merged** into a single number.
- **Non-dismissible disclaimers** ship with the UI verbatim: *"Signal strength only — not financial advice, not a price prediction."* near Potential, and *"Only buy what you can afford to lose. This score is a risk signal, not a guarantee."* near every buy action.
- **Unknown data counts as risk.** Missing free-tier signals lower the Risk Score rather than silently passing.

---

## License

MIT

