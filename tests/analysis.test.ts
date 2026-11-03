import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/analysis';
import { parseStats } from '../server/espn';
import type { BoxTeam, Stats } from '../src/types';

const base: Stats = { fgm: 35, fga: 80, tpm: 10, tpa: 30, ftm: 15, fta: 20, orb: 8, drb: 30, rebounds: 38, turnovers: 12, assists: 20, steals: 6, blocks: 4, fouls: 17 };
function team(stats: Stats, id = '1'): BoxTeam {
  return { id, name: 'Test team', shortName: 'Test', abbreviation: 'TST', logo: '', color: '#123456', homeAway: 'home', score: 2 * stats.fgm + stats.tpm + stats.ftm, stats };
}

test('the decomposition equals the score margin across 2,000 varied box scores', () => {
  let seed = 7231;
  const rand = (max: number) => { seed = (seed * 16807) % 2147483647; return seed % (max+1); };
  const makeStats = (): Stats => {
    const tpa = rand(60), twoa = rand(85), tpm = rand(tpa), twom = rand(twoa), fta = rand(50);
    return { ...base, tpa, tpm, fga: tpa+twoa, fgm: tpm+twom, fta, ftm: rand(fta), orb: rand(25), turnovers: rand(30) };
  };
  for (let i=0; i<2000; i++) {
    const us = team(makeStats()), them = team(makeStats(), '2');
    const a = analyze(us, them)!;
    assert.ok(a);
    assert.ok(Math.abs(a.factors.reduce((sum, f) => sum + f.points, 0) - (them.score-us.score)) < 1e-8);
    const reverse = analyze(them, us)!;
    for (const f of a.factors) assert.ok(Math.abs(f.points + reverse.factors.find(g => g.id === f.id)!.points) < 1e-8);
  }
});

test('identical teams have no point impact', () => {
  const a = analyze(team(base), team(base, '2'))!;
  assert.equal(a.gap, 0);
  assert.ok(a.factors.every(f => f.points === 0));
});

test('defensive boards, fouls, assists, steals and blocks are not double counted', () => {
  const us = team(base), them = team({ ...base, drb: 50, rebounds: 58, assists: 40, fouls: 30, steals: 20, blocks: 15 }, '2');
  assert.ok(analyze(us, them)!.factors.every(f => f.points === 0));
});

test('turnover allocation is offset by balance if actual shot attempts are identical', () => {
  const a = analyze(team({ ...base, turnovers: 20 }), team(base, '2'))!;
  assert.ok(a.factors.find(f => f.id === 'turnovers')!.points > 0);
  assert.equal(a.factors.find(f => f.id === 'turnovers')!.points, -a.factors.find(f => f.id === 'balance')!.points);
  assert.equal(a.gap, 0);
});

test('zero attempts produce finite, balanced numbers', () => {
  const zero: Stats = { ...base, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, orb: 0, turnovers: 0 };
  const a = analyze(team(zero), team(base, '2'))!;
  assert.ok(a.factors.every(f => Number.isFinite(f.points)));
  assert.ok(Math.abs(a.factors.reduce((s, f) => s+f.points, 0)-a.gap) < 1e-8);
});

test('missing or out-of-sync live stats do not generate a misleading analysis', () => {
  assert.equal(analyze({ ...team(base), stats: null }, team(base, '2')), null);
  assert.equal(analyze({ ...team(base), score: 200 }, team(base, '2')), null);
});

test('ESPN adapter rejects incomplete and impossible shot lines', () => {
  assert.equal(parseStats(undefined), null);
  assert.equal(parseStats([{ name: 'fieldGoalsMade-fieldGoalsAttempted', displayValue: '5-4' }]), null);
  const stats = [
    { name: 'fieldGoalsMade-fieldGoalsAttempted', displayValue: '35-80' },
    { name: 'threePointFieldGoalsMade-threePointFieldGoalsAttempted', displayValue: '10-30' },
    { name: 'freeThrowsMade-freeThrowsAttempted', displayValue: '15-20' },
    { name: 'offensiveRebounds', displayValue: '8' },
    { name: 'turnovers', displayValue: '12' },
    { name: 'totalTurnovers', displayValue: '13' },
  ];
  assert.equal(parseStats(stats)?.turnovers, 13);
  assert.equal(parseStats(stats)?.fga, 80);
  assert.equal(parseStats(stats.slice(0, 3)), null);
});
