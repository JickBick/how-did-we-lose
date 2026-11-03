import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Link2,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { AnalysisSkeleton, GamesSkeleton, Methodology } from "./components";
import { analyze, pct, points, signed } from "./analysis";
import type {
  BoxTeam,
  Envelope,
  Factor,
  FactorId,
  Game,
  GameDetail,
  Team,
} from "./types";

const REPO = "https://github.com/JickBick/how-did-we-lose";
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const shiftDate = (date: string, amount: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
};
const prettyDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
const initialQuery = new URLSearchParams(window.location.search);
const initialDate = initialQuery.get("date");
const topics: Record<FactorId, string> = {
  turnovers: "turnovers",
  threes: "three-point shooting",
  twos: "two-point shooting",
  rebounds: "offensive rebounding",
  line: "getting to the line",
  freeThrows: "free-throw shooting",
  shotMix: "shot selection",
  balance: "shot opportunities",
};

function Logo({ team, size = 64 }: { team: Team; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [team.logo]);
  return team.logo && !failed ? (
    <img
      className="team-logo"
      src={team.logo}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="logo-fallback" style={{ width: size, height: size }}>
      {team.abbreviation}
    </span>
  );
}
async function get<T>(url: string, signal?: AbortSignal): Promise<Envelope<T>> {
  const response = await fetch(url, { signal });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.error || "This game could not be loaded. Please try again.",
    );
  return body;
}

function BoxScore({ us, them }: { us: BoxTeam; them: BoxTeam }) {
  if (!us.stats || !them.stats) return null;
  const u = us.stats,
    o = them.stats;
  const rows: [string, string | number, string | number][] = [
    ["Field goals", `${u.fgm}/${u.fga}`, `${o.fgm}/${o.fga}`],
    ["Field-goal attempts", u.fga, o.fga],
    ["Three-pointers", `${u.tpm}/${u.tpa}`, `${o.tpm}/${o.tpa}`],
    [
      "Three-point accuracy",
      u.tpa ? pct(u.tpm / u.tpa) : "—",
      o.tpa ? pct(o.tpm / o.tpa) : "—",
    ],
    ["Free throws", `${u.ftm}/${u.fta}`, `${o.ftm}/${o.fta}`],
    ["Offensive rebounds", u.orb, o.orb],
    ["Defensive rebounds", u.drb, o.drb],
    ["Total rebounds", u.rebounds, o.rebounds],
    ["Turnovers", u.turnovers, o.turnovers],
    ["Assists", u.assists, o.assists],
    ["Steals", u.steals, o.steals],
    ["Blocks", u.blocks, o.blocks],
    ["Personal fouls", u.fouls, o.fouls],
  ];
  return (
    <section className="box-score" aria-label="Team box score">
      <table>
        <thead>
          <tr>
            <th scope="col">Team totals</th>
            <th scope="col">{us.abbreviation}</th>
            <th scope="col">{them.abbreviation}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, a, b]) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              <td>{a}</td>
              <td>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="table-note">
        Supporting stats give context. Only the eight breakdown factors are
        added to the margin.
      </p>
    </section>
  );
}

