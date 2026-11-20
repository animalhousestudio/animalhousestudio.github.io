import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import assert from 'node:assert/strict';

const output = process.argv[2];
const edge = process.argv[3];
const closeUp = process.argv[4] === '--close-up';
const base = process.env.CASA3D_REVIEW_URL ?? 'http://127.0.0.1:5187/index.template.html';
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'casa3d-terrain-review-'));
const processEdge = spawn(edge, [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--mute-audio',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling',
  '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
let ws;
let edgeLog = '';
processEdge.stderr.on('data', chunk => { edgeLog = (edgeLog + chunk).slice(-4000); });
const errors = [];
const enabled = { timeout: 240000 };
async function waitFor(fn, label, timeout = enabled.timeout) {
  const stop = Date.now() + timeout;
  while (Date.now() < stop) {
    const value = await fn();
    if (value) return value;
    await sleep(300);
  }
  throw Error('Timed out: ' + label);
}
try {
  const portFile = await waitFor(() => readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => ''), 'Edge debugger', 20000);
  const [port, endpoint] = portFile.trim().split(/\r?\n/);
  ws = new WebSocket('ws://127.0.0.1:' + port + endpoint);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let count = 0;
  const pending = new Map();
  ws.addEventListener('close', () => {
    for (const handler of pending.values()) handler.reject(Error('Edge disconnected\n' + edgeLog));
    pending.clear();
  });
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id != null) {
      const handler = pending.get(message.id);
      if (!handler) return;
      pending.delete(message.id);
      if (message.error) handler.reject(Error(message.error.message));
      else handler.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      errors.push(details.exception?.description ?? details.text);
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      errors.push(message.params.args.map(arg => arg.value ?? arg.description).join(' '));
    }
  });
  function send(method, params = {}, sessionId) {
    const id = ++count;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Error(method + ' timed out\n' + edgeLog));
      }, 60000);
      pending.set(id, {
        resolve(result) { clearTimeout(timer); resolve(result); },
        reject(error) { clearTimeout(timer); reject(error); },
      });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const page = (name, params) => send(name, params, sessionId);
  await Promise.all(['Runtime.enable', 'Page.enable'].map(name => page(name)));
  await page('Emulation.setDeviceMetricsOverride', { width: 960, height: 580, deviceScaleFactor: 1, mobile: false });
  await page('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const evaluate = async expression => {
    const { result, exceptionDetails } = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) throw Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  const diag = `JSON.parse(document.querySelector('[data-testid="world-diagnostics"]')?.dataset.state || '{}')`;
  const read = () => evaluate(diag);
  const go = label => evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent === ${JSON.stringify(label)}).click()`);
  const capture = async name => {
    const { data } = await page('Page.captureScreenshot', { format: 'png', fromSurface: true });
    await writeFile(join(output, name + '.png'), Buffer.from(data, 'base64'));
  };
  await page('Page.navigate', { url: base + '?review&panel&view=terrain' });
  async function sample(label, check) {
    return waitFor(async () => {
      const state = await read();
      if (errors.length) throw Error(JSON.stringify(errors));
      return state.ready && state.performance?.calls > 0 && check(state) && state;
    }, label);
  }
  const report = { browser: 'Edge, SwiftShader', viewport: [960, 580], views: {} };
  await sample('panorama', s => !s.groundDetail?.texture);
  async function record(name) {
    await capture(name);
    const state = await read();
    report.views[name] = {
      calls: state.performance.calls, triangles: state.performance.triangles,
      collisionTriangles: state.collisionTriangles, detail: state.groundDetail,
    };
  }
  await record('panorama');
  await go('Terreno · cratere UFO');
  await sample('UFO detail', s => s.groundDetail?.texture && s.groundDetail.cells.length > 0);
  await record('cratere');
  const camera = async (eye, target) => evaluate(`(() => {
    const {player} = window.__APP;
    const pos = player.camera.position.clone().set(...${JSON.stringify(eye)});
    const [x,y,z] = ${JSON.stringify(target)};
    const dx=x-pos.x, dy=y-pos.y, dz=z-pos.z;
    player.setPosition(pos);
    player.yaw = Math.atan2(dx,dz);
    player.pitch = Math.atan2(dy,Math.hypot(dx,dz));
    player.updateCamera();
  })()`);
  await camera([-44, 7, 186], [-28, 0, 155]);
  await sample('terrain detail near the approach', s => s.groundDetail?.cells.some(id => id === 'ground-2-4'));
  await sleep(2200);
  await record('arrivo');
  if (closeUp) {
    const hasReview = await evaluate(`Array.from(document.querySelectorAll('button')).some(b => b.textContent === 'Terreno · regolite')`);
    if (hasReview) await go('Terreno · regolite');
    else await camera([-36, 2.65, 179], [-40, 0, 173]);
    await sample('regolith close-up', s => s.playerPosition?.[0] === -36 && s.groundDetail?.texture);
    await record('regolite');
  }
  await go('Terreno · panoramica');
  const released = await sample('terrain detail released', s => !s.groundDetail?.texture && !s.groundDetail?.cells.length);
  if (closeUp) {
    report.released = released.groundDetail;
    report.materialRequests = await evaluate(`performance.getEntriesByType('resource')
      .filter(e => e.initiatorType === 'img' && /rock-micro|regolith-detail/.test(e.name))
      .map(e => ({ file: new URL(e.name).pathname.split('/').at(-1), bytes: e.decodedBodySize }))`);
    assert.ok(report.materialRequests.length > 0, 'The optional material tile must load over the network');
  }
  report.surface = await evaluate(`(() => {
    const {scene} = window.__APP;
    const geometry = scene.getObjectByName('Asteroid_Surface').geometry;
    return { vertices:geometry.attributes.position.count, triangles:geometry.index.count/3 };
  })()`);
  report.errors = errors;
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  ws?.close();
  processEdge.kill();
}
