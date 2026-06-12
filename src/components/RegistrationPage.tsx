import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, Users, ArrowRight } from 'lucide-react';
import { Tournament, RegistrationEntry } from '../types/tournament';
import { getTournaments } from '../utils/storage';
import { registerTeam, RegisterResult } from '../utils/registration';
import { slugify } from '../utils/slugify';

// ─── Public team registration (/daftar/:slug) ─────────────────────────────────
// Styled as an exclusive invitation, not a form: dark stage identity, one
// question at a time (Enter to advance), and a numbered golden ticket at the
// end — built to be screenshotted into the WA group.

const BG = '#06081A';
const GOLD = '#E2B95B';
const goldGrad = `linear-gradient(110deg, #F3D27E, ${GOLD} 60%, #C9952F)`;

// /daftar without a slug: every event with open registration
function RegistrationIndex() {
  const [open, setOpen] = useState<Tournament[] | null>(null);
  useEffect(() => {
    getTournaments().then((ts) => setOpen(ts.filter((t) => t.registration?.enabled)));
  }, []);

  return (
    <div className="grain min-h-screen font-sans text-white p-4 sm:p-8 flex justify-center" style={{ background: BG }}>
      <div className="w-full max-w-lg relative z-10">
        <div className="text-center mb-10 mt-10">
          <p className="font-mono text-[11px] tracking-[0.4em] uppercase text-white/40 mb-4">
            <span className="gold-text font-bold">ON</span>POINT
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight">
            Pendaftaran <span className="gold-text">dibuka</span>
          </h1>
        </div>
        {open === null ? (
          <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin" style={{ color: GOLD }} /></div>
        ) : open.length === 0 ? (
          <p className="text-center text-sm text-white/40">Belum ada event yang membuka pendaftaran online saat ini.</p>
        ) : (
          <div className="space-y-3">
            {open.map((t) => {
              const regs = t.registrations ?? [];
              const quota = t.registration?.quota ?? 0;
              const left = quota > 0 ? Math.max(0, quota - regs.length) : null;
              return (
                <Link
                  key={t.id}
                  to={`/daftar/${t.slug || slugify(t.name)}`}
                  className="flex items-center justify-between border border-white/10 bg-white/[0.04] rounded-2xl p-5 hover:border-[#E2B95B]/60 hover:-translate-y-0.5 transition-all"
                >
                  <div>
                    <div className="font-display font-bold uppercase tracking-wide">{t.name}</div>
                    <div className="text-xs text-white/40 mt-1">
                      {left === null ? 'Slot tersedia' : left === 0 ? 'Penuh — waiting list' : `Sisa ${left} slot`}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RegistrationPage() {
  const { slug } = useParams<{ slug: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [stepIdx, setStepIdx] = useState(-1); // -1 = cover screen
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getTournaments().then((ts) => {
      const t = ts.find((x) => x.id === slug || (x.slug || slugify(x.name)) === slug);
      setTournament(t ?? null);
      setLoading(false);
    });
  }, [slug]);

  if (!slug) return <RegistrationIndex />;

  const cfg = tournament?.registration;
  const fields = cfg?.fields ?? [];
  const regs = tournament?.registrations ?? [];
  const quota = cfg?.quota ?? 0;
  const slotsLeft = quota > 0 ? Math.max(0, quota - regs.length) : null;
  const field = stepIdx >= 0 ? fields[stepIdx] : null;
  const isLast = stepIdx === fields.length - 1;

  const submit = async () => {
    if (!tournament) return;
    setSubmitting(true);
    const entry: RegistrationEntry = {
      id: `reg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      values,
      createdAt: new Date().toISOString(),
    };
    const res = await registerTeam(tournament, entry);
    setResult(res);
    setSubmitting(false);
  };

  const next = () => {
    if (!field) return;
    if (field.required && !values[field.id]?.trim()) {
      setError(`${field.label} wajib diisi`);
      return;
    }
    setError(null);
    if (isLast) {
      submit();
    } else {
      setStepIdx((i) => i + 1);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="grain min-h-screen font-sans text-white flex items-center justify-center p-4 relative overflow-hidden" style={{ background: BG }}>
      <div className="absolute -top-40 -right-40 w-[560px] h-[560px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(226,185,91,0.13) 0%, transparent 65%)' }} />
      <div className="absolute -bottom-48 -left-40 w-[560px] h-[560px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(226,185,91,0.09) 0%, transparent 65%)' }} />
      <div className="relative z-10 w-full max-w-xl">{children}</div>
    </div>
  );

  if (loading) {
    return shell(<div className="flex justify-center"><Loader2 className="w-8 h-8 animate-spin" style={{ color: GOLD }} /></div>);
  }

  if (!tournament || !cfg?.enabled) {
    return shell(
      <div className="text-center max-w-sm mx-auto">
        <Users className="w-10 h-10 mx-auto text-white/20 mb-4" />
        <h1 className="font-display text-2xl font-bold uppercase">Pendaftaran tidak tersedia</h1>
        <p className="text-sm text-white/40 mt-3">
          Event ini belum membuka pendaftaran online, atau link-nya tidak valid. Hubungi penyelenggara event.
        </p>
      </div>
    );
  }

  // ── Golden ticket (success) ──
  if (result && (result.status === 'registered' || result.status === 'waitlist')) {
    const isReg = result.status === 'registered';
    const teamName = values[fields[0]?.id] || 'Tim Kamu';
    return shell(
      <div className="ticket-in mx-auto max-w-md">
        <div className="rounded-3xl p-[1.5px]" style={{ background: goldGrad }}>
          <div className="rounded-3xl px-7 pt-8 pb-6 relative" style={{ background: '#0A0E23' }}>
            <p className="font-mono text-[10px] tracking-[0.45em] uppercase text-white/40 text-center">
              {isReg ? 'Official Entry' : 'Waiting List'}
            </p>
            <h1 className="font-display text-center text-2xl font-bold uppercase tracking-tight mt-2">
              {tournament.name}
            </h1>
            <div className="text-center mt-7">
              <div className="font-mono text-[10px] tracking-[0.35em] uppercase text-white/35">Tim</div>
              <div className="font-display text-3xl font-bold mt-1 gold-shine break-words">{teamName}</div>
            </div>
            <div className="text-center mt-6">
              {isReg ? (
                <span className="font-display text-6xl font-bold gold-text">
                  #{String(result.count ?? regs.length + 1).padStart(2, '0')}
                </span>
              ) : (
                <span className="inline-block font-mono text-xs font-bold tracking-[0.25em] uppercase border border-amber-400/50 text-amber-300 rounded-full px-4 py-2">
                  Daftar Tunggu
                </span>
              )}
              <p className="text-[11px] text-white/35 mt-2">
                {isReg ? 'nomor urut pendaftaran' : 'Kamu dihubungi kalau ada slot kosong'}
              </p>
            </div>

            {/* perforation */}
            <div className="relative my-6">
              <div className="border-t-2 border-dashed border-white/15" />
              <div className="absolute -left-10 -top-3 w-6 h-6 rounded-full" style={{ background: BG }} />
              <div className="absolute -right-10 -top-3 w-6 h-6 rounded-full" style={{ background: BG }} />
            </div>

            {isReg && cfg.paymentNote ? (
              <div>
                <p className="font-mono text-[10px] tracking-[0.35em] uppercase text-white/35 mb-2">Selesaikan pembayaran</p>
                <p className="text-sm text-white/75 whitespace-pre-wrap leading-relaxed">{cfg.paymentNote}</p>
              </div>
            ) : (
              <p className="text-sm text-white/50 text-center">Simpan tiket ini sebagai bukti pendaftaran.</p>
            )}
          </div>
        </div>
        <p className="text-center text-xs text-white/35 mt-5">
          📸 Screenshot tiket ini & kirim bersama bukti transfer ke penyelenggara
        </p>
        <p className="text-center text-[11px] text-white/25 mt-6">
          Powered by <span className="font-bold"><span className="gold-text">ON</span>POINT</span>
        </p>
      </div>
    );
  }

  // ── Cover screen ──
  if (stepIdx === -1) {
    return shell(
      <div className="step-in text-center">
        <p className="font-mono text-[11px] tracking-[0.45em] uppercase text-white/40 mb-5">Pendaftaran Tim</p>
        <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight leading-[1.04]">
          {tournament.name}
        </h1>
        {slotsLeft !== null && (
          <div className="mt-7 max-w-xs mx-auto">
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (regs.length / quota) * 100)}%`, background: goldGrad }} />
            </div>
            <p className={`mt-2.5 text-sm font-bold ${slotsLeft === 0 ? 'text-amber-300' : ''}`} style={slotsLeft === 0 ? undefined : { color: GOLD }}>
              {slotsLeft === 0 ? 'Penuh — pendaftaran masuk waiting list' : `Sisa ${slotsLeft} dari ${quota} slot`}
            </p>
          </div>
        )}
        <button
          onClick={() => setStepIdx(0)}
          className="mt-10 rounded-full px-10 py-4 font-bold text-[#06081A] transition-all hover:shadow-[0_0_36px_-6px_rgba(226,185,91,0.9)] hover:-translate-y-0.5"
          style={{ background: goldGrad }}
        >
          Daftarkan Tim →
        </button>
        <p className="mt-5 text-xs text-white/30">{fields.length} pertanyaan singkat · ±30 detik</p>
      </div>
    );
  }

  // ── One question per screen ──
  return shell(
    <div key={field!.id} className="step-in">
      <div className="flex items-center gap-3 mb-10">
        <span className="font-mono text-xs" style={{ color: GOLD }}>
          {String(stepIdx + 1).padStart(2, '0')}<span className="text-white/30"> / {String(fields.length).padStart(2, '0')}</span>
        </span>
        <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((stepIdx + 1) / fields.length) * 100}%`, background: goldGrad }} />
        </div>
      </div>

      <label className="font-display block text-2xl sm:text-4xl font-bold uppercase tracking-tight leading-tight">
        {field!.label}
        {field!.required && <span style={{ color: GOLD }}> *</span>}
      </label>

      {field!.type === 'select' ? (
        <div className="mt-7 grid gap-2.5">
          {(field!.options ?? []).map((o) => (
            <button
              key={o}
              onClick={() => { setValues((v) => ({ ...v, [field!.id]: o })); setError(null); }}
              className={`text-left px-5 py-4 rounded-2xl border transition-all ${
                values[field!.id] === o
                  ? 'border-[#E2B95B] bg-[#E2B95B]/10 font-bold'
                  : 'border-white/15 bg-white/[0.03] hover:border-white/40'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      ) : (
        <input
          autoFocus
          type={field!.type === 'phone' ? 'tel' : 'text'}
          inputMode={field!.type === 'phone' ? 'tel' : undefined}
          value={values[field!.id] ?? ''}
          onChange={(e) => { setValues((v) => ({ ...v, [field!.id]: e.target.value })); setError(null); }}
          onKeyDown={(e) => e.key === 'Enter' && next()}
          placeholder={field!.type === 'phone' ? '08xxxxxxxxxx' : 'Ketik di sini…'}
          className="mt-7 w-full bg-transparent border-0 border-b-2 border-white/20 focus:border-[#E2B95B] outline-none text-2xl sm:text-3xl py-3 placeholder-white/20 transition-colors font-display"
        />
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {result?.status === 'closed' && <p className="mt-3 text-sm text-red-400">Pendaftaran sudah ditutup.</p>}
      {result?.status === 'error' && <p className="mt-3 text-sm text-red-400">Gagal mengirim — coba lagi.</p>}

      <div className="mt-10 flex items-center justify-between">
        <button
          onClick={() => { setError(null); setStepIdx((i) => i - 1); }}
          className="text-sm text-white/40 hover:text-white transition-colors"
        >
          ← Kembali
        </button>
        <button
          onClick={next}
          disabled={submitting}
          className="rounded-full px-8 py-3.5 font-bold text-[#06081A] disabled:opacity-50 transition-all hover:shadow-[0_0_28px_-6px_rgba(226,185,91,0.9)] hover:-translate-y-0.5"
          style={{ background: goldGrad }}
        >
          {submitting ? 'Mengirim…' : isLast ? 'Kirim 🎟' : 'Lanjut →'}
        </button>
      </div>
      <p className="mt-4 text-right text-[11px] text-white/25">tekan Enter ↵</p>
    </div>
  );
}
