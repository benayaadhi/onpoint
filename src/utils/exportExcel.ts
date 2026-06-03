import * as XLSX from 'xlsx';
import { Tournament, Match } from '../types/tournament';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtScore(match: Match): string {
  if (match.scoringMode === 'race' || match.team1RaceScore !== undefined) {
    return `${match.team1RaceScore ?? 0} – ${match.team2RaceScore ?? 0}`;
  }
  if (match.setHistory && match.setHistory.length > 0) {
    return match.setHistory
      .filter(s => s.completed)
      .map(s => `${s.team1Games}-${s.team2Games}`)
      .join(', ');
  }
  return `${match.team1Score.games} – ${match.team2Score.games}`;
}

function getRoundLabel(round: number, maxRound: number): string {
  if (round === maxRound) return 'Final';
  if (round === maxRound - 1) return 'Semifinal';
  if (round === maxRound - 2) return 'Quarterfinal';
  return `Round of ${Math.pow(2, maxRound - round + 1)}`;
}

function getCourtName(courtId: string | undefined, tournament: Tournament): string {
  if (!courtId) return '-';
  return tournament.courts.find(c => c.id === courtId)?.name ?? courtId;
}

function getGroupName(groupId: string | undefined, tournament: Tournament): string {
  if (!groupId) return '-';
  return tournament.groups?.find(g => g.id === groupId)?.name ?? groupId;
}

// ─── Sheet builders ───────────────────────────────────────────────────────────

function buildSummarySheet(tournament: Tournament) {
  const groupMatches = tournament.matches.filter(m => m.groupId);
  const knockoutMatches = tournament.matches.filter(m => !m.groupId);
  const completedMatches = tournament.matches.filter(m => m.completed);

  const rows = [
    ['Tournament Name', tournament.name],
    ['Format', tournament.format.replace(/-/g, ' ')],
    ['Scoring Mode', tournament.scoringMode ?? 'padel'],
    ['Race Target', tournament.raceTarget ?? '-'],
    ['Created At', new Date(tournament.createdAt).toLocaleString()],
    ['Status', tournament.completed ? 'Completed' : 'In Progress'],
    ['Champion', tournament.winner?.name ?? '-'],
    [],
    ['Total Teams', tournament.teams.length],
    ['Total Matches', tournament.matches.length],
    ['Completed Matches', completedMatches.length],
    ['Group Stage Matches', groupMatches.length],
    ['Knockout Matches', knockoutMatches.length],
    ['Total Courts', tournament.courts.length],
  ];

  return XLSX.utils.aoa_to_sheet(rows);
}

function buildTeamStatsSheet(tournament: Tournament) {
  const headers = [
    'Team',
    'Group',
    'Group Rank',
    'Matches Played',
    'Wins',
    'Losses',
    'Win Rate %',
    'Games Won',
    'Games Lost',
    'Game Diff',
  ];

  const rows = tournament.teams.map(team => {
    const played = tournament.matches.filter(
      m => m.completed && (m.team1.id === team.id || m.team2.id === team.id)
    );
    const wins = played.filter(m => m.winner?.id === team.id).length;
    const losses = played.length - wins;
    const winRate = played.length > 0 ? Math.round((wins / played.length) * 100) : 0;

    let gamesWon = 0;
    let gamesLost = 0;
    played.forEach(m => {
      const isTeam1 = m.team1.id === team.id;
      if (m.scoringMode === 'race' || m.team1RaceScore !== undefined) {
        gamesWon += isTeam1 ? (m.team1RaceScore ?? 0) : (m.team2RaceScore ?? 0);
        gamesLost += isTeam1 ? (m.team2RaceScore ?? 0) : (m.team1RaceScore ?? 0);
      } else if (m.setHistory && m.setHistory.length > 0) {
        m.setHistory.filter(s => s.completed).forEach(s => {
          gamesWon += isTeam1 ? s.team1Games : s.team2Games;
          gamesLost += isTeam1 ? s.team2Games : s.team1Games;
        });
      } else {
        gamesWon += isTeam1 ? m.team1Score.games : m.team2Score.games;
        gamesLost += isTeam1 ? m.team2Score.games : m.team1Score.games;
      }
    });

    // Group info
    let groupName = '-';
    let groupRank = '-';
    if (tournament.groups) {
      for (const g of tournament.groups) {
        const idx = g.standings.findIndex(s => s.id === team.id);
        if (idx !== -1) {
          groupName = g.name;
          groupRank = String(idx + 1);
          break;
        }
      }
    }

    return [
      team.name,
      groupName,
      groupRank,
      played.length,
      wins,
      losses,
      `${winRate}%`,
      gamesWon,
      gamesLost,
      gamesWon - gamesLost,
    ];
  });

  // Sort by wins desc then game diff desc
  rows.sort((a, b) => {
    const winDiff = (b[4] as number) - (a[4] as number);
    if (winDiff !== 0) return winDiff;
    return (b[9] as number) - (a[9] as number);
  });

  return XLSX.utils.aoa_to_sheet([headers, ...rows]);
}

