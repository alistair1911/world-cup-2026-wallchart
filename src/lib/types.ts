export type UserKey = "tata" | "lucas";

export type GroupLetter =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L";

export type MatchPhase =
  | "group"
  | "round32"
  | "round16"
  | "quarter"
  | "semi"
  | "third"
  | "final";

export type MatchStatus = "scheduled" | "live" | "final";

export type KnockoutSeed = {
  type: "seed";
  label: string;
  group?: GroupLetter;
  place?: 1 | 2 | 3;
  thirdPool?: GroupLetter[];
};

export type Team = {
  id: string;
  name: string;
  code: string;
  flag: string;
  group: GroupLetter;
  seed: number;
};

export type Match = {
  id: string;
  matchNumber: number;
  phase: MatchPhase;
  kickoff: string;
  venue: string;
  group?: GroupLetter;
  homeTeamId?: string;
  awayTeamId?: string;
  homeSeed?: KnockoutSeed;
  awaySeed?: KnockoutSeed;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  penaltyWinnerId?: string | null;
  updatedBy?: UserKey | null;
  updatedAt?: string | null;
};

export type Prediction = {
  userKey: UserKey;
  matchId: string;
  homeScore: number | null;
  awayScore: number | null;
  predictedWinnerTeamId?: string | null;
  updatedAt?: string | null;
};

export type MatchComment = {
  id: string;
  userKey: UserKey;
  displayName: string;
  matchId: string;
  body: string;
  createdAt: string;
};

export type PlayerMatchStat = {
  matchId: string;
  playerId: string;
  playerName: string;
  teamId: string;
  goals: number;
  assists: number;
  updatedBy?: UserKey | null;
  updatedAt?: string | null;
};

export type FantasyPosition = "GK" | "DEF" | "MID" | "FWD";

export type FantasyRosterSlot = {
  userKey: UserKey;
  playerId: string;
  roundId: string;
  slotIndex: number;
  isStarter: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
  updatedAt?: string | null;
};

export type FantasyPlayerMatchScore = {
  matchId: string;
  playerId: string;
  teamId: string;
  points: number;
  goals: number;
  assists: number;
  cleanSheet: boolean;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  penaltySaves: number;
  penaltyMisses: number;
  breakdown: Record<string, number>;
  status: "confirmed" | "needs_review";
  updatedAt?: string | null;
};

export type FamilySession = {
  userKey: UserKey;
  displayName: string;
  authUserId?: string;
};

export type FamilyUser = {
  key: UserKey;
  displayName: string;
  accent: string;
};

export type StandingRow = {
  team: Team;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

export type ScoreResult = {
  points: number;
  basePoints: number;
  knockoutBonus: number;
  status: "Exact" | "Close" | "Correct winner" | "Missed" | "Pending";
  exact: boolean;
  correctOutcome: boolean;
  explanation: string;
};
