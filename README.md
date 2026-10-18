# Johor Commodity Exchange — Market Terminal

A Next.js App Router starter for a fictional sovereign commodity exchange. Includes a dark financial-terminal UI, 14 commodity instruments, instrument detail pages, historical price charts, a demo admin console, Supabase/PostgreSQL schema, FX conversion and tax previews.

> **Important:** Prices and chart history in the current UI are illustrative demo data. Admin form changes are validated in browser memory and are **not persisted**. This repository is a starter implementation, not a live exchange, broker, or regulated trading system. Add real authentication, server-side authorization, database-backed reads/writes, audit trails, operational monitoring and legal/compliance review before production use.

## Stack

- Next.js 14 / React 18 / TypeScript
- Tailwind CSS with custom terminal styling
- Recharts for responsive price and OHLC-style charts
- Supabase / PostgreSQL schema in `supabase/schema.sql`

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The UI runs in demo mode without Supabase environment variables. To set up the database:

1. Create a project in [Supabase](https://supabase.com/).
2. Open **SQL Editor** in the Supabase dashboard.
3. Run the contents of `supabase/schema.sql`.
4. Copy the project URL and anon/public key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Restart the development server.

The schema includes `commodities`, `price_history`, `exchange_settings`, and `admin_audit_log`. `price_history` contains the required `id`, `commodity_id`, `date`, `price_gold`, `price_usd`, `change_percentage` columns and optional OHLC columns (`open_usd`, `high_usd`, `low_usd`, `close_usd`). A unique constraint ensures one record per commodity per date.

## Routes

- `/` — market overview with 14 listed commodity instruments.
- `/market/[slug]` — instrument detail, price history chart, OHLC reference chart and daily history table.
- `/admin` — demo control panel for FX rate (default 19.50 USD/GOLD), import tax (5%), domestic/export tax (3%), spot price conversion and daily OHLC input validation.

## FX and tax behavior

- USD reference = GOLD price × USD per GOLD.
- The UI's illustrative tax preview uses base USD price × (1 + tax percentage / 100).
- Tax handling varies by jurisdiction and transaction type. Confirm whether taxes should be added to or deducted from a quoted price and which side bears the tax before implementing live calculations.

## Production hardening checklist

- Add Supabase Auth and enforce admin roles on the server; do not treat a hidden admin route as authorization.
- Keep Supabase service-role credentials exclusively in server environment variables. Never prefix them with `NEXT_PUBLIC_`.
- Replace demo data helpers with database reads, and implement server routes/actions for price, FX, tax and historical-record mutations.
- Validate OHLC values on the server and enforce `low <= open/close <= high`; use database transactions for updates.
- Add audit logging for all admin changes, rate limiting, CSRF/session protections as appropriate, backups, monitoring and tests.
- Add an explicit data source and timestamp for any live market feed. Do not label manually entered or sample data as real-time.
- Review licensing/terms for any external price feed and chart library configuration.

## Deploy to GitHub and Vercel

1. Create a Git repository and push this project:

   ```bash
   git init
   git add .
   git commit -m "Initial Johor Commodity Exchange terminal"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPOSITORY_URL
   git push -u origin main
   ```

2. In [Vercel](https://vercel.com/), import the GitHub repository. Framework preset should be detected as Next.js; use `npm run build` as the build command.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under Vercel Project → Settings → Environment Variables if connecting Supabase.
4. Deploy. Subsequent pushes to the configured branch trigger deployments automatically.
5. Test the production build locally with `npm run build` before release.

## Notes

The instrument list and initial quotes are seeded in `lib/data.ts` for the front-end demo and separately inserted by `supabase/schema.sql`. For a database-backed production deployment, make the database the single source of truth and remove the duplicate sample catalogue from the UI path.
