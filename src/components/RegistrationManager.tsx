import { useState } from 'react';
import { Copy, Link2, Plus, Trash2, UserPlus } from 'lucide-react';
import { Tournament, RegistrationConfig, RegistrationField, Team } from '../types/tournament';
import { updateRegistration, DEFAULT_REGISTRATION_FIELDS } from '../utils/registration';
import { getTournament } from '../utils/storage';
import { slugify } from '../utils/slugify';

// ─── Organizer panel: enable/configure the public registration form, ─────────
// tick payments, and import paid teams into the tournament.

export default function RegistrationManager({
  tournament,
  onUpdateTournament,
  onRefreshed,
  onImportTeams,
}: {
  tournament: Tournament;
  onUpdateTournament: (t: Tournament) => void; // persists (config changes)
  onRefreshed: (t: Tournament) => void; // state-only (after atomic entry RPCs)
  onImportTeams: (teams: Team[]) => void;
}) {
  const [copied, setCopied] = useState(false);
  const cfg = tournament.registration;
  const regs = tournament.registrations ?? [];
  const link = `${window.location.origin}/daftar/${tournament.slug || slugify(tournament.name)}`;

  const save = (patch: Partial<RegistrationConfig>) =>
    onUpdateTournament({
      ...tournament,
      registration: { enabled: false, fields: DEFAULT_REGISTRATION_FIELDS, ...cfg, ...patch },
    });

  const saveFields = (fields: RegistrationField[]) => save({ fields });

  // entry actions go through the atomic RPC, then we re-pull the fresh row
  const entryAction = async (entryId: string, action: 'paid' | 'unpaid' | 'delete') => {
    await updateRegistration(tournament, entryId, action);
    const fresh = await getTournament(tournament.id);
    if (fresh) onRefreshed(fresh);
  };

  const importPaid = () => {
    const teamField = cfg?.fields[0]?.id ?? 'team';
    const paid = regs.filter((r) => r.paid && !r.waitlist);
    if (paid.length === 0) return;
    const existing = new Set(tournament.teams.map((t) => t.name.toLowerCase()));
    const newTeams: Team[] = paid
      .map((r) => (r.values[teamField] ?? '').trim())
      .filter((name) => name && !existing.has(name.toLowerCase()))
      .map((name) => ({ id: `team-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name }));
    if (newTeams.length > 0) onImportTeams([...tournament.teams, ...newTeams]);
  };

  if (!cfg?.enabled) {
    return (
      <div className="bg-white/80 backdrop-blur-xl border border-[#F0EBE3] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#2A2A2A]">Pendaftaran Online</h2>
            <p className="text-gray-500 text-sm mt-1">
              Form pendaftaran publik — peserta isi sendiri lewat link, kamu tinggal centang yang sudah bayar.
            </p>
          </div>
          <button
            onClick={() => save({ enabled: true })}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#B45330] to-[#C96A40] text-white font-semibold text-sm"
          >
            Aktifkan
          </button>
        </div>
      </div>
    );
  }

  const paidCount = regs.filter((r) => r.paid && !r.waitlist).length;

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-[#F0EBE3] rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#2A2A2A]">Pendaftaran Online</h2>
          <p className="text-gray-500 text-sm mt-1">
            {regs.length} pendaftar · {paidCount} lunas
            {cfg.quota ? ` · kuota ${cfg.quota}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-1.5 text-sm border border-[#B45330] text-[#B45330] hover:bg-[#B45330] hover:text-white px-3 py-2 rounded-lg transition-all"
          >
            {copied ? <Copy className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
            {copied ? 'Tersalin!' : 'Salin Link'}
          </button>
          <button
            onClick={() => save({ enabled: false })}
            className="text-sm text-gray-400 hover:text-red-500 px-2 py-2 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1.5">Kuota tim (0 = bebas)</label>
          <input
            type="number"
            min={0}
            value={cfg.quota ?? 0}
            onChange={(e) => save({ quota: Math.max(0, parseInt(e.target.value, 10) || 0) })}
            className="w-full px-3 py-2.5 bg-white border border-[#F0EBE3] rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1.5">Instruksi pembayaran</label>
          <textarea
            value={cfg.paymentNote ?? ''}
            onChange={(e) => save({ paymentNote: e.target.value })}
            rows={2}
            placeholder={'Transfer Rp xxx ke BCA 1234567 a.n. ...\nKonfirmasi ke WA 08xx'}
            className="w-full px-3 py-2.5 bg-white border border-[#F0EBE3] rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Field editor */}
      <div>
        <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
          Kolom form <span className="normal-case">(ubah sebelum link disebar)</span>
        </label>
        <div className="space-y-2">
          {cfg.fields.map((f, i) => (
            <div key={f.id} className="flex flex-wrap items-center gap-2">
              <input
                value={f.label}
                onChange={(e) => saveFields(cfg.fields.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)))}
                className="flex-1 min-w-40 px-3 py-2 bg-white border border-[#F0EBE3] rounded-lg text-sm"
              />
              <select
                value={f.type}
                onChange={(e) => saveFields(cfg.fields.map((x) => (x.id === f.id ? { ...x, type: e.target.value as RegistrationField['type'] } : x)))}
                className="px-2 py-2 bg-white border border-[#F0EBE3] rounded-lg text-sm"
              >
                <option value="text">Teks</option>
                <option value="phone">No. HP</option>
                <option value="select">Pilihan</option>
              </select>
              {f.type === 'select' && (
                <input
                  value={(f.options ?? []).join(', ')}
                  onChange={(e) => saveFields(cfg.fields.map((x) => (x.id === f.id ? { ...x, options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) } : x)))}
                  placeholder="Opsi A, Opsi B"
                  className="flex-1 min-w-32 px-3 py-2 bg-white border border-[#F0EBE3] rounded-lg text-sm"
                />
              )}
              <label className="flex items-center gap-1 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={f.required ?? false}
                  onChange={(e) => saveFields(cfg.fields.map((x) => (x.id === f.id ? { ...x, required: e.target.checked } : x)))}
                />
                wajib
              </label>
              <button
                disabled={i === 0}
                title={i === 0 ? 'Kolom pertama = nama tim (untuk impor)' : 'Hapus kolom'}
                onClick={() => saveFields(cfg.fields.filter((x) => x.id !== f.id))}
                className="text-gray-300 hover:text-red-500 disabled:opacity-30 p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => saveFields([...cfg.fields, { id: `f-${Date.now()}`, label: 'Kolom baru', type: 'text' }])}
          className="mt-2 flex items-center gap-1 text-sm text-[#B45330] hover:underline"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah kolom
        </button>
      </div>

      {/* Entries */}
      {regs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-500 uppercase tracking-widest">Pendaftar</label>
            <button
              onClick={importPaid}
              disabled={paidCount === 0}
              className="flex items-center gap-1.5 text-sm bg-gradient-to-r from-[#B45330] to-[#C96A40] text-white px-3 py-2 rounded-lg disabled:opacity-40"
            >
              <UserPlus className="w-3.5 h-3.5" /> Masukkan {paidCount} tim lunas ke Tournament
            </button>
          </div>
          <div className="divide-y divide-[#F0EBE3] border-y border-[#F0EBE3]">
            {regs.map((r) => (
              <div key={r.id} className="py-2.5 flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2 shrink-0">
                  <input
                    type="checkbox"
                    checked={r.paid ?? false}
                    onChange={(e) => entryAction(r.id, e.target.checked ? 'paid' : 'unpaid')}
                    className="w-4 h-4 accent-[#B45330]"
                  />
                  <span className={`text-xs font-bold ${r.paid ? 'text-green-600' : 'text-gray-400'}`}>
                    {r.paid ? 'LUNAS' : 'belum'}
                  </span>
                </label>
                <div className="flex-1 truncate">
                  {cfg.fields.map((f) => r.values[f.id]).filter(Boolean).join(' · ')}
                </div>
                {r.waitlist && (
                  <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">
                    Waitlist
                  </span>
                )}
                <button onClick={() => entryAction(r.id, 'delete')} className="text-gray-300 hover:text-red-500 p-1 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
