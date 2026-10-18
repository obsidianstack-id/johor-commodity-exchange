-- Johor Commodity Exchange: run once in Supabase SQL Editor.
-- Official initial values transcribed from the supplied decision document dated 19 Oct 2026.
create extension if not exists pgcrypto;

create table if not exists public.commodities (
 id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null, symbol text not null unique,
 category text not null, unit text not null default 'per lot', price_gold numeric(18,6) not null default 0 check(price_gold >= 0),
 price_usd numeric(18,2) not null default 0 check(price_usd >= 0), daily_change_pct numeric(9,4) not null default 0,
 indicative_volume text not null default '—', is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.price_history (
 id uuid primary key default gen_random_uuid(), commodity_id uuid not null references public.commodities(id) on delete cascade,
 date date not null, price_gold numeric(18,6) not null check(price_gold >= 0), price_usd numeric(18,2) not null check(price_usd >= 0),
 change_percentage numeric(9,4) not null default 0, open_usd numeric(18,2), high_usd numeric(18,2), low_usd numeric(18,2), close_usd numeric(18,2),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(commodity_id,date),
 check(open_usd is null or open_usd >= 0), check(high_usd is null or high_usd >= 0), check(low_usd is null or low_usd >= 0), check(close_usd is null or close_usd >= 0),
 check(high_usd is null or low_usd is null or high_usd >= low_usd),
 check(high_usd is null or open_usd is null or high_usd >= open_usd), check(high_usd is null or close_usd is null or high_usd >= close_usd),
 check(low_usd is null or open_usd is null or low_usd <= open_usd), check(low_usd is null or close_usd is null or low_usd <= close_usd)
);
create index if not exists price_history_commodity_date_idx on public.price_history(commodity_id,date desc);
create table if not exists public.exchange_settings (
 id integer primary key default 1 check(id=1), usd_per_gold numeric(18,6) not null default 19.50 check(usd_per_gold>0),
 import_tax_pct numeric(7,4) not null default 5.00 check(import_tax_pct between 0 and 100),
 domestic_export_tax_pct numeric(7,4) not null default 3.00 check(domestic_export_tax_pct between 0 and 100), updated_at timestamptz not null default now()
);
insert into public.exchange_settings(id) values(1) on conflict(id) do nothing;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade, is_admin boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.admin_audit_log (
 id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id) on delete set null, action text not null,
 entity_type text not null, entity_id text, before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);

-- Official base values. price_usd is rounded from GOLD × 19.50 to two decimals.
insert into public.commodities(slug,name,symbol,category,unit,price_gold,price_usd,daily_change_pct,indicative_volume) values
('makanan','Makanan','FOOD','Agrikultur','per lot',0.86,16.77,0,'—'),
('senjata','Senjata','ARMS','Industri','per unit',1.22,23.79,0,'—'),
('tiket','Tiket','TICK','Layanan','per tiket',1.20,23.40,0,'—'),
('kapal','Kapal','SHIP','Transportasi','per kapal',6.99,136.31,0,'—'),
('gandum-mentah','Gandum Mentah','WHEAT','Agrikultur','per ton',0.13,2.54,0,'—'),
('besi-mentah','Besi Mentah','IRON','Logam','per ton',0.10,1.95,0,'—'),
('minyak-mentah','Minyak Mentah','OIL','Energi','per barel',0.10,1.95,0,'—'),
('kapas-mentah','Kapas Mentah','COTN','Agrikultur','per bal',0.13,2.54,0,'—'),
('kayu','Kayu','WOOD','Bahan baku','per m³',0.13,2.54,0,'—'),
('batu-bara','Batu Bara','COAL','Energi','per ton',0.09,1.76,0,'—'),
('tembaga-mentah','Tembaga Mentah','COPR','Logam','per ton',0.13,2.54,0,'—'),
('bahan-bangunan','Bahan Bangunan','BLDG','Konstruksi','per lot',1.39,27.11,0,'—'),
('bahan-bakar','Bahan Bakar','FUEL','Energi','per unit',1.00,19.50,0,'—'),
('elektronik','Elektronik','ELEC','Teknologi','per unit',1.40,27.30,0,'—')
on conflict(slug) do nothing;

-- The source PDF supplies one official price point only, not a multi-day historical series.
insert into public.price_history(commodity_id,date,price_gold,price_usd,change_percentage,close_usd)
select id,date '2026-10-19',price_gold,price_usd,0,price_usd from public.commodities
on conflict(commodity_id,date) do update set price_gold=excluded.price_gold,price_usd=excluded.price_usd,close_usd=excluded.close_usd,updated_at=now();

alter table public.commodities enable row level security;
alter table public.price_history enable row level security;
alter table public.exchange_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.admin_audit_log enable row level security;
drop policy if exists "Public can read active commodities" on public.commodities;
create policy "Public can read active commodities" on public.commodities for select to anon,authenticated using(is_active=true);
drop policy if exists "Public can read price history" on public.price_history;
create policy "Public can read price history" on public.price_history for select to anon,authenticated using(true);
drop policy if exists "Public can read exchange settings" on public.exchange_settings;
create policy "Public can read exchange settings" on public.exchange_settings for select to anon,authenticated using(true);
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select to authenticated using(id=auth.uid());
-- No client-facing direct write policies. Admin changes must use the functions below.

create or replace function public.is_exchange_admin() returns boolean language sql stable security definer set search_path=public,auth as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_admin=true);
$$;
revoke all on function public.is_exchange_admin() from public;
grant execute on function public.is_exchange_admin() to authenticated;

