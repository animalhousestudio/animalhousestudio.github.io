import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { CAT_CLEARINGS } from '../../src/rooms/catColonyLayout.mjs';

const output = process.argv[2];
const edge = process.argv[3];
const base = 'http://127.0.0.1:5174/index.template.html';
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'casa3d-cats-review-'));
const processEdge = spawn(edge, [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--mute-audio',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling',
  '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
let ws;
let edgeLog = '';
processEdge.stderr.on('data', chunk => { edgeLog = (edgeLog + chunk).slice(-4000); });
const errors = [];
const requests = [];
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
    if (message.method === 'Network.responseReceived' && /toon_cat_free.*\.glb$/.test(message.params.response.url)) {
      requests.push({ url: message.params.response.url, status: message.params.response.status });
    }
  });
  function send(method, params = {}, sessionId) {
    const id = ++count;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Error(method + ' timed out\n' + edgeLog));
      }, 30000);
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
  await Promise.all(['Runtime.enable', 'Page.enable', 'Network.enable'].map(name => page(name)));
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
  await page('Page.navigate', { url: base + '?review' });
  async function sample(label, check) {
    return waitFor(async () => {
      const state = await read();
      if (errors.length || state.cats?.failed) throw Error(JSON.stringify({ errors, cats: state.cats }));
      return state.cats?.ready && check(state) && state;
    }, label);
  }
  await waitFor(() => evaluate("Boolean(document.querySelector('.arrival-splash__start:not([disabled]):not([hidden])'))"), 'landing ready');
  assert.equal(requests.length, 0, 'loading the landing screen must not request cats');
  await evaluate("document.querySelector('.arrival-splash__start').click()");
  const first = await sample('cats visible after a normal landing', s => s.cats?.visible.some(cat => cat.clearing === 'arrival'));
  assert.equal(first.cats.count, 24, JSON.stringify(first.cats));
  assert.deepEqual(first.cats.visible.map(cat => cat.id), ['cat-1']);
  const report = { browser: 'Edge, SwiftShader', viewport: [960, 580],
    landing: { requestedBeforeLanding: false, cats: first.cats.visible }, sections: {}, errors, requests };
  await capture('landing');
  for (const { id, label, catIds } of CAT_CLEARINGS) {
    await go('Gatti · ' + label);
    const state = await sample(id, s => s.cats.visible.filter(cat => cat.clearing === id).length === catIds.length);
    report.sections[id] = { cats: state.cats.visible, performance: state.performance };
    await capture(id);
  }
  await go('Gatti · Pulizia');
  await evaluate('window.__APP.reviewCats({ id: "cat-1", action: "groom", seconds: 0.31 })');
  await sample('washing close-up', s => s.cats.visible.some(cat => cat.id === 'cat-1' && cat.action === 'groom'));
  await capture('groom');
  await go('Gatti · Riposo');
  await sample('resting close-up', s => s.cats.visible.some(cat => cat.id === 'cat-1' && cat.action === 'rest'));
  await capture('rest');
  await go('Gatti · Arrivo');
  await evaluate('window.__APP.reviewCats({ seconds: 0 })');
  await sleep(1500);
  const visible = await sample('count cats on', s => s.cats.visible.length === 1);
  await evaluate('window.__APP.reviewCats({ visible: false })');
  const hidden = await sample('count cats off', s => s.cats.visible.length === 0);
  const calls = visible.performance.calls - hidden.performance.calls;
  const triangles = visible.performance.triangles - hidden.performance.triangles;
  assert.equal(calls, 2, JSON.stringify({ visible: visible.performance, hidden: hidden.performance }));
  assert.equal(triangles, 2638);
  assert.equal(visible.collisionTriangles, hidden.collisionTriangles);
  report.comparison = { visible: visible.performance, hidden: hidden.performance, calls, triangles };
  await page('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await evaluate('window.__APP.reviewCats({ seconds: 0 })');
  const start = await sample('start walking', s => s.cats.visible.some(cat => cat.id === 'cat-1' && cat.action === 'walk'));
  await evaluate('window.__APP.reviewCats({ seconds: 3 })');
  const moved = await sample('cat walks around the clearing', s => s.cats.visible.some(cat => cat.id === 'cat-1'
    && Math.hypot(cat.position[0] - start.cats.visible.find(c => c.id === 'cat-1').position[0],
      cat.position[2] - start.cats.visible.find(c => c.id === 'cat-1').position[2]) > .85));
  assert.ok(moved.cats.evaluations > start.cats.evaluations);
  await evaluate('window.__APP.reviewCats()');
  await sleep(2000);
  const animationA = await read();
  const animationB = await sample('live pose updates', s => s.cats.evaluations > animationA.cats.evaluations + 3);
  report.animation = { evaluations: [animationA.cats.evaluations, animationB.cats.evaluations] };
  assert.equal(requests.filter(r => r.status === 200).length, 1);
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ sections: Object.keys(report.sections), calls, triangles }));
} finally {
  ws?.close();
  processEdge.kill();
}
