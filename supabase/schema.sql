-- Johor Commodity Exchange schema for Supabase/PostgreSQL.
create extension if not exists pgcrypto;

create table if not exists public.commodities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  symbol text not null unique,
  category text not null,
  unit text not null default 'per lot',
  price_gold numeric(18,6) not null default 0 check (price_gold >= 0),
  price_usd numeric(18,2) not null default 0 check (price_usd >= 0),
  daily_change_pct numeric(9,4) not null default 0,
  indicative_volume text not null default '—',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  commodity_id uuid not null references public.commodities(id) on delete cascade,
  date date not null,
  price_gold numeric(18,6) not null check (price_gold >= 0),
  price_usd numeric(18,2) not null check (price_usd >= 0),
  change_percentage numeric(9,4) not null default 0,
  open_usd numeric(18,2),
  high_usd numeric(18,2),
  low_usd numeric(18,2),
  close_usd numeric(18,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (commodity_id, date),
  check (open_usd is null or open_usd >= 0),
  check (high_usd is null or high_usd >= 0),
  check (low_usd is null or low_usd >= 0),
  check (close_usd is null or close_usd >= 0),
  check (high_usd is null or low_usd is null or high_usd >= low_usd),
  check (high_usd is null or open_usd is null or high_usd >= open_usd),
  check (high_usd is null or close_usd is null or high_usd >= close_usd),
  check (low_usd is null or open_usd is null or low_usd <= open_usd),
  check (low_usd is null or close_usd is null or low_usd <= close_usd)
);
create index if not exists price_history_commodity_date_idx on public.price_history (commodity_id, date desc);

create table if not exists public.exchange_settings (
  id integer primary key default 1 check (id = 1),
  usd_per_gold numeric(18,6) not null default 19.50 check (usd_per_gold > 0),
  import_tax_pct numeric(7,4) not null default 5.00 check (import_tax_pct between 0 and 100),
  domestic_export_tax_pct numeric(7,4) not null default 3.00 check (domestic_export_tax_pct between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into public.exchange_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

insert into public.commodities (slug,name,symbol,category,unit,price_gold,price_usd,daily_change_pct,indicative_volume) values
('makanan','Makanan','FOOD','Agrikultur','per lot',1.18,23.01,1.84,'18.42K'),
('senjata','Senjata','ARMS','Industri','per unit',8.40,163.80,-0.72,'2.84K'),
('tiket','Tiket','TICK','Layanan','per tiket',0.42,8.19,0.31,'41.20K'),
('kapal','Kapal','SHIP','Transportasi','per kapal',940.00,18330.00,2.65,'184'),
('gandum-mentah','Gandum Mentah','WHEAT','Agrikultur','per ton',0.86,16.77,1.12,'12.70K'),
('besi-mentah','Besi Mentah','IRON','Logam','per ton',2.75,53.63,-1.35,'8.15K'),
('minyak-mentah','Minyak Mentah','OIL','Energi','per barel',4.32,84.24,3.24,'26.91K'),
('kapas-mentah','Kapas Mentah','COTN','Agrikultur','per bal',1.52,29.64,-0.44,'6.72K'),
('kayu','Kayu','WOOD','Bahan baku','per m³',0.74,14.43,0.88,'14.50K'),
('batu-bara','Batu Bara','COAL','Energi','per ton',1.34,26.13,-2.08,'21.08K'),
('tembaga-mentah','Tembaga Mentah','COPR','Logam','per ton',5.70,111.15,1.91,'4.64K'),
('bahan-bangunan','Bahan Bangunan','BLDG','Konstruksi','per lot',1.06,20.67,0.54,'9.24K'),
('bahan-bakar','Bahan Bakar','FUEL','Energi','per unit',2.18,42.51,2.16,'19.43K'),
('elektronik','Elektronik','ELEC','Teknologi','per unit',12.50,243.75,1.07,'3.81K')
on conflict (slug) do nothing;

-- Public users may read active market data. Mutations must go through a server-side
-- endpoint that checks an authenticated admin role; do not enable broad client writes.
alter table public.commodities enable row level security;
alter table public.price_history enable row level security;
alter table public.exchange_settings enable row level security;
alter table public.admin_audit_log enable row level security;

drop policy if exists "Public can read active commodities" on public.commodities;
create policy "Public can read active commodities" on public.commodities for select using (is_active = true);
drop policy if exists "Public can read price history" on public.price_history;
create policy "Public can read price history" on public.price_history for select using (true);
drop policy if exists "Public can read exchange settings" on public.exchange_settings;
create policy "Public can read exchange settings" on public.exchange_settings for select using (true);
-- Intentionally no client write policies. Add admin-only policies after configuring
-- a trusted role model, or perform writes through server routes using a service key.