function buildGroupStandingsSheet(tournament: Tournament) {
  const headers = ['Group', 'Rank', 'Team', 'Matches', 'W', 'L', 'Games Won', 'Games Lost', 'Diff', 'Advances'];
  const rows: (string | number)[][] = [];

  (tournament.groups ?? []).forEach(group => {
    group.standings.forEach((team, idx) => {
      const played = group.matches.filter(m => {
        const fm = tournament.matches.find(x => x.id === m.id);
        return fm?.completed && (fm.team1.id === team.id || fm.team2.id === team.id);
      });
      const fullMatches = played.map(m => tournament.matches.find(x => x.id === m.id)!).filter(Boolean);
      const wins = fullMatches.filter(m => m.winner?.id === team.id).length;
      const losses = fullMatches.length - wins;

      let gamesWon = 0;
      let gamesLost = 0;
      fullMatches.forEach(m => {
        const isTeam1 = m.team1.id === team.id;
        if (m.scoringMode === 'race' || m.team1RaceScore !== undefined) {
          gamesWon += isTeam1 ? (m.team1RaceScore ?? 0) : (m.team2RaceScore ?? 0);
          gamesLost += isTeam1 ? (m.team2RaceScore ?? 0) : (m.team1RaceScore ?? 0);
        } else {
          gamesWon += isTeam1 ? m.team1Score.games : m.team2Score.games;
          gamesLost += isTeam1 ? m.team2Score.games : m.team1Score.games;
        }
      });

      // Top 2 per group advance (standard padel tournament rule)
      const advances = idx < 2 ? 'Yes' : 'No';

      rows.push([
        group.name,
        idx + 1,
        team.name,
        fullMatches.length,
        wins,
        losses,
        gamesWon,
        gamesLost,
        gamesWon - gamesLost,
        advances,
      ]);
    });

    // Blank row between groups
    rows.push([]);
  });

  return XLSX.utils.aoa_to_sheet([headers, ...rows]);
}