export default function App() {
  const [date, setDate] = useState(
    initialDate &&
      /^20\d{2}-\d{2}-\d{2}$/.test(initialDate) &&
      Number.isFinite(Date.parse(initialDate))
      ? initialDate
      : today(),
  );
  const [requestedGameId, setRequestedGameId] = useState<string | null>(
    initialQuery.get("game"),
  );
  const [teamId, setTeamId] = useState<string | null>(initialQuery.get("team"));
  const [method, setMethod] = useState(false);
  const [tab, setTab] = useState<"breakdown" | "boxscore">("breakdown");
  const [filter, setFilter] = useState<"all" | "hurt" | "helped">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Record<string, number>>({});
  const [shareMessage, setShareMessage] = useState("");
  const preferRecent = useRef(!initialQuery.has("date"));
  const reduced = useReducedMotion();
  const gamesQuery = useQuery({
    queryKey: ["games", date],
    queryFn: ({ signal }) => get<Game[]>(`/api/games?date=${date}`, signal),
    refetchInterval: 30_000,
  });
  const games = gamesQuery.data?.data || [];
  const gameId =
    games.find((g) => g.id === requestedGameId)?.id ||
    games.find((g) => g.state === "post")?.id ||
    games.find((g) => g.state === "in")?.id ||
    games[0]?.id;
  const detailQuery = useQuery({
    queryKey: ["game", gameId],
    queryFn: ({ signal }) => get<GameDetail>(`/api/games/${gameId}`, signal),
    enabled: !!gameId,
    staleTime: 30_000,
    refetchInterval: (query) => {
      const snapshot = query.state.data?.data;
      if (!snapshot || snapshot.state !== "post") return 30_000;
      const [a, b] = snapshot.teams;
      return a && b && analyze(a, b) ? false : 30_000;
    },
  });
  const detail = detailQuery.data,
    game = detail?.data;
  const us =
    game?.teams.find((t) => t.id === teamId) ||
    game?.teams.slice().sort((a, b) => a.score - b.score)[0];
  const them = game?.teams.find((t) => t.id !== us?.id);
  const analysis =
    us && them && game?.state !== "pre" ? analyze(us, them) : null;
  const visible = analysis
    ? filter === "hurt"
      ? analysis.hurt
      : filter === "helped"
        ? analysis.helped
        : analysis.factors
    : [];
  const recovered =
    analysis?.hurt.reduce(
      (sum, f) => sum + (f.points * (fixes[f.id] || 0)) / 100,
      0,
    ) || 0;
  const best = analysis
    ? analysis.gap >= 0
      ? analysis.hurt[0]
      : analysis.helped[0]
    : null;
  const isLive = game?.state === "in";
  const maxImpact = Math.max(
    1,
    ...(analysis?.factors.map((f) => Math.abs(f.points)) || []),
  );
  let running = 0;
  const chartRows = visible.map((f) => {
    const effective =
      f.points > 0 ? f.points * (1 - (fixes[f.id] || 0) / 100) : f.points;
    running += effective;
    return { factor: f, effective, running };
  });

  useEffect(() => {
    if (!gamesQuery.data || !preferRecent.current) return;
    preferRecent.current = false;
    if (
      date === today() &&
      !gamesQuery.data.data.some((g) => g.state !== "pre")
    )
      setDate(shiftDate(date, -1));
  }, [date, gamesQuery.data]);
  useEffect(() => {
    if (detail)
      setTeamId((current) =>
        detail.data.teams.some((t) => t.id === current)
          ? current
          : [...detail.data.teams].sort((a, b) => a.score - b.score)[0].id,
      );
  }, [detail]);
  useEffect(() => {
    setFixes({});
    setExpanded(null);
    setFilter("all");
  }, [gameId, teamId]);
  useEffect(() => {
    if (detail && teamId && detail.data.id === gameId)
      window.history.replaceState(
        null,
        "",
        `?${new URLSearchParams({ date, game: detail.data.id, team: teamId })}`,
      );
  }, [date, detail, teamId, gameId]);

  const changeDate = (next: string) => {
    preferRecent.current = false;
    setRequestedGameId(null);
    setDate(next);
  };
  const refresh = () => {
    void gamesQuery.refetch();
    if (gameId) void detailQuery.refetch();
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage("Link copied");
    } catch {
      setShareMessage("Copy the link from the address bar");
    }
    window.setTimeout(() => setShareMessage(""), 3500);
  };
  const title =
    analysis?.gap === 0
      ? "The score is level."
      : best
        ? analysis!.gap >= 0
          ? `The difference ${isLive ? "is" : "was"} ${topics[best.id]}.`
          : `The edge ${isLive ? "is" : "was"} ${topics[best.id]}.`
        : "The game, explained.";
  const balance = analysis ? analysis.gap - recovered : 0;

  return (
    <>
      <a className="skip-link" href="#analysis">
        Skip to game analysis
      </a>
      <header className="site-header">
        <div className="wrap header-inner">
          <a className="brand" href="/">
            <h1>How did we lose?</h1>
          </a>
          <nav aria-label="Main navigation">
            <button className="method-nav" onClick={() => setMethod(true)}>
              How it adds up
            </button>
            {game && (
              <a href={game.sourceUrl} target="_blank" rel="noreferrer">
                ESPN box score <ExternalLink size={13} />
              </a>
            )}
            <a
              className="github-link"
              href={REPO}
              target="_blank"
              rel="noreferrer"
            >
              GitHub <ExternalLink size={13} />
            </a>
          </nav>
        </div>
      </header>
      <main className="wrap" id="analysis" tabIndex={-1}>
        <section className="game-tools" aria-label="Choose an NBA game">
          <div className="date-tools">
            <button
              className="icon-button"
              title="Previous day"
              aria-label="Previous day"
              onClick={() => changeDate(shiftDate(date, -1))}
            >
              <ChevronLeft size={17} />
            </button>
            <input
              className="date-input"
              type="date"
              aria-label="Game date, US Eastern time"
              value={date}
              min="2000-01-01"
              max="2099-12-31"
              onChange={(e) => {
                if (e.target.value) changeDate(e.target.value);
              }}
            />
            <button
              className="icon-button"
              title="Next day"
              aria-label="Next day"
              onClick={() => changeDate(shiftDate(date, 1))}
            >
              <ChevronRight size={17} />
            </button>
            {date !== today() && (
              <button
                className="today-button"
                onClick={() => changeDate(today())}
              >
                Today
              </button>
            )}
          </div>
          <div className="game-picker">
            {gamesQuery.isPending ? (
              <GamesSkeleton />
            ) : games.length > 0 ? (
              <select
                aria-label="NBA game"
                value={gameId || ""}
                onChange={(e) => {
                  if (e.target.value !== gameId) {
                    setRequestedGameId(e.target.value);
                    setTeamId(null);
                  }
                }}
              >
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.teams
                      .map(
                        (t) =>
                          `${t.shortName}${g.state === "pre" ? "" : ` ${t.score}`}`,
                      )
                      .join(" · ")}{" "}
                    — {g.status}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          {game && (
            <div className="game-status">
              <span className={`status-dot ${isLive ? "live" : ""}`} />
              <span>
                {detailQuery.isFetching
                  ? "Updating…"
                  : detail?.stale
                    ? "Cached data"
                    : game.status}
              </span>
              <button
                className="icon-button refresh-button"
                aria-label="Refresh box score"
                title="Refresh box score"
                onClick={refresh}
              >
                <RefreshCw size={15} />
              </button>
              <button
                className="icon-button share-button"
                aria-label={shareMessage || "Share breakdown"}
                title={shareMessage || "Share breakdown"}
                onClick={share}
              >
                <Link2 size={16} />
              </button>
            </div>
          )}
        </section>
        {gamesQuery.error && !gamesQuery.data && (
          <div className="error-panel" role="alert">
            <h2>The schedule could not be loaded.</h2>
            <p>{gamesQuery.error.message}</p>
            <button onClick={refresh}>
              Try again <RefreshCw size={15} />
            </button>
          </div>
        )}
        {!gamesQuery.isPending && !gamesQuery.error && games.length === 0 && (
          <section className="empty-games">
            <h2>No games on this date.</h2>
            <p>Choose another date, or revisit the 2025 Finals.</p>
            <button onClick={() => changeDate("2025-06-22")}>
              2025 Finals, Game 7 <ArrowRight size={16} />
            </button>
          </section>
        )}
        {!!gameId && detailQuery.isPending && <AnalysisSkeleton />}
        {detailQuery.error && !detail && (
          <div className="error-panel" role="alert">
            <h2>This box score is unavailable.</h2>
            <p>{detailQuery.error.message}</p>
            <button onClick={refresh}>
              Try again <RefreshCw size={15} />
            </button>
          </div>
        )}
        {game && us && them && (
          <>
            <section className="scoreboard" aria-label="Game result">
              <div className="score-team our-team">
                <Logo team={us} />
                <div>
                  <h2>
                    <span className="team-full">{us.name}</span>
                    <span className="team-short">{us.shortName}</span>
                  </h2>
                  <p>
                    {us.abbreviation} ·{" "}
                    {us.homeAway === "home" ? "Home" : "Away"}
                  </p>
                </div>
              </div>
              <div className="scores">
                <strong className={us.score < them.score ? "loser" : "winner"}>
                  {game.state === "pre" ? "—" : us.score}
                </strong>
                <span className="dash">–</span>
                <strong className={them.score < us.score ? "loser" : "winner"}>
                  {game.state === "pre" ? "—" : them.score}
                </strong>
              </div>
              <div className="score-team opponent-team">
                <Logo team={them} />
                <div>
                  <h2>
                    <span className="team-full">{them.name}</span>
                    <span className="team-short">{them.shortName}</span>
                  </h2>
                  <p>
                    {them.abbreviation} ·{" "}
                    {them.homeAway === "home" ? "Home" : "Away"}
                  </p>
                </div>
              </div>
            </section>
            <div className="game-meta">
              <span>
                {game.note || "NBA"}
                <span
                  className={`result-pill ${us.score > them.score ? "won" : ""}`}
                >
                  {game.state === "pre"
                    ? "Upcoming"
                    : us.score === them.score
                      ? "Tied"
                      : us.score > them.score
                        ? `${isLive ? "Leading" : "Won"} by ${us.score - them.score}`
                        : `${isLive ? "Trailing" : "Lost"} by ${them.score - us.score}`}
                </span>
              </span>
              <span>
                {prettyDate(date)}
                {game.venue && ` · ${game.venue}`}
              </span>
            </div>
            {(detail?.stale || detailQuery.isRefetchError) && (
              <p className="stale-message" role="status">
                The feed could not refresh. Showing the last successful update
                from {new Date(detail!.fetchedAt).toLocaleString()}.
              </p>
            )}
            {game.state === "pre" ? (
              <section className="empty-analysis">
                <h2>This game hasn’t started yet.</h2>
                <p>
                  The breakdown will appear when the box score is available.
                  Choose a completed game to see how it works.
                </p>
              </section>
            ) : !analysis ? (
              <section className="empty-analysis">
                <h2>Waiting for the box score to catch up.</h2>
                <p>
                  The score and shooting stats are incomplete or out of sync.
                  We’ll check again in 30 seconds.
                </p>
                <button onClick={refresh}>
                  Check now <RefreshCw size={15} />
                </button>
              </section>
            ) : (
              <>
                <section className="answer">
                  <div>
                    <h2>{title}</h2>
                    {best ? (
                      <p>
                        {best.comparison}.{" "}
                        <strong
                          className={
                            best.points > 0 ? "cost-text" : "help-text"
                          }
                        >
                          {points(best.points)} equivalent points{" "}
                          {best.points > 0 ? "in costs" : "in offsets"}.
                        </strong>
                        <button
                          className="explain-link"
                          title="Explain the biggest factor"
                          aria-label="Explain the biggest factor"
                          onClick={() => {
                            setTab("breakdown");
                            setFilter("all");
                            setExpanded(best.id);
                            window.requestAnimationFrame(() =>
                              document
                                .getElementById(`factor-${best.id}`)
                                ?.scrollIntoView({
                                  behavior: reduced ? "instant" : "smooth",
                                  block: "nearest",
                                }),
                            );
                          }}
                        >
                          See the calculation <ArrowRight size={14} />
                        </button>
                      </p>
                    ) : (
                      <p>The available factors balance evenly.</p>
                    )}
                  </div>
                  <label className="team-switch">
                    {analysis.gap > 0
                      ? "Explain the loss for"
                      : "Show the game for"}
                    <select
                      aria-label="Your team"
                      value={us.id}
                      onChange={(e) => setTeamId(e.target.value)}
                    >
                      {game.teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>
                <section
                  className="analysis"
                        aria-label="Point impact breakdown"
                >
                  <div className="analysis-heading">
                    <h2>
                      {recovered > 0
                        ? "What if we closed the gaps?"
                        : analysis.gap > 0
                          ? `Where the ${analysis.gap} points went`
                          : analysis.gap < 0
                            ? `Where the ${-analysis.gap}-point edge came from`
                            : "How the factors balanced"}
                    </h2>
                    <div className="content-tabs" aria-label="Analysis view">
                      <button
                        className={tab === "breakdown" ? "active" : ""}
                        onClick={() => setTab("breakdown")}
                      >
                        {tab === "breakdown" && (
                          <motion.span
                            className="tab-selection"
                            layoutId="view-selection"
                          />
                        )}
                        The breakdown <span>{analysis.factors.length}</span>
                      </button>
                      <button
                        className={tab === "boxscore" ? "active" : ""}
                        onClick={() => setTab("boxscore")}
                      >
                        {tab === "boxscore" && (
                          <motion.span
                            className="tab-selection"
                            layoutId="view-selection"
                          />
                        )}
                        Box score
                      </button>
                    </div>
                  </div>
                  {tab === "boxscore" ? (
                    <BoxScore us={us} them={them} />
                  ) : (
                    <>
                      <div className="factor-toolbar">
                        <div className="factor-filters">
                          {(["all", "hurt", "helped"] as const).map((f) => (
                            <button
                              key={f}
                              className={filter === f ? "active" : ""}
                              aria-pressed={filter === f}
                              onClick={() => setFilter(f)}
                            >
                              {filter === f && (
                                <motion.span
                                  className="segment-selection"
                                  layoutId="filter-selection"
                                />
                              )}
                              {f === "all"
                                ? "All factors"
                                : f === "hurt"
                                  ? "Costs"
                                  : "Offsets"}
                            </button>
                          ))}
                        </div>
                        <span>
                          {recovered > 0
                            ? "Scenario values · Original ranking"
                            : "Ranked by impact · Equivalent points"}
                        </span>
                        {recovered > 0 && (
                          <button
                            className="scenario-reset"
                            title="Reset what-if scenario"
                            aria-label="Reset what-if scenario"
                            onClick={() => setFixes({})}
                          >
                            <RotateCcw size={14} />
                            Reset what-if
                          </button>
                        )}
                      </div>
                      <div className="chart-head" aria-hidden="true">
                        <span>
                          {us.shortName} compared with {them.shortName}
                        </span>
                        <div className="chart-axis">
                          <span>Cost</span>
                          <span>0</span>
                          <span>Offset</span>
                        </div>
                        <span className="running-label">
                          {filter === "hurt"
                            ? "Total cost"
                            : filter === "helped"
                              ? "Total offset"
                              : "Running gap"}
                        </span>
                      </div>
                      <div className="factor-list" role="list">
                        {chartRows.map(({ factor, effective, running }) => (
                          <FactorRow
                            key={factor.id}
                            factor={factor}
                            effective={effective}
                            running={running}
                            filter={filter}
                            maxImpact={maxImpact}
                            primary={factor.id === best?.id}
                            expanded={expanded === factor.id}
                            onExpand={() =>
                              setExpanded(
                                expanded === factor.id ? null : factor.id,
                              )
                            }
                            fix={fixes[factor.id] || 0}
                            onFix={(n) =>
                              setFixes((old) => ({ ...old, [factor.id]: n }))
                            }
                          />
                        ))}
                        {visible.length === 0 && (
                          <p className="empty-filter">
                            No {filter === "hurt" ? "costs" : "offsets"} in this
                            snapshot.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </section>
                <div className="bottom-line">
                  <div className="method-links">
                    <button onClick={() => setMethod(true)}>
                      How does a box score become points?{" "}
                      <ArrowRight size={14} />
                    </button>
                    <p>
                      Eight factors, counted once. Totals use unrounded values.
                    </p>
                    <a href={game.sourceUrl} target="_blank" rel="noreferrer">
                      Check the source box score <ExternalLink size={12} />
                    </a>
                  </div>
                  <section
                    className="balance-block"
                    aria-label={
                      recovered > 0 ? "What-if point balance" : "Point balance"
                    }
                  >
                    <div className="point-balance">
                      <div>
                        <strong className="cost-text">
                          {points(analysis.totalHurt - recovered)}
                        </strong>
                        <span>
                          {recovered > 0 ? "Remaining costs" : "Costs"}
                        </span>
                      </div>
                      <span className="math-sign">−</span>
                      <div>
                        <strong className="help-text">
                          {points(analysis.totalHelp)}
                        </strong>
                        <span>Offsets</span>
                      </div>
                      <span className="math-sign">=</span>
                      <div>
                        <strong>{points(balance)}</strong>
                        <span>
                          {recovered > 0
                            ? balance >= 0
                              ? "Adjusted deficit"
                              : "Adjusted advantage"
                            : balance > 0
                              ? isLive
                                ? "Current deficit"
                                : "Final deficit"
                              : balance < 0
                                ? isLive
                                  ? "Current advantage"
                                  : "Final advantage"
                                : "Level"}
                        </span>
                      </div>
                    </div>
                    <p className="balance-note">
                      {recovered > 0
                        ? `+${points(recovered)} equivalent points recovered. An illustration, not a prediction.`
                        : `${Math.min(us.score, them.score)} + ${Math.abs(analysis.gap)} = ${Math.max(us.score, them.score)} · The full margin, accounted for.`}
                    </p>
                  </section>
                </div>
                <AnimatePresence>
                  {recovered > 0 && (
                    <motion.div
                      className="scenario-dock"
                      initial={{ opacity: 0, y: reduced ? 0 : 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: reduced ? 0 : 12 }}
                    >
                      <div>
                        <span>What-if margin</span>
                        <strong>
                          {signed(-balance)} <small>pts</small>
                        </strong>
                      </div>
                      <p>+{points(recovered)} points recovered</p>
                      <button
                        title="Reset what-if scenario"
                        aria-label="Reset what-if scenario"
                        onClick={() => setFixes({})}
                      >
                        <RotateCcw size={17} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </>
        )}
        <p className="schedule-note">
          Schedule dates use US Eastern time. ESPN’s live feed may be delayed.
        </p>
      </main>
      <footer>
        <div className="wrap footer-inner">
          <span>Real NBA data from ESPN · Equivalent-point estimates</span>
          <a href={REPO} target="_blank" rel="noreferrer">
            Open source <ExternalLink size={12} />
          </a>
        </div>
      </footer>
      {method && <Methodology onClose={() => setMethod(false)} />}
      <div className="sr-only" role="status" aria-live="polite">
        {shareMessage}
      </div>
    </>
  );
}

function FactorRow({
  factor: f,
  effective,
  running,
  maxImpact,
  filter,
  primary,
  expanded,
  onExpand,
  fix,
  onFix,
}: {
  factor: Factor;
  effective: number;
  running: number;
  maxImpact: number;
  filter: "all" | "hurt" | "helped";
  primary: boolean;
  expanded: boolean;
  onExpand: () => void;
  fix: number;
  onFix: (n: number) => void;
}) {
  const reduced = useReducedMotion();
  const cost = f.points > 0.049,
    neutral = Math.abs(effective) < 0.049;
  const width = Math.min(100, (Math.abs(effective) / maxImpact) * 100);
  const runningWord =
    filter === "hurt"
      ? "cost"
      : filter === "helped"
        ? "offset"
        : Math.abs(running) < 0.049
          ? "level"
          : running > 0
            ? "behind"
            : "ahead";
  return (
    <article
      className={`factor-card ${cost ? "hurts" : "helps"} ${primary ? "primary-factor" : ""} ${expanded ? "expanded" : ""}`}
      id={`factor-${f.id}`}
      role="listitem"
    >
      <button
        className="factor-main"
        aria-expanded={expanded}
        aria-controls={`detail-${f.id}`}
        onClick={onExpand}
      >
        <span className="factor-description">
          <span className="factor-name">{f.title}</span>
          <span className="factor-comparison">{f.comparison}</span>
        </span>
        <span
          className="impact-track"
          aria-label={`${cost ? "Cost" : "Offset"}: ${points(effective)} equivalent points`}
          style={{ "--w": `${width}%` } as CSSProperties}
        >
          <span className="impact-half cost">
            {cost && (
              <>
                <motion.span
                  className="impact-bar"
                  initial={false}
                  animate={{ scaleX: width / 100 }}
                  transition={{ duration: 0 }}
                />
                <span className="impact-value">
                  {neutral ? "0.0" : signed(-effective)}
                </span>
              </>
            )}
          </span>
          <span className="impact-half help">
            {!cost && (
              <>
                <motion.span
                  className="impact-bar"
                  initial={false}
                  animate={{ scaleX: width / 100 }}
                  transition={{ duration: 0 }}
                />
                <span className="impact-value">
                  {neutral ? "0.0" : signed(-effective)}
                </span>
              </>
            )}
          </span>
        </span>
        <span className="running-gap">
          <strong>{points(running)}</strong>
          <small>{runningWord}</small>
          <ChevronDown size={13} className="expand-chevron" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            className="factor-detail-clip"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: reduced
                ? { duration: 0 }
                : { type: "spring", stiffness: 450, damping: 43 },
              opacity: { duration: 0.15 },
            }}
          >
            <div className="factor-detail" id={`detail-${f.id}`}>
              <p>{f.explanation}</p>
              <p className="formula">
                <strong>The math</strong>
                {f.formula}
              </p>
              {cost && (
                <div className="fix-control">
                  <div>
                    <label htmlFor={`fix-${f.id}`}>Close this gap</label>
                    <span>
                      {fix}% ·{" "}
                      <strong>
                        +{points((f.points * fix) / 100)} pts recovered
                      </strong>
                    </span>
                  </div>
                  <input
                    id={`fix-${f.id}`}
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={fix}
                    onChange={(e) => onFix(Number(e.target.value))}
                    aria-valuetext={`${fix} percent of gap closed, ${points((f.points * fix) / 100)} equivalent points recovered`}
                  />
                  <div className="range-labels">
                    <span>As played</span>
                    <button onClick={() => onFix(100)}>
                      Close the full gap <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
