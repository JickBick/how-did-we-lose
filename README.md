# How did we lose?

**The box score, explained.** A small NBA app that turns live and final box scores into a ranked explanation of the scoring margin.

Pick a date, game and team. See the biggest point costs, the things that helped, and an accounting that adds up to the actual margin. Expand a factor to see the math or close 0–100% of the gap in an interactive what-if scenario. Share a link to the same game and perspective.

## Run locally

Node 22.12+ is required (Node 24 is used in production).

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to Express on port 3001.

```sh
npm test
npm run build
npm start
```

Production serves both the app and the API on `PORT` (default 3001). No database or API key is required.

## Railway

The included Dockerfile uses a multi-stage build and runs as a non-root user. `railway.toml` sets `/api/health` as the health check.

```sh
railway login
railway init --name how-did-we-lose
railway add --service web
railway up --service web
railway domain --service web
```

For automatic deploys, connect this GitHub repository to the `web` service in Railway and select `main`. The Dockerfile is detected automatically. Deployment needs no environment variables beyond Railway’s injected `PORT`.

## Data

The server reads ESPN’s public, unauthenticated NBA scoreboard and game-summary endpoints. This is an unofficial integration: ESPN provides no availability guarantee, and the endpoints or data shape may change. Responses are cached in memory, requests are coalesced, and upstream requests time out after 10 seconds. Cache storage is bounded. On upstream failure, a previously fetched response less than 24 hours old is returned with an explicit `stale` flag and timestamp. There is no synthetic/demo data silently substituted for real games.

- `GET /api/games?date=YYYY-MM-DD`: games on the US Eastern schedule date, cached 30 seconds.
- `GET /api/games/:id`: normalized box score, cached 20 seconds for live/upcoming games and one hour for completed games.
- `GET /api/health`: process health.

The browser refreshes games and the selected box score every 30 seconds. ESPN itself may lag. Missing shooting lines and score/stat mismatches show a waiting state instead of a calculation.

## Method

Costs are positive in the model; the UI displays costs with a minus sign and benefits with a plus sign. Reverse team perspective and every factor changes sign.

Scoring is `FGA × field-goal points per attempt + FTA × FT%`. For any product, the exact symmetric split is:

```
Δ(a × b) = Δa × average(b) + average(a) × Δb
```

Field-goal efficiency is split into two-point accuracy, three-point accuracy and three-point attempt share using the same identity. Free-throw scoring is split into attempts and accuracy. A zero-attempt rate uses the other team’s rate (or zero if both teams have zero attempts) to avoid attributing a shooting percentage to an unobserved shot.

Shot-volume difference is allocated to offensive rebounds and turnovers at average field-goal points per attempt. The residual is **possession balance**, which explicitly reconciles the estimated allocations with actual FGA. It includes effects of foul trips, timing, team rebounds and other possession details that cannot be separated from a team box score. These are equivalent-point allocations, not possession-level causal measurements.

Defensive rebounds, assists, steals, blocks, fouls and points off turnovers are not assigned extra points: doing so would count scoring or opportunities again. In particular, total fouls are not a proxy for free-throw opportunities. The actual FTA line is used instead.

The full eight factors add to the scoreboard margin within floating-point precision. Display rounding can differ by 0.1 points. What-if sliders remove a selected fraction of the corresponding model cost; they are illustrations, not predictions of a replayed game. Importance percentages are shares of total costs or total benefits, not shares of the net margin.

## Checks

Tests cover 2,000 randomized score reconciliations, perspective symmetry, zero-attempt games, double-count prevention, live score/stat mismatch handling, upstream normalization, cache behavior, input validation and feed failures.

Built with React, TypeScript, Vite and Express. Fonts: DM Sans and Barlow Condensed (self-hosted). Team logos and game data are supplied by ESPN. This project is independent of the NBA and ESPN.
