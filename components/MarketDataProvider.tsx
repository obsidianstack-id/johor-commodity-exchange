'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

import {
  commodities as seed,
  defaultSettings,
  historyFor,
} from '@/lib/data';

import type {
  Commodity,
  MarketSettings,
  PricePoint,
} from '@/lib/data';

type MarketContextType = {
  commodities: Commodity[];
  settings: MarketSettings;
  histories: Record<string, PricePoint[]>;
  loading: boolean;
  connected: boolean;
  refresh: () => Promise<void>;
};

type CommodityRow = {
  id: string;
  slug: string;
  name: string;
  symbol: string;
  category: string;
  unit: string;
  price_gold: number | string;
  price_usd: number | string;
  daily_change_pct?: number | string | null;
  indicative_volume?: string | null;
};

type HistoryRow = {
  date: string;
  open_usd?: number | string | null;
  high_usd?: number | string | null;
  low_usd?: number | string | null;
  close_usd?: number | string | null;
  price_usd?: number | string | null;
  price_gold?: number | string | null;
  change_percentage?: number | string | null;
  commodities: {
    slug: string;
  };
};

const MarketContext = createContext<MarketContextType | null>(
  null,
);

function mapCommodity(row: CommodityRow): Commodity {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    symbol: row.symbol,
    category: row.category,
    unit: row.unit,
    priceGold: Number(row.price_gold),
    priceUsd: Number(row.price_usd),
    change: Number(row.daily_change_pct ?? 0),
    volume: row.indicative_volume || '—',
  };
}

function mapHistory(row: HistoryRow): PricePoint {
  const close = Number(
    row.close_usd ?? row.price_usd ?? 0,
  );

  return {
    date: String(row.date),
    open: Number(row.open_usd ?? close),
    high: Number(row.high_usd ?? close),
    low: Number(row.low_usd ?? close),
    close,
    price_gold: Number(row.price_gold ?? 0),
    price_usd: Number(row.price_usd ?? close),
    change_percentage: Number(row.change_percentage ?? 0),
  };
}

export function MarketDataProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [rows, setRows] = useState<Commodity[]>(seed);

  const [settings, setSettings] =
    useState<MarketSettings>(defaultSettings);

  const [histories, setHistories] = useState<
    Record<string, PricePoint[]>
  >(() =>
    Object.fromEntries(
      seed.map((commodity) => [
        commodity.slug,
        historyFor(commodity),
      ]),
    ),
  );

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  // ==========================================================
  // MEMUAT DATA PASAR DARI SUPABASE
  // ==========================================================

  const refresh = useCallback(async (): Promise<void> => {
    // Simpan client dalam variabel lokal setelah memeriksa null.
    const configuredClient = supabase;

    if (!configuredClient) {
      setLoading(false);
      setConnected(false);
      return;
    }

    const client: NonNullable<typeof supabase> =
      configuredClient;

    try {
      const [commodityResult, settingsResult, historyResult] =
        await Promise.all([
          client
            .from('commodities')
            .select('*')
            .eq('is_active', true)
            .order('name'),

          client
            .from('exchange_settings')
            .select('*')
            .eq('id', 1)
            .maybeSingle(),

          client
            .from('price_history')
            .select('*, commodities!inner(slug)')
            .order('date', { ascending: true }),
        ]);

      // Data komoditas.
      if (commodityResult.error) {
        console.error(
          'Gagal memuat komoditas:',
          commodityResult.error.message,
        );
      } else if (commodityResult.data) {
        const commodityRows =
          commodityResult.data as CommodityRow[];

        if (commodityRows.length > 0) {
          setRows(commodityRows.map(mapCommodity));
          setConnected(true);
        }
      }

      // Pengaturan kurs dan pajak.
      if (settingsResult.error) {
        console.error(
          'Gagal memuat pengaturan:',
          settingsResult.error.message,
        );
      } else if (settingsResult.data) {
        setSettings({
          usd_per_gold: Number(
            settingsResult.data.usd_per_gold,
          ),
          import_tax_pct: Number(
            settingsResult.data.import_tax_pct,
          ),
          domestic_export_tax_pct: Number(
            settingsResult.data.domestic_export_tax_pct,
          ),
        });
      }

      // Riwayat harga OHLC.
      if (historyResult.error) {
        console.error(
          'Gagal memuat riwayat harga:',
          historyResult.error.message,
        );
      } else if (historyResult.data) {
        const historyRows =
          historyResult.data as unknown as HistoryRow[];

        const grouped: Record<string, PricePoint[]> = {};

        for (const row of historyRows) {
          const slug = row.commodities?.slug;

          if (!slug) continue;

          if (!grouped[slug]) {
            grouped[slug] = [];
          }

          grouped[slug].push(mapHistory(row));
        }

        setHistories((previous) => {
          const next: Record<string, PricePoint[]> = {};

          for (const commodity of rows) {
            next[commodity.slug] =
              grouped[commodity.slug]?.length
                ? grouped[commodity.slug]
                : previous[commodity.slug] ?? [];
          }

          // Gunakan daftar terbaru dari hasil query apabila tersedia.
          const latestCommodityRows =
            commodityResult.data as
              | CommodityRow[]
              | null;

          if (latestCommodityRows?.length) {
            for (const commodity of latestCommodityRows) {
              next[commodity.slug] =
                grouped[commodity.slug]?.length
                  ? grouped[commodity.slug]
                  : previous[commodity.slug] ?? [];
            }
          }

          return next;
        });
      }
    } catch (error) {
      console.error(
        'Terjadi kesalahan saat memuat data pasar:',
        error,
      );

      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [rows]);

  // ==========================================================
  // REALTIME: PERUBAHAN DATA DATABASE
  // ==========================================================

  useEffect(() => {
    // Alias lokal ini menghindari error TypeScript karena null.
    const configuredClient = supabase;

    void refresh();

    if (!configuredClient) {
      return;
    }

    const client: NonNullable<typeof supabase> =
      configuredClient;

    const channel = client
      .channel('public-market-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'commodities',
        },
        () => {
          void refresh();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'exchange_settings',
        },
        () => {
          void refresh();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'price_history',
        },
        () => {
          void refresh();
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
        }
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [refresh]);

  // ==========================================================
  // NILAI CONTEXT UNTUK SELURUH APLIKASI
  // ==========================================================

  const value = useMemo<MarketContextType>(
    () => ({
      commodities: rows,
      settings,
      histories,
      loading,
      connected,
      refresh,
    }),
    [
      rows,
      settings,
      histories,
      loading,
      connected,
      refresh,
    ],
  );

  return (
    <MarketContext.Provider value={value}>
      {children}
    </MarketContext.Provider>
  );
}

// ============================================================
// HOOK DATA PASAR
// ============================================================

export function useMarketData(): MarketContextType {
  const value = useContext(MarketContext);

  if (!value) {
    throw new Error(
      'useMarketData must be used within MarketDataProvider',
    );
  }

  return value;
}
