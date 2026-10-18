-- ONE-TIME migration for an existing Supabase project previously seeded with demo prices.
-- Run only when applying the official 19 Oct 2026 schedule for the first time.
-- Do not rerun after admins have begun managing current prices; it restores these starting values.
update public.commodities set price_gold=0.86,price_usd=16.77,daily_change_pct=0,updated_at=now() where slug='makanan';
update public.commodities set price_gold=1.22,price_usd=23.79,daily_change_pct=0,updated_at=now() where slug='senjata';
update public.commodities set price_gold=1.20,price_usd=23.40,daily_change_pct=0,updated_at=now() where slug='tiket';
update public.commodities set price_gold=6.99,price_usd=136.31,daily_change_pct=0,updated_at=now() where slug='kapal';
update public.commodities set price_gold=0.13,price_usd=2.54,daily_change_pct=0,updated_at=now() where slug='gandum-mentah';
update public.commodities set price_gold=0.10,price_usd=1.95,daily_change_pct=0,updated_at=now() where slug='besi-mentah';
update public.commodities set price_gold=0.10,price_usd=1.95,daily_change_pct=0,updated_at=now() where slug='minyak-mentah';
update public.commodities set price_gold=0.13,price_usd=2.54,daily_change_pct=0,updated_at=now() where slug='kapas-mentah';
update public.commodities set price_gold=0.13,price_usd=2.54,daily_change_pct=0,updated_at=now() where slug='kayu';
update public.commodities set price_gold=0.09,price_usd=1.76,daily_change_pct=0,updated_at=now() where slug='batu-bara';
update public.commodities set price_gold=0.13,price_usd=2.54,daily_change_pct=0,updated_at=now() where slug='tembaga-mentah';
update public.commodities set price_gold=1.39,price_usd=27.11,daily_change_pct=0,updated_at=now() where slug='bahan-bangunan';
update public.commodities set price_gold=1.00,price_usd=19.50,daily_change_pct=0,updated_at=now() where slug='bahan-bakar';
update public.commodities set price_gold=1.40,price_usd=27.30,daily_change_pct=0,updated_at=now() where slug='elektronik';
insert into public.price_history(commodity_id,date,price_gold,price_usd,change_percentage,close_usd)
select id,date '2026-10-19',price_gold,price_usd,0,price_usd from public.commodities
on conflict(commodity_id,date) do update set price_gold=excluded.price_gold,price_usd=excluded.price_usd,change_percentage=0,close_usd=excluded.close_usd,updated_at=now();
