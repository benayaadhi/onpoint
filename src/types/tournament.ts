export interface Team {
  id: string;
  name: string;
  wins?: number;
  losses?: number;
  setsWon?: number;
  setsLost?: number;
  gamesWon?: number;
  gamesLost?: number;
  // Race-mode standings (games/points accumulated across matches)
  pointsWon?: number;
  pointsLost?: number;
}

export interface Court {
  id: string;
  name: string;
  slug?: string; // URL-safe version of name, e.g. "court-7"
  isAvailable: boolean;
  currentMatch?: string; // Match ID
  location?: string;
  surface?: 'clay' | 'artificial-grass' | 'concrete' | 'indoor';
}

export type MatchStatus =
  | 'scheduled'
  | 'in-progress'
  | 'completed'
  | 'cancelled';

export interface MatchSchedule {
  scheduledTime?: string;
  startTime?: string;
  endTime?: string;
  estimatedDuration?: number; // minutes
}

export interface PadelScore {
  games: number;
  points: number;
  sets: number;
}

export interface MatchRules {
  setsToWin: number; // sets needed to win the match (best of 1/3/5 → 1/2/3)
  gamesToWinSet: number; // games needed to win a set (e.g. 6 full, 4 short)
  tiebreakAt: number; // games-each that triggers a tiebreak (6 full, 3 short)
  tiebreakPoints: number; // points to win the tiebreak game (win by 2)
  goldenPoint: boolean; // true = sudden death at 40-40, false = advantage
}

export const DEFAULT_MATCH_RULES: MatchRules = {
  setsToWin: 2,
  gamesToWinSet: 6,
  tiebreakAt: 6,
  tiebreakPoints: 7,
  goldenPoint: false,
};

export interface Match {
  id: string;
  team1: Team;
  team2: Team;
  team1Score: PadelScore;
  team2Score: PadelScore;
  winner?: Team;
  completed: boolean;
  round: number;
  position: number;
  currentSet: number;
  currentGame: number;
  servingTeam: 'team1' | 'team2';
  isDeuce: boolean;
  advantage?: 'team1' | 'team2';
  isTiebreaker: boolean;
  tiebreakPoints?: { team1: number; team2: number };
  pointsInGame: number;
  // Court system additions
  courtId?: string;
  status: MatchStatus;
  schedule: MatchSchedule;
  // Group system additions
  groupId?: string;
  setHistory?: SetHistory[];
  // Clash (club vs club) additions — a rubber inside a tie
  tieId?: string;
  category?: RubberCategory;
  // Scoring mode (set on match from tournament config)
  scoringMode?: 'padel' | 'race';
  raceTarget?: number;
  team1RaceScore?: number;
  team2RaceScore?: number;
  isGoldenPoint?: boolean;
  // Configurable padel rules (falls back to DEFAULT_MATCH_RULES when absent)
  rules?: MatchRules;
  // Monotonic stamp (ms) of the last score change — used to reject stale
  // incoming updates so an optimistic local score never bounces backward.
  lastUpdated?: number;
}

export interface SetHistory {
  setNumber: number;
  team1Games: number;
  team2Games: number;
  winner: 'team1' | 'team2';
  completed: boolean;
}

export interface Group {
  id: string;
  name: string; // "Group A", "Group B", etc.
  teams: Team[];
  preferredCourtId?: string;
  completed: boolean;
  matches: Match[];
  standings: Team[];
}

// ─── Clash (club vs club) format ─────────────────────────────────────────────
export type RubberCategory = 'men' | 'women' | 'mix';
export const RUBBER_CATEGORIES: RubberCategory[] = ['men', 'women', 'mix'];

// A club fields one team per category; clubs are what the standings rank.
export interface Club {
  id: string;
  name: string;
  teams: Record<RubberCategory, Team>;
  // standings (recomputed from completed rubbers)
  rubbersWon?: number;
  rubbersLost?: number;
  tiesWon?: number;
  setsWon?: number;
  setsLost?: number;
}

// A tie is one club-vs-club confrontation = 3 rubbers (one per category).
export interface Tie {
  id: string;
  club1Id: string;
  club2Id: string;
  round: number;
  stage: 'round-robin' | 'final' | 'knockout' | 'pool' | 'playoff' | 'semifinal' | 'third-place';
  position: number; // bracket position (knockout) or schedule slot
  matchIds: string[]; // the 3 rubber match ids
  completed: boolean;
  winnerClubId?: string;
  // Pool-knockout additions
  poolId?: string; // set for stage 'pool'
  seed1?: number; // seed number filling club1 slot (knockout display)
  seed2?: number; // seed number filling club2 slot (knockout display)
}

// A pool is a round-robin group of clubs in the pool-knockout structure.
export interface ClashPool {
  id: string;
  name: string; // "Pool 1", "Pool A", etc.
  clubIds: string[];
}

export type ClashStructure = 'round-robin' | 'rr-final' | 'knockout' | 'pool-knockout';

export interface Tournament {
  id: string;
  name: string;
  slug?: string; // URL-safe version of name, e.g. "wepadl-2025"
  format: 'round-robin' | 'single-elimination' | 'group-knockout' | 'clash';
  teams: Team[];
  matches: Match[];
  courts: Court[];
  currentRound: number;
  completed: boolean;
  winner?: Team;
  createdAt: string;
  // Tournament scheduling settings
  matchDuration: number; // default match duration in minutes
  breakBetweenMatches: number; // break time between matches in minutes
  // Group system additions
  groups?: Group[];
  groupStage?: boolean; // true if still in group stage
  scoringMode?: 'padel' | 'race';
  raceTarget?: number;
  showSponsorBar?: boolean;
  // Configurable rules (padel scoring + group structure)
  matchRules?: MatchRules;
  teamsPerGroup?: number; // default 4
  qualifiersPerGroup?: number; // teams advancing from each group, default 2
  // Clash format additions
  clubs?: Club[];
  ties?: Tie[];
  clashStructure?: ClashStructure; // default 'rr-final'
  clashStage?: 'round-robin' | 'final' | 'pool' | 'knockout' | 'done'; // progress
  winnerClubId?: string; // clash champion club
  // Pool-knockout additions
  clashPools?: ClashPool[];
  clashThirdPlace?: boolean; // include a 3rd-place tie
}

export interface TournamentConfig {
  matchRules: MatchRules;
  teamsPerGroup: number;
  qualifiersPerGroup: number;
  // Clash format
  clubs?: Club[];
  clashStructure?: ClashStructure;
  clashThirdPlace?: boolean;
}

export type TournamentFormat =
  | 'round-robin'
  | 'single-elimination'
  | 'group-knockout'
  | 'clash';
