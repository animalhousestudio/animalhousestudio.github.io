const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const base = process.env.CASA3D_BASE || 'http://127.0.0.1:5194/index.template.html?review';
const viewport = { width: 1100, height: 720 };

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const capture = name => page.screenshot({ path: join(__dirname, name + '.png') });
    const state = () => page.evaluate(() => {
      const { scene, camera } = window.__APP;
      const root = scene.getObjectByName('AsteroidAtmosphere');
      const smoke = root.getObjectByName('AsteroidColorSmoke');
      const flares = camera.getObjectByName('ArrivalFlares');
      const diagnostics = JSON.parse(document.querySelector('[data-testid=world-diagnostics]').dataset.state);
      const lights = root.children.filter(node => node.isSpotLight);
      const mount = light => light.intensity > 0 ? {
        origin:light.position.toArray(),target:light.target.position.toArray(),angle:light.angle,
      } : null;
      return {
        flares: flares ? { visible:flares.visible, count:flares.userData.emitters, elapsed:flares.children[0].material.uniforms.elapsed.value } : null,
        atmosphere:diagnostics.atmosphere,
        smoke:smoke.visible, smokeTime:smoke.material.uniforms.time.value, quads:smoke.geometry.instanceCount,
        high:lights.slice(0,2).map(mount).filter(Boolean), ground:mount(lights[2]),
        performance:diagnostics.performance,
      };
    });
    await page.goto(base);
    await page.getByRole('button',{name:'ATTERRA'}).click({timeout:90000});
    await page.waitForFunction(() => window.__APP.camera.getObjectByName('ArrivalFlares')
      ?.children[0].material.uniforms.elapsed.value > 7.4,null,{timeout:20000});
    const flight = await state();
    assert.ok(flight.flares.visible);
    assert.equal(flight.flares.count,5);
    assert.equal(flight.smoke,false);
    assert.deepEqual(flight.high,[]);
    await capture('flight');
    await page.waitForFunction(() => {
      const flares = window.__APP.camera.getObjectByName('ArrivalFlares');
      return flares && !flares.visible && flares.children[0].material.uniforms.elapsed.value>11.9;
    },null,{timeout:12000});
    const cutoff = await state();
    assert.equal(cutoff.smoke,false);
    await page.waitForFunction(() => window.__APP.scene.getObjectByName('AsteroidColorSmoke').visible);
    const landed = await state();
    assert.equal(landed.flares,null);
    assert.equal(landed.ground,null);
    await page.waitForFunction(() => {
      const d = JSON.parse(document.querySelector('[data-testid=world-diagnostics]')?.dataset.state || '{}');
      return d.atmosphere?.groundIndex === 0;
    },null,{timeout:18000});
    const firstGround = await state();
    assert.ok(firstGround.smokeTime>=10 && firstGround.smokeTime<12);
    await page.waitForFunction(() => {
      const d = JSON.parse(document.querySelector('[data-testid=world-diagnostics]')?.dataset.state || '{}');
      return d.atmosphere?.groundIndex === 1;
    },null,{timeout:8500});
    const secondGround = await state();
    assert.ok(secondGround.smokeTime>=14 && secondGround.smokeTime<16);
    assert.notDeepEqual(firstGround.ground.origin,secondGround.ground.origin);

    const previews = {};
    for (const view of ['atmosphere','atmosphere-house','atmosphere-back']) {
      await page.goto(base+'&view='+view);
      await page.waitForFunction(() => {
        const d = JSON.parse(document.querySelector('[data-testid=world-diagnostics]')?.dataset.state || '{}');
        return d.ready && d.atmosphere?.smoke && d.atmosphere?.activeLights===3;
      },null,{timeout:90000});
      await page.waitForTimeout(2400);
      previews[view] = await state();
      assert.equal(previews[view].atmosphere.groundFixtures,4);
      assert.equal(previews[view].atmosphere.highFixtures,14);
      assert.ok(previews[view].atmosphere.vents>=44);
      assert.ok(previews[view].high.every(light=>light.origin[1]>=85));
      await capture(view);
    }
    assert.deepEqual(errors,[]);
    const report = { viewport,flight,cutoff,landed,firstGround,secondGround,previews,errors };
    writeFileSync(join(__dirname,'report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
