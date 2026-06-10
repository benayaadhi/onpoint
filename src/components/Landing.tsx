import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── OnPoint landing / sales page ─────────────────────────────────────────────
// Premium broadcast-night look: near-black navy, champagne gold, Space Grotesk
// display type. All effects are pure CSS + one IntersectionObserver — no
// animation libraries, so it stays fast.

const WA = '6285290000130';
const wa = (text: string) => `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;

const BG = '#06081A';
const GOLD = '#E2B95B';

// Reveal-on-scroll wrapper (adds .in when the block enters the viewport)
function Reveal({ children, delay = 0, className = '' }: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${inView ? 'in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

const STATS = [
  { n: '0,2', u: 'dtk', d: 'skor sampai ke TV' },
  { n: '3+', u: 'court', d: 'serentak tanpa bentrok' },
  { n: '72', u: 'jam', d: 'masa aktif per event' },
  { n: '1', u: 'kode', d: 'langsung jalan' },
];

const FEATURES = [
  {
    t: 'Scoring live anti-bentrok',
    d: 'Beberapa panitia menskor beberapa court bersamaan — skor tidak pernah saling timpa. Teruji ratusan match simulasi penuh.',
  },
  {
    t: 'TV display per court',
    d: 'Skor live di layar venue, ganti match otomatis dalam sepersekian detik, perayaan juara, dan standings saat jeda.',
  },
  {
    t: 'Iklan sponsor di TV',
    d: 'Video iklan gaya YouTube saat jeda: bumper singkat antar game, reel panjang antar match. Slot-nya kamu jual ke sponsor.',
  },
  {
    t: 'Semua format turnamen',
    d: 'Round robin, group + knockout, eliminasi, sampai clash antar klub (squad battle men/women/mix).',
  },
  {
    t: 'Link live untuk peserta',
    d: 'Bracket, jadwal, dan skor di HP masing-masing peserta — cukup buka link, tanpa install apa pun.',
  },
  {
    t: 'Satu kode, semua beres',
    d: 'Bayar per event, terima kode aktivasi, buat turnamen. Hasil dan bracket tersimpan dan bisa dilihat selamanya.',
  },
];

const TIERS = [
  {
    name: 'STARTER',
    price: '1jt',
    tag: 'Komunitas',
    best: false,
    items: [
      'Scoring live + bracket semua format',
      'TV display per court',
      'Link live peserta',
      'Iklan jaringan OnPoint tampil di TV',
      'Watermark OnPoint',
    ],
  },
  {
    name: 'COMPACT',
    price: '2jt',
    tag: 'Event privat',
    best: false,
    items: [
      'Semua fitur Starter',
      'TV bersih — tanpa iklan',
      'Tanpa watermark',
    ],
  },
  {
    name: 'TOURNAMENT',
    price: '4jt',
    tag: 'Event bersponsor',
    best: true,
    items: [
      'Semua fitur Compact',
      'Bar sponsor 3 logo di TV — milikmu',
      'Jual slot-nya ke sponsor, untung 100% buatmu',
    ],
  },
  {
    name: 'CHAMPIONSHIP',
    price: '6jt',
    tag: 'Event besar',
    best: false,
    items: [
      'Semua fitur Tournament',
      'Sistem video ads penuh: bumper antar game, reel antar match, tombol Break',
      'Inventori iklan senilai jutaan — siap dijual',
      'Prioritas support saat event',
    ],
  },
];

const FAQ = [
  {
    q: 'Gimana cara mulai?',
    a: 'Chat WhatsApp kami → sepakati paket & tanggal event → transfer → kamu terima kode aktivasi → masukkan kode saat membuat turnamen. Lima menit jadi.',
  },
  {
    q: 'Kode aktivasi itu apa?',
    a: 'Satu kode = satu event. Kode dipakai sekali saat membuat turnamen, lalu paketmu (Starter/Compact/Tournament/Championship) aktif otomatis di semua fitur.',
  },
  {
    q: 'Masa aktif 72 jam maksudnya?',
    a: 'Sejak kode dipakai, turnamen bisa diskor dan di-reset selama 3 hari — cukup untuk persiapan plus hari-H. Setelah itu hasil, bracket, dan TV tetap bisa dilihat selamanya; hanya input skor yang terkunci.',
  },
  {
    q: 'Event diundur / molor?',
    a: 'Chat kami, masa aktifnya kami geser. Gratis, manusiawi.',
  },
  {
    q: 'Perlu install aplikasi?',
    a: 'Tidak. Semuanya jalan di browser — HP panitia, HP peserta, sampai TV venue (cukup browser di TV/mini PC).',
  },
  {
    q: 'Iklan sponsornya gimana cara kerjanya?',
    a: 'Di paket Tournament kamu dapat 3 slot logo di TV. Di Championship kamu juga bisa upload video/poster iklan yang diputar otomatis di setiap jeda — antar game, antar match, atau saat tombol Break ditekan. Slot-slot itu kamu jual sendiri ke sponsor: satu sponsor biasanya sudah menutup biaya paketnya.',
  },
];

const MARQUEE = ['LIVE SCORING', 'TV DISPLAY', 'SPONSOR ADS', 'BRACKET OTOMATIS', 'MULTI-COURT', 'CLASH ANTAR KLUB'];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="grain min-h-screen font-sans antialiased text-white selection:bg-[#E2B95B] selection:text-[#06081A]" style={{ background: BG }}>
      {/* ── Nav ── */}
      <header className="fixed top-0 inset-x-0 z-50">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mt-4 flex items-center justify-between rounded-full border border-white/10 bg-[#06081A]/75 backdrop-blur-xl px-4 py-2.5">
            <a href="#" className="flex items-center gap-2.5">
              <img src="/landing/logo.png" alt="OnPoint" width={34} height={34} className="rounded-full bg-white" />
              <span className="font-display font-bold tracking-[0.18em] text-sm">
                <span className="gold-text">ON</span>POINT
              </span>
            </a>
            <nav className="hidden md:flex items-center gap-8 text-sm text-white/55">
              <a href="#fitur" className="hover:text-white transition-colors">Fitur</a>
              <a href="#harga" className="hover:text-white transition-colors">Harga</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
              <button onClick={() => navigate('/iklan')} className="hover:text-[#F3D27E] transition-colors">
                Pasang Iklan
              </button>
              <button onClick={() => navigate('/contestant')} className="hover:text-white transition-colors">
                Cek Tournament
              </button>
            </nav>
            <a
              href={wa('Halo OnPoint, saya mau tanya soal sistem turnamen padel')}
              className="rounded-full px-5 py-2 text-sm font-bold text-[#06081A] transition-all hover:shadow-[0_0_24px_-4px_rgba(226,185,91,0.8)]"
              style={{ background: `linear-gradient(110deg, #F3D27E, ${GOLD} 60%, #C9952F)` }}
            >
              WhatsApp
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative min-h-[96vh] flex items-end overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src="/landing/hero.jpg"
            alt="Turnamen padel OnPoint"
            className="kenburns absolute inset-0 w-full h-full object-cover"
            width={1600}
            height={1067}
          />
        </div>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,8,26,0.62) 0%, rgba(6,8,26,0.28) 45%, rgba(6,8,26,0.98) 100%)' }} />
        {/* gold ambient glow behind the headline */}
        <div className="absolute -bottom-40 -left-40 w-[640px] h-[640px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(226,185,91,0.16) 0%, transparent 65%)' }} />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-48 w-full">
          <Reveal>
            <p className="font-mono text-[11px] md:text-xs tracking-[0.45em] uppercase mb-6 text-white/60">
              <span className="gold-text font-bold">OnPoint</span> — Padel Tournament System
            </p>
          </Reveal>
          <Reveal delay={120}>
            <h1 className="font-display text-[2.6rem] sm:text-6xl md:text-[5.2rem] font-bold leading-[0.98] tracking-tight uppercase max-w-4xl">
              Turnamen padel
              <br />
              rasa <span className="gold-text">broadcast.</span>
            </h1>
          </Reveal>
          <Reveal delay={240}>
            <p className="mt-7 max-w-xl text-white/65 text-base md:text-lg leading-relaxed">
              Scoring live multi-court, TV display di tiap lapangan, dan slot iklan
              yang bisa kamu jual ke sponsor. Panitia tinggal pencet skor — sisanya
              jalan sendiri.
            </p>
          </Reveal>
          <Reveal delay={360}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a
                href={wa('Halo OnPoint, saya mau pakai sistemnya untuk event padel saya. Boleh info paketnya?')}
                className="rounded-full px-8 py-4 font-bold text-[#06081A] text-sm md:text-base transition-all hover:shadow-[0_0_36px_-6px_rgba(226,185,91,0.9)] hover:-translate-y-0.5"
                style={{ background: `linear-gradient(110deg, #F3D27E, ${GOLD} 60%, #C9952F)` }}
              >
                Pesan via WhatsApp
              </a>
              <a href="#harga" className="rounded-full px-8 py-4 font-bold text-sm md:text-base border border-white/20 hover:border-[#E2B95B]/70 hover:text-[#F3D27E] transition-colors">
                Lihat Harga
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Marquee ── */}
      <div className="border-y border-white/10 overflow-hidden py-4 select-none" aria-hidden>
        <div className="marquee flex whitespace-nowrap w-max">
          {[0, 1].map((k) => (
            <div key={k} className="flex">
              {MARQUEE.map((m) => (
                <span key={m + k} className="font-display font-bold uppercase tracking-[0.3em] text-sm mx-8 text-white/25">
                  {m} <span className="gold-text mx-8">·</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Stats ── */}
      <section className="mx-auto max-w-6xl px-4 py-16 grid grid-cols-2 md:grid-cols-4 gap-10">
        {STATS.map((s, i) => (
          <Reveal key={s.d} delay={i * 90}>
            <div className="font-display text-4xl md:text-5xl font-bold gold-text">
              {s.n}<span className="text-xl md:text-2xl ml-1">{s.u}</span>
            </div>
            <div className="mt-2 text-sm text-white/50">{s.d}</div>
          </Reveal>
        ))}
      </section>

      {/* ── Features ── */}
      <section id="fitur" className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <p className="font-mono text-[11px] tracking-[0.45em] uppercase text-white/35 mb-5">Fitur</p>
          <h2 className="font-display text-3xl md:text-5xl font-bold uppercase tracking-tight max-w-2xl leading-[1.05]">
            Semua yang venue &amp; panitia butuhkan
          </h2>
        </Reveal>
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.t} delay={(i % 3) * 110}>
              <div className="group h-full rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-7 transition-all duration-300 hover:border-[#E2B95B]/50 hover:-translate-y-1 hover:shadow-[0_18px_50px_-18px_rgba(226,185,91,0.25)]">
                <div className="font-mono text-xs gold-text mb-5">{String(i + 1).padStart(2, '0')}</div>
                <h3 className="font-display font-bold text-lg leading-snug">{f.t}</h3>
                <p className="mt-3 text-sm text-white/50 leading-relaxed">{f.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Sponsor math ── */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-[#E2B95B]/30 p-10 md:p-16" style={{ background: 'linear-gradient(120deg, rgba(226,185,91,0.14) 0%, rgba(226,185,91,0.05) 55%, rgba(6,8,26,0) 100%)' }}>
            <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(226,185,91,0.22) 0%, transparent 65%)' }} />
            <p className="font-mono text-[11px] tracking-[0.45em] uppercase text-white/40 mb-5">Matematika sponsor</p>
            <h2 className="font-display text-3xl md:text-5xl font-bold uppercase tracking-tight leading-[1.05] max-w-3xl">
              Sistemnya bisa <span className="gold-text">terbayar sendiri.</span>
            </h2>
            <p className="mt-6 max-w-2xl leading-relaxed text-white/65">
              TV di venue ditatap semua orang yang menunggu giliran main. Di paket
              Tournament &amp; Championship, slot logo dan video iklan di TV itu{' '}
              <strong className="text-white">milikmu</strong> — jual ke brand lokal,
              dan satu-dua sponsor biasanya sudah menutup biaya paketnya. Sisanya untung.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── Pricing ── */}
      <section id="harga" className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <p className="font-mono text-[11px] tracking-[0.45em] uppercase text-white/35 mb-5">Harga</p>
          <h2 className="font-display text-3xl md:text-5xl font-bold uppercase tracking-tight leading-[1.05]">
            Bayar per event.
            <br className="hidden md:block" /> Tanpa langganan.
          </h2>
        </Reveal>
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
          {TIERS.map((t, i) => (
            <Reveal key={t.name} delay={i * 110} className="h-full">
              <div
                className={`relative h-full rounded-2xl p-7 flex flex-col border transition-all duration-300 hover:-translate-y-1.5 ${
                  t.best
                    ? 'gold-glow border-transparent bg-gradient-to-b from-[#E2B95B]/[0.12] to-white/[0.02]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/30'
                }`}
              >
                {t.best && (
                  <span
                    className="absolute -top-3 left-7 rounded-full px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#06081A]"
                    style={{ background: `linear-gradient(110deg, #F3D27E, ${GOLD} 60%, #C9952F)` }}
                  >
                    Terlaris
                  </span>
                )}
                <div className="font-mono text-[11px] tracking-[0.25em] uppercase text-white/40">{t.tag}</div>
                <h3 className="font-display mt-1.5 font-bold text-xl tracking-[0.08em]">{t.name}</h3>
                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="text-sm text-white/45">Rp</span>
                  <span className={`font-display text-5xl font-bold ${t.best ? 'gold-text' : ''}`}>{t.price}</span>
                  <span className="text-sm text-white/45">/event</span>
                </div>
                <ul className="mt-7 space-y-3 text-sm text-white/60 flex-1">
                  {t.items.map((it) => (
                    <li key={it} className="flex gap-3 leading-snug">
                      <span className="gold-text shrink-0">—</span>
                      {it}
                    </li>
                  ))}
                </ul>
                <a
                  href={wa(`Halo OnPoint, saya mau pesan paket ${t.name} (Rp ${t.price}) untuk event padel saya.`)}
                  className={`mt-8 rounded-full py-3.5 text-center text-sm font-bold transition-all hover:-translate-y-0.5 ${
                    t.best
                      ? 'text-[#06081A] hover:shadow-[0_0_28px_-6px_rgba(226,185,91,0.9)]'
                      : 'border border-white/20 hover:border-[#E2B95B]/70 hover:text-[#F3D27E]'
                  }`}
                  style={t.best ? { background: `linear-gradient(110deg, #F3D27E, ${GOLD} 60%, #C9952F)` } : undefined}
                >
                  Pesan {t.name[0] + t.name.slice(1).toLowerCase()}
                </a>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <p className="mt-7 text-sm text-white/35">
            Butuh event rutin tiap minggu atau lisensi venue?{' '}
            <a className="underline decoration-[#E2B95B]/50 underline-offset-4 hover:text-[#F3D27E]" href={wa('Halo OnPoint, saya tertarik lisensi venue / paket event rutin.')}>
              Chat kami
            </a>{' '}
            — ada paketnya.
          </p>
        </Reveal>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-16">
        <Reveal>
          <p className="font-mono text-[11px] tracking-[0.45em] uppercase text-white/35 mb-5">FAQ</p>
          <h2 className="font-display text-3xl md:text-5xl font-bold uppercase tracking-tight">Sering ditanya</h2>
        </Reveal>
        <Reveal>
          <div className="mt-12 divide-y divide-white/10 border-y border-white/10">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer items-center justify-between font-bold list-none hover:text-[#F3D27E] transition-colors">
                  {f.q}
                  <span className="ml-4 transition-transform duration-300 group-open:rotate-45 gold-text text-2xl leading-none font-light">+</span>
                </summary>
                <p className="mt-3.5 text-sm text-white/55 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Final CTA + footer ── */}
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-12 md:p-20 text-center">
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-48 w-[720px] h-[480px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(226,185,91,0.18) 0%, transparent 65%)' }} />
            <h2 className="font-display text-3xl md:text-6xl font-bold uppercase tracking-tight leading-[1.03]">
              Event berikutnya,
              <br />
              <span className="gold-text">level berikutnya.</span>
            </h2>
            <a
              href={wa('Halo OnPoint, saya mau pakai sistemnya untuk event padel saya. Boleh info paketnya?')}
              className="relative mt-10 inline-block rounded-full px-10 py-4.5 py-4 font-bold text-[#06081A] transition-all hover:shadow-[0_0_44px_-8px_rgba(226,185,91,1)] hover:-translate-y-0.5"
              style={{ background: `linear-gradient(110deg, #F3D27E, ${GOLD} 60%, #C9952F)` }}
            >
              Chat WhatsApp — 0852 9000 0130
            </a>
          </div>
        </Reveal>
        <footer className="py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/35">
          <div className="flex items-center gap-2.5">
            <img src="/landing/logo.png" alt="" width={26} height={26} className="rounded-full bg-white" loading="lazy" />
            <span>© {new Date().getFullYear()} OnPoint</span>
          </div>
          <div className="flex items-center gap-7">
            <button onClick={() => navigate('/iklan')} className="hover:text-white transition-colors">Pasang iklan</button>
            <button onClick={() => navigate('/contestant')} className="hover:text-white transition-colors">Cek tournament kamu</button>
            <a href={wa('Halo OnPoint!')} className="hover:text-white transition-colors">WhatsApp</a>
          </div>
        </footer>
      </section>
    </div>
  );
}
