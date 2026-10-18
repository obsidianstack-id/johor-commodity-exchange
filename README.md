# Johor Commodity Exchange — database-backed premium market terminal

Next.js 14 / React 18 / TypeScript / Tailwind CSS / Recharts / Supabase PostgreSQL. Responsive for Android/mobile touchscreens and desktop. Public market pages subscribe to Supabase Realtime; authorized admin mutations are executed by database RPC functions and audited.

## Official starting prices

The starter catalogue is transcribed from `copy.pdf`, titled *Penetapan Rentang Harga Minimum & Maksimum Domestik*, effective 19 October 2026. FX is 1 GOLD = USD 19.50, import tax 5%, domestic/export tax 3%. All 14 commodity base values are seeded in `lib/data.ts` and `supabase/schema.sql`; initial price history contains only the official date 2026-10-19. The PDF does not supply a multi-day OHLC series, so no invented historical series is generated.

**Policy ambiguity in the source document:** the text says the minimum uses a 3% domestic/export adjustment, but the published minimum column equals the base USD price for every commodity. The app preserves the published table: minimum = base price; maximum = base price × (1 + import tax%). The domestic/export tax remains editable and stored, but does not alter the published minimum until the policy owner confirms the intended formula. This is explicit to avoid silently changing the official table.

## Run locally

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Without Supabase variables, the app uses the official initial price list in local preview mode; admin writes are disabled.

## Supabase setup (required for persistence/realtime)

1. Create a Supabase project.
2. In **SQL Editor**, run the complete `supabase/schema.sql` file. If this is an existing project previously seeded with the earlier demo prices, run `supabase/migration_official_prices_2026_10_19.sql` once immediately after schema setup. This migration intentionally resets current quotes to the official starting schedule; do not rerun it after administrators have begun updating prices.
3. In **Project Settings → API**, copy Project URL and the publishable key (or legacy anon key).
4. Put them in `.env.local` and Vercel environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

5. Restart local dev or redeploy Vercel after changing environment variables.
6. Confirm the tables `commodities`, `price_history`, `exchange_settings`, `profiles`, and `admin_audit_log` exist. SQL enables Realtime for the three public market tables.

### Create the first admin safely

1. In Supabase **Authentication → Users**, create the admin user with email/password. Disable public sign-up if it is not needed.
2. Copy that user's UUID.
3. In SQL Editor, run this statement with the real UUID:

```sql
insert into public.profiles (id, is_admin)
values ('PASTE-AUTH-USER-UUID-HERE', true)
on conflict (id) do update set is_admin = true;
```

Only trusted project owners should grant `is_admin`. Do not expose service-role keys in browser code. `/admin` uses Supabase Auth and the database functions independently check the `profiles.is_admin` role. The public client has no direct table write policies.

## How data updates work

- Public market and detail pages query the database and subscribe to Realtime events for `commodities`, `exchange_settings`, and `price_history`.
- Admin saves use `admin_update_settings`, `admin_update_commodity_price`, and `admin_upsert_price_history` RPC functions.
- Database functions check `auth.uid()` and `profiles.is_admin`, validate FX/tax and OHLC, and write an audit record.
- FX updates recalculate current commodity USD prices from GOLD. Historical USD records are not rewritten.
- A daily OHLC save upserts by `(commodity_id, date)`, computes change versus the previous dated close, and updates the current quote if the submitted date is the newest session.
- If Realtime events are delayed or disconnected, clients can refresh/reopen the page; realtime should not be described as an exchange-grade tick feed. This is admin-published reference data, not a live global market feed.

## Routes

- `/` — market overview and official base/range prices.
- `/market/[slug]` — commodity details, historical line chart and OHLC chart/table.
- `/admin` — authenticated admin for FX, tax, spot prices and daily OHLC.

## Tax/range formula

- Current base USD = `price_gold × usd_per_gold`, rounded to two decimals for quote display.
- Official minimum = base USD, matching the table in the supplied PDF.
- Official maximum = base USD × `(1 + import_tax_pct / 100)`, rounded to two decimals.
- The domestic/export rate is stored and editable but not applied to the minimum due to the inconsistency in the source table described above.

## Deploy to GitHub + Vercel

1. Commit the project to GitHub.
2. Import that repository in Vercel; framework should be detected as Next.js.
3. Add the two `NEXT_PUBLIC_SUPABASE_*` variables to Vercel Project → Settings → Environment Variables for Production/Preview as required.
4. Redeploy after adding environment variables.
5. Create the admin Auth user and set the trusted `profiles.is_admin` flag using the steps above.
6. Test market data read, admin login, price save, historical OHLC save, and verify changes on another browser/device.

## Verification checklist before production

- Run `npm run build`.
- Test the SQL file in a new Supabase project.
- Verify the 14 GOLD values and USD conversions against the official table.
- Verify unauthorized users cannot execute admin RPC functions.
- Verify an admin update is visible on a separate browser/device through Realtime.
- Back up the database and review security/audit retention before relying on this as an operational price system.

This is a market-reference application, not a payment system, brokerage, or exchange-grade real-time trading engine.
