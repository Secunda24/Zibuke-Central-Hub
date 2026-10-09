const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { AccessToken } = require('livekit-server-sdk');

function loadRoute(file, { session = { userId: 'account-a' }, config = {}, changes = 1, canAccessRoom = true } = {}) {
  const queries = [];
  const env = {
    LIVEKIT_API_KEY: 'test-key', LIVEKIT_API_SECRET: 'test-secret-for-call-regression-tests',
    NEXT_PUBLIC_LIVEKIT_URL: 'wss://test.livekit.cloud',
    DB: { prepare(sql) {
      const query = { sql, args: [] };
      queries.push(query);
      return { bind(...args) {
        query.args = args;
        return { first: async () => { if(sql.includes('SELECT caller_id FROM call_signals') || sql.includes('SELECT id FROM events') || sql.includes('SELECT e.id FROM events')) return null; if(sql.includes('SELECT id FROM call_signals')) return canAccessRoom ? {id:'allowed'} : null; return {id:session?.userId,first_name:'Same',last_name:'Name'}; },
          all: async () => ({ results: [] }), run: async () => ({ meta: { changes } }) };
      } };
    } }, ...config,
  };
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, URL, crypto: require('node:crypto').webcrypto, process: { env: {} }, require(name) {
    if (name === 'livekit-server-sdk') return { AccessToken };
    if (name === 'next/server') return { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200, headers: options.headers }) } };
    if (name === '@opennextjs/cloudflare') return { getCloudflareContext: async () => ({ env }) };
    if (name.endsWith('/auth/session')) return { verifySession: async () => session };
    throw new Error(`Unexpected import ${name}`);
  } });
  return { route: exports, queries };
}
const request = (query = '', body = {}) => ({ nextUrl: new URL(`https://app.example/api?${query}`), cookies: {}, json: async () => body });
const claims = response => JSON.parse(Buffer.from(response.body.token.split('.')[1], 'base64url').toString());
const tokenFile = 'app/api/livekit/route.ts';
const signalFile = 'app/api/calls/signal/route.ts';

test('two accounts with the same display name receive distinct LiveKit identities', async () => {
  const a = await loadRoute(tokenFile).route.GET(request('room=shared&username=forged'));
  const b = await loadRoute(tokenFile, { session: { userId: 'account-b' } }).route.GET(request('room=shared'));
  assert.equal(a.status, 200);
  assert.equal(claims(a).sub, 'account-a');
  assert.equal(claims(b).sub, 'account-b');
  assert.equal(claims(a).name, claims(b).name);
  assert.equal(claims(a).video.room, 'shared');
  assert.equal(claims(a).video.canPublish, true);
  assert.equal(claims(a).video.canSubscribe, true);
  assert.equal(a.body.serverUrl, 'wss://test.livekit.cloud');
  assert.equal(a.headers['Cache-Control'], 'no-store');
});
test('anonymous callers cannot obtain a room token', async () => {
  assert.equal((await loadRoute(tokenFile, { session: null }).route.GET(request('room=shared'))).status, 401);
});
test('missing room or runtime credentials return actionable errors', async () => {
  assert.equal((await loadRoute(tokenFile).route.GET(request())).status, 400);
  assert.equal((await loadRoute(tokenFile, { config: { LIVEKIT_API_SECRET: undefined } }).route.GET(request('room=shared'))).status, 503);
});
test('invitation preserves the exact room and derives caller from the session', async () => {
  const { route, queries } = loadRoute(signalFile);
  const response = await route.POST(request('', { callerId: 'forged', callerName: 'Forged', targetUserId: 'account-b', roomName: 'unique-room-123' }));
  assert.equal(response.status, 200);
  assert.equal(response.body.roomName, 'unique-room-123');
  const insert = queries.find(q => q.sql.startsWith('INSERT'));
  assert.equal(insert.args[1], 'account-a');
  assert.equal(insert.args[4], 'unique-room-123');
});
test('incoming calls are scoped to the signed-in account', async () => {
  const { route, queries } = loadRoute(signalFile);
  await route.GET(request('userId=other-account'));
  assert.equal(queries[0].args[0], 'account-a');
});
test('acceptance is recipient-scoped and stale invitations cannot be accepted', async () => {
  const { route, queries } = loadRoute(signalFile);
  assert.equal((await route.PATCH(request('', { signalId: 'signal', status: 'answered' }))).status, 200);
  assert.equal(queries[0].args[2], 'account-a');
  assert.match(queries[0].sql, /target_user_id = \?/);
  assert.equal((await loadRoute(signalFile, { changes: 0 }).route.PATCH(request('', { signalId: 'signal', status: 'answered' }))).status, 409);
  assert.equal((await route.PATCH(request('', { signalId: 'signal', status: 'invalid' }))).status, 400);
});

test('uninvited accounts cannot obtain private room tokens',async()=>{assert.equal((await loadRoute(tokenFile,{canAccessRoom:false}).route.GET(request('room=private'))).status,403);});
