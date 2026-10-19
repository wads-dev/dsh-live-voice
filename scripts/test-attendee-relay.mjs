import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../packages/live-voice/package.json', import.meta.url));
const { WebSocket } = require('ws');
const name = 'dlv-relay-test-' + randomBytes(6).toString('hex');
const image = process.env.DSH_ATTENDEE_IMAGE || 'attendee-local:arm64';
const assets = fileURLToPath(new URL('../packages/live-voice/deploy/attendee/', import.meta.url));
const child = spawn(
  'docker',
  [
    'run',
    '--rm',
    '--name',
    name,
    '--entrypoint',
    'python',
    '-p',
    '127.0.0.1::18765',
    '-p',
    '127.0.0.1::18766',
    '-v',
    assets + ':/dsh:ro',
    image,
    '/dsh/cross_runtime_fixture.py',
  ],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
);
let output = '',
  errors = '';
child.stdout.on('data', (data) => {
  output = (output + data).slice(-16000);
});
child.stderr.on('data', (data) => {
  errors = (errors + data).slice(-16000);
});
const exited = once(child, 'exit');
const abort = new AbortController();
const deadline = setTimeout(() => abort.abort(), 30000);
let hub;
try {
  await new Promise((resolve, reject) => {
    const onData = () => {
      if (output.includes('fixture-ready')) {
        cleanup();
        resolve();
      }
    };
    const onExit = (code) => {
      cleanup();
      reject(Error('Fixture exited ' + code + ': ' + errors));
    };
    const onAbort = () => {
      cleanup();
      reject(Error('Fixture startup deadline'));
    };
    const cleanup = () => {
      child.stdout.off('data', onData);
      child.off('exit', onExit);
      abort.signal.removeEventListener('abort', onAbort);
    };
    child.stdout.on('data', onData);
    child.once('exit', onExit);
    abort.signal.addEventListener('abort', onAbort, { once: true });
    if (abort.signal.aborted) onAbort();
    else if (child.exitCode !== null) onExit(child.exitCode);
    else onData();
  });
  const ports = JSON.parse(
    execFileSync('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', name], {
      encoding: 'utf8',
    }),
  );
  const tlsPort = ports['18765/tcp'][0].HostPort,
    descriptorPort = ports['18766/tcp'][0].HostPort;
  const compile = async (entry) => {
    const result = await build({
      absWorkingDir: root,
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      format: 'esm',
      write: false,
      packages: 'external',
    });
    return import(
      'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')
    );
  };
  const { connectAttendeeRelay } = await compile(
    'packages/live-voice/src/app/server/attendeeRelay.ts',
  );
  const { AttendeeHub } = await compile(
    'packages/live-voice/src/modules/conversation/models/AttendeeHub.ts',
  );
  hub = new AttendeeHub();
  const session = hub.open();
  class RoutedWebSocket extends WebSocket {
    constructor(url, options) {
      assert.equal(url, 'wss://127.0.0.1:18765/v1/receive');
      assert.equal(options.rejectUnauthorized, true);
      super('wss://127.0.0.1:' + tlsPort + '/v1/receive', options);
    }
  }
  const fetcher = (url, options) => {
    assert.equal(url, 'http://127.0.0.1:18766/v1/descriptor');
    return fetch('http://127.0.0.1:' + descriptorPort + '/v1/descriptor', options);
  };
  await connectAttendeeRelay(
    'cross-runtime-test-key',
    hub,
    session,
    async () => ({ WebSocket: RoutedWebSocket }),
    fetcher,
    abort,
  );
  const audio = new Promise((resolve, reject) => {
    const inspect = () => {
      if (hub.read(0).events.length === 2) {
        cleanup();
        resolve();
      }
    };
    const cancel = () => {
      cleanup();
      reject(Error('Audio deadline'));
    };
    const cleanup = () => {
      session.socket.off('message', inspect);
      abort.signal.removeEventListener('abort', cancel);
    };
    session.socket.on('message', inspect);
    abort.signal.addEventListener('abort', cancel, { once: true });
    inspect();
  });
  await audio;
  const batch = hub.read(0);
  assert.deepEqual(
    batch.events.map((event) => event.participantId),
    ['device/python-one', 'device/python-two'],
  );
  assert.equal(batch.events[0].chunk, 'AID/fw==');
  abort.abort();
  hub.close();
  const [code] = await exited;
  assert.equal(code, 0, errors);
  assert.ok(output.includes('producer-revoked'));
  console.log(
    'PASS: real Node host → Docker Python TLS relay → two UUID PCM messages → producer revocation',
  );
  console.log(
    'API admission is a test fixture; no production services or meeting bots were touched.',
  );
} finally {
  clearTimeout(deadline);
  abort.abort();
  hub?.close();
  if (child.exitCode === null) {
    try {
      execFileSync('docker', ['stop', '--time', '2', name], { stdio: 'ignore', timeout: 5000 });
    } catch {}
    child.kill('SIGTERM');
  }
}
