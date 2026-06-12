import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, CheckCircle, Users, ArrowRight } from 'lucide-react';
import { Tournament, RegistrationEntry } from '../types/tournament';
import { getTournaments } from '../utils/storage';
import { registerTeam, RegisterResult } from '../utils/registration';
import { slugify } from '../utils/slugify';

// ─── Public team-registration form (/daftar/:slug) ───────────────────────────
// Custom fields come from the organizer's config; payment stays manual
// (transfer + WA) — instructions are shown after submitting.

// /daftar without a slug: list every event with open registration
function RegistrationIndex() {
  const [open, setOpen] = useState<Tournament[] | null>(null);
  useEffect(() => {
    getTournaments().then((ts) => setOpen(ts.filter((t) => t.registration?.enabled)));
  }, []);

  if (open === null) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#B45330]" />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[#FAF8F5] font-mono text-[#2A2A2A] p-4 sm:p-8 flex justify-center">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8 mt-6">
          <p className="font-mono text-[11px] tracking-[0.4em] uppercase text-[#8B7355] mb-3">OnPoint</p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight">Pendaftaran Dibuka</h1>
        </div>
        {open.length === 0 ? (
          <p className="text-center text-sm text-gray-500">
            Belum ada event yang membuka pendaftaran online saat ini.
          </p>
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
                  className="flex items-center justify-between bg-white border border-[#F0EBE3] rounded-2xl p-5 hover:border-[#B45330] transition-colors"
                >
                  <div>
                    <div className="font-display font-bold">{t.name}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {left === null ? 'Slot tersedia' : left === 0 ? 'Penuh — waiting list' : `Sisa ${left} slot`}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#B45330] shrink-0" />
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
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getTournaments().then((ts) => {
      const t = ts.find(
        (x) => x.id === slug || (x.slug || slugify(x.name)) === slug
      );
      setTournament(t ?? null);
      setLoading(false);
    });
  }, [slug]);

  if (!slug) return <RegistrationIndex />;

  const cfg = tournament?.registration;
  const regs = tournament?.registrations ?? [];
  const quota = cfg?.quota ?? 0;
  const slotsLeft = quota > 0 ? Math.max(0, quota - regs.length) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament || !cfg) return;
    for (const f of cfg.fields) {
      if (f.required && !values[f.id]?.trim()) {
        setError(`"${f.label}" wajib diisi.`);
        return;
      }
    }
    setError(null);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#B45330]" />
      </div>
    );
  }

  if (!tournament || !cfg?.enabled) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] font-mono text-[#2A2A2A] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Users className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <h1 className="font-display text-xl font-bold">Pendaftaran tidak tersedia</h1>
          <p className="text-sm text-gray-500 mt-2">
            Event ini belum membuka pendaftaran online, atau link-nya tidak valid.
            Hubungi penyelenggara event.
          </p>
        </div>
      </div>
    );
  }

  // Post-submit screens
  if (result === 'registered' || result === 'waitlist') {
    return (
      <div className="min-h-screen bg-[#FAF8F5] font-mono text-[#2A2A2A] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#F0EBE3] rounded-2xl p-8 text-center shadow-sm">
          <CheckCircle className={`w-12 h-12 mx-auto mb-4 ${result === 'registered' ? 'text-green-500' : 'text-amber-500'}`} />
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
            {result === 'registered' ? 'Terdaftar!' : 'Masuk Waiting List'}
          </h1>
          <p className="text-sm text-gray-500 mt-3">
            {result === 'registered'
              ? 'Pendaftaranmu sudah masuk. Selesaikan pembayaran supaya slot-mu terkunci:'
              : 'Slot sudah penuh — kamu masuk daftar tunggu. Penyelenggara akan menghubungimu kalau ada slot kosong.'}
          </p>
          {result === 'registered' && cfg.paymentNote && (
            <div className="mt-5 bg-[#FAF8F5] border border-[#F0EBE3] rounded-xl p-4 text-sm text-left whitespace-pre-wrap">
              {cfg.paymentNote}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] font-mono text-[#2A2A2A] p-4 sm:p-8 flex justify-center">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8 mt-6">
          <p className="font-mono text-[11px] tracking-[0.4em] uppercase text-[#8B7355] mb-3">
            Pendaftaran Tim
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight">
            {tournament.name}
          </h1>
          {slotsLeft !== null && (
            <p className={`mt-3 text-sm font-bold ${slotsLeft === 0 ? 'text-amber-600' : 'text-[#B45330]'}`}>
              {slotsLeft === 0
                ? 'Slot penuh — pendaftaran berikutnya masuk waiting list'
                : `Sisa ${slotsLeft} dari ${quota} slot`}
            </p>
          )}
        </div>

        <form onSubmit={submit} className="bg-white border border-[#F0EBE3] rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
          {cfg.fields.map((f) => (
            <div key={f.id}>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {f.label} {f.required && <span className="text-[#B45330]">*</span>}
              </label>
              {f.type === 'select' ? (
                <select
                  value={values[f.id] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-[#F0EBE3] rounded-lg focus:ring-2 focus:ring-[#B45330] focus:border-transparent"
                >
                  <option value="">— pilih —</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === 'phone' ? 'tel' : 'text'}
                  inputMode={f.type === 'phone' ? 'tel' : undefined}
                  value={values[f.id] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-[#F0EBE3] rounded-lg focus:ring-2 focus:ring-[#B45330] focus:border-transparent"
                  placeholder={f.type === 'phone' ? '08xxxxxxxxxx' : ''}
                />
              )}
            </div>
          ))}

          {error && <p className="text-sm text-red-500">{error}</p>}
          {result === 'closed' && <p className="text-sm text-red-500">Pendaftaran sudah ditutup.</p>}
          {result === 'error' && <p className="text-sm text-red-500">Gagal mengirim — coba lagi.</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-[#B45330] to-[#C96A40] text-white disabled:opacity-50 transition-all hover:scale-[1.01]"
          >
            {submitting ? 'Mengirim…' : 'Daftar'}
          </button>
          {cfg.paymentNote && (
            <p className="text-xs text-gray-400 leading-relaxed">
              Setelah daftar, selesaikan pembayaran sesuai instruksi yang muncul.
            </p>
          )}
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by <span className="font-bold"><span style={{ color: '#C9952F' }}>ON</span>POINT</span>
        </p>
      </div>
    </div>
  );
}
