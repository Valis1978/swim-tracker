import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { roleToken, roleForToken, roleForPin, SESSION_SECONDS } from '../src/lib/session.ts';
import { createPinLimiter, readPin } from '../src/lib/pin-security.ts';
import { safeLoginPath } from '../src/lib/login-path.ts';

const env = { AUTH_SECRET: 'synthetic-secret-for-local-security-tests', PARENT_PIN: '1234', KID_PIN: '5678' };
const now = 1_790_000_000_000;

test('signed sessions retain their role and expire on the server', () => {
  for (const role of ['parent', 'kid']) {
    const token = roleToken(role, env, now);
    assert.equal(roleForToken(token, env, now), role);
    assert.equal(roleForToken(token, env, now + SESSION_SECONDS * 1000), null);
    assert.equal(roleForToken(token, env, now - 1000), null);
  }
});
test('session rejects role/signature tampering and secret/PIN rotation', () => {
  const token = roleToken('kid', env, now);
  assert.equal(roleForToken(token.replace('.kid.', '.parent.'), env, now), null);
  assert.equal(roleForToken(token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a'), env, now), null);
  assert.equal(roleForToken(token, { ...env, KID_PIN: '9999' }, now), null);
  assert.equal(roleForToken(token, { ...env, AUTH_SECRET: 'another-synthetic-secret-for-tests' }, now), null);
});
test('missing and short secrets or missing role PIN fail closed; legacy fallback never works', () => {
  const legacy = createHash('sha256').update('parent::swim-tracker').digest('hex');
  assert.equal(roleForToken(legacy, {}, now), null);
  for (const bad of [{}, { ...env, AUTH_SECRET: 'short' }, { ...env, AUTH_SECRET: undefined }, { ...env, PARENT_PIN: '' }]) {
    assert.equal(roleForToken(roleToken('parent', env, now), bad, now), null);
    assert.equal(roleForPin('1234', bad), null);
    assert.throws(() => roleToken('parent', bad, now));
  }
  assert.equal(roleForPin('1234', env), 'parent');
  assert.equal(roleForPin('5678', env), 'kid');
  assert.equal(roleForPin('nope', env), null);
});
test('shared login limit blocks attempt 11 and recovers after 15 minutes', () => {
  let tick = now;
  const take = createPinLimiter(() => tick);
  for (let n = 0; n < 10; n++) assert.equal(take(), 0);
  assert.equal(take(), 900);
  tick += 899_000; assert.equal(take(), 1);
  tick += 1000; assert.equal(take(), 0);
});
test('bounded JSON accepts real PIN strings but rejects malformed, non-string and oversized payloads', async () => {
  const req = body => new Request('https://local.test/api/pin', { method: 'POST', body });
  assert.equal(await readPin(req('{"pin":"1234"}')), '1234');
  for (const body of ['null', '{', '[]', '{"pin":1234}', '{"pin":{}}', JSON.stringify({ pin: 'x'.repeat(129) }), JSON.stringify({ pin: '1234', extra: 'č'.repeat(1024) })]) {
    assert.equal(await readPin(req(body)), null);
  }
});
test('chunked PIN request is capped even without a Content-Length header', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('{"pin":"' + 'x'.repeat(1024))); },
    cancel() { cancelled = true; },
  });
  const request = new Request('https://local.test/api/pin', { method: 'POST', body: stream, duplex: 'half' });
  assert.equal(await readPin(request), null);
  assert.equal(cancelled, true);
});
test('return path rejects JavaScript, external URLs, encoded separators and unrecognized paths', () => {
  for (const path of ['javascript:alert(1)', 'https://other.test/', '//other.test/', '/\\other.test', '/%2f%2fother.test', '/viki?next=bad', '/api/sync', null]) assert.equal(safeLoginPath(path), '/viki');
  for (const path of ['/', '/prehled', '/prehled/duel', '/nastaveni', '/plavec/fixture-id', '/dalkove']) assert.equal(safeLoginPath(path), path);
});
