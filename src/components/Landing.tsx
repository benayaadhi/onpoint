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
  { n: '0.2', u: 's', d: 'score to every TV' },
  { n: '3+', u: 'courts', d: 'scored at once, zero clashes' },
  { n: '72', u: 'h', d: 'active window per event' },
  { n: '1', u: 'code', d: "and you're live" },
];

const FEATURES = [
  {
    t: 'Clash-proof live scoring',
    d: 'Multiple crew scoring multiple courts at the same time — scores never overwrite each other. Proven across hundreds of simulated matches.',
  },
  {
    t: 'A TV display on every court',
    d: 'Live scores on the venue screens, matches switch automatically in a blink, winner celebrations, standings between matches.',
  },
  {
    t: 'Sponsor ads on TV',
    d: 'YouTube-style video ads during breaks: short bumpers between games, full reels between matches. The slots are yours to sell.',
  },
  {
    t: 'Every tournament format',
    d: 'Round robin, groups + knockout, single elimination, and club-vs-club clash (men / women / mix squad battles).',
  },
  {
    t: 'Live links for players',
    d: 'Bracket, schedule, and scores on every player\'s phone — just open a link, nothing to install.',
  },
  {
    t: 'One code, all set',
    d: 'Pay per event, get an activation code, create your tournament. Results and brackets stay viewable forever.',
  },
];

const TIERS = [
  {
    name: 'STARTER',
    price: '1jt',
    tag: 'Community',
    best: false,
    items: [
      'Live scoring + every bracket format',
      'TV display on every court',
      'Live links for players',
      'OnPoint network ads play on your TVs',
      'OnPoint watermark',
    ],
  },
  {
    name: 'COMPACT',
    price: '2jt',
    tag: 'Private event',
    best: false,
    items: [
      'Everything in Starter',
      'Clean TVs — no ads',
      'No watermark',
    ],
  },
  {
    name: 'TOURNAMENT',
    price: '4jt',
    tag: 'Sponsored event',
    best: true,
    items: [
      'Everything in Compact',
      'Sponsor bar on TV: 3 logo slots — yours',
      'Sell them to sponsors, keep 100%',
    ],
  },
  {
    name: 'CHAMPIONSHIP',
    price: '6jt',
    tag: 'Big stage',
    best: false,
    items: [
      'Everything in Tournament',
      'Full video ad system: bumpers between games, reels between matches, Break button',
      'Millions worth of ad inventory — ready to sell',
      'Priority support on event day',
    ],
  },
];

const FAQ = [
  {
    q: 'How do I get started?',
    a: 'Chat us on WhatsApp → agree on a package & event date → transfer → receive your activation code → enter it when creating the tournament. Five minutes, done.',
  },
  {
    q: "What's an activation code?",
    a: 'One code = one event. The code is used once when you create the tournament, and your package (Starter / Compact / Tournament / Championship) activates across every feature automatically.',
  },
  {
    q: 'What does the 72-hour window mean?',
    a: 'From the moment your code is used, the tournament can be scored and reset for 3 days — enough for setup plus event day. After that, results, brackets, and TVs stay viewable forever; only score input locks.',
  },
  {
    q: 'Event postponed or running late?',
    a: "Chat us and we'll shift your window. Free, no drama.",
  },
  {
    q: 'Do I need to install anything?',
    a: 'No. Everything runs in the browser — crew phones, player phones, and the venue TVs (any TV or mini PC with a browser).',
  },
  {
    q: 'How do the sponsor ads work?',
    a: 'On Tournament you get 3 logo slots on the TVs. On Championship you can also upload video/poster ads that play automatically during every break — between games, between matches, or when the Break button is pressed. You sell those slots yourself: one sponsor usually covers the whole package.',
  },
];

