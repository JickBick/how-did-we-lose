import express from 'express';
import path from 'node:path';
import { detailFrom, gameFrom } from './espn';

type CacheEntry = { data: unknown; time: number; expires: number };
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

export function createApp(fetcher: typeof fetch = fetch) {
  const app = express();
  app.disable('x-powered-by');
  const cache = new Map<string, CacheEntry>();
  const inFlight = new Map<string, Promise<unknown>>();

  async function cached(key: string, load: () => Promise<{ data: unknown; ttl: number }>) {
    const old = cache.get(key);
    if (old && old.expires > Date.now()) return { data: old.data, fetchedAt: new Date(old.time).toISOString(), stale: false };
    if (inFlight.has(key)) return inFlight.get(key);
    const promise = (async () => {
      try {
        const { data, ttl } = await load();
        const time = Date.now();
        cache.delete(key);
        cache.set(key, { data, time, expires: time + ttl });
        if (cache.size > 250) cache.delete(cache.keys().next().value!);
        return { data, fetchedAt: new Date(time).toISOString(), stale: false };
      } catch (error) {
        if (old && Date.now() - old.time < 86_400_000) return { data: old.data, fetchedAt: new Date(old.time).toISOString(), stale: true };
        throw error;
      } finally { inFlight.delete(key); }
    })();
    inFlight.set(key, promise);
    return promise;
  }

  async function upstream(url: string) {
    const res = await fetcher(url, { signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`ESPN returned ${res.status}`);
    return res.json();
  }

  app.get('/api/health', (_req, res) => { res.json({ ok: true }); });
  app.get('/api/games', async (req, res) => {
    const date = req.query.date;
    if (typeof date !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
      res.status(400).json({ error: 'Choose a valid date (YYYY-MM-DD).' }); return;
    }
    try {
      res.json(await cached(`games:${date}`, async () => {
        const raw = await upstream(`${ESPN}/scoreboard?dates=${date.replaceAll('-', '')}&limit=50`);
        if (!Array.isArray(raw.events)) throw new Error('Scoreboard is temporarily unavailable');
        return { data: raw.events.map(gameFrom), ttl: 30_000 };
      }));
    } catch { res.status(502).json({ error: 'The NBA feed is taking a timeout. Please try again in a moment.' }); }
  });
  app.get('/api/games/:id', async (req, res) => {
    if (!/^\d{6,12}$/.test(req.params.id)) { res.status(400).json({ error: 'Invalid game ID.' }); return; }
    try {
      res.json(await cached(`game:${req.params.id}`, async () => {
        const raw = await upstream(`${ESPN}/summary?event=${req.params.id}`);
        const data = detailFrom(raw);
        return { data, ttl: data.state === 'post' ? 3_600_000 : 20_000 };
      }));
    } catch { res.status(502).json({ error: 'This box score isn’t available right now. Try refreshing or choose another game.' }); }
  });
  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Endpoint not found.' }); });
  app.use(express.static(path.resolve('dist'), { maxAge: '1h' }));
  app.get('/', (_req, res) => { res.sendFile(path.resolve('dist/index.html')); });
  return app;
}
