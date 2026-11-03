import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Crosshair, ExternalLink, GitBranch, Link2, LoaderCircle, Minus, Plus, RefreshCw, RotateCcw, ShieldCheck, Target, TrendingDown, Trophy, X, Zap } from 'lucide-react';
import { analyze, pct, points, signed } from './analysis';
import type { BoxTeam, Envelope, Factor, FactorId, Game, GameDetail, Team } from './types';

const REPO = 'https://github.com/JickBick/how-did-we-lose';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const shiftDate = (date: string, amount: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0, 10); };
const prettyDate = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const initialQuery = new URLSearchParams(window.location.search);
const initialDate = initialQuery.get('date');

function Ball({ className = '' }: { className?: string }) {
  return <svg className={className} width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.7"/><path d="M4 16h24M16 4v24M7.5 7.5c11 5.4 11 11.6 17 17M24.5 7.5c-11 5.4-11 11.6-17 17" stroke="currentColor" strokeWidth="1.7"/></svg>;
}

function Logo({ team, size = 28 }: { team: Team; size?: number }) {
  return team.logo ? <img className="team-logo" src={team.logo} alt="" width={size} height={size} onError={e => { e.currentTarget.style.visibility = 'hidden'; }} /> : <span className="logo-fallback" style={{ width: size, height: size }}>{team.abbreviation}</span>;
}

