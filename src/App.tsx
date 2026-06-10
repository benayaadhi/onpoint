import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { Plus, RotateCcw, Trash2, Target, Tv, ExternalLink, Copy, Download, Monitor } from 'lucide-react';
import { exportTournamentToExcel } from './utils/exportExcel';
import { slugify } from './utils/slugify';
import Homepage from './components/Homepage';
import ContestantHomepage from './components/ContestantHomepage';
import TournamentSetup from './components/TournamentSetup';
import TournamentBracket from './components/TournamentBracket';
import MatchScoring from './components/MatchScoring';
import TeamManager from './components/TeamManager';
import SponsorManager from './components/SponsorManager';
import StandaloneSpectatorView from './components/StandaloneSpectatorView';
import SpectatorView from './components/SpectatorView';
import TVDisplay, { TVCourtPicker } from './components/TVDisplay';
import {
    Tournament,
    Match,
    Team,
    TournamentFormat,
    Court,
    TournamentConfig,
} from './types/tournament';
import {
    createTournament,
    advanceTournament,
} from './utils/tournamentLogic';
import {
    startMatchOnCourt,
    completeMatchAndFreeCourt,
} from './utils/courtAssignment';
import {
    saveTournament,
    getTournaments,
    getTournament,
    deleteTournament,
    subscribeTournamentChanges,
    broadcastScoreUpdate,
    subscribeToScoreUpdates,
} from './utils/storage';
import {
    realTimeUpdates,
    useRealTimeMatch,
    REAL_TIME_EVENTS,
} from './utils/realTimeUpdates';
import { redeemActivationCode } from './utils/tier';
import { supabase } from './lib/supabase';

