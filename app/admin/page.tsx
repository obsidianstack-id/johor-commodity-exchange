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
  const { commodities, settings, histories, connected, refresh } =
    useMarketData();

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

  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  const chosen =
    commodities.find((commodity) => commodity.slug === selected) ||
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

  // Sinkronkan formulir dengan pengaturan dari database.
  useEffect(() => {
    setFx(String(settings.usd_per_gold));
    setImportTax(String(settings.import_tax_pct));
    setDomesticTax(String(settings.domestic_export_tax_pct));
  }, [settings]);

  // Muat harga dan riwayat saat komoditas berubah.
  useEffect(() => {
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
  }, [selected, connected, commodities, histories]);

  // Pemeriksaan sesi dan hak akses administrator.
  useEffect(() => {
    const client = supabase;
    let mounted = true;

    if (!client) {
      setSessionReady(true);
      return;
    }

    async function checkAdmin(id: string) {
      if (!mounted) return;

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
        console.error('Pemeriksaan admin gagal:', error);

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
          console.error('Gagal memeriksa sesi:', error.message);
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

      // Jalankan pemeriksaan di luar callback autentikasi.
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

  // Login administrator.
  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const client = supabase;

    if (!client) {
      setFeedback('Supabase belum dikonfigurasi.');
      return;
    }

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

  // Logout administrator.
  const signOut = async () => {
    const client = supabase;

    if (client) {
      await client.auth.signOut();
    }

    setUserId(null);
    setIsAdmin(false);
    setFeedback('Sesi admin telah berakhir.');
  };

  // Simpan pengaturan kurs dan pajak.
  const saveSettings = async () => {
    const client = supabase;

    if (!client || !isAdmin) return;

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
      const { error } = await client.rpc('admin_update_settings', {
        p_usd_per_gold: fxNum,
        p_import_tax_pct: importTaxNum,
        p_domestic_export_tax_pct: domesticTaxNum,
      });

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

  // Simpan harga komoditas.
  const savePrice = async () => {
    const client = supabase;

    if (!client || !isAdmin || !chosen) return;

    if (
      !Number.isFinite(goldNum) ||
      goldNum <= 0 ||
      !Number.isFinite(fxNum) ||
      fxNum <= 0
    ) {
      setFeedback(
        'Harga GOLD dan kurs harus berupa angka lebih besar dari nol.',
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
        setFeedback(`Gagal menyimpan harga: ${error.message}`);
        return;
      }

      await refresh();

      setFeedback(
        `Harga ${chosen.name} berhasil disimpan. Referensi baru sekitar $${priceUsd.toFixed(2)} USD.`,
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

  // Simpan atau perbarui data OHLC harian.
  const saveHistory = async () => {
    const client = supabase;

    if (!client || !isAdmin || !chosen) return;

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

    if (l > Math.min(o, c) || h < Math.max(o, c) || l > h) {
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

      await refresh();

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

  if (!sessionReady) {
    return (
      <Shell active="admin">
        <main className="content">
          <div className="eyebrow">SECURE OPERATIONS</div>
          <h1 className="page-title">Administration Console</h1>
          <div className="notice">Memeriksa sesi admin…</div>
        </main>
      </Shell>
    );
  }

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
            Masuk dengan akun Supabase Auth yang telah diberi
            peran administrator. URL halaman saja tidak memberikan
            hak untuk mengubah data.
          </p>

          <form
            className="panel admin-auth-panel"
            onSubmit={signIn}
          >
            <div className="panel-head">
              <div>
                <div className="eyebrow">SECURITY GATE</div>
                <strong
                  style={{ display: 'block', marginTop: 5 }}
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
                  Akun berhasil login tetapi belum memiliki
                  peran administrator. Periksa apakah
                  profiles.is_admin bernilai true untuk user ID
                  ini.
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
              Perubahan disimpan di PostgreSQL dan dapat
              disiarkan ke klien yang terhubung.
            </div>
          </div>

          <button className="button" onClick={signOut}>
            <LogOut size={15} />
            Sign out
          </button>
        </div>

        <div className="admin-status-strip">
          <span>
            <ShieldCheck size={16} />
            AUTHENTICATED ADMIN
          </span>

          <span className={connected ? 'positive' : 'negative'}>
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
          {/* Pengaturan kurs dan pajak */}
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">
                  01 / FX & TAX POLICY
                </div>
                <strong
                  style={{ display: 'block', marginTop: 5 }}
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
                  onChange={(event) => setFx(event.target.value)}
                />
                <small className="muted">
                  Nilai kurs GOLD ke USD
                </small>
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
                Preview untuk komoditas terpilih
                <br />
                Harga dasar:{' '}
                <strong>
                  $
                  {(goldNum * fxNum || 0).toFixed(2)}
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

          {/* Harga komoditas */}
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">
                  02 / SPOT PRICE CONTROL
                </div>
                <strong
                  style={{ display: 'block', marginTop: 5 }}
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
                  onChange={(event) =>
                    setSelected(event.target.value)
                  }
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
                  {(
                    Number.isFinite(priceUsd) ? priceUsd : 0
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

          {/* Editor OHLC */}
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
                  style={{ display: 'block', marginTop: 5 }}
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
                    onChange={(event) =>
                      setSelected(event.target.value)
                    }
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
                    onChange={(event) =>
                      setDate(event.target.value)
                    }
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
                    onChange={(event) =>
                      setOpen(event.target.value)
                    }
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
                    onChange={(event) =>
                      setHigh(event.target.value)
                    }
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
                    onChange={(event) =>
                      setLow(event.target.value)
                    }
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
                    onChange={(event) =>
                      setClose(event.target.value)
                    }
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
                        ? `$${histories[selected][
                            histories[selected].length - 1
                          ].close.toFixed(2)}`
                        : 'No history'
                    }
                  />
                </div>
              </div>

              <div className="notice">
                Validasi: Low ≤ Open dan Close ≤ High. Low juga
                tidak boleh melebihi High. Jika tanggal sudah
                tersedia, data diperbarui, bukan digandakan.
              </div>

              <button
                className="button button-primary"
                disabled={busy || !connected}
                onClick={() => void saveHistory()}
              >
                <Save size={15} />
                SAVE DAILY OHLC RECORD
              </button>
            </div>
          </section>

          {/* Daftar komoditas */}
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
                  style={{ display: 'block', marginTop: 5 }}
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