const MARQUEE = ['LIVE SCORING', 'TV DISPLAY', 'SPONSOR ADS', 'AUTO BRACKETS', 'MULTI-COURT', 'CLUB CLASH'];

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
              <a href="#fitur" className="hover:text-white transition-colors">Features</a>
              <a href="#harga" className="hover:text-white transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
              <button onClick={() => navigate('/iklan')} className="hover:text-[#F3D27E] transition-colors">
                Advertise
              </button>
              <button onClick={() => navigate('/contestant')} className="hover:text-white transition-colors">
                My Tournament
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
              Padel tournaments,
              <br />
              <span className="gold-text">broadcast feel.</span>
            </h1>
          </Reveal>
          <Reveal delay={240}>
            <p className="mt-7 max-w-xl text-white/65 text-base md:text-lg leading-relaxed">
              Live multi-court scoring, a TV display on every court, and ad slots
              you can sell to sponsors. Your crew just taps the score — everything
              else runs itself.
            </p>
          </Reveal>
          <Reveal delay={360}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a
                href={wa('Halo OnPoint, saya mau pakai sistemnya untuk event padel saya. Boleh info paketnya?')}
                className="rounded-full px-8 py-4 font-bold text-[#06081A] text-sm md:text-base transition-all hover:shadow-[0_0_36px_-6px_rgba(226,185,91,0.9)] hover:-translate-y-0.5"
                style={{ background: `linear-gradient(110deg, #F3D27E, ${GOLD} 60%, #C9952F)` }}
              >
                Chat on WhatsApp
              </a>
              <a href="#harga" className="rounded-full px-8 py-4 font-bold text-sm md:text-base border border-white/20 hover:border-[#E2B95B]/70 hover:text-[#F3D27E] transition-colors">
                See Pricing
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
          <p className="font-mono text-[11px] tracking-[0.45em] uppercase text-white/35 mb-5">Features</p>
          <h2 className="font-display text-3xl md:text-5xl font-bold uppercase tracking-tight max-w-2xl leading-[1.05]">
            Everything a venue &amp; crew need
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
          <div className="relative overflow-hidden rounded-3xl p-10 md:p-16" style={{ background: '#FAF8F5', color: '#06081A' }}>
            <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(201,149,47,0.18) 0%, transparent 65%)' }} />
            <p className="font-mono text-[11px] tracking-[0.45em] uppercase mb-5" style={{ color: '#8B7355' }}>Sponsor math</p>
            <h2 className="font-display text-3xl md:text-5xl font-bold uppercase tracking-tight leading-[1.05] max-w-3xl">
              The system can <span style={{ color: '#C9952F' }}>pay for itself.</span>
            </h2>
            <p className="mt-6 max-w-2xl leading-relaxed" style={{ color: 'rgba(6,8,26,0.65)' }}>
              Everyone waiting for their turn watches the venue TVs. On Tournament
              &amp; Championship, the logo and video ad slots on those screens are{' '}
              <strong style={{ color: '#06081A' }}>yours</strong> — sell them to local
              brands, and one or two sponsors usually cover the package. The rest is profit.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── Pricing ── */}
      <section id="harga" className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <p className="font-mono text-[11px] tracking-[0.45em] uppercase text-white/35 mb-5">Pricing</p>
          <h2 className="font-display text-3xl md:text-5xl font-bold uppercase tracking-tight leading-[1.05]">
            Pay per event.
            <br className="hidden md:block" /> No subscriptions.
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
                  Get {t.name[0] + t.name.slice(1).toLowerCase()}
                </a>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <p className="mt-7 text-sm text-white/35">
            Running weekly events or want a venue license?{' '}
            <a className="underline decoration-[#E2B95B]/50 underline-offset-4 hover:text-[#F3D27E]" href={wa('Halo OnPoint, saya tertarik lisensi venue / paket event rutin.')}>
              Chat with us
            </a>{' '}
            — we have a plan for that.
          </p>
        </Reveal>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-16">
        <Reveal>
          <p className="font-mono text-[11px] tracking-[0.45em] uppercase text-white/35 mb-5">FAQ</p>
          <h2 className="font-display text-3xl md:text-5xl font-bold uppercase tracking-tight">Common questions</h2>
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
              Your next event,
              <br />
              <span className="gold-text">on another level.</span>
            </h2>
            <a
              href={wa('Halo OnPoint, saya mau pakai sistemnya untuk event padel saya. Boleh info paketnya?')}
              className="relative mt-10 inline-block rounded-full px-10 py-4.5 py-4 font-bold text-[#06081A] transition-all hover:shadow-[0_0_44px_-8px_rgba(226,185,91,1)] hover:-translate-y-0.5"
              style={{ background: `linear-gradient(110deg, #F3D27E, ${GOLD} 60%, #C9952F)` }}
            >
              WhatsApp — 0852 9000 0130
            </a>
          </div>
        </Reveal>
        <footer className="py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/35">
          <div className="flex items-center gap-2.5">
            <img src="/landing/logo.png" alt="" width={26} height={26} className="rounded-full bg-white" loading="lazy" />
            <span>© {new Date().getFullYear()} OnPoint</span>
          </div>
          <div className="flex items-center gap-7">
            <button onClick={() => navigate('/iklan')} className="hover:text-white transition-colors">Advertise</button>
            <button onClick={() => navigate('/contestant')} className="hover:text-white transition-colors">Find your tournament</button>
            <a href={wa('Halo OnPoint!')} className="hover:text-white transition-colors">WhatsApp</a>
          </div>
        </footer>
      </section>
    </div>
  );
}
