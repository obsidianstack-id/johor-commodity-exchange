'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Shell from '@/components/Shell';
import { useMarketData } from '@/components/MarketDataProvider';
import { rangeFor } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import {
  LockKeyhole,
  LogOut,
  Save,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

export default function AdminPage() {
  const {
    commodities,
    settings,
    histories,
    connected,
    refresh,
  } = useMarketData();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const [fx, setFx] = useState(String(settings.usd_per_gold));
  const [importTax, setImportTax] = useState(
    String(settings.import_tax_pct),
  );
  const [domesticTax, setDomesticTax] = useState(
    String(settings.domestic_export_tax_pct),
  );

  const [selected, setSelected] = useState('makanan');
  const [gold, setGold] = useState('0.86');
  const [date, setDate] = useState('2026-10-19');

  const [open, setOpen] = useState('16.77');
  const [high, setHigh] = useState('16.77');
  const [low, setLow] = useState('16.77');
  const [close, setClose] = useState('16.77');

  // Melindungi input OHLC saat pengguna sedang mengetik.
  const [ohlcDirty, setOhlcDirty] = useState(false);

  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  const chosen =
    commodities.find((item) => item.slug === selected) ??
    commodities[0];

  const fxNum = Number(fx);
  const goldNum = Number(gold);
  const priceUsd = goldNum * fxNum;

  const range = useMemo(
    () =>
      rangeFor(
        Number.isFinite(priceUsd) ? priceUsd : 0,
        {
          usd_per_gold: fxNum || 0,
          import_tax_pct: Number(importTax) || 0,
          domestic_export_tax_pct: Number(domesticTax) || 0,
        },
        Number.isFinite(goldNum) ? goldNum : 0,
      ),
    [priceUsd, fxNum, importTax, domesticTax, goldNum],
  );

  // Sinkronisasi pengaturan dari database.
  useEffect(() => {
    setFx(String(settings.usd_per_gold));
    setImportTax(String(settings.import_tax_pct));
    setDomesticTax(String(settings.domestic_export_tax_pct));
  }, [settings]);

  // Memuat data komoditas dan OHLC.
  // Jangan menimpa input OHLC selama pengguna sedang mengedit.
  useEffect(() => {
    if (ohlcDirty) return;

    const commodity = commodities.find(
      (item) => item.slug === selected,
    );

    if (!commodity) return;

    setGold(String(commodity.priceGold));

    const history = histories[selected] || [];
    const last = history[history.length - 1];

    if (last) {
      setDate(last.date);
      setOpen(last.open.toFixed(2));
      setHigh(last.high.toFixed(2));
      setLow(last.low.toFixed(2));
      setClose(last.close.toFixed(2));
    }
  }, [
    selected,
    connected,
    commodities,
    histories,
    ohlcDirty,
  ]);

  // ============================================================
  // AUTENTIKASI DAN PEMERIKSAAN HAK ADMIN
  // ============================================================
  useEffect(() => {
    let mounted = true;

    const configuredClient = supabase;

    if (!configuredClient) {
      setSessionReady(true);
      setUserId(null);
      setIsAdmin(false);

      return () => {
        mounted = false;
      };
    }

    const client: NonNullable<typeof supabase> =
      configuredClient;

    async function checkAdmin(id: string) {
      try {
        const { data, error } = await client
          .from('profiles')
          .select('is_admin')
          .eq('id', id)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          console.error(
            'Gagal memeriksa status admin:',
            error.message,
          );

          setIsAdmin(false);
          return;
        }

        setIsAdmin(Boolean(data?.is_admin));
      } catch (error) {
        console.error(
          'Terjadi kesalahan saat memeriksa admin:',
          error,
        );

        if (mounted) {
          setIsAdmin(false);
        }
      } finally {
        if (mounted) {
          setSessionReady(true);
        }
      }
    }

    async function initializeSession() {
      try {
        const { data, error } = await client.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error(
            'Gagal memeriksa sesi:',
            error.message,
          );

          setSessionReady(true);
          return;
        }

        const user = data.session?.user ?? null;

        setUserId(user?.id ?? null);

        if (user) {
          await checkAdmin(user.id);
        } else {
          setIsAdmin(false);
          setSessionReady(true);
        }
      } catch (error) {
        console.error('Gagal memuat sesi:', error);

        if (mounted) {
          setSessionReady(true);
        }
      }
    }

    void initializeSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      const user = session?.user ?? null;

      setUserId(user?.id ?? null);

      if (!user) {
        setIsAdmin(false);
        setSessionReady(true);
        return;
      }

      setTimeout(() => {
        if (mounted) {
          void checkAdmin(user.id);
        }
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ============================================================
  // LOGIN
  // ============================================================
  const signIn = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const configuredClient = supabase;

    if (!configuredClient) {
      setFeedback('Supabase belum dikonfigurasi.');
      return;
    }

    const client: NonNullable<typeof supabase> =
      configuredClient;

    setAuthBusy(true);
    setFeedback('');

    try {
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setFeedback(`Login gagal: ${error.message}`);
      }
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat login.',
      );
    } finally {
      setAuthBusy(false);
    }
  };

  // ============================================================
  // LOGOUT
  // ============================================================
  const signOut = async () => {
    const configuredClient = supabase;

    if (configuredClient) {
      const client: NonNullable<typeof supabase> =
        configuredClient;

      const { error } = await client.auth.signOut();

      if (error) {
        setFeedback(`Logout gagal: ${error.message}`);
        return;
      }
    }

    setUserId(null);
    setIsAdmin(false);
    setFeedback('Sesi admin telah berakhir.');
  };

  // ============================================================
  // SIMPAN PENGATURAN KURS DAN PAJAK
  // ============================================================
  const saveSettings = async () => {
    const configuredClient = supabase;

    if (!configuredClient || !isAdmin) return;

    const client: NonNullable<typeof supabase> =
      configuredClient;

    const importTaxNum = Number(importTax);
    const domesticTaxNum = Number(domesticTax);

    if (
      !Number.isFinite(fxNum) ||
      !Number.isFinite(importTaxNum) ||
      !Number.isFinite(domesticTaxNum) ||
      fxNum <= 0 ||
      importTaxNum < 0 ||
      importTaxNum > 100 ||
      domesticTaxNum < 0 ||
      domesticTaxNum > 100
    ) {
      setFeedback(
        'Kurs harus lebih besar dari nol dan pajak harus antara 0–100%.',
      );
      return;
    }

    setBusy(true);
    setFeedback('');

    try {
      const { error } = await client.rpc(
        'admin_update_settings',
        {
          p_usd_per_gold: fxNum,
          p_import_tax_pct: importTaxNum,
          p_domestic_export_tax_pct: domesticTaxNum,
        },
      );

      if (error) {
        setFeedback(
          `Gagal menyimpan pengaturan: ${error.message}`,
        );
        return;
      }

      await refresh();

      setFeedback(
        'Pengaturan kurs dan pajak berhasil disimpan.',
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat menyimpan pengaturan.',
      );
    } finally {
      setBusy(false);
    }
  };

  // ============================================================
  // SIMPAN HARGA KOMODITAS
  // ============================================================
  const savePrice = async () => {
    const configuredClient = supabase;

    if (!configuredClient || !isAdmin || !chosen) return;

    const client: NonNullable<typeof supabase> =
      configuredClient;

    if (
      !Number.isFinite(goldNum) ||
      goldNum <= 0 ||
      !Number.isFinite(fxNum) ||
      fxNum <= 0
    ) {
      setFeedback(
        'Harga GOLD dan kurs harus lebih besar dari nol.',
      );
      return;
    }

    setBusy(true);
    setFeedback('');

    try {
      const { error } = await client.rpc(
        'admin_update_commodity_price',
        {
          p_slug: selected,
          p_price_gold: goldNum,
        },
      );

      if (error) {
        setFeedback(
          `Gagal menyimpan harga: ${error.message}`,
        );
        return;
      }

      await refresh();

      setFeedback(
        `Harga ${chosen.name} berhasil disimpan. Referensi sekitar $${priceUsd.toFixed(2)} USD.`,
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat menyimpan harga.',
      );
    } finally {
      setBusy(false);
    }
  };

  // ============================================================
  // SIMPAN RIWAYAT HARGA OHLC
  // ============================================================
  const saveHistory = async () => {
    const configuredClient = supabase;

    if (!configuredClient || !isAdmin || !chosen) return;

    const client: NonNullable<typeof supabase> =
      configuredClient;

    const o = Number(open);
    const h = Number(high);
    const l = Number(low);
    const c = Number(close);

    if (
      !date ||
      ![o, h, l, c].every(
        (number) => Number.isFinite(number) && number > 0,
      )
    ) {
      setFeedback(
        'Tanggal dan seluruh nilai OHLC harus valid dan lebih besar dari nol.',
      );
      return;
    }

    if (
      l > Math.min(o, c) ||
      h < Math.max(o, c) ||
      l > h
    ) {
      setFeedback(
        'OHLC tidak valid. Pastikan Low ≤ Open dan Close ≤ High, serta Low ≤ High.',
      );
      return;
    }

    setBusy(true);
    setFeedback('');

    try {
      const { error } = await client.rpc(
        'admin_upsert_price_history',
        {
          p_slug: selected,
          p_date: date,
          p_open_usd: o,
          p_high_usd: h,
          p_low_usd: l,
          p_close_usd: c,
        },
      );

      if (error) {
        setFeedback(
          `Gagal menyimpan riwayat: ${error.message}`,
        );
        return;
      }

      // Pertahankan nilai form yang baru saja disimpan.
      // Setelah refresh selesai, izinkan sinkronisasi berikutnya.
      await refresh();

      setOhlcDirty(false);

      setFeedback(
        `Riwayat ${chosen.name} tanggal ${date} berhasil disimpan.`,
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat menyimpan riwayat.',
      );
    } finally {
      setBusy(false);
    }
  };

  // ============================================================
  // LOADING
  // ============================================================
  if (!sessionReady) {
    return (
      <Shell active="admin">
        <main className="content">
          <div className="eyebrow">SECURE OPERATIONS</div>
          <h1 className="page-title">
            Administration Console
          </h1>
          <div className="notice">
            Memeriksa sesi admin…
          </div>
        </main>
      </Shell>
    );
  }

  // ============================================================
  // HALAMAN LOGIN
  // ============================================================
  if (!userId || !isAdmin) {
    return (
      <Shell active="admin">
        <main className="content admin-auth-wrap">
          <div className="eyebrow">
            JOHOR EXCHANGE / RESTRICTED ACCESS
          </div>

          <h1 className="page-title">
            Administration Console
          </h1>

          <p className="muted">
            Masuk menggunakan akun Supabase Auth yang telah
            diberi hak administrator. Mengetahui URL halaman
            tidak otomatis memberikan akses administrator.
          </p>

          <form
            className="panel admin-auth-panel"
            onSubmit={signIn}
          >
            <div className="panel-head">
              <div>
                <div className="eyebrow">SECURITY GATE</div>
                <strong
                  style={{
                    display: 'block',
                    marginTop: 5,
                  }}
                >
                  Admin sign-in
                </strong>
              </div>

              <LockKeyhole size={22} />
            </div>

            <div className="admin-form-body">
              <div className="field">
                <label>Email admin</label>
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  required
                  placeholder="admin@example.com"
                />
              </div>

              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  required
                  placeholder="Password akun Supabase Auth"
                />
              </div>

              <button
                className="button button-primary full-button"
                disabled={authBusy || !supabase}
                type="submit"
              >
                {authBusy
                  ? 'SIGNING IN…'
                  : 'SIGN IN SECURELY ↗'}
              </button>

              {userId && !isAdmin && (
                <div className="notice">
                  Akun berhasil login, tetapi belum memiliki
                  hak administrator. Periksa apakah
                  profiles.is_admin bernilai true untuk user
                  ID tersebut.
                </div>
              )}

              {!supabase && (
                <div className="notice">
                  Supabase belum tersambung. Periksa environment
                  variables dan deploy ulang.
                </div>
              )}

              {feedback && (
                <div className="notice">{feedback}</div>
              )}
            </div>
          </form>

          <div className="footer">
            ADMIN ACCESS · NEVER SHARE YOUR PASSWORD OR SECRET KEY
          </div>
        </main>
      </Shell>
    );
  }

  // ============================================================
  // DASHBOARD ADMIN
  // ============================================================
  return (
    <Shell active="admin">
      <main className="content">
        <div className="admin-title-row">
          <div>
            <div className="eyebrow">
              EXCHANGE OPERATIONS / CONTROL ROOM
            </div>

            <h1 className="page-title">
              Administration Console
            </h1>

            <div className="muted">
              Pengaturan, harga komoditas, dan riwayat pasar.
            </div>
          </div>

          <button
            className="button"
            onClick={() => void signOut()}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>

        <div className="admin-status-strip">
          <span>
            <ShieldCheck size={16} />
            AUTHENTICATED ADMIN
          </span>

          <span
            className={connected ? 'positive' : 'negative'}
          >
            {connected
              ? '● DATABASE CONNECTED'
              : '● DATABASE NOT CONNECTED'}
          </span>

          <button
            className="button"
            onClick={() => void refresh()}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        <div
          className="admin-layout"
          style={{ marginTop: 16 }}
        >
          {/* PENGATURAN KURS DAN PAJAK */}
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">
                  01 / FX & TAX POLICY
                </div>

                <strong
                  style={{
                    display: 'block',
                    marginTop: 5,
                  }}
                >
                  Exchange Parameters
                </strong>
              </div>

              <span className="pill">GLOBAL</span>
            </div>

            <div className="admin-form-body">
              <div className="field">
                <label>USD per GOLD</label>
                <input
                  type="number"
                  min="0.000001"
                  step="0.01"
                  value={fx}
                  onChange={(event) =>
                    setFx(event.target.value)
                  }
                />
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>Import tax (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={importTax}
                    onChange={(event) =>
                      setImportTax(event.target.value)
                    }
                  />
                </div>

                <div className="field">
                  <label>Domestic / export tax (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={domesticTax}
                    onChange={(event) =>
                      setDomesticTax(event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="notice">
                Preview komoditas terpilih
                <br />
                Harga dasar:{' '}
                <strong>
                  ${(goldNum * fxNum || 0).toFixed(2)}
                </strong>
                <br />
                Published minimum:{' '}
                <strong>${range.min.toFixed(2)}</strong>
                <br />
                Import maximum:{' '}
                <strong>${range.max.toFixed(2)}</strong>
              </div>

              <button
                className="button button-primary full-button"
                disabled={busy}
                onClick={() => void saveSettings()}
              >
                <Save size={15} />
                SAVE FX & TAX SETTINGS
              </button>
            </div>
          </section>

          {/* HARGA KOMODITAS */}
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">
                  02 / SPOT PRICE CONTROL
                </div>

                <strong
                  style={{
                    display: 'block',
                    marginTop: 5,
                  }}
                >
                  Commodity Pricing
                </strong>
              </div>

              <span className="pill">AUTO-CONVERT</span>
            </div>

            <div className="admin-form-body">
              <div className="field">
                <label>Instrument</label>

                <select
                  value={selected}
                  onChange={(event) => {
                    setOhlcDirty(false);
                    setSelected(event.target.value);
                  }}
                >
                  {commodities.map((commodity) => (
                    <option
                      value={commodity.slug}
                      key={commodity.slug}
                    >
                      {commodity.symbol} — {commodity.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Base price (GOLD)</label>

                <input
                  type="number"
                  min="0.000001"
                  step="0.0001"
                  value={gold}
                  onChange={(event) =>
                    setGold(event.target.value)
                  }
                />
              </div>

              <div className="price-preview">
                <div className="muted">
                  AUTO-CONVERTED REFERENCE
                </div>

                <div className="stat-value">
                  $
                  {(Number.isFinite(priceUsd)
                    ? priceUsd
                    : 0
                  ).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  <span
                    className="muted"
                    style={{ fontSize: 11 }}
                  >
                    USD
                  </span>
                </div>

                <div className="muted">
                  Rate:{' '}
                  {Number.isFinite(fxNum)
                    ? fxNum.toFixed(2)
                    : '—'}{' '}
                  USD / GOLD
                </div>

                <div className="range-preview">
                  Official range{' '}
                  <strong>
                    ${range.min.toFixed(2)} – $
                    {range.max.toFixed(2)}
                  </strong>
                </div>
              </div>

              <button
                className="button button-primary full-button"
                disabled={busy || !connected}
                onClick={() => void savePrice()}
              >
                <Save size={15} />
                SAVE COMMODITY PRICE
              </button>
            </div>
          </section>

          {/* EDITOR RIWAYAT OHLC */}
          <section
            className="panel"
            style={{ gridColumn: '1 / -1' }}
          >
            <div className="panel-head">
              <div>
                <div className="eyebrow">
                  03 / HISTORICAL INDEX INPUT
                </div>

                <strong
                  style={{
                    display: 'block',
                    marginTop: 5,
                  }}
                >
                  Daily OHLC Editor
                </strong>
              </div>

              <span className="pill">DATABASE UPSERT</span>
            </div>

            <div className="admin-form-body">
              <div className="form-grid">
                <div className="field">
                  <label>Commodity</label>

                  <select
                    value={selected}
                    onChange={(event) => {
                      setOhlcDirty(false);
                      setSelected(event.target.value);
                    }}
                  >
                    {commodities.map((commodity) => (
                      <option
                        value={commodity.slug}
                        key={commodity.slug}
                      >
                        {commodity.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Trading date</label>

                  <input
                    type="date"
                    value={date}
                    onChange={(event) => {
                      setOhlcDirty(true);
                      setDate(event.target.value);
                    }}
                    required
                  />
                </div>

                <div className="field">
                  <label>Open (USD)</label>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={open}
                    onChange={(event) => {
                      setOhlcDirty(true);
                      setOpen(event.target.value);
                    }}
                    required
                  />
                </div>

                <div className="field">
                  <label>High (USD)</label>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={high}
                    onChange={(event) => {
                      setOhlcDirty(true);
                      setHigh(event.target.value);
                    }}
                    required
                  />
                </div>

                <div className="field">
                  <label>Low (USD)</label>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={low}
                    onChange={(event) => {
                      setOhlcDirty(true);
                      setLow(event.target.value);
                    }}
                    required
                  />
                </div>

                <div className="field">
                  <label>Close (USD)</label>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={close}
                    onChange={(event) => {
                      setOhlcDirty(true);
                      setClose(event.target.value);
                    }}
                    required
                  />
                </div>

                <div className="field">
                  <label>Calculated close (GOLD)</label>

                  <input
                    readOnly
                    value={
                      fxNum > 0
                        ? (Number(close) / fxNum).toFixed(4)
                        : '—'
                    }
                  />
                </div>

                <div className="field">
                  <label>Last stored close</label>

                  <input
                    readOnly
                    value={
                      histories[selected]?.length
                        ? `$${histories[selected][histories[selected].length - 1].close.toFixed(2)}`
                        : 'No history'
                    }
                  />
                </div>
              </div>

              {ohlcDirty && (
                <div className="notice">
                  Kamu sedang mengedit data OHLC. Perubahan
                  belum tersimpan ke database sampai tombol
                  SAVE DAILY OHLC RECORD ditekan.
                </div>
              )}

              <div className="notice">
                Validasi OHLC: Low tidak boleh melebihi Open,
                Close, atau High. High tidak boleh lebih rendah
                daripada Open atau Close.
              </div>

              <button
                className="button button-primary"
                disabled={busy || !connected}
                onClick={() => void saveHistory()}
              >
                <Save size={15} />
                {busy
                  ? 'SAVING…'
                  : 'SAVE DAILY OHLC RECORD'}
              </button>
            </div>
          </section>

          {/* DAFTAR KOMODITAS */}
          <section
            className="panel"
            style={{ gridColumn: '1 / -1' }}
          >
            <div className="panel-head">
              <div>
                <div className="eyebrow">
                  04 / CURRENT CATALOG
                </div>

                <strong
                  style={{
                    display: 'block',
                    marginTop: 5,
                  }}
                >
                  Active Commodity Registry
                </strong>
              </div>

              <span className="pill">
                {commodities.length} RECORDS
              </span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>SYMBOL</th>
                    <th>COMMODITY</th>
                    <th className="right">PRICE GOLD</th>
                    <th className="right">PRICE USD</th>
                    <th className="right">RANGE MIN–MAX</th>
                    <th>STATUS</th>
                  </tr>
                </thead>

                <tbody>
                  {commodities.map((commodity) => {
                    const commodityRange = rangeFor(
                      commodity.priceUsd,
                      settings,
                      commodity.priceGold,
                    );

                    return (
                      <tr key={commodity.slug}>
                        <td>
                          <span className="ticker">
                            {commodity.symbol}
                          </span>
                        </td>

                        <td>{commodity.name}</td>

                        <td className="right">
                          {commodity.priceGold.toFixed(4)}
                        </td>

                        <td className="right">
                          ${commodity.priceUsd.toFixed(2)}
                        </td>

                        <td className="right">
                          ${commodityRange.min.toFixed(2)} – $
                          {commodityRange.max.toFixed(2)}
                        </td>

                        <td className="positive">
                          ● ACTIVE
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {feedback && (
            <div
              className="notice"
              role="status"
              aria-live="polite"
              style={{ gridColumn: '1 / -1' }}
            >
              {feedback}
            </div>
          )}
        </div>

        <div className="footer">
          ALL CHANGES ARE SERVER-VALIDATED AND STORED THROUGH
          SUPABASE
        </div>
      </main>
    </Shell>
  );
}
