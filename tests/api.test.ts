import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app';

test('API validates input, caches upstream requests, and serves health', async () => {
  let calls = 0;
  const mock = (async () => { calls++; return Response.json({ events: [] }); }) as typeof fetch;
  const server = createApp(mock).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(`${url}/api/health`)).status, 200);
    for (const date of ['2026-02-30', '2026-13-01', 'nope']) assert.equal((await fetch(`${url}/api/games?date=${date}`)).status, 400);
    assert.equal((await fetch(`${url}/api/games/hello`)).status, 400);
    const a = await (await fetch(`${url}/api/games?date=2025-06-22`)).json();
    const b = await (await fetch(`${url}/api/games?date=2025-06-22`)).json();
    assert.deepEqual(a.data, []);
    assert.equal(a.fetchedAt, b.fetchedAt);
    assert.equal(calls, 1);
    assert.equal((await fetch(`${url}/api/not-found`)).status, 404);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('upstream errors have a useful error response rather than fabricated games', async () => {
  const server = createApp((async () => new Response('', { status: 503 })) as typeof fetch).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const r = await fetch(`http://127.0.0.1:${address.port}/api/games?date=2025-06-22`);
    assert.equal(r.status, 502);
    assert.match((await r.json()).error, /timeout/i);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
