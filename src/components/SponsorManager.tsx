import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, Trash2, ImageIcon, CheckCircle, AlertCircle, Loader,
  Plus, ChevronDown, ChevronUp, Layers, Trophy, Eye, EyeOff,
} from 'lucide-react';
import { Tournament } from '../types/tournament';
import {
  SponsorSlot, SponsorTemplate,
  getTemplates, createTemplate, deleteTemplate,
  getTemplateSlots, saveTemplateSlot, uploadTemplateSlotLogo,
  getTournamentSponsors, saveTournamentSponsor, uploadTournamentSponsorLogo,
  removeTournamentSponsor, loadTemplateToTournament,
} from '../utils/sponsors';

type Status = { type: 'success' | 'error' | 'loading'; message: string } | null;

interface Props {
  tournaments: Tournament[];
  initialTournamentId?: string;
  onUpdateTournament?: (tournament: Tournament) => void;
}

// ─── Slot Card ────────────────────────────────────────────────────────────────

function SlotCard({
  slot,
  fileRef,
  status,
  onUpload,
  onRemove,
}: {
  slot: SponsorSlot;
  fileRef: React.RefObject<HTMLInputElement | null>;
  status: Status;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const isLoading = status?.type === 'loading';
  return (
    <div className="border-2 border-dashed border-[#D4C9BB] rounded-xl p-4 flex flex-col items-center gap-3 bg-[#FAF8F5] hover:border-[#B45330] transition-colors">
      <div className="text-[#B45330] font-bold text-sm">SLOT {slot.position}</div>

      <div className="w-full h-20 bg-white rounded-lg border border-[#F0EBE3] flex items-center justify-center overflow-hidden">
        {slot.logo_url ? (
          <img src={slot.logo_url} alt={`Slot ${slot.position}`} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-300">
            <ImageIcon className="w-7 h-7" />
            <span className="text-xs">No logo</span>
          </div>
        )}
      </div>

      {status && (
        <div className={`flex items-center gap-1 text-xs font-medium ${
          status.type === 'success' ? 'text-green-600' : status.type === 'error' ? 'text-red-500' : 'text-[#B45330]'
        }`}>
          {status.type === 'loading' && <Loader className="w-3 h-3 animate-spin" />}
          {status.type === 'success' && <CheckCircle className="w-3 h-3" />}
          {status.type === 'error' && <AlertCircle className="w-3 h-3" />}
          {status.message}
        </div>
      )}

      <div className="flex gap-2 w-full">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = '';
          }}
        />
        <button
          disabled={isLoading}
          onClick={() => fileRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1 bg-gradient-to-r from-[#B45330] to-[#C96A40] text-white py-1.5 px-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
        >
          <Upload className="w-3 h-3" />
          {slot.logo_url ? 'Ganti' : 'Upload'}
        </button>
        {slot.logo_url && (
          <button
            disabled={isLoading}
            onClick={onRemove}
            className="flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 py-1.5 px-2 rounded-lg border border-red-200 disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onDelete,
  onSelect,
}: {
  template: SponsorTemplate;
  onDelete: () => void;
  onSelect?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<SponsorSlot[]>([]);
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const fileRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (open && slots.length === 0) {
      getTemplateSlots(template.id).then(setSlots);
    }
  }, [open, template.id]);

  const setStatus = (pos: number, s: Status) => {
    setStatuses((p) => ({ ...p, [pos]: s }));
    if (s?.type !== 'loading') setTimeout(() => setStatuses((p) => ({ ...p, [pos]: null })), 3000);
  };

  const handleUpload = async (pos: 1 | 2 | 3, file: File) => {
    setStatus(pos, { type: 'loading', message: 'Uploading...' });
    try {
      const url = await uploadTemplateSlotLogo(template.id, pos, file);
      const slot: SponsorSlot = { position: pos, logo_url: url };
      await saveTemplateSlot(template.id, slot);
      setSlots((prev) => prev.map((s) => (s.position === pos ? { ...s, logo_url: url } : s)));
      setStatus(pos, { type: 'success', message: 'Saved!' });
    } catch (err) {
      console.error(err);
      setStatus(pos, { type: 'error', message: 'Upload failed.' });
    }
  };

  const handleRemove = async (pos: 1 | 2 | 3) => {
    setStatus(pos, { type: 'loading', message: 'Removing...' });
    await saveTemplateSlot(template.id, { position: pos, logo_url: null });
    setSlots((prev) => prev.map((s) => (s.position === pos ? { ...s, logo_url: null } : s)));
    setStatus(pos, { type: 'success', message: 'Removed.' });
  };

  return (
    <div className="border border-[#F0EBE3] rounded-xl bg-[#FAF8F5] overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-[#B45330]" />
          <span className="font-semibold text-[#2A2A2A]">{template.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {onSelect && (
            <button
              onClick={onSelect}
              className="text-xs bg-[#B45330] text-white px-3 py-1.5 rounded-lg hover:bg-[#C96A40] transition-colors"
            >
              Pakai
            </button>
          )}
          <button
            onClick={onDelete}
            className="text-gray-400 hover:text-red-500 transition-colors p-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-gray-400 hover:text-[#B45330] transition-colors p-1"
          >
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-[#F0EBE3] pt-4">
          <div className="grid grid-cols-3 gap-3">
            {slots.map((slot, idx) => (
              <SlotCard
                key={slot.position}
                slot={slot}
                fileRef={fileRefs[idx]}
                status={statuses[slot.position] ?? null}
                onUpload={(file) => handleUpload(slot.position as 1 | 2 | 3, file)}
                onRemove={() => handleRemove(slot.position as 1 | 2 | 3)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tournament Sponsors Section ──────────────────────────────────────────────

function TournamentSponsors({
  tournament,
  templates,
  onUpdateTournament,
}: {
  tournament: Tournament;
  templates: SponsorTemplate[];
  onUpdateTournament?: (t: Tournament) => void;
}) {
  const [slots, setSlots] = useState<SponsorSlot[]>([]);
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const fileRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    getTournamentSponsors(tournament.id).then(setSlots);
  }, [tournament.id]);

  const setStatus = (pos: number, s: Status) => {
    setStatuses((p) => ({ ...p, [pos]: s }));
    if (s?.type !== 'loading') setTimeout(() => setStatuses((p) => ({ ...p, [pos]: null })), 3000);
  };

  const handleUpload = async (pos: 1 | 2 | 3, file: File) => {
    setStatus(pos, { type: 'loading', message: 'Uploading...' });
    try {
      const url = await uploadTournamentSponsorLogo(tournament.id, pos, file);
      const slot: SponsorSlot = { position: pos, logo_url: url };
      await saveTournamentSponsor(tournament.id, slot, null);
      setSlots((prev) => prev.map((s) => (s.position === pos ? { ...s, logo_url: url } : s)));
      setStatus(pos, { type: 'success', message: 'Saved!' });
    } catch (err) {
      console.error(err);
      setStatus(pos, { type: 'error', message: 'Upload failed.' });
    }
  };

  const handleRemove = async (pos: 1 | 2 | 3) => {
    setStatus(pos, { type: 'loading', message: 'Removing...' });
    await removeTournamentSponsor(tournament.id, pos);
    setSlots((prev) => prev.map((s) => (s.position === pos ? { ...s, logo_url: null } : s)));
    setStatus(pos, { type: 'success', message: 'Removed.' });
  };

  const handleLoadTemplate = async (templateId: string) => {
    setLoadingTemplate(true);
    setShowTemplatePicker(false);
    try {
      const loaded = await loadTemplateToTournament(templateId, tournament.id);
      setSlots(loaded);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTemplate(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[#B45330]" />
          <span className="font-semibold text-[#2A2A2A]">{tournament.name}</span>
          <span className="text-xs text-gray-400 bg-[#F0EBE3] px-2 py-0.5 rounded-full capitalize">
            {tournament.format.replace('-', ' ')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Show/hide sponsor bar toggle */}
          <button
            onClick={() => onUpdateTournament?.({ ...tournament, showSponsorBar: !(tournament.showSponsorBar !== false) })}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-all ${
              tournament.showSponsorBar !== false
                ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
                : 'bg-[#F0EBE3] text-gray-500 border-[#D4C9BB] hover:bg-[#E8E0D5]'
            }`}
            title="Toggle sponsor bar visibility on TV display"
          >
            {tournament.showSponsorBar !== false
              ? <><Eye className="w-3.5 h-3.5" /> Visible</>
              : <><EyeOff className="w-3.5 h-3.5" /> Hidden</>
            }
          </button>

        <div className="relative">
          <button
            disabled={loadingTemplate || templates.length === 0}
            onClick={() => setShowTemplatePicker((v) => !v)}
            className="flex items-center gap-1.5 text-sm border border-[#B45330] text-[#B45330] hover:bg-[#B45330] hover:text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
          >
            {loadingTemplate ? <Loader className="w-3 h-3 animate-spin" /> : <Layers className="w-3 h-3" />}
            Load Template
            <ChevronDown className="w-3 h-3" />
          </button>

          {showTemplatePicker && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-[#F0EBE3] rounded-xl shadow-lg z-20 min-w-48 overflow-hidden">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleLoadTemplate(t.id)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#FAF8F5] text-[#2A2A2A] border-b border-[#F0EBE3] last:border-0 transition-colors"
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
        </div> {/* end flex items-center gap-2 */}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {slots.map((slot, idx) => (
          <SlotCard
            key={slot.position}
            slot={slot}
            fileRef={fileRefs[idx]}
            status={statuses[slot.position] ?? null}
            onUpload={(file) => handleUpload(slot.position as 1 | 2 | 3, file)}
            onRemove={() => handleRemove(slot.position as 1 | 2 | 3)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main SponsorManager ──────────────────────────────────────────────────────

export default function SponsorManager({ tournaments, initialTournamentId, onUpdateTournament }: Props) {
  const [templates, setTemplates] = useState<SponsorTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState(
    initialTournamentId ?? tournaments[0]?.id ?? ''
  );

  useEffect(() => {
    getTemplates().then(setTemplates);
  }, []);

  const selectedTournament = tournaments.find((t) => t.id === selectedTournamentId) ?? null;

  const handleCreateTemplate = async () => {
    const name = newTemplateName.trim();
    if (!name) return;
    setCreating(true);
    const t = await createTemplate(name);
    if (t) setTemplates((prev) => [...prev, t]);
    setNewTemplateName('');
    setCreating(false);
  };

  const handleDeleteTemplate = async (id: string) => {
    await deleteTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-8">
      {/* ── Tournament Sponsors ── */}
      <div className="bg-white/80 backdrop-blur-xl border border-[#F0EBE3] rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[#2A2A2A] mb-1">Sponsor per Tournament</h2>
        <p className="text-gray-500 text-sm mb-5">
          Pilih tournament lalu upload logo atau load dari template.
        </p>

        {tournaments.length === 0 ? (
          <p className="text-gray-400 text-sm">Belum ada tournament. Buat dulu di halaman admin.</p>
        ) : (
          <div className="space-y-6">
            {/* Tournament selector */}
            <div className="flex flex-wrap gap-2">
              {tournaments.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTournamentId(t.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                    selectedTournamentId === t.id
                      ? 'bg-gradient-to-r from-[#B45330] to-[#C96A40] text-white border-[#B45330]'
                      : 'border-[#F0EBE3] text-gray-600 hover:border-[#B45330] hover:text-[#B45330]'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>

            {selectedTournament && (
              <TournamentSponsors tournament={selectedTournament} templates={templates} onUpdateTournament={onUpdateTournament} />
            )}
          </div>
        )}
      </div>

      {/* ── Templates ── */}
      <div className="bg-white/80 backdrop-blur-xl border border-[#F0EBE3] rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[#2A2A2A] mb-1">Sponsor Templates</h2>
        <p className="text-gray-500 text-sm mb-5">
          Buat template sekali, load ke tournament manapun. Klik nama template untuk upload logo.
        </p>

        {/* Create new template */}
        <div className="flex gap-3 mb-5">
          <input
            type="text"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTemplate()}
            placeholder="Nama template, misal: Seri A 2025"
            className="flex-1 border border-[#F0EBE3] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#B45330] bg-[#FAF8F5]"
          />
          <button
            onClick={handleCreateTemplate}
            disabled={!newTemplateName.trim() || creating}
            className="flex items-center gap-2 bg-gradient-to-r from-[#B45330] to-[#C96A40] text-white px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-all"
          >
            {creating ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Buat
          </button>
        </div>

        {templates.length === 0 ? (
          <p className="text-gray-400 text-sm">Belum ada template.</p>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onDelete={() => handleDeleteTemplate(t.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