function buildGroupMatrixSheet(tournament: Tournament) {
  const groups = tournament.groups ?? [];
  if (groups.length === 0) return null;

  // We build a separate block per group, stacked vertically with 2 blank rows between
  const allRows: (string | number | null)[][] = [];

  groups.forEach((group, gIdx) => {
    // Use standings order (already ranked) as the row/col order
    const teams = group.standings.length > 0 ? group.standings : group.teams;
    const n = teams.length;

    // Pre-compute score for every pair
    // result[rowTeamId][colTeamId] = "myScore–theirScore" or null if not played
    const result: Record<string, Record<string, string>> = {};
    teams.forEach(t => { result[t.id] = {}; });

    group.matches.forEach(gm => {
      const m = tournament.matches.find(x => x.id === gm.id);
      if (!m || !m.completed) return;

      let s1: string, s2: string;
      if (m.scoringMode === 'race' || m.team1RaceScore !== undefined) {
        s1 = String(m.team1RaceScore ?? 0);
        s2 = String(m.team2RaceScore ?? 0);
      } else if (m.setHistory && m.setHistory.filter(s => s.completed).length > 0) {
        const sets = m.setHistory.filter(s => s.completed);
        s1 = sets.map(s => s.team1Games).join('/');
        s2 = sets.map(s => s.team2Games).join('/');
      } else {
        s1 = String(m.team1Score.games);
        s2 = String(m.team2Score.games);
      }

      // From team1's perspective: s1–s2
      if (result[m.team1.id]) result[m.team1.id][m.team2.id] = `${s1}–${s2}`;
      // From team2's perspective: s2–s1
      if (result[m.team2.id]) result[m.team2.id][m.team1.id] = `${s2}–${s1}`;
    });

    // Header row: ["Group A", team1, team2, ..., W, L, GW, GL, Diff, Rank]
    if (gIdx > 0) {
      allRows.push([]);
      allRows.push([]);
    }
    allRows.push([group.name]);
    allRows.push([
      'Team',
      ...teams.map(t => t.name),
      'W', 'L', 'GW', 'GL', '+/−', 'Rank',
    ]);

    // One row per team
    teams.forEach((team, rowIdx) => {
      const played = group.matches
        .map(gm => tournament.matches.find(x => x.id === gm.id))
        .filter((m): m is Match => !!m && m.completed && (m.team1.id === team.id || m.team2.id === team.id));

      const wins = played.filter(m => m.winner?.id === team.id).length;
      const losses = played.length - wins;

      let gamesWon = 0, gamesLost = 0;
      played.forEach(m => {
        const isT1 = m.team1.id === team.id;
        if (m.scoringMode === 'race' || m.team1RaceScore !== undefined) {
          gamesWon  += isT1 ? (m.team1RaceScore ?? 0) : (m.team2RaceScore ?? 0);
          gamesLost += isT1 ? (m.team2RaceScore ?? 0) : (m.team1RaceScore ?? 0);
        } else if (m.setHistory && m.setHistory.length > 0) {
          m.setHistory.filter(s => s.completed).forEach(s => {
            gamesWon  += isT1 ? s.team1Games : s.team2Games;
            gamesLost += isT1 ? s.team2Games : s.team1Games;
          });
        } else {
          gamesWon  += isT1 ? m.team1Score.games : m.team2Score.games;
          gamesLost += isT1 ? m.team2Score.games : m.team1Score.games;
        }
      });

      const rank = group.standings.findIndex(s => s.id === team.id) + 1 || rowIdx + 1;

      const cells: (string | number | null)[] = [team.name];
      teams.forEach(col => {
        if (col.id === team.id) {
          cells.push('—');
        } else {
          cells.push(result[team.id]?.[col.id] ?? '-');
        }
      });

      cells.push(wins, losses, gamesWon, gamesLost, gamesWon - gamesLost, rank);
      allRows.push(cells);
    });
  });

  return XLSX.utils.aoa_to_sheet(allRows);
}

function buildAllMatchesSheet(tournament: Tournament) {
  const headers = [
    '#',
    'Stage',
    'Group',
    'Round',
    'Court',
    'Team 1',
    'Team 2',
    'Score',
    'Winner',
    'Status',
    'Scheduled Time',
    'Start Time',
    'End Time',
  ];

  const knockoutMatches = tournament.matches.filter(m => !m.groupId);
  const maxRound = knockoutMatches.length > 0
    ? Math.max(...knockoutMatches.map(m => m.round))
    : 0;

  const rows = tournament.matches.map((match, idx) => {
    const isGroup = !!match.groupId;
    const stage = isGroup ? 'Group Stage' : 'Knockout';
    const roundLabel = isGroup
      ? 'Round Robin'
      : getRoundLabel(match.round, maxRound);

    return [
      idx + 1,
      stage,
      getGroupName(match.groupId, tournament),
      roundLabel,
      getCourtName(match.courtId, tournament),
      match.team1.name,
      match.team2.name,
      match.completed ? fmtScore(match) : '-',
      match.winner?.name ?? '-',
      match.status,
      match.schedule?.scheduledTime
        ? new Date(match.schedule.scheduledTime).toLocaleString()
        : '-',
      match.schedule?.startTime
        ? new Date(match.schedule.startTime).toLocaleString()
        : '-',
      match.schedule?.endTime
        ? new Date(match.schedule.endTime).toLocaleString()
        : '-',
    ];
  });

  return XLSX.utils.aoa_to_sheet([headers, ...rows]);
}

