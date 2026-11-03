import type { BoxTeam, Factor, Stats } from './types';

const avg = (a: number, b: number) => (a + b) / 2;
const rate = (made: number, attempts: number, fallback: number) => attempts ? made / attempts : fallback;
export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
export const points = (n: number) => Math.abs(n) < 0.05 ? '0.0' : Math.abs(n).toFixed(1);
export const signed = (n: number) => `${n > 0.049 ? '+' : n < -0.049 ? '−' : ''}${points(n)}`;

/** Symmetric score decomposition. Positive points = disadvantage to the selected team. */
export function analyze(us: BoxTeam, them: BoxTeam) {
  if (!us.stats || !them.stats) return null;
  const u = us.stats, o = them.stats;
  const twoRate = (s: Stats, fallback = 0) => rate(s.fgm - s.tpm, s.fga - s.tpa, fallback);
  const u2 = twoRate(u, twoRate(o)), o2 = twoRate(o, u2);
  const u3 = rate(u.tpm, u.tpa, rate(o.tpm, o.tpa, 0)), o3 = rate(o.tpm, o.tpa, u3);
  const uf = rate(u.ftm, u.fta, rate(o.ftm, o.fta, 0)), of = rate(o.ftm, o.fta, uf);
  const uShare = rate(u.tpa, u.fga, rate(o.tpa, o.fga, 0));
  const oShare = rate(o.tpa, o.fga, uShare);
  const averageAttempts = avg(u.fga, o.fga), share = avg(uShare, oShare);
  const uPps = rate(2 * u.fgm + u.tpm, u.fga, rate(2 * o.fgm + o.tpm, o.fga, 0));
  const oPps = rate(2 * o.fgm + o.tpm, o.fga, uPps);
  const pps = avg(uPps, oPps);
  const orbGap = o.orb - u.orb, turnoverGap = u.turnovers - o.turnovers;
  const factors: Factor[] = [
    {
      id: 'threes', title: 'Three-point shooting',
      points: 3 * (o3 - u3) * share * averageAttempts,
      comparison: `${pct(u3)} vs ${pct(o3)} from three`,
      explanation: `Compare three-point accuracy at the two teams’ shared shot volume and three-point share. ${us.abbreviation} went ${u.tpm}/${u.tpa}; ${them.abbreviation} went ${o.tpm}/${o.tpa}.`,
      formula: '3 × difference in 3P% × average 3-point share × average FGA',
    },
    {
      id: 'twos', title: 'Two-point shooting',
      points: 2 * (o2 - u2) * (1 - share) * averageAttempts,
      comparison: `${pct(u2)} vs ${pct(o2)} inside the arc`,
      explanation: `Compare finishing inside the arc at shared shot volume and shot mix. ${us.abbreviation} made ${u.fgm - u.tpm}/${u.fga - u.tpa} twos; ${them.abbreviation} made ${o.fgm - o.tpm}/${o.fga - o.tpa}.`,
      formula: '2 × difference in 2P% × average 2-point share × average FGA',
    },
    {
      id: 'turnovers', title: 'Taking care of the ball',
      points: turnoverGap * pps,
      comparison: `${u.turnovers} vs ${o.turnovers} turnovers`,
      explanation: `Each extra turnover is allocated one lost shot opportunity, valued at the teams’ average ${pps.toFixed(2)} points per field-goal attempt. This is an opportunity estimate; any mismatch is included in possession balance.`,
      formula: '(Our turnovers − their turnovers) × average points per FGA',
    },
    {
      id: 'rebounds', title: 'Offensive rebounding',
      points: orbGap * pps,
      comparison: `${u.orb} vs ${o.orb} offensive rebounds`,
      explanation: `An extra offensive board is allocated one extra shot opportunity at ${pps.toFixed(2)} points per attempt. Defensive and total rebounds are shown in the box score but aren’t added again. Not every rebound produces a shot; the balance factor reconciles that.`,
      formula: '(Their offensive rebounds − ours) × average points per FGA',
    },
    {
      id: 'line', title: 'Getting to the line',
      points: (o.fta - u.fta) * avg(uf, of),
      comparison: `${u.fta} vs ${o.fta} free-throw attempts`,
      explanation: `Compare actual free-throw opportunities at the teams’ shared conversion rate of ${pct(avg(uf, of))}. Fouls don’t all lead to free throws, so foul counts aren’t assigned additional points.`,
      formula: 'Difference in FTA × average FT%',
    },
    {
      id: 'freeThrows', title: 'Free-throw shooting',
      points: (of - uf) * avg(u.fta, o.fta),
      comparison: `${pct(uf)} vs ${pct(of)} at the line`,
      explanation: `Isolate free-throw accuracy using the teams’ shared number of attempts. ${us.abbreviation} made ${u.ftm}/${u.fta}; ${them.abbreviation} made ${o.ftm}/${o.fta}.`,
      formula: 'Difference in FT% × average FTA',
    },
    {
      id: 'shotMix', title: 'Twos vs. threes',
      points: (oShare - uShare) * (3 * avg(u3, o3) - 2 * avg(u2, o2)) * averageAttempts,
      comparison: `${pct(uShare)} vs ${pct(oShare)} of shots were threes`,
      explanation: 'A three is worth more, but is usually harder to make. This isolates shot selection using shared two- and three-point accuracy. It is separate from how well either team shot.',
      formula: 'Difference in 3-point share × (3 × average 3P% − 2 × average 2P%) × average FGA',
    },
    {
      id: 'balance', title: 'Possession balance',
      points: (o.fga - u.fga - orbGap - turnoverGap) * pps,
      comparison: `${u.fga} vs ${o.fga} total field-goal attempts`,
      explanation: 'The remaining shot-attempt difference after offensive boards and turnovers. It balances trips ending in free throws, period-end possessions, team rebounds and other timing effects. A box score cannot separate these exactly.',
      formula: '(FGA difference − offensive-board difference − turnover disadvantage) × average points per FGA',
    },
  ];
  const scoreGap = them.score - us.score;
  const reconstructedGap = (2 * o.fgm + o.tpm + o.ftm) - (2 * u.fgm + u.tpm + u.ftm);
  // Live scores and live stats can arrive a few seconds apart. Never hide that mismatch.
  if (Math.abs(scoreGap - reconstructedGap) > 0.01) return null;
  factors.forEach(f => { if (Math.abs(f.points) < 1e-9) f.points = 0; });
  const hurt = factors.filter(f => f.points > 0.049).sort((a, b) => b.points - a.points);
  const helped = factors.filter(f => f.points < -0.049).sort((a, b) => a.points - b.points);
  return {
    factors: [...factors].sort((a, b) => Math.abs(b.points) - Math.abs(a.points)),
    hurt, helped, gap: scoreGap,
    totalHurt: factors.reduce((sum, f) => sum + Math.max(0, f.points), 0),
    totalHelp: factors.reduce((sum, f) => sum - Math.min(0, f.points), 0),
  };
}
