import { useNavigate } from 'react-router-dom';

// ─── OnPoint landing / sales page ─────────────────────────────────────────────
// Dark-broadcast look built from the logo palette (navy + yellow), zero extra
// dependencies and no webfonts so it stays fast on venue connections.

const WA = '6285290000130';
const wa = (text: string) => `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;

const NAVY = '#0A0E23';
const YELLOW = '#F5C518';

const STATS = [
  { n: '0,2 dtk', d: 'skor sampai ke TV' },
  { n: '3+ court', d: 'serentak tanpa bentrok' },
  { n: '72 jam', d: 'masa aktif per event' },
  { n: '1 kode', d: 'langsung jalan' },
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
      'Iklan jaringan WePadl tampil di TV',
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

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen font-sans antialiased text-white" style={{ background: NAVY }}>
      {/* ── Nav ── */}
      <header className="fixed top-0 inset-x-0 z-50">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mt-4 flex items-center justify-between rounded-full border border-white/10 bg-[#0A0E23]/80 backdrop-blur px-4 py-2.5">
            <a href="#" className="flex items-center gap-2.5">
              <img src="/landing/logo.png" alt="OnPoint" width={34} height={34} className="rounded-full bg-white" />
              <span className="font-bold tracking-wide">
                <span style={{ color: YELLOW }}>ON</span>POINT
              </span>
            </a>
            <nav className="hidden md:flex items-center gap-7 text-sm text-white/60">
              <a href="#fitur" className="hover:text-white transition-colors">Fitur</a>
              <a href="#harga" className="hover:text-white transition-colors">Harga</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
              <button onClick={() => navigate('/contestant')} className="hover:text-white transition-colors">
                Cek Tournament
              </button>
            </nav>
            <a
              href={wa('Halo WePadl, saya mau tanya soal sistem turnamen OnPoint')}
              className="rounded-full px-4 py-2 text-sm font-bold text-[#0A0E23] transition-transform hover:scale-105"
              style={{ background: YELLOW }}
            >
              WhatsApp
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative min-h-[92vh] flex items-end overflow-hidden">
        <img
          src="/landing/hero.jpg"
          alt="Turnamen padel WePadl"
          className="absolute inset-0 w-full h-full object-cover"
          width={1600}
          height={1067}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,14,35,0.55) 0%, rgba(10,14,35,0.25) 45%, rgba(10,14,35,0.97) 100%)' }} />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-44 w-full">
          <p className="font-mono text-xs md:text-sm tracking-[0.35em] uppercase mb-5" style={{ color: YELLOW }}>
            OnPoint × WePadl — Tournament System
          </p>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black leading-[1.02] tracking-tight uppercase max-w-4xl">
            Turnamen padel
            <br />
            rasa <span style={{ color: YELLOW }}>broadcast TV</span>
          </h1>
          <p className="mt-6 max-w-xl text-white/70 text-base md:text-lg leading-relaxed">
            Scoring live multi-court, TV display di tiap lapangan, dan slot iklan
            yang bisa kamu jual ke sponsor. Panitia tinggal pencet skor — sisanya
            jalan sendiri.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a
              href={wa('Halo WePadl, saya mau pakai OnPoint untuk event padel saya. Boleh info paketnya?')}
              className="rounded-full px-7 py-3.5 font-bold text-[#0A0E23] text-sm md:text-base transition-transform hover:scale-105"
              style={{ background: YELLOW }}
            >
              Pesan via WhatsApp
            </a>
            <a href="#harga" className="rounded-full px-7 py-3.5 font-bold text-sm md:text-base border border-white/25 hover:border-white/60 transition-colors">
              Lihat Harga
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="border-y border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.n}>
              <div className="font-mono text-3xl md:text-4xl font-bold" style={{ color: YELLOW }}>{s.n}</div>
              <div className="mt-1.5 text-sm text-white/55">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="fitur" className="mx-auto max-w-6xl px-4 py-24">
        <p className="font-mono text-xs tracking-[0.35em] uppercase text-white/40 mb-4">Fitur</p>
        <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight max-w-2xl leading-tight">
          Semua yang venue & panitia butuhkan
        </h2>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <div key={f.t} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 hover:border-white/25 transition-colors">
              <div className="font-mono text-xs text-white/35 mb-4">{String(i + 1).padStart(2, '0')}</div>
              <h3 className="font-bold text-lg leading-snug">{f.t}</h3>
              <p className="mt-2.5 text-sm text-white/55 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Sponsor math ── */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="rounded-3xl p-8 md:p-14" style={{ background: YELLOW, color: NAVY }}>
          <p className="font-mono text-xs tracking-[0.35em] uppercase opacity-60 mb-4">Matematika sponsor</p>
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight leading-tight max-w-3xl">
            Sistemnya bisa terbayar sendiri.
          </h2>
          <p className="mt-5 max-w-2xl font-medium leading-relaxed opacity-80">
            TV di venue ditatap semua orang yang menunggu giliran main. Di paket
            Tournament &amp; Championship, slot logo dan video iklan di TV itu{' '}
            <strong>milikmu</strong> — jual ke brand lokal, dan satu-dua sponsor
            biasanya sudah menutup biaya paketnya. Sisanya untung.
          </p>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="harga" className="mx-auto max-w-6xl px-4 pb-24">
        <p className="font-mono text-xs tracking-[0.35em] uppercase text-white/40 mb-4">Harga</p>
        <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight leading-tight">
          Bayar per event.
          <br className="hidden md:block" /> Tanpa langganan.
        </h2>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`relative rounded-2xl p-6 flex flex-col border ${
                t.best ? 'bg-white/[0.07]' : 'border-white/10 bg-white/[0.03]'
              }`}
              style={t.best ? { borderColor: YELLOW } : undefined}
            >
              {t.best && (
                <span
                  className="absolute -top-3 left-6 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#0A0E23]"
                  style={{ background: YELLOW }}
                >
                  Terlaris
                </span>
              )}
              <div className="font-mono text-xs tracking-widest text-white/45">{t.tag}</div>
              <h3 className="mt-1 font-black text-xl tracking-wide">{t.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-sm text-white/50">Rp</span>
                <span className="text-5xl font-black" style={t.best ? { color: YELLOW } : undefined}>{t.price}</span>
                <span className="text-sm text-white/50">/event</span>
              </div>
              <ul className="mt-6 space-y-2.5 text-sm text-white/65 flex-1">
                {t.items.map((it) => (
                  <li key={it} className="flex gap-2.5 leading-snug">
                    <span style={{ color: YELLOW }}>—</span>
                    {it}
                  </li>
                ))}
              </ul>
              <a
                href={wa(`Halo WePadl, saya mau pesan paket ${t.name} (Rp ${t.price}) untuk event padel saya.`)}
                className={`mt-7 rounded-full py-3 text-center text-sm font-bold transition-transform hover:scale-[1.03] ${
                  t.best ? 'text-[#0A0E23]' : 'border border-white/25 hover:border-white/60'
                }`}
                style={t.best ? { background: YELLOW } : undefined}
              >
                Pesan {t.name[0] + t.name.slice(1).toLowerCase()}
              </a>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-white/40">
          Butuh event rutin tiap minggu atau lisensi venue? <a className="underline hover:text-white" href={wa('Halo WePadl, saya tertarik lisensi venue / paket event rutin.')}>Chat kami</a> — ada paketnya.
        </p>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="mx-auto max-w-3xl px-4 pb-24">
        <p className="font-mono text-xs tracking-[0.35em] uppercase text-white/40 mb-4">FAQ</p>
        <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight">Sering ditanya</h2>
        <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer items-center justify-between font-bold list-none">
                {f.q}
                <span className="ml-4 transition-transform group-open:rotate-45 text-white/40 text-xl leading-none">+</span>
              </summary>
              <p className="mt-3 text-sm text-white/60 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Final CTA + footer ── */}
      <section className="mx-auto max-w-6xl px-4 pb-10">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 md:p-16 text-center">
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight leading-tight">
            Event berikutnya,
            <br />
            <span style={{ color: YELLOW }}>level berikutnya.</span>
          </h2>
          <a
            href={wa('Halo WePadl, saya mau pakai OnPoint untuk event padel saya. Boleh info paketnya?')}
            className="mt-8 inline-block rounded-full px-9 py-4 font-bold text-[#0A0E23] transition-transform hover:scale-105"
            style={{ background: YELLOW }}
          >
            Chat WhatsApp — 0852 9000 0130
          </a>
        </div>
        <footer className="py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/40">
          <div className="flex items-center gap-2.5">
            <img src="/landing/logo.png" alt="" width={26} height={26} className="rounded-full bg-white" loading="lazy" />
            <span>© {new Date().getFullYear()} OnPoint × WePadl</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/contestant')} className="hover:text-white transition-colors">Cek tournament kamu</button>
            <a href={wa('Halo WePadl!')} className="hover:text-white transition-colors">WhatsApp</a>
          </div>
        </footer>
      </section>
    </div>
  );
}