// ==========================================
// SCORING LOCK — Supabase Presence
// Locked per court when a courtId is assigned, otherwise per match.
// This prevents two admins scoring on the same physical court simultaneously,
// while allowing parallel scoring of different courts (e.g. two group matches at once).
// ==========================================
function useScoringLock(matchId: string | null | undefined, courtId?: string | null): {
    lockedByOther: boolean;
    checking: boolean;
    wasKicked: boolean;
    forceKick: () => void;
} {
    const [lockedByOther, setLockedByOther] = useState(false);
    const [checking, setChecking] = useState(false);
    const [wasKicked, setWasKicked] = useState(false);
    const deviceId = useRef<string>('');
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    useEffect(() => {
        if (!deviceId.current) {
            const stored = sessionStorage.getItem('onpoint-device-id');
            if (stored) {
                deviceId.current = stored;
            } else {
                const id = `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                sessionStorage.setItem('onpoint-device-id', id);
                deviceId.current = id;
            }
        }
    }, []);

    // Use courtId as lock scope when assigned (covers both group and knockout matches on a court)
    const lockKey = courtId ? `court-${courtId}` : `match-${matchId}`;

    useEffect(() => {
        if (!matchId) {
            setChecking(false);
            return;
        }
        setChecking(true);

        const channel = supabase.channel(`scoring-lock-${lockKey}`, {
            config: {
                presence: { key: deviceId.current || 'unknown' },
                broadcast: { self: false },
            },
        });

        channelRef.current = channel;

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const others = Object.keys(state).filter(
                    (k) => k !== deviceId.current
                );
                setLockedByOther(others.length > 0);
                setChecking(false);
            })
            .on('broadcast', { event: 'force-kick' }, () => {
                // Someone sent a force-kick — leave immediately
                setWasKicked(true);
                channel.untrack();
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ joinedAt: Date.now() });
                    // Fallback: if presence sync hasn't fired yet, unblock now.
                    // track() triggers a sync on the server side, so by the time
                    // this resolves the sync handler should have already run.
                    // This covers cases where the sync event is delayed or dropped.
                    setChecking(false);
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    // Can't establish presence — fail open so user isn't stuck.
                    setChecking(false);
                }
            });

        return () => {
            channel.untrack();
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [lockKey]);

    const forceKick = () => {
        channelRef.current?.send({
            type: 'broadcast',
            event: 'force-kick',
            payload: { kickedAt: Date.now() },
        });
    };

    return { lockedByOther, checking, wasKicked, forceKick };
}

// ==========================================
// SHARED LAYOUT — Admin header + nav
// ==========================================
function AdminLayout({
    children,
    currentTournament,
    onResetTournament,
    activePage,
}: {
    children: React.ReactNode;
    currentTournament: Tournament | null;
    onResetTournament: () => void;
    activePage: string;
}) {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#FAF8F5] text-[#2A2A2A] overflow-hidden">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-[#B45330]/10 to-[#8B7355]/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-gradient-to-r from-[#8B7355]/10 to-[#B45330]/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
                <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-gradient-to-r from-[#B45330]/10 to-[#8B7355]/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
            </div>

            {/* Header */}
            <header className="relative z-10 bg-white/90 backdrop-blur-xl border-b border-[#F0EBE3] shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div
                            className="flex items-center gap-3 cursor-pointer"
                            onClick={() => navigate('/admin')}
                        >
                            <div className="w-10 h-10 bg-gradient-to-r from-[#B45330] to-[#C96A40] rounded-lg flex items-center justify-center">
                                <Target className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-[#B45330] to-[#C96A40] bg-clip-text text-transparent">
                                    On Point
                                </h1>
                                {currentTournament && (
                                    <p className="text-sm text-gray-500">
                                        {currentTournament.name}
                                    </p>
                                )}
                            </div>
                        </div>

                        <nav className="flex items-center gap-4">
                            {currentTournament && (
                                <>
                                    <button
                                        onClick={() =>
                                            navigate(`/admin/tournament/${currentTournament.id}`)
                                        }
                                        className={`px-4 py-2 rounded-xl transition-all duration-300 ${activePage === 'bracket'
                                                ? 'bg-gradient-to-r from-[#B45330] to-[#C96A40] text-white border border-[#B45330]'
                                                : 'text-gray-600 hover:text-[#2A2A2A] hover:bg-[#F0EBE3]/50 border border-[#F0EBE3]'
                                            }`}
                                    >
                                        Bracket
                                    </button>

                                    <button
                                        onClick={() =>
                                            navigate(
                                                `/admin/tournament/${currentTournament.id}/teams`
                                            )
                                        }
                                        className={`px-4 py-2 rounded-xl transition-all duration-300 ${activePage === 'teams'
                                                ? 'bg-gradient-to-r from-[#8B7355] to-[#A89070] text-white border border-[#8B7355]'
                                                : 'text-gray-600 hover:text-[#2A2A2A] hover:bg-[#F0EBE3]/50 border border-[#F0EBE3]'
                                            }`}
                                    >
                                        Teams
                                    </button>

                                    <button
                                        onClick={() => exportTournamentToExcel(currentTournament)}
                                        className="flex items-center gap-2 text-[#8B7355] hover:text-[#B45330] transition-colors px-3 py-2 rounded-xl hover:bg-[#F0EBE3]/50 border border-[#F0EBE3] hover:border-[#B45330]/30"
                                    >
                                        <Download className="w-4 h-4" />
                                        Export
                                    </button>

                                    <button
                                        onClick={onResetTournament}
                                        className="flex items-center gap-2 text-gray-500 hover:text-red-500 transition-colors px-3 py-2 rounded-xl hover:bg-[#F0EBE3]/50"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Reset
                                    </button>
                                </>
                            )}

                            <button
                                onClick={() => navigate('/admin/sponsors')}
                                className={`px-4 py-2 rounded-xl transition-all duration-300 ${activePage === 'sponsors'
                                        ? 'bg-gradient-to-r from-[#B45330] to-[#C96A40] text-white border border-[#B45330]'
                                        : 'text-gray-600 hover:text-[#2A2A2A] hover:bg-[#F0EBE3]/50 border border-[#F0EBE3]'
                                    }`}
                            >
                                Sponsors
                            </button>

                            <button
                                onClick={() => navigate('/admin')}
                                className="flex items-center gap-2 bg-gradient-to-r from-[#B45330] to-[#C96A40] hover:from-[#C96A40] hover:to-[#B45330] text-white px-4 py-2 rounded-xl transition-all duration-300 transform hover:scale-105 border border-[#B45330]"
                            >
                                <Plus className="w-4 h-4" />
                                New Tournament
                            </button>

                            <button
                                onClick={() => navigate('/')}
                                className="flex items-center gap-2 text-gray-500 hover:text-[#2A2A2A] transition-colors px-3 py-2 rounded-xl hover:bg-[#F0EBE3]/50"
                            >
                                Home
                            </button>
                        </nav>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}

// ==========================================
// CONTESTANT LAYOUT — Simpler header
// ==========================================
function ContestantLayout({
    children,
    currentTournament,
}: {
    children: React.ReactNode;
    currentTournament: Tournament | null;
}) {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#FAF8F5] text-[#2A2A2A] overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-[#B45330]/10 to-[#8B7355]/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-gradient-to-r from-[#8B7355]/10 to-[#B45330]/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
            </div>

            <header className="relative z-10 bg-white/90 backdrop-blur-xl border-b border-[#F0EBE3] shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div
                            className="flex items-center gap-3 cursor-pointer"
                            onClick={() => navigate('/contestant')}
                        >
                            <div className="w-10 h-10 bg-gradient-to-r from-[#B45330] to-[#C96A40] rounded-lg flex items-center justify-center">
                                <Target className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-[#B45330] to-[#C96A40] bg-clip-text text-transparent">
                                    On Point
                                </h1>
                                {currentTournament && (
                                    <p className="text-sm text-gray-500">
                                        {currentTournament.name}
                                    </p>
                                )}
                            </div>
                        </div>
                        <nav className="flex items-center gap-4">
                            {currentTournament && (
                                <button
                                    onClick={() =>
                                        navigate(
                                            `/contestant/tournament/${currentTournament.id}`
                                        )
                                    }
                                    className="px-4 py-2 rounded-xl text-gray-600 hover:text-[#2A2A2A] hover:bg-[#F0EBE3]/50 border border-[#F0EBE3] transition-all duration-300"
                                >
                                    Bracket
                                </button>
                            )}
                            <button
                                onClick={() => navigate('/contestant')}
                                className="flex items-center gap-2 bg-gradient-to-r from-[#B45330] to-[#C96A40] hover:from-[#C96A40] hover:to-[#B45330] text-white px-4 py-2 rounded-xl transition-all duration-300 transform hover:scale-105 border border-[#B45330]"
                            >
                                Back
                            </button>
                        </nav>
                    </div>
                </div>
            </header>

            <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}

// ==========================================
// MAIN APP — Route definitions
// ==========================================
function App() {
    const [currentTournament, setCurrentTournament] =
        useState<Tournament | null>(null);
    const [savedTournaments, setSavedTournaments] = useState<Tournament[]>([]);

    // Load tournaments on mount + subscribe to realtime
    useEffect(() => {
        const init = async () => {
            const tournaments = await getTournaments();
            setSavedTournaments(tournaments);
        };
        init();

        // Slow path: postgres_changes — fires after DB write (~500ms-2s).
        // Egress-friendly: fetch ONLY the changed row (the old refetch-all made
        // every client download the whole table on every point), debounced 2s
        // per tournament so a scoring burst collapses into one fetch. Merge
        // per-match by lastUpdated so a refetch can't revert a locally-newer
        // optimistic score.
        const timers = new Map<string, ReturnType<typeof setTimeout>>();
        const unsubscribe = subscribeTournamentChanges((id) => {
            if (!id) return; // 20s poll + broadcast cover unidentified changes
            clearTimeout(timers.get(id));
            timers.set(id, setTimeout(async () => {
                timers.delete(id);
                const fresh = await getTournament(id);
                if (!fresh) {
                    // Row deleted
                    setSavedTournaments((prev) => prev.filter((t) => t.id !== id));
                    return;
                }
                setSavedTournaments((prev) => {
                    const i = prev.findIndex((t) => t.id === id);
                    return i === -1 ? [fresh, ...prev] : prev.map((t) => (t.id === id ? fresh : t));
                });
                setCurrentTournament((prev) => {
                    if (!prev || prev.id !== id) return prev;
                    return {
                        ...fresh,
                        matches: fresh.matches.map((fm) => {
                            const pm = prev.matches.find((m) => m.id === fm.id);
                            return pm && (pm.lastUpdated ?? 0) > (fm.lastUpdated ?? 0) ? pm : fm;
                        }),
                    };
                });
            }, 2000));
        });
        return () => {
            unsubscribe();
            timers.forEach((t) => clearTimeout(t));
        };
    }, []);

    // Fast path: Supabase broadcast (~50ms cross-device via WebSocket)
    useEffect(() => {
        if (!currentTournament?.id) return;
        const unsub = subscribeToScoreUpdates(currentTournament.id, (match) => {
            setCurrentTournament((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    matches: prev.matches.map((m) => {
                        if (m.id !== match.id) return m;
                        // Reject a stale broadcast that would revert a newer score
                        if ((match.lastUpdated ?? 0) < (m.lastUpdated ?? 0)) return m;
                        return match;
                    }),
                };
            });
        });
        return unsub;
    }, [currentTournament?.id]);

    // Guaranteed fallback: poll Supabase every 20s. Real-time updates come
    // instantly via the websocket broadcast; this only catches up if that
    // connection drops, so a slow interval keeps egress low while idle.
    useEffect(() => {
        if (!currentTournament?.id) return;
        const id = currentTournament.id;
        const interval = setInterval(async () => {
            const fresh = await getTournament(id);
            if (!fresh) return;
            setCurrentTournament((prev) => {
                if (!prev || prev.id !== id) return prev;
                // Keep any locally-newer match so a stale poll (read before our
                // save propagated) can't revert a freshly scored point.
                return {
                    ...fresh,
                    matches: fresh.matches.map((fm) => {
                        const pm = prev.matches.find((m) => m.id === fm.id);
                        return pm && (pm.lastUpdated ?? 0) > (fm.lastUpdated ?? 0) ? pm : fm;
                    }),
                };
            });
        }, 20000);
        return () => clearInterval(interval);
    }, [currentTournament?.id]);

    // --- Shared handlers ---
    const handleCreateTournament = async (
        name: string,
        format: TournamentFormat,
        teams: Team[],
        courts: Court[],
        scoringMode: 'padel' | 'race' = 'padel',
        raceTarget: number = 4,
        navigate: (path: string) => void,
        config?: Partial<TournamentConfig>,
        activationCode?: string
    ): Promise<string | null> => {
        const baseTournament = createTournament(
            name,
            format,
            teams,
            courts,
            scoringMode,
            raceTarget,
            config
        );
        // Attach slugs to tournament and each court
        const tournament: Tournament = {
            ...baseTournament,
            slug: slugify(name),
            courts: baseTournament.courts.map(c => ({ ...c, slug: slugify(c.name) })),
        };

        // Gate: redeem the activation code → stamps the pricing tier. While the
        // DB function isn't installed yet this returns 'ungated' and creation
        // proceeds without a tier (full access), so deploys stay safe.
        const redeemed = await redeemActivationCode(activationCode ?? '', tournament.id);
        if (redeemed === null) {
            return 'Kode aktivasi tidak valid atau sudah terpakai. Hubungi WePadl untuk membeli kode.';
        }
        if (redeemed !== 'ungated') {
            tournament.tier = redeemed;
        }

        setCurrentTournament(tournament);
        await saveTournament(tournament);
        const tournaments = await getTournaments();
        setSavedTournaments(tournaments);
        navigate(`/admin/tournament/${tournament.id}`);
        return null;
    };

    const handleResetTournament = async (navigate: (path: string) => void) => {
        if (currentTournament) {
            const resetTournament = createTournament(
                currentTournament.name,
                currentTournament.format,
                currentTournament.teams,
                currentTournament.courts,
                currentTournament.scoringMode || 'padel',
                currentTournament.raceTarget || 4,
                {
                    matchRules: currentTournament.matchRules,
                    teamsPerGroup: currentTournament.teamsPerGroup,
                    qualifiersPerGroup: currentTournament.qualifiersPerGroup,
                }
            );
            setCurrentTournament(resetTournament);
            await saveTournament(resetTournament);
            const tournaments = await getTournaments();
            setSavedTournaments(tournaments);
            navigate(`/admin/tournament/${resetTournament.id}`);
        }
    };

    const handleDeleteTournament = async (tournamentId: string) => {
        await deleteTournament(tournamentId);
        const tournaments = await getTournaments();
        setSavedTournaments(tournaments);
        if (currentTournament?.id === tournamentId) {
            setCurrentTournament(null);
        }
    };

    const handleUpdateMatch = (updatedMatch: Match) => {
        setCurrentTournament((ct) => {
            if (!ct) return null;

            const updatedMatches = ct.matches.map((m) =>
                m.id === updatedMatch.id ? updatedMatch : m
            );

            const tournamentWithUpdatedMatch = { ...ct, matches: updatedMatches };

            // Detect undo of a completion — restore court.currentMatch
            const previousMatch = ct.matches.find((m) => m.id === updatedMatch.id);
            const isUndoingCompletion = previousMatch?.completed && !updatedMatch.completed;
            const tournamentRestoredCourt = isUndoingCompletion && updatedMatch.courtId
                ? {
                    ...tournamentWithUpdatedMatch,
                    courts: tournamentWithUpdatedMatch.courts.map((c) =>
                        c.id === updatedMatch.courtId ? { ...c, currentMatch: updatedMatch.id } : c
                    ),
                }
                : tournamentWithUpdatedMatch;

            // Free the court when match completes
            const tournamentAfterCourt = updatedMatch.completed && updatedMatch.courtId
                ? completeMatchAndFreeCourt(tournamentRestoredCourt, updatedMatch.id)
                : tournamentRestoredCourt;

            // advanceTournament recalculates all group standings from scratch
            // (covers both completion and undo-of-completion), so no separate
            // standings pass is needed here.
            const advancedTournament = advanceTournament(tournamentAfterCourt);

            // Stamp lastUpdated on every match the advance changed (bracket fills,
            // completions, court frees). The merge save keeps the newest version
            // per match, so stamping ensures these win over a concurrent court's
            // stale copy. The scored match is already stamped by the scorer.
            const stampNow = Date.now();
            const stampedTournament = {
                ...advancedTournament,
                matches: advancedTournament.matches.map((m) => {
                    const before = tournamentAfterCourt.matches.find((x) => x.id === m.id);
                    return before && JSON.stringify(before) !== JSON.stringify(m)
                        ? { ...m, lastUpdated: stampNow }
                        : m;
                }),
            };

            // Persist only — local state is already updated below (return), and
            // spectators sync via the websocket broadcast. No full-table refetch.
            saveTournament(stampedTournament);

            // No auto-navigate on completion — user stays on scoring page
            // so they can undo if accidentally clicked the winning point.
            // They navigate back manually via the "Back to Bracket" button.

            // Same-device fast sync (BroadcastChannel)
            realTimeUpdates.broadcastMatchUpdate(
                updatedMatch,
                'match_updated',
                updatedMatch.completed
                    ? REAL_TIME_EVENTS.MATCH_COMPLETED
                    : REAL_TIME_EVENTS.POINT_SCORED
            );

            // Cross-device fast sync (Supabase WebSocket broadcast, ~50ms)
            if (ct.id) {
                broadcastScoreUpdate(updatedMatch, ct.id);
            }

            return stampedTournament;
        });
    };

    const loadTournamentById = async (id: string): Promise<Tournament | null> => {
        // Check in-memory first
        if (currentTournament?.id === id) return currentTournament;

        // Then check saved list
        let found = savedTournaments.find((t) => t.id === id) || null;
        if (found) {
            setCurrentTournament(found);
            return found;
        }

        // Fetch fresh from storage
        const tournaments = await getTournaments();
        setSavedTournaments(tournaments);
        found = tournaments.find((t) => t.id === id) || null;
        if (found) setCurrentTournament(found);
        return found;
    };

    return (
        <Routes>
            {/* Landing Page */}
            <Route
                path="/"
                element={<HomepageWrapper />}
            />

            {/* Admin Setup */}
            <Route
                path="/admin"
                element={
                    <AdminSetupPage
                        savedTournaments={savedTournaments}
                        onCreateTournament={handleCreateTournament}
                        onDeleteTournament={handleDeleteTournament}
                        onLoadTournament={(t) => setCurrentTournament(t)}
                        onResetTournament={handleResetTournament}
                        currentTournament={currentTournament}
                    />
                }
            />

            {/* Admin Tournament Bracket */}
            <Route
                path="/admin/tournament/:id"
                element={
                    <AdminBracketPage
                        currentTournament={currentTournament}
                        loadTournamentById={loadTournamentById}
                        onResetTournament={handleResetTournament}
                        setCurrentTournament={setCurrentTournament}
                        setSavedTournaments={setSavedTournaments}
                    />
                }
            />

            {/* Admin Match Scoring */}
            <Route
                path="/admin/tournament/:id/scoring/:matchId"
                element={
                    <AdminScoringPage
                        currentTournament={currentTournament}
                        loadTournamentById={loadTournamentById}
                        onUpdateMatch={handleUpdateMatch}
                        onResetTournament={handleResetTournament}
                        onUpdateTournament={async (t) => {
                            setCurrentTournament(t);
                            await saveTournament(t);
                            getTournaments().then(setSavedTournaments);
                        }}
                    />
                }
            />

            {/* Admin Team Manager */}
            <Route
                path="/admin/tournament/:id/teams"
                element={
                    <AdminTeamsPage
                        currentTournament={currentTournament}
                        loadTournamentById={loadTournamentById}
                        setCurrentTournament={setCurrentTournament}
                        onResetTournament={handleResetTournament}
                    />
                }
            />

            {/* Admin Sponsors */}
            <Route
                path="/admin/sponsors"
                element={
                    <AdminSponsorsPage
                        currentTournament={currentTournament}
                        savedTournaments={savedTournaments}
                        onResetTournament={handleResetTournament}
                        setSavedTournaments={setSavedTournaments}
                        setCurrentTournament={setCurrentTournament}
                    />
                }
            />

            {/* Contestant Homepage */}
            <Route path="/contestant" element={<ContestantHomepageWrapper onSelectTournament={(t) => setCurrentTournament(t)} />} />

            {/* Contestant Tournament View */}
            <Route
                path="/contestant/tournament/:id"
                element={
                    <ContestantBracketPage
                        currentTournament={currentTournament}
                        loadTournamentById={loadTournamentById}
                    />
                }
            />

            {/* Spectator Standalone */}
            <Route path="/spectator" element={<SpectatorPage />} />

            {/* TV Display — by ID (legacy) or by slug */}
            <Route path="/tv" element={<TVCourtPicker />} />
            <Route path="/tv/:tournamentId" element={<TVDisplay />} />
            <Route path="/tv/:tournamentSlug/:courtSlug" element={<TVDisplayBySlug />} />

            {/* Legacy redirects */}
            <Route path="/TournamentSetup.tsx" element={<Navigate to="/admin" replace />} />
            <Route path="/TournamentBracket.tsx" element={<Navigate to="/admin" replace />} />
            <Route path="/MatchScoring.tsx" element={<Navigate to="/admin" replace />} />
            <Route path="/TeamManager.tsx" element={<Navigate to="/admin" replace />} />
            <Route path="/ContestantHomepage.tsx" element={<Navigate to="/contestant" replace />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

// ==========================================
// PAGE COMPONENTS
// ==========================================

// --- Admin Setup Page ---
function AdminSetupPage({
    savedTournaments,
    onCreateTournament,
    onDeleteTournament,
    onLoadTournament,
    onResetTournament,
    currentTournament,
}: {
    savedTournaments: Tournament[];
    onCreateTournament: (
        name: string,
        format: TournamentFormat,
        teams: Team[],
        courts: Court[],
        scoringMode: 'padel' | 'race',
        raceTarget: number,
        navigate: (path: string) => void,
        config?: Partial<TournamentConfig>,
        activationCode?: string
    ) => Promise<string | null>;
    onDeleteTournament: (id: string) => void;
    onLoadTournament: (t: Tournament) => void;
    onResetTournament: (navigate: (path: string) => void) => void;
    currentTournament: Tournament | null;
}) {
    const navigate = useNavigate();

    return (
        <AdminLayout
            currentTournament={currentTournament}
            onResetTournament={() => onResetTournament(navigate)}
            activePage="setup"
        >
            <div className="space-y-8">
                <TournamentSetup
                    onCreateTournament={(name, format, teams, courts, scoringMode, raceTarget, config, activationCode) =>
                        onCreateTournament(
                            name,
                            format,
                            teams,
                            courts,
                            scoringMode || 'padel',
                            raceTarget || 4,
                            navigate,
                            config,
                            activationCode
                        )
                    }
                />

                {savedTournaments.length > 0 && (
                    <div className="bg-white/80 backdrop-blur-xl border border-[#F0EBE3] rounded-2xl p-6 shadow-sm">
                        <h2 className="text-2xl font-bold text-[#2A2A2A] mb-6">
                            Saved Tournaments
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {savedTournaments.map((tournament) => (
                                <div
                                    key={tournament.id}
                                    className="bg-[#FAF8F5] border border-[#F0EBE3] rounded-xl p-4 hover:shadow-md transition-all duration-300 transform hover:scale-105"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="font-bold text-[#2A2A2A]">
                                                {tournament.name}
                                            </h3>
                                            <p className="text-sm text-gray-600 capitalize">
                                                {tournament.format.replace('-', ' ')}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {tournament.teams.length} teams
                                                {tournament.scoringMode === 'race' && ` · Race to ${tournament.raceTarget || 4}`}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => onDeleteTournament(tournament.id)}
                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => {
                                            onLoadTournament(tournament);
                                            navigate(`/admin/tournament/${tournament.id}`);
                                        }}
                                        className="w-full bg-gradient-to-r from-[#B45330] to-[#C96A40] hover:from-[#C96A40] hover:to-[#B45330] text-white py-2 rounded-xl transition-all duration-300 transform hover:scale-105 font-medium border border-[#B45330]"
                                    >
                                        Load Tournament
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

// --- Court Picker Modal ---
function CourtPickerModal({
    match,
    tournament,
    onConfirm,
    onCancel,
}: {
    match: Match;
    tournament: Tournament;
    onConfirm: (courtId: string) => void;
    onCancel: () => void;
}) {
    const [selectedCourtId, setSelectedCourtId] = useState<string>(match.courtId || '');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white border border-[#F0EBE3] rounded-2xl shadow-2xl w-full max-w-md font-mono">
                <div className="p-6 border-b border-[#F0EBE3]">
                    <h2 className="text-lg font-bold text-[#2A2A2A]">Assign Court</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {match.team1.name} <span className="text-[#B45330]">vs</span> {match.team2.name}
                    </p>
                </div>

                <div className="p-6 space-y-3">
                    {tournament.courts.map((court) => {
                        const isLive = !!court.currentMatch;
                        const isSelected = selectedCourtId === court.id;
                        const liveMatch = isLive
                            ? tournament.matches.find((m) => m.id === court.currentMatch)
                            : null;

                        return (
                            <button
                                key={court.id}
                                onClick={() => setSelectedCourtId(court.id)}
                                disabled={isLive}
                                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                                    isLive
                                        ? 'border-[#F0EBE3] bg-gray-50 opacity-60 cursor-not-allowed'
                                        : isSelected
                                        ? 'border-[#B45330] bg-[#B45330]/10'
                                        : 'border-[#F0EBE3] hover:border-[#8B7355] bg-white'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className={`font-bold ${isSelected ? 'text-[#B45330]' : 'text-[#2A2A2A]'}`}>
                                        {court.name}
                                    </span>
                                    {isLive ? (
                                        <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse inline-block" />
                                            LIVE
                                        </span>
                                    ) : court.isAvailable ? (
                                        <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                            Available
                                        </span>
                                    ) : (
                                        <span className="text-xs font-semibold text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                                            Unavailable
                                        </span>
                                    )}
                                </div>
                                {isLive && liveMatch && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {liveMatch.team1.name} vs {liveMatch.team2.name}
                                    </p>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="p-6 border-t border-[#F0EBE3] flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 rounded-lg border border-[#F0EBE3] text-gray-600 hover:bg-gray-50 font-semibold text-sm transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => selectedCourtId && onConfirm(selectedCourtId)}
                        disabled={!selectedCourtId}
                        className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                            selectedCourtId
                                ? 'bg-[#B45330] text-white hover:bg-[#C96A40]'
                                : 'bg-[#F0EBE3] text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        Start Scoring
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Admin Bracket Page ---
function AdminBracketPage({
    currentTournament,
    loadTournamentById,
    onResetTournament,
    setCurrentTournament,
    setSavedTournaments,
}: {
    currentTournament: Tournament | null;
    loadTournamentById: (id: string) => Promise<Tournament | null>;
    onResetTournament: (navigate: (path: string) => void) => void;
    setCurrentTournament: (t: Tournament | null) => void;
    setSavedTournaments: (t: Tournament[]) => void;
}) {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [tournament, setTournament] = useState<Tournament | null>(
        currentTournament
    );
    const [pendingMatch, setPendingMatch] = useState<Match | null>(null);

    useEffect(() => {
        if (id && (!tournament || tournament.id !== id)) {
            loadTournamentById(id).then((t) => {
                if (t) setTournament(t);
            });
        }
    }, [id]);

    // Keep in sync if currentTournament updates (e.g., after match)
    useEffect(() => {
        if (currentTournament && currentTournament.id === id) {
            setTournament(currentTournament);
        }
    }, [currentTournament, id]);

    const handleCourtAssignAndNavigate = async (match: Match, courtId: string) => {
        if (!tournament) return;
        // Assign courtId to match
        const updatedMatches = tournament.matches.map((m) =>
            m.id === match.id ? { ...m, courtId } : m
        );
        const updatedTournament = { ...tournament, matches: updatedMatches };
        setTournament(updatedTournament);
        setCurrentTournament(updatedTournament);
        await saveTournament(updatedTournament);
        const tournaments = await getTournaments();
        setSavedTournaments(tournaments);
        setPendingMatch(null);
        navigate(`/admin/tournament/${tournament.id}/scoring/${match.id}`);
    };

    if (!tournament) {
        return (
            <AdminLayout
                currentTournament={null}
                onResetTournament={() => onResetTournament(navigate)}
                activePage="bracket"
            >
                <div className="text-center py-20 text-gray-400">
                    Loading tournament...
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout
            currentTournament={tournament}
            onResetTournament={() => onResetTournament(navigate)}
            activePage="bracket"
        >
            {pendingMatch && (
                <CourtPickerModal
                    match={pendingMatch}
                    tournament={tournament}
                    onConfirm={(courtId) => handleCourtAssignAndNavigate(pendingMatch, courtId)}
                    onCancel={() => setPendingMatch(null)}
                />
            )}
            <TournamentBracket
                tournament={tournament}
                isContestantView={false}
                onMatchSelect={(match) => {
                    if (
                        match.team1.name !== 'TBD' &&
                        match.team2.name !== 'TBD'
                    ) {
                        const hasCourts = tournament.courts && tournament.courts.length > 0;
                        const needsCourtPick = !match.courtId && hasCourts && !match.completed && match.status !== 'in-progress';
                        if (needsCourtPick) {
                            // No court assigned yet + courts available — let admin pick
                            setPendingMatch(match);
                        } else {
                            // Has courtId, no courts configured, completed, or in-progress → go straight
                            navigate(
                                `/admin/tournament/${tournament.id}/scoring/${match.id}`
                            );
                        }
                    }
                }}
                selectedMatch={null}
                onUpdateTournament={async (updatedTournament) => {
                    setCurrentTournament(updatedTournament);
                    setTournament(updatedTournament);
                    await saveTournament(updatedTournament);
                    const tournaments = await getTournaments();
                    setSavedTournaments(tournaments);
                }}
            />
        </AdminLayout>
    );
}

// --- Admin Scoring Page ---
function AdminScoringPage({
    currentTournament,
    loadTournamentById,
    onUpdateMatch,
    onResetTournament,
    onUpdateTournament,
}: {
    currentTournament: Tournament | null;
    loadTournamentById: (id: string) => Promise<Tournament | null>;
    onUpdateMatch: (match: Match) => void;
    onResetTournament: (navigate: (path: string) => void) => void;
    onUpdateTournament: (t: Tournament) => void;
}) {
    const { id, matchId } = useParams<{ id: string; matchId: string }>();
    const navigate = useNavigate();
    const [tournament, setTournament] = useState<Tournament | null>(
        currentTournament
    );
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [startedMatchId, setStartedMatchId] = useState<string | null>(null);

    const realtimeMatch = useRealTimeMatch(matchId || null);
    // Only start the lock once selectedMatch is loaded — avoids lock key changing
    // mid-render from `match-X` → `court-Y` when courtId becomes available
    const lockMatchId = selectedMatch ? matchId : null;
    const { lockedByOther, checking, wasKicked, forceKick } = useScoringLock(lockMatchId, selectedMatch?.courtId);
    const [kickedBanner, setKickedBanner] = useState(false);
    const [forceUnlockConfirm, setForceUnlockConfirm] = useState(false);

    // When we receive a force-kick, show banner briefly then navigate away
    useEffect(() => {
        if (!wasKicked) return;
        setKickedBanner(true);
        const timer = setTimeout(() => {
            navigate(`/admin/tournament/${id}`);
        }, 2500);
        return () => clearTimeout(timer);
    }, [wasKicked]);

    useEffect(() => {
        if (id && (!tournament || tournament.id !== id)) {
            loadTournamentById(id).then((t) => {
                if (t) setTournament(t);
            });
        }
    }, [id]);

    useEffect(() => {
        if (currentTournament && currentTournament.id === id) {
            setTournament(currentTournament);
        }
    }, [currentTournament, id]);

    useEffect(() => {
        if (tournament && matchId) {
            const match = tournament.matches.find((m) => m.id === matchId);
            if (match) setSelectedMatch(match);
        }
    }, [tournament, matchId]);

    // Auto-start match on court when scoring page opens
    useEffect(() => {
        if (!tournament || !matchId || startedMatchId === matchId) return;
        const match = tournament.matches.find((m) => m.id === matchId);
        if (!match || !match.courtId || match.status !== 'scheduled') return;

        const updated = startMatchOnCourt(tournament, matchId);
        setStartedMatchId(matchId);
        onUpdateTournament(updated);
        // Tell TVs right away (~50ms) that this match is live on its court,
        // instead of leaving them to the slower table-change refetch.
        const started = updated.matches.find((m) => m.id === matchId);
        if (started) broadcastScoreUpdate(started, updated.id);
    }, [tournament, matchId, startedMatchId]);

    useEffect(() => {
        if (realtimeMatch && selectedMatch?.id === realtimeMatch.id) {
            setSelectedMatch(realtimeMatch);
        }
    }, [realtimeMatch, selectedMatch?.id]);

    if (!tournament || !selectedMatch) {
        return (
            <AdminLayout
                currentTournament={tournament}
                onResetTournament={() => onResetTournament(navigate)}
                activePage="scoring"
            >
                <div className="text-center py-20 text-gray-400">
                    Loading match...
                </div>
            </AdminLayout>
        );
    }

    if (checking) {
        return (
            <AdminLayout
                currentTournament={tournament}
                onResetTournament={() => onResetTournament(navigate)}
                activePage="scoring"
            >
                <div className="text-center py-20 text-gray-400">
                    Checking access...
                </div>
            </AdminLayout>
        );
    }

    if (kickedBanner) {
        return (
            <AdminLayout
                currentTournament={tournament}
                onResetTournament={() => onResetTournament(navigate)}
                activePage="scoring"
            >
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="text-6xl animate-bounce">⚠️</div>
                    <h2 className="text-2xl font-bold text-gray-700">Session Ended</h2>
                    <p className="text-gray-500 text-center max-w-sm">
                        You were removed from this scoring session by another admin. Returning to bracket...
                    </p>
                    <div className="w-48 h-1.5 bg-[#F0EBE3] rounded-full overflow-hidden">
                        <div className="h-full bg-[#B45330] rounded-full animate-[shrink_2.5s_linear_forwards]" style={{ animation: 'width 2.5s linear forwards', width: '100%' }} />
                    </div>
                </div>
            </AdminLayout>
        );
    }

    if (lockedByOther) {
        return (
            <AdminLayout
                currentTournament={tournament}
                onResetTournament={() => onResetTournament(navigate)}
                activePage="scoring"
            >
                <div className="flex flex-col items-center justify-center py-24 gap-6">
                    <div className="text-6xl">🔒</div>
                    <h2 className="text-2xl font-bold text-gray-700">
                        {selectedMatch?.groupId ? 'Group Locked' : 'Match In Progress'}
                    </h2>
                    <p className="text-gray-500 text-center max-w-sm">
                        {selectedMatch?.groupId
                            ? 'Another admin is already scoring a match in this group. Only one admin can score per group at a time.'
                            : 'This match is currently being scored by another admin. Only one admin can score a match at a time.'}
                    </p>
                    <button
                        onClick={() => navigate(`/admin/tournament/${tournament.id}`)}
                        className="px-6 py-3 bg-[#B45330] text-white rounded-xl font-semibold hover:bg-[#C96A40] transition-colors"
                    >
                        Back to Bracket
                    </button>

                    <div className="border-t border-[#F0EBE3] pt-6 text-center">
                        <p className="text-xs text-gray-400 mb-3">
                            Admin stuck / forgot to close? Force-remove their session.
                        </p>
                        {!forceUnlockConfirm ? (
                            <button
                                onClick={() => setForceUnlockConfirm(true)}
                                className="px-5 py-2 border border-red-300 text-red-500 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors"
                            >
                                🔓 Force Unlock
                            </button>
                        ) : (
                            <div className="flex flex-col items-center gap-3">
                                <p className="text-sm text-red-600 font-semibold">
                                    This will kick all other admins off this match. Are you sure?
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            forceKick();
                                            setForceUnlockConfirm(false);
                                        }}
                                        className="px-5 py-2 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-colors"
                                    >
                                        Yes, Force Unlock
                                    </button>
                                    <button
                                        onClick={() => setForceUnlockConfirm(false)}
                                        className="px-5 py-2 bg-[#F0EBE3] text-gray-600 rounded-xl text-sm font-semibold hover:bg-[#E8E0D5] transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </AdminLayout>
        );
    }

    const nextScheduledMatch = tournament.matches.find(
        (m) =>
            m.courtId === selectedMatch.courtId &&
            !m.completed &&
            m.status === 'scheduled' &&
            m.id !== selectedMatch.id &&
            m.team1.name !== 'TBD' &&
            m.team2.name !== 'TBD'
    );

    return (
        <MatchScoring
            match={selectedMatch}
            tournament={tournament}
            onUpdateMatch={(m) => onUpdateMatch(m)}
            onBack={() => navigate(`/admin/tournament/${tournament.id}`)}
            onNextMatch={
                nextScheduledMatch
                    ? () => navigate(`/admin/tournament/${tournament.id}/scoring/${nextScheduledMatch.id}`)
                    : undefined
            }
            tournamentName={tournament.name}
        />
    );
}

// --- Admin Teams Page ---
function AdminTeamsPage({
    currentTournament,
    loadTournamentById,
    setCurrentTournament,
    onResetTournament,
}: {
    currentTournament: Tournament | null;
    loadTournamentById: (id: string) => Promise<Tournament | null>;
    setCurrentTournament: (t: Tournament | null) => void;
    onResetTournament: (navigate: (path: string) => void) => void;
}) {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [tournament, setTournament] = useState<Tournament | null>(
        currentTournament
    );

    useEffect(() => {
        if (id && (!tournament || tournament.id !== id)) {
            loadTournamentById(id).then((t) => {
                if (t) setTournament(t);
            });
        }
    }, [id]);

    useEffect(() => {
        if (currentTournament && currentTournament.id === id) {
            setTournament(currentTournament);
        }
    }, [currentTournament, id]);

    if (!tournament) {
        return (
            <AdminLayout
                currentTournament={null}
                onResetTournament={() => onResetTournament(navigate)}
                activePage="teams"
            >
                <div className="text-center py-20 text-gray-400">Loading...</div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout
            currentTournament={tournament}
            onResetTournament={() => onResetTournament(navigate)}
            activePage="teams"
        >
            <TeamManager
                teams={tournament.teams}
                onUpdateTeams={(teams) => {
                    const updatedTournament = { ...tournament, teams };
                    setCurrentTournament(updatedTournament);
                    setTournament(updatedTournament);
                    saveTournament(updatedTournament);
                }}
                onRenameTeam={(teamId, newName) => {
                    const rename = <T extends { id: string; name: string }>(t: T): T =>
                        t.id === teamId ? { ...t, name: newName } : t;
                    const renameMatch = (m: Match): Match => ({
                        ...m,
                        team1: rename(m.team1),
                        team2: rename(m.team2),
                        winner: m.winner ? rename(m.winner) : undefined,
                    });
                    const updated: Tournament = {
                        ...tournament,
                        teams: tournament.teams.map(rename),
                        matches: tournament.matches.map(renameMatch),
                        winner: tournament.winner ? rename(tournament.winner) : undefined,
                        groups: tournament.groups?.map(g => ({
                            ...g,
                            teams: g.teams.map(rename),
                            standings: g.standings.map(rename),
                            matches: g.matches.map(renameMatch),
                        })),
                    };
                    setCurrentTournament(updated);
                    setTournament(updated);
                    saveTournament(updated);
                }}
            />
        </AdminLayout>
    );
}

// --- Contestant Bracket Page ---
function ContestantBracketPage({
    currentTournament,
    loadTournamentById,
}: {
    currentTournament: Tournament | null;
    loadTournamentById: (id: string) => Promise<Tournament | null>;
}) {
    const { id } = useParams<{ id: string }>();
    const [tournament, setTournament] = useState<Tournament | null>(
        currentTournament
    );
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [setHistory, setSetHistoryState] = useState<
        Array<{
            setNumber: number;
            team1Games: number;
            team2Games: number;
            winner: 'team1' | 'team2';
            completed: boolean;
        }>
    >([]);

    useEffect(() => {
        if (id && (!tournament || tournament.id !== id)) {
            loadTournamentById(id).then((t) => {
                if (t) setTournament(t);
            });
        }
    }, [id]);

    useEffect(() => {
        if (currentTournament && currentTournament.id === id) {
            setTournament(currentTournament);
        }
    }, [currentTournament, id]);

    if (selectedMatch && tournament) {
        return (
            <SpectatorView
                match={selectedMatch}
                onClose={() => setSelectedMatch(null)}
                tournamentName={tournament.name}
                tournamentId={tournament.id}
                setHistory={setHistory}
            />
        );
    }

    if (!tournament) {
        return (
            <ContestantLayout currentTournament={null}>
                <div className="text-center py-20 text-gray-400">Loading...</div>
            </ContestantLayout>
        );
    }

    return (
        <ContestantLayout currentTournament={tournament}>
            {/* TV Display Links */}
            {tournament.courts.length > 0 && (
                <div className="relative z-10 bg-white border border-[#F0EBE3] rounded-2xl p-5 mb-6 shadow-sm">
                    <h3 className="text-sm font-bold text-[#2A2A2A] flex items-center gap-2 mb-3">
                        <Tv className="w-4 h-4 text-[#B45330]" />
                        TV Display Links
                        <span className="text-xs text-gray-400 font-normal">— buka di browser TV, satu per court</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {tournament.courts.map((court, idx) => {
                            const url = `${window.location.origin}/tv/${tournament.id}?court=${idx}`;
                            return (
                                <div
                                    key={court.id}
                                    className="flex items-center justify-between gap-2 bg-[#FAF8F5] border border-[#F0EBE3] rounded-xl px-4 py-3"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${court.currentMatch ? 'bg-red-500 animate-pulse' : court.isAvailable ? 'bg-green-500' : 'bg-gray-400'}`} />
                                        <span className="font-semibold text-[#2A2A2A] truncate text-sm">{court.name}</span>
                                        {court.currentMatch && (
                                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex-shrink-0">LIVE</span>
                                        )}
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                        <button
                                            onClick={() => navigator.clipboard.writeText(url).then(() => alert(`URL copied!\n${url}`))}
                                            className="p-1.5 text-gray-400 hover:text-[#B45330] hover:bg-[#B45330]/10 rounded-lg transition-colors"
                                            title="Copy URL"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <a
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 text-gray-400 hover:text-[#B45330] hover:bg-[#B45330]/10 rounded-lg transition-colors"
                                            title="Open TV display"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <TournamentBracket
                tournament={tournament}
                isContestantView={true}
                onMatchSelect={(match) => {
                    if (
                        !match.completed &&
                        match.team1.name !== 'TBD' &&
                        match.team2.name !== 'TBD'
                    ) {
                        const existingSets: typeof setHistory = [];
                        for (let i = 1; i < match.currentSet; i++) {
                            const setWinner =
                                i <= match.team1Score.sets ? 'team1' : 'team2';
                            existingSets.push({
                                setNumber: i,
                                team1Games: setWinner === 'team1' ? 6 : 4,
                                team2Games: setWinner === 'team2' ? 6 : 4,
                                winner: setWinner,
                                completed: true,
                            });
                        }
                        setSetHistoryState(existingSets);
                        setSelectedMatch(match);
                    }
                }}
                selectedMatch={selectedMatch}
                onUpdateTournament={async () => { }}
            />
        </ContestantLayout>
    );
}

// --- Admin Sponsors Page ---
function AdminSponsorsPage({
    currentTournament,
    savedTournaments,
    onResetTournament,
    setSavedTournaments,
    setCurrentTournament,
}: {
    currentTournament: Tournament | null;
    savedTournaments: Tournament[];
    onResetTournament: (navigate: (path: string) => void) => void;
    setSavedTournaments: React.Dispatch<React.SetStateAction<Tournament[]>>;
    setCurrentTournament: React.Dispatch<React.SetStateAction<Tournament | null>>;
}) {
    const navigate = useNavigate();
    return (
        <AdminLayout
            currentTournament={currentTournament}
            onResetTournament={() => onResetTournament(navigate)}
            activePage="sponsors"
        >
            <SponsorManager
                tournaments={savedTournaments}
                initialTournamentId={currentTournament?.id}
                onUpdateTournament={async (t) => {
                    await saveTournament(t);
                    const updated = await getTournaments();
                    setSavedTournaments(updated);
                    if (currentTournament?.id === t.id) setCurrentTournament(t);
                }}
            />
        </AdminLayout>
    );
}

// --- Spectator Page ---
function SpectatorPage() {
    const [searchParams] = useSearchParams();
    const matchId = searchParams.get('matchId');
    const tournamentName = searchParams.get('tournamentName');
    const tournamentId = searchParams.get('tournamentId');

    if (!matchId) {
        return (
            <div className="min-h-screen bg-[#FAF8F5] text-[#2A2A2A] font-mono flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-[#B45330] mb-4">
                        Spectator View
                    </h1>
                    <p className="text-gray-600">
                        No match ID provided. Use{' '}
                        <code className="bg-[#F0EBE3] px-2 py-1 rounded">
                            /spectator?matchId=YOUR_MATCH_ID
                        </code>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <StandaloneSpectatorView
            matchId={matchId}
            tournamentName={tournamentName || undefined}
            tournamentId={tournamentId || undefined}
        />
    );
}

// --- TV Display by slug (/tv/:tournamentSlug/:courtSlug) ---
function TVDisplayBySlug() {
    const { tournamentSlug, courtSlug } = useParams<{ tournamentSlug: string; courtSlug: string }>();
    const navigate = useNavigate();

    useEffect(() => {
        getTournaments().then((tournaments) => {
            // Match tournament by slug or fallback to slugified name
            const tournament = tournaments.find(
                (t) => (t.slug || slugify(t.name)) === tournamentSlug
            );
            if (!tournament) { navigate('/tv', { replace: true }); return; }

            // Match court by slug or fallback to slugified name, get its index
            const courtIndex = tournament.courts.findIndex(
                (c) => (c.slug || slugify(c.name)) === courtSlug
            );
            if (courtIndex === -1) { navigate('/tv', { replace: true }); return; }

            // Redirect to the canonical TV display URL with court index
            navigate(`/tv/${tournament.id}?court=${courtIndex}`, { replace: true });
        });
    }, [tournamentSlug, courtSlug]);

    return (
        <div className="min-h-screen bg-[#FAF8F5] font-mono flex items-center justify-center">
            <Monitor className="w-10 h-10 text-[#B45330] animate-pulse" />
        </div>
    );
}

// --- Homepage wrapper with navigation ---
function HomepageWrapper() {
    const navigate = useNavigate();
    return <Homepage onGetStarted={() => navigate('/contestant')} />;
}

// --- Contestant Homepage wrapper with navigation ---
function ContestantHomepageWrapper({
    onSelectTournament,
}: {
    onSelectTournament: (t: Tournament) => void;
}) {
    const navigate = useNavigate();
    return (
        <ContestantHomepage
            onSelectTournament={(t) => {
                onSelectTournament(t);
                navigate(`/contestant/tournament/${t.id}`);
            }}
            onBackToHome={() => navigate('/')}
        />
    );
}

export default App;
