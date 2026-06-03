import React, { useState } from 'react';
import { Plus, Edit, Trash2, MapPin, Power, PowerOff } from 'lucide-react';
import { Court } from '../types/tournament';
import { slugify } from '../utils/slugify';

interface CourtManagerProps {
    courts: Court[];
    onUpdateCourts: (courts: Court[]) => void;
}

interface CourtFormData {
    name: string;
    location: string;
    surface: 'clay' | 'artificial-grass' | 'concrete' | 'indoor';
}

export default function CourtManager({ courts, onUpdateCourts }: CourtManagerProps) {
    const [isAddingCourt, setIsAddingCourt] = useState(false);
    const [editingCourtId, setEditingCourtId] = useState<string | null>(null);
    const [formData, setFormData] = useState<CourtFormData>({
        name: '',
        location: '',
        surface: 'artificial-grass'
    });

    const resetForm = () => {
        setIsAddingCourt(false);
        setEditingCourtId(null);
        setFormData({ name: '', location: '', surface: 'artificial-grass' });
    };

    const handleAddCourt = () => {
        if (!formData.name.trim()) return;
        const newCourt: Court = {
            id: crypto.randomUUID(),
            name: formData.name.trim(),
            slug: slugify(formData.name.trim()),
            location: formData.location.trim() || undefined,
            surface: formData.surface,
            isAvailable: true
        };
        onUpdateCourts([...courts, newCourt]);
        resetForm();
    };

    const handleEditCourt = (courtId: string) => {
        const court = courts.find(c => c.id === courtId);
        if (!court) return;
        setFormData({
            name: court.name,
            location: court.location || '',
            surface: court.surface || 'artificial-grass'
        });
        setEditingCourtId(courtId);
        setIsAddingCourt(true); // Open the form for editing
    };

    const handleUpdateCourt = () => {
        if (!formData.name.trim() || !editingCourtId) return;
        const updatedCourts = courts.map(court =>
            court.id === editingCourtId
                ? { ...court, name: formData.name.trim(), slug: slugify(formData.name.trim()), location: formData.location.trim() || undefined, surface: formData.surface }
                : court
        );
        onUpdateCourts(updatedCourts);
        resetForm();
    };

    const handleDeleteCourt = (courtId: string) => {
        const court = courts.find(c => c.id === courtId);
        if (court?.currentMatch) {
            alert('Cannot delete court with an active match!');
            return;
        }
        if (confirm('Are you sure you want to delete this court?')) {
            onUpdateCourts(courts.filter(c => c.id !== courtId));
        }
    };

    const toggleCourtAvailability = (courtId: string) => {
        const updatedCourts = courts.map(court =>
            court.id === courtId
                ? { ...court, isAvailable: !court.isAvailable }
                : court
        );
        onUpdateCourts(updatedCourts);
    };

    const getSurfacePillStyle = (surface: Court['surface']) => {
        switch (surface) {
            case 'clay': return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
            case 'artificial-grass': return 'bg-green-500/10 text-green-400 border-green-500/30';
            case 'concrete': return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
            case 'indoor': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
            default: return 'bg-gray-500/10 text-gray-400';
        }
    };

    return (
        // Container utama diubah ke light mode
        <div className="bg-white/80 border border-[#F0EBE3] rounded-xl p-6 text-[#2A2A2A] font-mono">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-[#2A2A2A]">Court List</h2>
                <button
                    onClick={() => { setIsAddingCourt(true); setEditingCourtId(null); }}
                    className="group flex items-center gap-2 bg-[#B45330] text-white border border-[#B45330] px-4 py-2 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 hover:bg-[#C96A40] hover:shadow-neon-green"
                >
                    <Plus className="w-4 h-4" />
                    Add Court
                </button>
            </div>

            {/* Form Add/Edit dengan gaya neon */}
            {(isAddingCourt || editingCourtId) && (
                <div className="bg-[#FAF8F5] rounded-lg p-4 mb-6 border border-[#F0EBE3]">
                    <h3 className="text-lg font-semibold mb-4 text-[#B45330]">
                        {editingCourtId ? 'Edit Court' : 'Add New Court'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Court Name *</label>
                            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Center Court"
                                className="w-full px-3 py-2 bg-white border border-[#F0EBE3] rounded-lg text-[#2A2A2A] placeholder-gray-400 focus:ring-2 focus:ring-[#B45330] focus:border-transparent" autoFocus />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Location</label>
                            <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="e.g., North Wing"
                                className="w-full px-3 py-2 bg-white border border-[#F0EBE3] rounded-lg text-[#2A2A2A] placeholder-gray-400 focus:ring-2 focus:ring-[#B45330] focus:border-transparent" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Surface Type</label>
                            <select value={formData.surface} onChange={(e) => setFormData({ ...formData, surface: e.target.value as Court['surface'] })}
                                className="w-full px-3 py-2 bg-white border border-[#F0EBE3] rounded-lg text-[#2A2A2A] focus:ring-2 focus:ring-[#B45330] focus:border-transparent">
                                <option value="artificial-grass">Artificial Grass</option>
                                <option value="clay">Clay</option><option value="concrete">Concrete</option><option value="indoor">Indoor</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={editingCourtId ? handleUpdateCourt : handleAddCourt} disabled={!formData.name.trim()}
                            className="bg-[#B45330] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#C96A40] transition-colors disabled:bg-[#D4C9BB] disabled:text-gray-400 disabled:cursor-not-allowed">
                            {editingCourtId ? 'Update Court' : 'Save Court'}
                        </button>
                        <button onClick={resetForm} className="bg-[#F0EBE3] text-[#2A2A2A] px-4 py-2 rounded-lg hover:bg-[#D4C9BB] transition-colors">Cancel</button>
                    </div>
                </div>
            )}

            {/* Daftar Lapangan */}
            {courts.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-[#D4C9BB] rounded-lg">
                    <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No courts configured yet.</p>
                    <p className="text-sm">Click 'Add Court' to get started.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {courts.map((court) => (
                        <div key={court.id} className={`border rounded-lg p-4 transition-all duration-300 ${court.isAvailable ? 'border-[#B45330]/50 bg-[#B45330]/10' : 'border-red-400/50 bg-red-50'}`}>
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="font-bold text-[#2A2A2A]">{court.name}</h3>
                                    {court.location && <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{court.location}</p>}
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => handleEditCourt(court.id)} className="text-gray-400 hover:text-[#2A2A2A] p-1" title="Edit court"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteCourt(court.id)} className="text-red-500 hover:text-red-400 p-1" title="Delete court"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mb-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSurfacePillStyle(court.surface)}`}>{court.surface?.replace('-', ' ').toUpperCase()}</span>
                                <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-semibold ${court.isAvailable ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-500'}`}>
                                    <div className={`w-2 h-2 rounded-full ${court.isAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
                                    {court.isAvailable ? 'Available' : 'Unavailable'}
                                </div>
                            </div>

                            <button onClick={() => toggleCourtAvailability(court.id)} disabled={!!court.currentMatch}
                                className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${court.isAvailable
                                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                        : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}>
                                {court.isAvailable ? <PowerOff size={14} /> : <Power size={14} />}
                                {court.isAvailable ? 'Mark Unavailable' : 'Mark Available'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}