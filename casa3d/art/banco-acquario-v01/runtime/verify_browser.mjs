import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import assert from 'node:assert/strict';

const output = process.argv[2];
const edge = process.argv[3];
const base = 'http://127.0.0.1:4186/casa3d/';
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(output, 'edge-profile-'));
const processEdge = spawn(edge, [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--mute-audio',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling',
  '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank',
], { stdio: 'ignore', windowsHide: true });
let ws;
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
    if (message.method === 'Network.responseReceived' && /banco-acquario.*\.glb$/.test(message.params.response.url)) {
      requests.push({ url: message.params.response.url, status: message.params.response.status });
    }
  });
  function send(method, params = {}, sessionId) {
    const id = ++count;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const page = (name, params) => send(name, params, sessionId);
  await Promise.all(['Runtime.enable', 'Page.enable', 'Network.enable'].map(name => page(name)));
  await page('Page.addScriptToEvaluateOnNewDocument', { source: `
    // Advance the same gameplay frame delta, at most .05 s per frame.
    const realNow = performance.now.bind(performance);
    performance.now = () => realNow() * (window.__fishRideQa ? 3 : 1);
  ` });
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
  await page('Page.navigate', { url: base + '?review&view=fish-outbound' });
  const first = await waitFor(async () => {
    const info = await read();
    if (errors.length || info.fishSchool?.failed) throw Error(JSON.stringify({ errors, info }));
    return info.fishSchool?.visible && info.coaster?.underwater && info;
  }, 'fish GLB and underwater tunnel');
  const report = { browser: 'Edge, rendering software', viewport: [960, 580], sections: {}, errors, requests };
  async function sample(key, label, condition) {
    if (label) await go(label);
    const state = await waitFor(async () => {
      const s = await read();
      return s.coaster?.underwater && s.fishSchool?.visible && condition(s.fishSchool) && s;
    }, key);
    await sleep(700);
    await capture(key);
    report.sections[key] = { ...state.fishSchool, performance: state.performance };
  }
  await sample('andata', null, fish => fish.position[0] > -117 && Math.cos(fish.yaw) > .9);
  await sample('ritorno', 'Pesci · corridoio ritorno', fish => fish.position[0] < -123 && Math.cos(fish.yaw) < -.9);
  await sample('primo-laghetto', 'Pesci · primo laghetto', fish => fish.position[2] < 19);
  await sample('secondo-laghetto', 'Pesci · secondo laghetto', fish => fish.position[2] > 76);
  const visible = await read();
  await evaluate(`window.__APP.reviewFish({ seconds: ${visible.fishSchool.seconds}, visible: false })`);
  const hidden = await waitFor(async () => {
    const s = await read();
    return s.fishSchool && !s.fishSchool.visible && s;
  }, 'culled school');
  assert.equal(visible.performance.calls - hidden.performance.calls, 1);
  assert.equal(visible.performance.triangles - hidden.performance.triangles, 22641);
  report.delta = { calls: 1, triangles: 22641 };
  await go('Pesci · giro completo');
  const moving = await waitFor(async () => {
    const s = await read();
    return s.fishSchool?.visible && s;
  }, 'moving school');
  const advanced = await waitFor(async () => {
    const s = await read();
    return s.fishSchool?.visible && s.fishSchool.evaluations > moving.fishSchool.evaluations + 3 && s;
  }, 'animated school');
  assert.notDeepEqual(advanced.fishSchool.position, moving.fishSchool.position);
  report.animated = true;
  report.duration = first.fishSchool.duration;
  assert.equal(requests.filter(r => r.status === 200).length, 1);
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  await go('Giostra · partenza');
  await waitFor(async () => (await read()).coaster?.available, 'boardable coaster', 12000);
  await page('Input.dispatchKeyEvent', { type: 'keyDown', key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69 });
  await page('Input.dispatchKeyEvent', { type: 'keyUp', key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69 });
  await waitFor(() => evaluate("Boolean(document.querySelector('dialog[open] [data-ride=yes]'))"), 'boarding confirmation', 10000);
  await evaluate("document.querySelector('dialog[open] [data-ride=yes]').click(); window.__fishRideQa = true;");
  await evaluate("(() => {\n const {renderer,camera}=window.__APP;\n const draw=renderer.render;\n renderer.render=function(scene,view) {\n   const {x,y,z}=camera.position;\n   if (Math.abs(x+120)>4.25||y>=-5||z<17||z>78) return;\n   const output=draw.call(this,scene,view);\n   const school=scene.getObjectByName('PondFishSchoolMesh');\n   if (school?.visible && school.position.z-z>4.5 && school.position.z-z<8.0) {\n     const state=JSON.parse(document.querySelector('[data-testid=world-diagnostics]').dataset.state);\n     window.__fishRideCapture={png:renderer.domElement.toDataURL('image/png'),\n       progress:state.coaster.progress, fish:school.position.toArray(), eye:camera.position.toArray()};\n     renderer.render=draw;\n   }\n   return output;\n };\n return true;\n})()");
  console.log('Boarded the moving coaster.');
  const ride = await waitFor(async () => {
    if (errors.length) throw Error(errors.join('; '));
    return evaluate('window.__fishRideCapture');
  }, 'first-person carriage within 8 metres of the visible school', 175000);
  assert.ok(ride.fish[0] > -117 && ride.fish[2] - ride.eye[2] < 8);
  await writeFile(join(output, 'giostra-in-movimento.png'), Buffer.from(ride.png.split(',')[1], 'base64'));
  report.realRide = { progress: ride.progress, fish: ride.fish, eye: ride.eye,
    coastUnderwater: true, acceleratedClock: true, skipExteriorDraw: true };
  await writeFile(join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ liveRide: report.realRide, sections: Object.keys(report.sections), duration: report.duration, delta: report.delta, requests }));
} finally {
  ws?.close();
  processEdge.kill();
}
