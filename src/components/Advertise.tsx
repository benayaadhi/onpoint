import { useNavigate } from 'react-router-dom';

// ─── /iklan — page for BRANDS who pay OnPoint to run ads on the network ──────
// (The organizer-facing sales page is Landing.tsx; this speaks to advertisers.)

const WA = '6285290000130';
const wa = (text: string) => `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;

const BG = '#06081A';
const GOLD = '#E2B95B';
const goldBtn = { background: `linear-gradient(110deg, #F3D27E, ${GOLD} 60%, #C9952F)` };

const WHY = [
  {
    t: 'An audience that actually watches',
    d: 'Players waiting for their turn and spectators at the venue watch the score TVs all event long — not an ad people scroll past.',
  },
  {
    t: 'A premium crowd',
    d: 'The padel community: urban, active, strong purchasing power. The right context for sports, F&B, apparel, and lifestyle brands.',
  },
  {
    t: 'Broadcast-style placement',
    d: 'Your video or poster plays automatically during every break — short bumpers between games, full reels between matches. Unskippable.',
  },
];

const STEPS = [
  { n: '01', t: 'Send your creative', d: 'A short video (10–30s, no audio needed) or a poster. Our team helps check the format.' },
  { n: '02', t: 'It plays automatically', d: "Your creative joins the OnPoint network reel and plays on the TVs of the network's events throughout your partnership period." },
  { n: '03', t: 'Get a play report', d: 'Event and playback recap at the end of each period — transparent, renewable monthly.' },
];

export default function Advertise() {
  const navigate = useNavigate();

  return (
    <div className="grain min-h-screen font-sans antialiased text-white selection:bg-[#E2B95B] selection:text-[#06081A]" style={{ background: BG }}>
      {/* ── Nav ── */}
      <header className="fixed top-0 inset-x-0 z-50">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mt-4 flex items-center justify-between rounded-full border border-white/10 bg-[#06081A]/75 backdrop-blur-xl px-4 py-2.5">
            <button onClick={() => navigate('/')} className="flex items-center gap-2.5">
              <img src="/landing/logo.png" alt="OnPoint" width={34} height={34} className="rounded-full bg-white" />
              <span className="font-display font-bold tracking-[0.18em] text-sm">
                <span className="gold-text">ON</span>POINT
              </span>
            </button>
            <nav className="hidden md:flex items-center gap-8 text-sm text-white/55">
              <button onClick={() => navigate('/')} className="hover:text-white transition-colors">For Organizers</button>
              <a href="#cara" className="hover:text-white transition-colors">How It Works</a>
            </nav>
            <a
              href={wa('Halo OnPoint, saya tertarik memasang iklan brand kami di jaringan TV event padel.')}
              className="rounded-full px-5 py-2 text-sm font-bold text-[#06081A] transition-all hover:shadow-[0_0_24px_-4px_rgba(226,185,91,0.8)]"
              style={goldBtn}
            >
              WhatsApp
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative min-h-[88vh] flex items-end overflow-hidden">
        <img
          src="/landing/hero.jpg"
          alt="TV display di venue padel"
          className="kenburns absolute inset-0 w-full h-full object-cover"
          width={1600}
          height={1067}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,8,26,0.66) 0%, rgba(6,8,26,0.3) 45%, rgba(6,8,26,0.98) 100%)' }} />
        <div className="absolute -bottom-40 -right-40 w-[640px] h-[640px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(226,185,91,0.16) 0%, transparent 65%)' }} />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-48 w-full">
          <p className="font-mono text-[11px] md:text-xs tracking-[0.45em] uppercase mb-6 text-white/60">
            <span className="gold-text font-bold">OnPoint</span> — For Brands & Advertisers
          </p>
          <h1 className="font-display text-[2.6rem] sm:text-6xl md:text-[4.6rem] font-bold leading-[0.98] tracking-tight uppercase max-w-4xl">
            Your brand on the screen
            <br />
            <span className="gold-text">everyone's watching.</span>
          </h1>
          <p className="mt-7 max-w-xl text-white/65 text-base md:text-lg leading-relaxed">
            Video ads on padel venue score TVs — played automatically during every
            break, across the OnPoint event network.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href={wa('Halo OnPoint, saya tertarik memasang iklan brand kami di jaringan TV event padel. Boleh info paket partnership-nya?')}
              className="rounded-full px-8 py-4 font-bold text-[#06081A] text-sm md:text-base transition-all hover:shadow-[0_0_36px_-6px_rgba(226,185,91,0.9)] hover:-translate-y-0.5"
              style={goldBtn}
            >
              Become a Partner
            </a>
          </div>
        </div>
      </section>

      {/* ── Why ── */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <p className="font-mono text-[11px] tracking-[0.45em] uppercase text-white/35 mb-5">Why here</p>
        <h2 className="font-display text-3xl md:text-5xl font-bold uppercase tracking-tight max-w-2xl leading-[1.05]">
          Attention you can't buy in a feed
        </h2>
        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {WHY.map((f) => (
            <div key={f.t} className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-7 transition-all duration-300 hover:border-[#E2B95B]/50 hover:-translate-y-1">
              <h3 className="font-display font-bold text-lg leading-snug">{f.t}</h3>
              <p className="mt-3 text-sm text-white/50 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How ── */}
      <section id="cara" className="mx-auto max-w-6xl px-4 pb-20">
        <p className="font-mono text-[11px] tracking-[0.45em] uppercase text-white/35 mb-5">How it works</p>
        <h2 className="font-display text-3xl md:text-5xl font-bold uppercase tracking-tight leading-[1.05]">
          Three steps, on air.
        </h2>
        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
              <div className="font-mono text-xs gold-text mb-5">{s.n}</div>
              <h3 className="font-display font-bold text-lg">{s.t}</h3>
              <p className="mt-3 text-sm text-white/50 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mx-auto max-w-6xl px-4 pb-10">
        <div className="relative overflow-hidden rounded-3xl border border-[#E2B95B]/30 p-12 md:p-20 text-center" style={{ background: 'linear-gradient(120deg, rgba(226,185,91,0.13) 0%, rgba(226,185,91,0.04) 55%, rgba(6,8,26,0) 100%)' }}>
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-48 w-[720px] h-[480px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(226,185,91,0.2) 0%, transparent 65%)' }} />
          <h2 className="font-display text-3xl md:text-6xl font-bold uppercase tracking-tight leading-[1.03]">
            Partner slots are
            <br />
            <span className="gold-text">limited per period.</span>
          </h2>
          <p className="mt-6 text-white/55 max-w-xl mx-auto">
            Monthly partnership packages — your brand appears across every network
            event. Pricing and availability via WhatsApp.
          </p>
          <a
            href={wa('Halo OnPoint, saya mau info paket partner iklan jaringan (harga & ketersediaan).')}
            className="mt-10 inline-block rounded-full px-10 py-4 font-bold text-[#06081A] transition-all hover:shadow-[0_0_44px_-8px_rgba(226,185,91,1)] hover:-translate-y-0.5"
            style={goldBtn}
          >
            WhatsApp — 0852 9000 0130
          </a>
        </div>
        <footer className="py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/35">
          <div className="flex items-center gap-2.5">
            <img src="/landing/logo.png" alt="" width={26} height={26} className="rounded-full bg-white" loading="lazy" />
            <span>© {new Date().getFullYear()} OnPoint</span>
          </div>
          <button onClick={() => navigate('/')} className="hover:text-white transition-colors">For event organizers →</button>
        </footer>
      </section>
    </div>
  );
}
