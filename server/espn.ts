import type { BoxTeam, Game, GameDetail, Stats, Team } from '../src/types';

type Raw = Record<string, any>;
export function teamFrom(raw: Raw): Team {
  const t = raw.team;
  return {
    id: String(t.id), name: t.displayName, shortName: t.shortDisplayName || t.name,
    abbreviation: t.abbreviation, logo: t.logo || t.logos?.[0]?.href || '',
    color: /^([a-f\d]{6})$/i.test(t.color) ? `#${t.color}` : '#243b30',
    score: Number(raw.score) || 0, homeAway: raw.homeAway,
    record: raw.records?.find((r: Raw) => r.type === 'total')?.summary,
  };
}

export function gameFrom(raw: Raw): Game {
  const c = raw.competitions[0];
  const s = c.status || raw.status;
  return {
    id: String(raw.id), date: c.date || raw.date,
    state: s.type.state, status: s.type.shortDetail || s.type.detail || s.type.description,
    teams: c.competitors.map(teamFrom).sort((a: Team, b: Team) => a.homeAway === b.homeAway ? 0 : a.homeAway === 'away' ? -1 : 1),
    note: c.notes?.[0]?.headline || raw.gameNote,
  };
}

export function parseStats(statistics: Raw[] | undefined): Stats | null {
  if (!statistics?.length) return null;
  const get = (name: string) => statistics.find(s => s.name === name)?.displayValue;
  const pair = (name: string): [number, number] | null => {
    const v = get(name);
    if (typeof v !== 'string' || !/^\d+\s*-\s*\d+$/.test(v)) return null;
    const [made, attempts] = v.split('-').map(Number);
    return made <= attempts ? [made, attempts] : null;
  };
  const fg = pair('fieldGoalsMade-fieldGoalsAttempted');
  const tp = pair('threePointFieldGoalsMade-threePointFieldGoalsAttempted');
  const ft = pair('freeThrowsMade-freeThrowsAttempted');
  const num = (name: string): number | null => {
    const raw = get(name);
    return raw != null && /^\d+$/.test(String(raw)) ? Number(raw) : null;
  };
  const orb = num('offensiveRebounds');
  const turnovers = num('totalTurnovers') ?? num('turnovers');
  if (!fg || !tp || !ft || orb === null || turnovers === null || tp[0] > fg[0] || tp[1] > fg[1] || fg[0] - tp[0] > fg[1] - tp[1]) return null;
  return {
    fgm: fg[0], fga: fg[1], tpm: tp[0], tpa: tp[1], ftm: ft[0], fta: ft[1], orb, turnovers,
    drb: num('defensiveRebounds') ?? 0, rebounds: num('totalRebounds') ?? 0,
    assists: num('assists') ?? 0, steals: num('steals') ?? 0, blocks: num('blocks') ?? 0, fouls: num('fouls') ?? 0,
  };
}

export function detailFrom(raw: Raw): GameDetail {
  if (!raw.header?.competitions?.[0]?.competitors?.length) throw new Error('Game not found');
  const game = gameFrom(raw.header);
  const teams: BoxTeam[] = game.teams.map(t => ({
    ...t,
    stats: parseStats(raw.boxscore?.teams?.find((b: Raw) => String(b.team.id) === t.id)?.statistics),
  }));
  return {
    ...game, teams, venue: raw.gameInfo?.venue?.fullName || '',
    sourceUrl: `https://www.espn.com/nba/boxscore/_/gameId/${game.id}`,
  };
}
