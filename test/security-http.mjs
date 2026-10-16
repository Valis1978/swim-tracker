import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { roleToken } from '../src/lib/session.ts';

// Start the built app with synthetic credentials and no data-service credentials.
const portServer = createServer();
await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
const port = portServer.address().port;
await new Promise(resolve => portServer.close(resolve));
const auth = { AUTH_SECRET: 'synthetic-http-regression-session-secret', PARENT_PIN: '1234', KID_PIN: '5678' };
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], {
  env: { PATH: process.env.PATH, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', ...auth },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });
const base = `http://127.0.0.1:${port}`;
const request = (path, init = {}) => fetch(base + path, { redirect: 'manual', ...init });
const cookie = role => `swim_auth=${roleToken(role, auth)}`;
try {
  let ready = false;
  for (let n = 0; n < 150; n++) {
    try { if ((await request('/pin')).status === 200) { ready = true; break; } } catch {}
    if (child.exitCode !== null) break;
    await delay(100);
  }
  assert.ok(ready, 'App failed to start: ' + output.slice(-2000));

  for (const path of ['/viki', '/zavody', '/dalkove', '/rekordy', '/zavod/1', '/prehled', '/nastaveni', '/plavec/synthetic']) {
    const res = await request(path);
    assert.equal(res.status, 307, path);
    assert.equal(new URL(res.headers.get('location'), base).pathname, '/pin');
  }
  for (const path of ['/api/compare', '/api/swimmer-races', '/api/sync-now', '/api/settings']) {
    const method = path === '/api/sync-now' || path === '/api/settings' ? 'POST' : 'GET';
    assert.equal((await request(path, { method })).status, 401, path);
    assert.equal((await request(path, { method, headers: { cookie: cookie('kid') } })).status, 403, path);
  }
  assert.equal((await request('/api/sync', { method: 'POST' })).status, 401);
  const kidPage = await request('/prehled', { headers: { cookie: cookie('kid') } });
  assert.equal(kidPage.status, 307);
  assert.equal(new URL(kidPage.headers.get('location'), base).pathname, '/viki');
  // kid may open race detail pages, never parent-only paths dressed up as one
  const kidRace = await request('/zavod/abc', { headers: { cookie: cookie('kid') } });
  assert.equal(kidRace.status, 307);
  assert.equal(new URL(kidRace.headers.get('location'), base).pathname, '/viki');
  assert.equal((await request('/api/compare', { headers: { cookie: cookie('kid').replace('.kid.', '.parent.') } })).status, 401);

  const login = pin => request('/api/pin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin }) });
  const loggedIn = await login('1234');
  assert.equal(loggedIn.status, 200);
  assert.equal((await loggedIn.json()).role, 'parent');
  assert.match(loggedIn.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(loggedIn.headers.get('set-cookie'), /Secure/i);
  assert.match(loggedIn.headers.get('set-cookie'), /SameSite=lax/i);
  assert.equal(loggedIn.headers.get('cache-control'), 'no-store');
  const issuedCookie = loggedIn.headers.get('set-cookie').split(';')[0];
  // Valid parent reaches validation; invalid ID prevents any CSPS or DB call.
  const parentRequest = await request('/api/swimmers', { method: 'POST', headers: { cookie: issuedCookie, 'content-type': 'application/json' }, body: '{"cspsUserId":0}' });
  assert.equal(parentRequest.status, 400);
  assert.match((await parentRequest.json()).error, /Neplatné ID/);
  const kidLogin = await login('5678');
  assert.equal(kidLogin.status, 200); assert.equal((await kidLogin.json()).role, 'kid');

  for (let n = 0; n < 8; n++) {
    assert.equal((await request('/api/pin', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `192.0.2.${n}` }, body: '{"pin":"wrong"}' })).status, 401);
  }
  const limited = await login('1234');
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  console.log('HTTP security regression PASS: anonymous/kid/parent boundaries, signed cookies, sync denial and spoof-resistant PIN limit.');
} finally {
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(3000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}