async function get<T>(url: string, signal?: AbortSignal): Promise<Envelope<T>> {
  const response = await fetch(url, { signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
  return body;
}

function FactorIcon({ id }: { id: FactorId }) {
  const icons = { threes: Crosshair, twos: Target, turnovers: RotateCcw, rebounds: ArrowDown, line: Minus, freeThrows: Crosshair, shotMix: GitBranch, balance: RefreshCw };
  const Icon = icons[id];
  return <Icon size={19} strokeWidth={1.7} />;
}

function Methodology({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="method-dialog" onClose={onClose} onClick={e => { if (e.target === e.currentTarget) ref.current?.close(); }}>
    <div className="dialog-heading"><span className="eyebrow">THE METHOD BEHIND THE MISERY</span><button className="icon-button" aria-label="Close explanation" onClick={() => ref.current?.close()}><X size={20}/></button></div>
    <h2>A box score. A little math.<br/>A much clearer story.</h2>
    <p>We compare your team with its opponent and translate the differences into equivalent points. Positive costs hurt your team. Green offsets helped.</p>
    <div className="method-step"><span>01</span><div><h3>Start with the points</h3><p>Field-goal points = 2 × field goals made + threes made. Add made free throws and you have the score.</p></div></div>
    <div className="method-step"><span>02</span><div><h3>Separate opportunity from accuracy</h3><p>Shared averages split scoring differences into shot volume, two- and three-point accuracy, shot mix, free-throw attempts and free-throw accuracy. This symmetric split treats both teams equally.</p></div></div>
    <div className="method-step"><span>03</span><div><h3>Explain where the shots went</h3><p>We allocate one shot opportunity to each extra offensive rebound or turnover, at average points per field-goal attempt. The remaining difference sits in possession balance. These are estimates, not a claim about individual possessions.</p></div></div>
    <div className="method-step"><span>04</span><div><h3>Make every point add up</h3><p>The full set of factors adds to the actual margin. We don’t add defensive boards, assists, fouls or points off turnovers again: they overlap with the scoring already counted. Display rounding can differ by 0.1 points.</p></div></div>
    <div className="method-note"><ShieldCheck size={21}/><p>The what-if controls close portions of the accounting gaps. They illustrate the size of an issue; they don’t predict how a different game would have played out.</p></div>
    <p className="source-note">Data: ESPN’s public NBA feed, which can be delayed and has no guaranteed availability. Live scores and stats sometimes arrive separately; we wait for them to agree before calculating.</p>
    <button className="primary-button" onClick={() => ref.current?.close()}>Got it. Show me the damage <ArrowRight size={16}/></button>
  </dialog>;
}

function BoxScore({ us, them }: { us: BoxTeam; them: BoxTeam }) {
  if (!us.stats || !them.stats) return null;
  const u = us.stats, o = them.stats;
  const rows: [string, string | number, string | number][] = [
    ['Field goals', `${u.fgm}/${u.fga}`, `${o.fgm}/${o.fga}`],
    ['Field-goal attempts', u.fga, o.fga],
    ['Three-pointers', `${u.tpm}/${u.tpa}`, `${o.tpm}/${o.tpa}`],
    ['Three-point %', u.tpa ? pct(u.tpm/u.tpa) : '—', o.tpa ? pct(o.tpm/o.tpa) : '—'],
    ['Free throws', `${u.ftm}/${u.fta}`, `${o.ftm}/${o.fta}`],
    ['Offensive rebounds', u.orb, o.orb], ['Defensive rebounds', u.drb, o.drb],
    ['Total rebounds', u.rebounds, o.rebounds], ['Turnovers', u.turnovers, o.turnovers],
    ['Assists', u.assists, o.assists], ['Steals', u.steals, o.steals], ['Blocks', u.blocks, o.blocks], ['Personal fouls', u.fouls, o.fouls],
  ];
  return <section className="box-score panel"><div className="panel-heading"><h2>The numbers behind it</h2><span className="muted">Team totals</span></div><table><thead><tr><th>STAT</th><th><Logo team={us} size={24}/>{us.abbreviation}</th><th><Logo team={them} size={24}/>{them.abbreviation}</th></tr></thead><tbody>{rows.map(([name, a, b]) => <tr key={name}><th scope="row">{name}</th><td>{a}</td><td>{b}</td></tr>)}</tbody></table><p className="table-note">Supporting stats give context. Only the factors in the breakdown are added to the margin.</p></section>;
}

export default function App() {
  const [date, setDate] = useState(initialDate && /^20\d{2}-\d{2}-\d{2}$/.test(initialDate) && Number.isFinite(Date.parse(initialDate)) ? initialDate : today());
  const [games, setGames] = useState<Game[]>([]);
  const [gameId, setGameId] = useState<string | null>(initialQuery.get('game'));
  const [detail, setDetail] = useState<Envelope<GameDetail> | null>(null);
  const [teamId, setTeamId] = useState<string | null>(initialQuery.get('team'));
  const [loadingGames, setLoadingGames] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [gamesError, setGamesError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [method, setMethod] = useState(false);
  const [tab, setTab] = useState<'breakdown' | 'boxscore'>('breakdown');
  const [filter, setFilter] = useState<'all' | 'hurt' | 'helped'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Record<string, number>>({});
  const [shareMessage, setShareMessage] = useState('');
  const railRef = useRef<HTMLDivElement>(null);
  const preferRecent = useRef(!initialQuery.has('date'));

  useEffect(() => {
    const controller = new AbortController();
    let first = true;
    setLoadingGames(true); setGamesError(''); setGames([]);
    const load = async () => {
      try {
        const response = await get<Game[]>(`/api/games?date=${date}`, controller.signal);
        if (controller.signal.aborted) return;
        // After midnight ET, today's schedule may only contain future games.
        // Open the previous slate so a first visit has an actual game to explain.
        if (preferRecent.current && date === today() && !response.data.some(g => g.state !== 'pre')) {
          preferRecent.current = false;
          setDate(shiftDate(date, -1));
          return;
        }
        preferRecent.current = false;
        setGames(response.data); setGamesError('');
        setGameId(current => response.data.some(g => g.id === current) ? current : response.data.find(g => g.state === 'post')?.id || response.data.find(g => g.state === 'in')?.id || response.data[0]?.id || null);
      } catch (error) { if (!controller.signal.aborted) setGamesError((error as Error).message); }
      finally { if (!controller.signal.aborted && first) { setLoadingGames(false); first = false; } }
    };
    void load();
    const interval = window.setInterval(load, 30_000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [date, refreshKey]);

  useEffect(() => {
    if (!gameId) { setDetail(null); return; }
    const controller = new AbortController();
    let first = true;
    setLoadingDetail(true); setDetail(null); setDetailError('');
    const load = async () => {
      try {
        const response = await get<GameDetail>(`/api/games/${gameId}`, controller.signal);
        if (controller.signal.aborted) return;
        setDetail(response); setDetailError('');
        setTeamId(current => response.data.teams.some(t => t.id === current) ? current : [...response.data.teams].sort((a, b) => a.score - b.score)[0].id);
      } catch (error) { if (!controller.signal.aborted) setDetailError((error as Error).message); }
      finally { if (!controller.signal.aborted && first) { setLoadingDetail(false); first = false; } }
    };
    void load();
    const interval = window.setInterval(load, 30_000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [gameId, refreshKey]);

  useEffect(() => { setFixes({}); setExpanded(null); setFilter('all'); }, [gameId, teamId]);
  useEffect(() => {
    if (detail && teamId && detail.data.id === gameId) {
      const params = new URLSearchParams({ date, game: detail.data.id, team: teamId });
      window.history.replaceState(null, '', `?${params}`);
    }
  }, [detail, teamId, date, gameId]);

  const changeDate = (next: string) => { setGameId(null); setDetail(null); setDate(next); };
  const game = detail?.data;
  const us = game?.teams.find(t => t.id === teamId);
  const them = game?.teams.find(t => t.id !== teamId);
  const analysis = us && them && game?.state !== 'pre' ? analyze(us, them) : null;
  const visible = analysis ? filter === 'hurt' ? analysis.hurt : filter === 'helped' ? analysis.helped : [
    ...(analysis.gap >= 0 ? [...analysis.hurt, ...analysis.helped] : [...analysis.helped, ...analysis.hurt]),
    ...analysis.factors.filter(f => Math.abs(f.points) <= .049),
  ] : [];
  const recovered = analysis?.hurt.reduce((sum, f) => sum + f.points * (fixes[f.id] || 0) / 100, 0) || 0;
  const best = analysis ? analysis.gap >= 0 ? analysis.hurt[0] : analysis.helped[0] : null;
  const isLive = game?.state === 'in';
  const dateLabel = date === today() ? 'Today' : date === shiftDate(today(), -1) ? 'Yesterday' : prettyDate(date);

  async function share() {
    try { await navigator.clipboard.writeText(window.location.href); setShareMessage('Link copied'); }
    catch { setShareMessage('Copy the link from your address bar'); }
    window.setTimeout(() => setShareMessage(''), 3500);
  }

  return <>
    <a className="skip-link" href="#analysis">Skip to game analysis</a>
    <header className="site-header"><div className="header-inner">
      <a className="brand" href="/" aria-label="How did we lose? Home"><span className="brand-icon"><Ball/></span><span>how did we <strong>lose?</strong></span></a>
      <nav aria-label="Main navigation"><button className="nav-active" onClick={() => document.getElementById('games')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>The breakdown</button><button onClick={() => setMethod(true)}>How it works <ArrowUpRight size={13}/></button><a href={REPO} target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={13}/></a></nav>
      <div className="header-meta"><span className="status-dot"/>NBA, in perspective</div>
    </div></header>

    <main>
      <section className="intro"><div><div className="eyebrow intro-eyebrow"><span className="tiny-line"/>THE BOX SCORE, EXPLAINED</div><h1>Missed the game.<br/><span>Found the reasons.</span><span className="heading-period">*</span></h1><p>Every loss has a story. See where the points got away.</p></div><div className="intro-aside"><span className="asterisk">✳</span><p>No hot takes.<br/>Just the numbers.</p><span className="hand-line"/></div></section>

      <section className="games-section" id="games" aria-label="Choose an NBA game">
        <div className="section-toolbar"><div className="section-label"><Ball/> PICK YOUR GAME <span className="league-tag">NBA</span></div><div className="date-tools"><button className="icon-button" aria-label="Previous day" onClick={() => changeDate(shiftDate(date, -1))}><ChevronLeft size={17}/></button><label className="date-control"><CalendarDays size={15}/><span>{dateLabel}</span><ChevronDown size={13}/><input aria-label="Game date, US Eastern time" type="date" value={date} min="2000-01-01" max="2099-12-31" onChange={e => { if (e.target.value) changeDate(e.target.value); }}/></label><button className="icon-button" aria-label="Next day" onClick={() => changeDate(shiftDate(date, 1))}><ChevronRight size={17}/></button>{date !== today() && <button className="today-button" onClick={() => changeDate(today())}>Today</button>}</div></div>
        {loadingGames ? <div className="game-rail game-loading" aria-live="polite"><LoaderCircle className="spin" size={18}/> Getting the games…</div> : gamesError ? <div className="inline-error" role="alert"><p>{gamesError}</p><button onClick={() => setRefreshKey(n => n+1)}>Try again <RefreshCw size={14}/></button></div> : games.length === 0 ? <div className="empty-games"><CalendarDays size={24}/><div><strong>No games on this date.</strong><p>Try another day, or revisit a classic.</p></div><button onClick={() => changeDate('2025-06-22')}>2025 Finals, Game 7 <ArrowRight size={15}/></button></div> : <div className="rail-wrap"><div className="game-rail" ref={railRef}>{games.map(g => <button key={g.id} className={`game-card ${g.id === gameId ? 'selected' : ''}`} onClick={() => { setGameId(g.id); setTeamId(null); }} aria-pressed={g.id === gameId} aria-label={`${g.teams.map(t => t.name).join(' at ')}, ${g.status}`}><div className={`game-status ${g.state === 'in' ? 'live' : ''}`}>{g.state === 'in' && <span className="status-dot"/>}{g.status}</div>{g.teams.map(t => <div className="game-team" key={t.id}><Logo team={t} size={21}/><span>{t.abbreviation}</span><b className={t.score === Math.max(...g.teams.map(t => t.score)) && g.state !== 'pre' ? 'winning-score' : ''}>{g.state === 'pre' ? '—' : t.score}</b></div>)}{g.id === gameId && <span className="selected-check"><Check size={11}/></span>}</button>)}</div><button className="rail-next" aria-label="More games" onClick={() => railRef.current?.scrollBy({ left: 340, behavior: 'smooth' })}><ChevronRight size={19}/></button></div>}
        <div className="games-footnote"><span>{prettyDate(date)} · US Eastern time</span><span>{games.length > 0 && `${games.length} games`}</span></div>
      </section>

      <div id="analysis" className="analysis-anchor"/>
      {loadingDetail && !gamesError && <div className="loading-panel" aria-live="polite"><LoaderCircle className="spin" size={26}/><h2>Reading between the box-score lines…</h2></div>}
      {detailError && <div className="error-panel" role="alert"><CircleHelp size={27}/><h2>The stats are taking a timeout.</h2><p>{detailError}</p><button className="primary-button" onClick={() => setRefreshKey(n => n+1)}>Try again <RefreshCw size={16}/></button></div>}
      {game && us && them && !loadingDetail && <>
        <div className="perspective-row"><div><span className="eyebrow">THROUGH YOUR TEAM’S EYES</span><div className="team-toggle" aria-label="Your team">{game.teams.map(t => <button className={teamId === t.id ? 'active' : ''} onClick={() => setTeamId(t.id)} key={t.id} aria-pressed={teamId === t.id}><Logo team={t} size={20}/>{t.shortName}{teamId === t.id && <Check size={13}/>}</button>)}</div></div><button className="share-button" onClick={share}><Link2 size={15}/><span>{shareMessage || 'Share breakdown'}</span></button></div>

        <section className="scoreboard panel" aria-label="Game result">
          <div className="scoreboard-main"><div className="score-team our-team"><Logo team={us} size={80}/><div><span className="you-label">YOUR TEAM</span><h2>{us.name}</h2><span className="team-meta">{us.homeAway === 'home' ? 'HOME' : 'AWAY'}{us.record ? ` · ${us.record}` : ''}</span></div></div><div className="score-center"><span className={`score-status ${isLive ? 'live' : ''}`}>{isLive && <span className="status-dot"/>}{game.status}</span><div className="scores"><strong>{game.state === 'pre' ? '—' : us.score}</strong><span>–</span><strong className="opponent-score">{game.state === 'pre' ? '—' : them.score}</strong></div><span className={`result-pill ${analysis && analysis.gap < 0 ? 'won' : ''}`}>{game.state === 'pre' ? 'UPCOMING' : us.score === them.score ? 'ALL SQUARE' : us.score > them.score ? `${isLive ? 'LEADING' : 'WON'} BY ${us.score - them.score}` : `${isLive ? 'TRAILING' : 'LOST'} BY ${them.score - us.score}`}</span></div><div className="score-team opponent-team"><div><span className="you-label">THE OPPONENT</span><h2>{them.name}</h2><span className="team-meta">{them.homeAway === 'home' ? 'HOME' : 'AWAY'}{them.record ? ` · ${them.record}` : ''}</span></div><Logo team={them} size={80}/></div></div>
          <div className="scoreboard-footer"><span>{game.note || 'NBA Regular Season'}{game.venue && <><span className="dot-separator">·</span>{game.venue}</>}</span><span><span className={`status-dot ${isLive ? '' : 'neutral'}`}/>{detail?.stale ? 'Cached data' : isLive ? 'Updates every 30s' : 'Final box score'}<button aria-label="Refresh box score" className="refresh-button" onClick={() => setRefreshKey(n => n+1)}><RefreshCw size={13}/></button></span></div>
        </section>
        {detail?.stale && <p className="stale-message" role="status">The feed is temporarily unavailable. Showing the last successful update from {new Date(detail.fetchedAt).toLocaleString()}.</p>}
        {detailError && <p className="stale-message" role="status">Refresh failed. The displayed stats are from {new Date(detail!.fetchedAt).toLocaleString()}.</p>}

        {game.state === 'pre' ? <div className="empty-analysis panel"><Ball/><h2>The story starts at tip-off.</h2><p>We’ll break down the points once the stats start coming in. Pick a completed game to see how it works.</p></div> : !analysis ? <div className="empty-analysis panel"><RefreshCw size={30}/><h2>Waiting for the box score to catch up.</h2><p>The score and shooting stats aren’t in sync yet, or the stats are incomplete. We’ll check again automatically in 30 seconds.</p><button className="text-button" onClick={() => setRefreshKey(n => n+1)}>Check now <RefreshCw size={14}/></button></div> : <>
          <div className="analysis-title"><div><div className="eyebrow">{isLive ? 'THE STORY SO FAR' : 'THE POST-GAME POST-MORTEM'}</div><h2>{analysis.gap > 0 ? isLive ? 'Why are we behind?' : 'So, how did we lose?' : analysis.gap < 0 ? isLive ? 'What’s giving us the edge?' : 'So, how did we win?' : 'What’s keeping it close?'}</h2></div><span className="analysis-caption"><span className="mini-spark">✳</span> The margin, made sense of.</span></div>
          {best && <div className="takeaway"><span className="takeaway-icon">{analysis.gap >= 0 ? <TrendingDown size={21}/> : <Trophy size={21}/>}</span><p><strong>{best.title}</strong> {analysis.gap >= 0 ? 'was the biggest drag' : 'gave us the biggest lift'} — <strong>{points(best.points)} equivalent points</strong>. {analysis.gap >= 0 ? 'Start there.' : 'That made a difference.'}</p><button aria-label="Explain the biggest factor" onClick={() => { setTab('breakdown'); setFilter('all'); setExpanded(best.id); window.setTimeout(() => document.getElementById(`factor-${best.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30); }}><ArrowDownRight size={20}/></button></div>}

          <div className="content-grid"><div className="breakdown-column"><div className="content-tabs" aria-label="Analysis view"><button className={tab === 'breakdown' ? 'active' : ''} onClick={() => setTab('breakdown')}>The breakdown <span>{analysis.factors.length}</span></button><button className={tab === 'boxscore' ? 'active' : ''} onClick={() => setTab('boxscore')}>Box score</button><button className="method-link" onClick={() => setMethod(true)}><CircleHelp size={14}/><span>How we calculate</span></button></div>
            {tab === 'boxscore' ? <BoxScore us={us} them={them}/> : <><div className="factor-toolbar"><div className="factor-filters">{(['all', 'hurt', 'helped'] as const).map(f => <button key={f} onClick={() => setFilter(f)} className={filter === f ? 'active' : ''}>{f === 'all' ? 'All factors' : f === 'hurt' ? 'Hurt us' : 'Helped us'}</button>)}</div><span>RANKED BY POINT IMPACT</span></div><div className="factor-list">{visible.map((f, index) => <FactorCard key={f.id} factor={f} index={index} total={analysis.totalHurt} totalHelp={analysis.totalHelp} expanded={expanded === f.id} onExpand={() => setExpanded(expanded === f.id ? null : f.id)} fix={fixes[f.id] || 0} onFix={n => setFixes(old => ({ ...old, [f.id]: n }))}/>)}{visible.length === 0 && <div className="empty-filter panel">No {filter === 'helped' ? 'helpful' : 'harmful'} factors in this snapshot.</div>}</div><div className="rounding-note"><ShieldCheck size={15}/><span>One scoring gap. No double counting. Estimates are rounded to 0.1 points.</span></div></>}
          </div>

          <aside className="summary-column"><section className="margin-card"><div className="eyebrow">THE {isLive ? 'MARGIN' : analysis.gap > 0 ? 'LOSS' : analysis.gap < 0 ? 'WIN' : 'TIE'}, ACCOUNTED FOR</div><div className="margin-number">{Math.abs(analysis.gap)}<span>PTS</span><svg viewBox="0 0 120 60" aria-hidden="true"><path d="M4 14h22l13 15h22l13 14h40" fill="none" stroke="currentColor" strokeWidth="2"/><path d="m106 35 9 8-9 8" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="4" cy="14" r="4" fill="currentColor"/></svg></div><p className="margin-subtitle">{analysis.gap > 0 ? `${isLive ? 'Current' : 'Final'} deficit` : analysis.gap < 0 ? `${isLive ? 'Current' : 'Final'} advantage` : 'Nothing between them'}</p><div className="margin-divider"/><div className="ledger-line"><span><span className="ledger-dot bad"/>Points that hurt</span><strong>−{points(analysis.totalHurt)}</strong></div><div className="ledger-line"><span><span className="ledger-dot good"/>Points that helped</span><strong className="green">+{points(analysis.totalHelp)}</strong></div><div className="ledger-total"><span>Net point difference</span><strong>{signed(-analysis.gap)}</strong></div><div className="impact-strip" aria-label="Relative size of harmful and helpful factors">{analysis.factors.filter(f => Math.abs(f.points) > .049).map(f => <div key={f.id} style={{ flex: Math.abs(f.points), background: f.points > 0 ? '#dd8d70' : '#c5f264' }} title={`${f.title}: ${signed(-f.points)} pts`}/>)}</div><div className="ledger-caption"><span>Equivalent points, relative to {them.abbreviation}.</span><button aria-label="About equivalent points" onClick={() => setMethod(true)}><CircleHelp size={13}/></button></div></section>

          <section className="whatif-card panel"><div className="whatif-heading"><span className="whatif-icon"><Zap size={18}/></span><h3>A little “what if?”</h3>{recovered > 0 && <button className="reset-button" onClick={() => setFixes({})} aria-label="Reset what-if scenario"><RotateCcw size={14}/></button>}</div><p>Close a gap in the breakdown.<br/>See how much it could have mattered.</p><div className="whatif-result"><div><span>POINTS RECOVERED</span><strong>+{points(recovered)}</strong></div><div><span>ADJUSTED MARGIN</span><strong className={recovered - analysis.gap >= 0 ? 'scenario-positive' : ''}>{signed(recovered - analysis.gap)}</strong></div></div><div className="whatif-score"><span>{us.abbreviation} <b>{(us.score + recovered).toFixed(recovered > 0 ? 1 : 0)}</b></span><span>–</span><span><b>{them.score}</b> {them.abbreviation}</span></div><small>An illustration using equivalent points, not a prediction.</small></section>
          <div className="side-note"><span>↳</span><p>The box score tells you <em>what</em> happened.<br/>This helps you see <em>why it mattered.</em></p></div></aside></div>
        </>}
        <div className="data-source"><span>DATA DOESN’T DO HOT TAKES.</span><a href={game.sourceUrl} target="_blank" rel="noreferrer">View original ESPN box score <ExternalLink size={12}/></a></div>
      </>}
    </main>

    <footer><div className="footer-inner"><div className="footer-brand"><Ball/><span>A little less “we just wanted it less.”<br/><strong>A little more perspective.</strong></span></div><div><button onClick={() => setMethod(true)}>The methodology</button><a href={REPO} target="_blank" rel="noreferrer">Open source <ArrowUpRight size={12}/></a><span>Made for the fans who check the box score.</span></div></div></footer>
    {method && <Methodology onClose={() => setMethod(false)}/>}
    <div className="sr-only" role="status" aria-live="polite">{shareMessage}</div>
  </>;
}

function FactorCard({ factor: f, index, total, totalHelp, expanded, onExpand, fix, onFix }: { factor: Factor; index: number; total: number; totalHelp: number; expanded: boolean; onExpand: () => void; fix: number; onFix: (n: number) => void }) {
  const hurts = f.points > .049, neutral = Math.abs(f.points) <= .049;
  const weight = neutral ? 0 : Math.round(Math.abs(f.points) / (hurts ? total : totalHelp) * 100);
  return <article id={`factor-${f.id}`} className={`factor-card panel ${hurts ? 'hurts' : 'helps'} ${expanded ? 'expanded' : ''} ${neutral ? 'neutral-factor' : ''}`}>
    <button className="factor-main" onClick={onExpand} aria-expanded={expanded} aria-controls={`detail-${f.id}`}><span className="factor-rank">{String(index + 1).padStart(2, '0')}</span><span className="factor-icon"><FactorIcon id={f.id}/></span><span className="factor-description"><span className="factor-name">{f.title}{index === 0 && <span className="biggest-badge">BIGGEST IMPACT</span>}</span><span className="factor-comparison">{f.comparison}</span><span className="factor-track"><span style={{ width: `${weight}%` }}/></span></span><span className="factor-points"><strong>{neutral ? '' : hurts ? '−' : '+'}{points(f.points)}<small>pts</small></strong><span>{neutral ? 'No impact' : `${weight}% of ${hurts ? 'the damage' : 'the offsets'}`}</span></span><ChevronDown className="expand-chevron" size={16}/></button>
    {expanded && <div className="factor-detail" id={`detail-${f.id}`}><p>{f.explanation}</p><div className="formula"><span>THE MATH</span>{f.formula}</div>{hurts && <div className="fix-control"><div><label htmlFor={`fix-${f.id}`}><Zap size={14}/>Close this gap</label><span>{fix}% <ArrowRight size={12}/> <strong>+{points(f.points * fix/100)} pts</strong></span></div><input id={`fix-${f.id}`} type="range" min="0" max="100" step="10" value={fix} onChange={e => onFix(Number(e.target.value))} aria-valuetext={`${fix} percent of gap closed, ${points(f.points * fix / 100)} equivalent points recovered`}/><div className="range-labels"><span>As played</span><button onClick={() => onFix(100)}>Close the full gap <Plus size={12}/></button></div></div>}</div>}
  </article>;
}