function buildKnockoutBracketSheet(tournament: Tournament) {
  const headers = ['Round', 'Position', 'Team 1', 'Team 2', 'Score', 'Winner'];

  const knockoutMatches = tournament.matches
    .filter(m => !m.groupId)
    .sort((a, b) => a.round - b.round || a.position - b.position);

  const maxRound = knockoutMatches.length > 0
    ? Math.max(...knockoutMatches.map(m => m.round))
    : 0;

  const rows = knockoutMatches.map(match => [
    getRoundLabel(match.round, maxRound),
    match.position,
    match.team1.name,
    match.team2.name,
    match.completed ? fmtScore(match) : '-',
    match.winner?.name ?? '-',
  ]);

  return XLSX.utils.aoa_to_sheet([headers, ...rows]);
}

function buildHeadToHeadSheet(tournament: Tournament) {
  const headers = ['Match', 'Stage', 'Team 1', 'Team 2', 'Set', 'T1 Games', 'T2 Games', 'Set Winner'];
  const rows: (string | number)[][] = [];

  tournament.matches
    .filter(m => m.completed && m.setHistory && m.setHistory.length > 0)
    .forEach((match, idx) => {
      const stage = match.groupId ? getGroupName(match.groupId, tournament) : 'Knockout';
      match.setHistory!.filter(s => s.completed).forEach(set => {
        rows.push([
          `Match ${idx + 1}: ${match.team1.name} vs ${match.team2.name}`,
          stage,
          match.team1.name,
          match.team2.name,
          `Set ${set.setNumber}`,
          set.team1Games,
          set.team2Games,
          set.winner === 'team1' ? match.team1.name : match.team2.name,
        ]);
      });
    });

  if (rows.length === 0) return null;
  return XLSX.utils.aoa_to_sheet([headers, ...rows]);
}

// ─── Column widths helper ─────────────────────────────────────────────────────

function setColWidths(sheet: XLSX.WorkSheet, widths: number[]) {
  sheet['!cols'] = widths.map(w => ({ wch: w }));
}

// ─── Main export function ─────────────────────────────────────────────────────

export function exportTournamentToExcel(tournament: Tournament) {
  const wb = XLSX.utils.book_new();

  // 1. Summary
  const summarySheet = buildSummarySheet(tournament);
  setColWidths(summarySheet, [22, 30]);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // 2. Team Statistics
  const teamSheet = buildTeamStatsSheet(tournament);
  setColWidths(teamSheet, [22, 14, 12, 16, 8, 8, 12, 12, 12, 12]);
  XLSX.utils.book_append_sheet(wb, teamSheet, 'Team Stats');

  // 3. Group Standings (if applicable)
  if (tournament.groups && tournament.groups.length > 0) {
    const groupSheet = buildGroupStandingsSheet(tournament);
    setColWidths(groupSheet, [14, 8, 22, 10, 6, 6, 12, 12, 8, 10]);
    XLSX.utils.book_append_sheet(wb, groupSheet, 'Group Standings');

    // 3b. Round-robin matrix (head-to-head per group)
    const matrixSheet = buildGroupMatrixSheet(tournament);
    if (matrixSheet) {
      setColWidths(matrixSheet, [22, ...Array(20).fill(12)]);
      XLSX.utils.book_append_sheet(wb, matrixSheet, 'Group H2H Matrix');
    }
  }

  // 4. All Matches
  const matchSheet = buildAllMatchesSheet(tournament);
  setColWidths(matchSheet, [6, 14, 12, 14, 14, 20, 20, 14, 20, 12, 20, 20, 20]);
  XLSX.utils.book_append_sheet(wb, matchSheet, 'All Matches');

  // 5. Knockout Bracket (if applicable)
  const knockoutMatches = tournament.matches.filter(m => !m.groupId && m.completed);
  if (knockoutMatches.length > 0) {
    const knockoutSheet = buildKnockoutBracketSheet(tournament);
    setColWidths(knockoutSheet, [16, 10, 22, 22, 14, 22]);
    XLSX.utils.book_append_sheet(wb, knockoutSheet, 'Knockout Bracket');
  }

  // 6. Set Details (padel mode only, if setHistory exists)
  const setDetailSheet = buildHeadToHeadSheet(tournament);
  if (setDetailSheet) {
    setColWidths(setDetailSheet, [36, 14, 18, 18, 8, 10, 10, 18]);
    XLSX.utils.book_append_sheet(wb, setDetailSheet, 'Set Details');
  }

  // Download
  const filename = `${tournament.name.replace(/[^a-z0-9]/gi, '_')}_results.xlsx`;
  XLSX.writeFile(wb, filename);
}
