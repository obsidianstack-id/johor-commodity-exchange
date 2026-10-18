'use client';

import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Settings = {
  usd_per_gold: number;
  import_tax_pct: number;
  domestic_export_tax_pct: number;
};

const DEFAULT_SETTINGS: Settings = {
  usd_per_gold: 19.5,
  import_tax_pct: 5,
  domestic_export_tax_pct: 3,
};

export default function AdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const [settings, setSettings] =
    useState<Settings>(DEFAULT_SETTINGS);

  const [fx, setFx] = useState('19.5');
  const [importTax, setImportTax] = useState('5');
  const [domesticTax, setDomesticTax] = useState('3');

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const client = supabase;

    if (!client) {
      setFeedback(
        'Supabase belum dikonfigurasi. Periksa environment variables.'
      );
      setSessionReady(true);
      return;
    }

    let mounted = true;

    async function checkAdmin(id: string) {
      try {
        const { data, error } = await client
          .from('profiles')
          .select('is_admin')
          .eq('id', id)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          console.error('Admin check failed:', error.message);
          setIsAdmin(false);
          setFeedback(
            'Tidak dapat memeriksa hak admin. Periksa tabel profiles dan kebijakan RLS.'
          );
        } else {
          setIsAdmin(data?.is_admin === true);
          setFeedback(
            data?.is_admin === true
              ? 'Login berhasil. Hak administrator terverifikasi.'
              : 'Akun ini belum memiliki hak administrator.'
          );
        }
      } catch (error) {
        if (!mounted) return;

        console.error(error);
        setIsAdmin(false);
        setFeedback('Terjadi kesalahan saat memeriksa hak admin.');
      } finally {
        if (mounted) setSessionReady(true);
      }
    }

    async function initializeSession() {
      try {
        const {
          data: { session },
          error,
        } = await client.auth.getSession();

        if (!mounted) return;

        if (error) {
          setFeedback('Gagal memuat sesi login.');
          setSessionReady(true);
          return;
        }

        const user = session?.user ?? null;

        setUserId(user?.id ?? null);

        if (user) {
          await checkAdmin(user.id);
        } else {
          setIsAdmin(false);
          setSessionReady(true);
        }
      } catch (error) {
        if (!mounted) return;

        console.error(error);
        setFeedback('Gagal menginisialisasi sesi Supabase.');
        setSessionReady(true);
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
        setFeedback('Silakan login untuk melanjutkan.');
        return;
      }

      setSessionReady(false);

      // Jalankan pemeriksaan setelah callback auth selesai.
      setTimeout(() => {
        if (mounted) void checkAdmin(user.id);
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !isAdmin) return;

    let mounted = true;

    async function loadSettings() {
      const client = supabase;

      if (!client) return;

      const { data, error } = await client
        .from('exchange_settings')
        .select(
          'usd_per_gold, import_tax_pct, domestic_export_tax_pct'
        )
        .limit(1)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error('Settings load failed:', error.message);
        setFeedback(
          'Login admin berhasil, tetapi pengaturan gagal dimuat. Pastikan tabel exchange_settings tersedia.'
        );
        return;
      }

      if (!data) {
        setFeedback(
          'Belum ada pengaturan kurs di exchange_settings.'
        );
        return;
      }

      const nextSettings: Settings = {
        usd_per_gold: Number(data.usd_per_gold),
        import_tax_pct: Number(data.import_tax_pct),
        domestic_export_tax_pct: Number(
          data.domestic_export_tax_pct
        ),
      };

      setSettings(nextSettings);
      setFx(String(nextSettings.usd_per_gold));
      setImportTax(String(nextSettings.import_tax_pct));
      setDomesticTax(
        String(nextSettings.domestic_export_tax_pct)
      );
    }

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, [isAdmin]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const client = supabase;

    if (!client) {
      setFeedback('Supabase belum dikonfigurasi.');
      return;
    }

    setBusy(true);
    setFeedback('');

    try {
      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setFeedback(`Login gagal: ${error.message}`);
      } else {
        setPassword('');
        setFeedback('Login berhasil. Memeriksa hak admin...');
      }
    } catch (error) {
      console.error(error);
      setFeedback('Terjadi kesalahan saat login.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const client = supabase;

    if (!client) return;

    setBusy(true);

    try {
      const { error } = await client.auth.signOut();

      if (error) {
        setFeedback(`Gagal logout: ${error.message}`);
        return;
      }

      setUserId(null);
      setIsAdmin(false);
      setFeedback('Kamu telah logout.');
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const client = supabase;

    if (!client || !isAdmin || !userId) {
      setFeedback('Akses ditolak. Login sebagai administrator.');
      return;
    }

    const usdPerGold = Number(fx);
    const importTaxPct = Number(importTax);
    const domesticTaxPct = Number(domesticTax);

    if (
      !Number.isFinite(usdPerGold) ||
      !Number.isFinite(importTaxPct) ||
      !Number.isFinite(domesticTaxPct) ||
      usdPerGold <= 0 ||
      importTaxPct < 0 ||
      importTaxPct > 100 ||
      domesticTaxPct < 0 ||
      domesticTaxPct > 100
    ) {
      setFeedback(
        'Kurs harus lebih dari 0 dan pajak harus berada antara 0–100%.'
      );
      return;
    }

    setBusy(true);
    setFeedback('');

    try {
      const { error } = await client.rpc('admin_update_settings', {
        p_usd_per_gold: usdPerGold,
        p_import_tax_pct: importTaxPct,
        p_domestic_export_tax_pct: domesticTaxPct,
      });

      if (error) {
        console.error('Settings update failed:', error.message);
        setFeedback(
          `Gagal menyimpan pengaturan: ${error.message}`
        );
        return;
      }

      setSettings({
        usd_per_gold: usdPerGold,
        import_tax_pct: importTaxPct,
        domestic_export_tax_pct: domesticTaxPct,
      });

      setFeedback('Pengaturan berhasil disimpan.');
    } catch (error) {
      console.error(error);
      setFeedback('Terjadi kesalahan saat menyimpan pengaturan.');
    } finally {
      setBusy(false);
    }
  }

  const configured = Boolean(supabase);

  return (
    <main className="min-h-screen bg-[#080d17] px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">
              Republic of Johor
            </p>

            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
              Commodity Exchange
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Administrator Control Panel
            </p>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={signOut}
              disabled={busy}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
            >
              Logout
            </button>
          )}
        </header>

        {!configured && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            Supabase belum dikonfigurasi. Tambahkan
            NEXT_PUBLIC_SUPABASE_URL dan
            NEXT_PUBLIC_SUPABASE_ANON_KEY pada Environment Variables
            di Vercel.
          </div>
        )}

        {!sessionReady ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
            <p className="text-slate-300">
              Memeriksa sesi administrator...
            </p>
          </section>
        ) : !userId ? (
          <section className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl sm:p-8">
            <h2 className="text-xl font-semibold">
              Login Administrator
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Gunakan akun yang sudah dibuat melalui Supabase
              Authentication.
            </p>

            <form onSubmit={signIn} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm text-slate-300"
                >
                  Email
                </label>

                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-500"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm text-slate-300"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-500"
                  placeholder="Masukkan password"
                />
              </div>

              <button
                type="submit"
                disabled={busy || !configured}
                className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Memproses...' : 'Login'}
              </button>
            </form>
          </section>
        ) : !isAdmin ? (
          <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <h2 className="text-xl font-semibold text-red-300">
              Akses administrator ditolak
            </h2>

            <p className="mt-3 break-all text-sm text-slate-300">
              User ID: {userId}
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Pastikan kolom profiles.is_admin bernilai true untuk
              User ID tersebut dan kebijakan RLS mengizinkan
              pengguna membaca profilnya sendiri.
            </p>

            <button
              type="button"
              onClick={signOut}
              disabled={busy}
              className="mt-5 rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
            >
              Logout
            </button>
          </section>
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <p className="text-sm font-medium text-emerald-400">
                Administrator terverifikasi
              </p>

              <p className="mt-2 break-all text-xs text-slate-400">
                User ID: {userId}
              </p>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-7">
              <h2 className="text-xl font-semibold">
                Pengaturan Bursa
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Atur kurs GOLD/USD serta persentase pajak.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-400">
                    Kurs saat ini
                  </p>

                  <p className="mt-2 text-xl font-bold">
                    {settings.usd_per_gold.toFixed(2)} USD
                  </p>

                  <p className="text-xs text-slate-500">
                    per 1 GOLD
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-400">
                    Pajak impor
                  </p>

                  <p className="mt-2 text-xl font-bold">
                    {settings.import_tax_pct}%
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-400">
                    Pajak domestik/ekspor
                  </p>

                  <p className="mt-2 text-xl font-bold">
                    {settings.domestic_export_tax_pct}%
                  </p>
                </div>
              </div>

              <form
                onSubmit={saveSettings}
                className="mt-6 space-y-5"
              >
                <div>
                  <label
                    htmlFor="fx"
                    className="mb-2 block text-sm text-slate-300"
                  >
                    Kurs USD per GOLD
                  </label>

                  <input
                    id="fx"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={fx}
                    onChange={(event) =>
                      setFx(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="importTax"
                      className="mb-2 block text-sm text-slate-300"
                    >
                      Pajak impor (%)
                    </label>

                    <input
                      id="importTax"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      required
                      value={importTax}
                      onChange={(event) =>
                        setImportTax(event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="domesticTax"
                      className="mb-2 block text-sm text-slate-300"
                    >
                      Pajak domestik/ekspor (%)
                    </label>

                    <input
                      id="domesticTax"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      required
                      value={domesticTax}
                      onChange={(event) =>
                        setDomesticTax(event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50 sm:w-auto"
                >
                  {busy
                    ? 'Menyimpan...'
                    : 'Simpan Pengaturan'}
                </button>
              </form>
            </section>
          </div>
        )}

        {feedback && (
          <div
            role="status"
            className="mt-6 break-words rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300"
          >
            {feedback}
          </div>
        )}

        <footer className="mt-10 border-t border-slate-800 pt-5 text-center text-xs text-slate-500">
          Johor Commodity Exchange · Admin Console
        </footer>
      </div>
    </main>
  );
}
