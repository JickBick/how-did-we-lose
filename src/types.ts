export type Team = {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  logo: string;
  color: string;
  score: number;
  homeAway: 'home' | 'away';
  record?: string;
};

export type Game = {
  id: string;
  date: string;
  state: 'pre' | 'in' | 'post';
  status: string;
  teams: Team[];
  note?: string;
};

export type Stats = {
  fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number;
  orb: number; drb: number; rebounds: number; turnovers: number;
  assists: number; steals: number; blocks: number; fouls: number;
};

export type BoxTeam = Team & { stats: Stats | null };
export type GameDetail = Omit<Game, 'teams'> & {
  teams: BoxTeam[];
  venue: string;
  sourceUrl: string;
};

export type Envelope<T> = { data: T; fetchedAt: string; stale: boolean };
export type FactorId = 'threes' | 'twos' | 'turnovers' | 'rebounds' | 'line' | 'freeThrows' | 'shotMix' | 'balance';
export type Factor = {
  id: FactorId;
  title: string;
  points: number;
  comparison: string;
  explanation: string;
  formula: string;
};
