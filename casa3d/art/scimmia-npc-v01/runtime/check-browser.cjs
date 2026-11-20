const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const base = process.env.SCIMMIA_BASE || 'http://127.0.0.1:5194/index.template.html';
const output = path.join(__dirname,'../../scimmia-npc-v03/percorso-completo');
const manifest = require('../../scimmia-npc-v03/runtime-export.json');
const viewport = { width: 1080, height: 720 };
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
const diagnostics = '[data-testid="world-diagnostics"]';
const timeout = { timeout: 90000 };
const isNpcRequest = request => request.resourceType() !== 'script'
  && /\/scimmia-npc(?:-[a-z0-9_-]+)?\.glb$/i.test(new URL(request.url()).pathname);

function waitForPhase(page, phase, post) {
  return page.waitForFunction(({ diagnostics, phase, post }) => {
    const state = JSON.parse(document.querySelector(diagnostics)?.dataset.state || '{}').scimmia;
    return state?.phase === phase && (post === undefined || state.post === post);
  }, { diagnostics,phase,post },timeout);
}

function read(page) {
  return page.locator(diagnostics).evaluate(el => JSON.parse(el.dataset.state));
}

async function measure(page, visible) {
  await page.evaluate(visible => window.__APP.reviewScimmia({ freeze:true,visible }),visible);
  await pause(2200);
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const data = await read(page);
    assert.equal(data.scimmia.visible,visible);
    samples.push({ ...data.performance, geometryCount:data.geometryCount,
      textureCount:data.textureCount, collisionTriangles:data.collisionTriangles });
    await pause(1050);
  }
  return samples;
}

(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const errors = [];
  try {
    await fs.mkdir(output,{recursive:true});
    const follow = await browser.newPage({viewport,reducedMotion:'reduce'});
    follow.on('pageerror',error => errors.push(error.message));
    await follow.goto(base+'?review&view=monkey');
    await waitForPhase(follow,'walk');
    await follow.screenshot({path:path.join(output,'walk.png')});
    const { scimmia: { posts } } = await read(follow);
    const order = posts.map(post => post.id);
    assert.equal(order.length,25);
    assert.deepEqual(order.slice(0,5),['176:1','175:1','175:-1','174:-1','174:1']);
    const holds = [];
    await waitForPhase(follow,'grip',order[0]);
    await follow.evaluate(() => window.__APP.reviewScimmia({ freeze:true }));
    await follow.screenshot({path:path.join(output,'grip-first.png')});
    holds.push((await read(follow)).scimmia.hold);
    const visible = await measure(follow,true);
    const hidden = await measure(follow,false);
    assert.equal(visible[0].calls-hidden[0].calls,1);
    assert.equal(visible[0].triangles-hidden[0].triangles,manifest.triangles);
    assert.equal(visible[0].textureCount-hidden[0].textureCount,0);
    assert.equal(visible[0].collisionTriangles-hidden[0].collisionTriangles,0);
    const gpu = await follow.evaluate(() => {
      const gl = window.__APP.renderer.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info');
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    });
    await follow.evaluate(() => window.__APP.reviewScimmia());
    for (const [i,id] of order.slice(1).entries()) {
      if (i===0) {
        await follow.waitForFunction(() => {
          const actor = window.__APP.scene.getObjectByName('ArrivalScimmia')?.children[0];
          if (!actor?.visible || actor.position.y < 3.1) return false;
          window.__APP.reviewScimmia({freeze:true});
          return true;
        },null,{timeout:15000});
        await follow.screenshot({path:path.join(output,'leap.png')});
        await follow.evaluate(() => window.__APP.reviewScimmia());
      }
      await waitForPhase(follow,'grip',id);
      holds.push((await read(follow)).scimmia.hold);
      if (id === '172:1') {
        assert.ok((await read(follow)).scimmia.position[1] > 5);
        await follow.screenshot({path:path.join(output,'grip-over-rock.png')});
      }
      if (i===11) await follow.screenshot({path:path.join(output,'grip-middle.png')});
    }
    await follow.waitForFunction(({diagnostics,post}) => {
      const data = JSON.parse(document.querySelector(diagnostics)?.dataset.state || '{}').scimmia;
      return data?.returning && data.post === post && data.phase === 'grip';
    },{diagnostics,post:order.at(-2)},timeout);
    await follow.screenshot({path:path.join(output,'return.png')});
    assert.ok(holds.every(hold => hold >= 2 && hold <= 7));
    assert.ok(new Set(holds).size > 1);
    await follow.close();

    const landing = await browser.newPage({viewport,reducedMotion:'reduce'});
    const requests = [];
    landing.on('request',request => { if (isNpcRequest(request)) requests.push(request.url()); });
    landing.on('pageerror',error => errors.push(error.message));
    await landing.goto(base+'?review');
    const start = landing.getByRole('button',{name:'ATTERRA'});
    await start.waitFor({state:'visible',...timeout});
    assert.equal(requests.length,0);
    await start.click();
    await landing.waitForFunction(({ diagnostics }) => {
      const state = JSON.parse(document.querySelector(diagnostics)?.dataset.state || '{}');
      return state.landing && state.scimmia?.ready && !state.scimmia.active;
    },{ diagnostics },timeout);
    await waitForPhase(landing,'walk');
    const realArrival = (await read(landing)).scimmia;
    assert.equal(realArrival.active,true);
    assert.equal(realArrival.visible,false);
    assert.ok(realArrival.position[0]<0 && realArrival.position[2]>215);
    assert.equal(requests.length,1);
    assert.deepEqual(errors,[]);
    const result = { base, viewport, gpu, order, holds, visible, hidden, realArrival, requests, errors };
    await fs.writeFile(path.join(output,'browser-report.json'),JSON.stringify(result,null,2)+'\n');
    console.log('PASS real arrival, all 25 posts, first return hop and fixed-camera comparison');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error);process.exitCode=1; });