create or replace function public.admin_update_settings(p_usd_per_gold numeric,p_import_tax_pct numeric,p_domestic_export_tax_pct numeric)
returns void language plpgsql security definer set search_path=public,auth as $$
declare old_row public.exchange_settings%rowtype;
begin
 if auth.uid() is null or not public.is_exchange_admin() then raise exception 'Admin authorization required'; end if;
 if p_usd_per_gold<=0 or p_import_tax_pct<0 or p_import_tax_pct>100 or p_domestic_export_tax_pct<0 or p_domestic_export_tax_pct>100 then raise exception 'Invalid FX/tax values'; end if;
 select * into old_row from public.exchange_settings where id=1 for update;
 update public.exchange_settings set usd_per_gold=p_usd_per_gold,import_tax_pct=p_import_tax_pct,domestic_export_tax_pct=p_domestic_export_tax_pct,updated_at=now() where id=1;
 update public.commodities set price_usd=round(price_gold*p_usd_per_gold,2),updated_at=now();
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,before_data,after_data) values(auth.uid(),'UPDATE_SETTINGS','exchange_settings','1',to_jsonb(old_row),jsonb_build_object('usd_per_gold',p_usd_per_gold,'import_tax_pct',p_import_tax_pct,'domestic_export_tax_pct',p_domestic_export_tax_pct));
end; $$;
revoke all on function public.admin_update_settings(numeric,numeric,numeric) from public;
grant execute on function public.admin_update_settings(numeric,numeric,numeric) to authenticated;

create or replace function public.admin_update_commodity_price(p_slug text,p_price_gold numeric)
returns void language plpgsql security definer set search_path=public,auth as $$
declare c public.commodities%rowtype; fx numeric;
begin
 if auth.uid() is null or not public.is_exchange_admin() then raise exception 'Admin authorization required'; end if;
 if p_price_gold<=0 then raise exception 'Price must be greater than zero'; end if;
 select usd_per_gold into fx from public.exchange_settings where id=1;
 select * into c from public.commodities where slug=p_slug and is_active=true for update;
 if not found then raise exception 'Commodity not found'; end if;
 update public.commodities set price_gold=p_price_gold,price_usd=round(p_price_gold*fx,2),updated_at=now() where id=c.id;
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,before_data,after_data) values(auth.uid(),'UPDATE_PRICE','commodity',c.id::text,to_jsonb(c),jsonb_build_object('slug',p_slug,'price_gold',p_price_gold,'price_usd',round(p_price_gold*fx,2)));
end; $$;
revoke all on function public.admin_update_commodity_price(text,numeric) from public;
grant execute on function public.admin_update_commodity_price(text,numeric) to authenticated;

create or replace function public.admin_upsert_price_history(p_slug text,p_date date,p_open_usd numeric,p_high_usd numeric,p_low_usd numeric,p_close_usd numeric)
returns void language plpgsql security definer set search_path=public,auth as $$
declare c public.commodities%rowtype; fx numeric; prev_close numeric; pct numeric; old_row jsonb;
begin
 if auth.uid() is null or not public.is_exchange_admin() then raise exception 'Admin authorization required'; end if;
 if p_date is null or p_open_usd<=0 or p_high_usd<=0 or p_low_usd<=0 or p_close_usd<=0 then raise exception 'Date and OHLC values must be positive'; end if;
 if p_low_usd>least(p_open_usd,p_close_usd) or p_high_usd<greatest(p_open_usd,p_close_usd) or p_low_usd>p_high_usd then raise exception 'Invalid OHLC: Low <= Open/Close <= High'; end if;
 select * into c from public.commodities where slug=p_slug and is_active=true for update;
 if not found then raise exception 'Commodity not found'; end if;
 select usd_per_gold into fx from public.exchange_settings where id=1;
 select close_usd into prev_close from public.price_history where commodity_id=c.id and date<p_date and close_usd is not null order by date desc limit 1;
 if prev_close is null or prev_close=0 then pct:=0; else pct:=round(((p_close_usd-prev_close)/prev_close)*100,4); end if;
 select to_jsonb(ph) into old_row from public.price_history ph where commodity_id=c.id and date=p_date;
 insert into public.price_history(commodity_id,date,price_gold,price_usd,change_percentage,open_usd,high_usd,low_usd,close_usd)
 values(c.id,p_date,round(p_close_usd/fx,6),round(p_close_usd,2),pct,round(p_open_usd,2),round(p_high_usd,2),round(p_low_usd,2),round(p_close_usd,2))
 on conflict(commodity_id,date) do update set price_gold=excluded.price_gold,price_usd=excluded.price_usd,change_percentage=excluded.change_percentage,open_usd=excluded.open_usd,high_usd=excluded.high_usd,low_usd=excluded.low_usd,close_usd=excluded.close_usd,updated_at=now();
 if p_date >= coalesce((select max(date) from public.price_history where commodity_id=c.id),p_date) then
  update public.commodities set price_usd=round(p_close_usd,2),price_gold=round(p_close_usd/fx,6),daily_change_pct=pct,updated_at=now() where id=c.id;
 end if;
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,before_data,after_data) values(auth.uid(),'UPSERT_PRICE_HISTORY','price_history',c.slug||':'||p_date::text,old_row,jsonb_build_object('open_usd',p_open_usd,'high_usd',p_high_usd,'low_usd',p_low_usd,'close_usd',p_close_usd,'change_percentage',pct));
end; $$;
revoke all on function public.admin_upsert_price_history(text,date,numeric,numeric,numeric,numeric) from public;
grant execute on function public.admin_upsert_price_history(text,date,numeric,numeric,numeric,numeric) to authenticated;

-- Enable Supabase Realtime for tables consumed by the mobile/web UI. Safe to rerun.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='commodities') then alter publication supabase_realtime add table public.commodities; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='price_history') then alter publication supabase_realtime add table public.price_history; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='exchange_settings') then alter publication supabase_realtime add table public.exchange_settings; end if;
end $$;
