import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Users, ArrowRight } from 'lucide-react';
import { Team } from '../types/tournament';

interface TeamManagerProps {
    teams: Team[];
    onUpdateTeams: (teams: Team[]) => void;
    onRenameTeam?: (teamId: string, newName: string) => void;
}

export default function TeamManager({ teams, onUpdateTeams, onRenameTeam }: TeamManagerProps) {
    const [newTeamName, setNewTeamName] = useState('');
    const [editingTeam, setEditingTeam] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [confirmRename, setConfirmRename] = useState<{ teamId: string; oldName: string; newName: string } | null>(null);

    const addTeam = () => {
        if (newTeamName.trim()) {
            const newTeam: Team = {
                id: `team-${Date.now()}`,
                name: newTeamName.trim()
            };
            onUpdateTeams([...teams, newTeam]);
            setNewTeamName('');
        }
    };

    const startEdit = (team: Team) => {
        setEditingTeam(team.id);
        setEditName(team.name);
        setConfirmRename(null);
    };

    const requestSave = (team: Team) => {
        const newName = editName.trim();
        if (!newName || newName === team.name) {
            cancelEdit();
            return;
        }
        setConfirmRename({ teamId: team.id, oldName: team.name, newName });
    };

    const confirmSave = () => {
        if (!confirmRename) return;
        if (onRenameTeam) {
            onRenameTeam(confirmRename.teamId, confirmRename.newName);
        } else {
            // Fallback: update teams array only (pre-tournament)
            onUpdateTeams(teams.map(t =>
                t.id === confirmRename.teamId ? { ...t, name: confirmRename.newName } : t
            ));
        }
        setEditingTeam(null);
        setEditName('');
        setConfirmRename(null);
    };

    const cancelEdit = () => {
        setEditingTeam(null);
        setEditName('');
        setConfirmRename(null);
    };

    const removeTeam = (teamId: string) => {
        onUpdateTeams(teams.filter(t => t.id !== teamId));
    };

    return (
        <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-[#2A2A2A] mb-6 flex items-center gap-3">
                <Users className="w-6 h-6 text-[#B45330]" />
                Team Manager
            </h2>

            {/* Add Team */}
            <div className="flex gap-3 mb-6">
                <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Enter team name"
                    className="flex-1 px-4 py-3 border border-[#F0EBE3] rounded-lg focus:ring-2 focus:ring-[#B45330] focus:border-transparent transition-all"
                    onKeyPress={(e) => e.key === 'Enter' && addTeam()}
                />
                <button
                    onClick={addTeam}
                    className="px-6 py-3 bg-[#B45330] text-white rounded-lg hover:bg-[#C96A40] transition-colors flex items-center gap-2 font-semibold"
                >
                    <Plus className="w-4 h-4" />
                    Add Team
                </button>
            </div>

            {/* Teams List */}
            <div className="space-y-3">
                {teams.map((team, index) => {
                    const isEditing = editingTeam === team.id;
                    const isPendingConfirm = confirmRename?.teamId === team.id;

                    return (
                        <div key={team.id} className="p-4 bg-gray-50 rounded-lg transition-colors">
                            {isPendingConfirm ? (
                                /* Confirmation step */
                                <div className="flex flex-col gap-3">
                                    <p className="text-sm font-semibold text-[#2A2A2A]">Confirm rename?</p>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="px-3 py-1.5 bg-[#F0EBE3] rounded-lg font-mono text-gray-500 line-through">{confirmRename.oldName}</span>
                                        <ArrowRight className="w-4 h-4 text-[#B45330] flex-shrink-0" />
                                        <span className="px-3 py-1.5 bg-[#B45330]/10 border border-[#B45330]/30 rounded-lg font-mono font-bold text-[#B45330]">{confirmRename.newName}</span>
                                    </div>
                                    <p className="text-xs text-gray-400">This will update the name everywhere — matches, standings, and results.</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={confirmSave}
                                            className="px-4 py-2 bg-[#B45330] text-white rounded-lg text-sm font-bold hover:bg-[#C96A40] transition-colors"
                                        >
                                            Yes, Rename
                                        </button>
                                        <button
                                            onClick={cancelEdit}
                                            className="px-4 py-2 bg-[#F0EBE3] text-[#2A2A2A] rounded-lg text-sm hover:bg-[#D4C9BB] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : isEditing ? (
                                /* Edit input step */
                                <div className="flex items-center gap-3">
                                    <span className="inline-flex items-center justify-center w-8 h-8 bg-[#B45330]/10 text-[#B45330] rounded-full text-sm font-bold flex-shrink-0">
                                        {index + 1}
                                    </span>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="flex-1 px-3 py-1.5 border border-[#B45330]/50 rounded-lg focus:ring-2 focus:ring-[#B45330] focus:border-transparent text-sm"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') requestSave(team);
                                            if (e.key === 'Escape') cancelEdit();
                                        }}
                                        autoFocus
                                    />
                                    <button
                                        onClick={() => requestSave(team)}
                                        disabled={!editName.trim()}
                                        className="px-3 py-1.5 bg-[#B45330] text-white rounded-lg text-sm font-semibold hover:bg-[#C96A40] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={cancelEdit}
                                        className="px-3 py-1.5 bg-[#F0EBE3] text-[#2A2A2A] rounded-lg text-sm hover:bg-[#D4C9BB] transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                /* View mode */
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="inline-flex items-center justify-center w-8 h-8 bg-[#B45330]/10 text-[#B45330] rounded-full text-sm font-bold">
                                            {index + 1}
                                        </span>
                                        <span className="font-semibold text-gray-900">{team.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => startEdit(team)}
                                            className="p-2 text-gray-400 hover:text-[#B45330] transition-colors"
                                            title="Rename team"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => removeTeam(team.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                            title="Remove team"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {teams.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No teams added yet. Add your first team above.</p>
                </div>
            )}
        </div>
    );
}
