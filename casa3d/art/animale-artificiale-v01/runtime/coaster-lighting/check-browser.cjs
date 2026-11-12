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
      return {
        ambient: scene.children.find(node => node.isAmbientLight).intensity,
        smoke: smoke.visible,
        smokeTime: smoke.material.uniforms.time.value,
        emitters: flares?.userData.emitters ?? 0,
        atmosphere: diagnostics.atmosphere,
        performance: diagnostics.performance,
        mounts: root.children.filter(node => node.isSpotLight && node.intensity>0)
          .map(light => ({ origin: light.position.toArray(), target: light.target.position.toArray(), angle: light.angle })),
      };
    });
    await page.goto(base);
    await page.getByRole('button', { name: 'ATTERRA' }).click({ timeout: 90000 });
    await page.waitForFunction(() => window.__APP.camera.getObjectByName('ArrivalFlares')
      ?.children[0].material.uniforms.elapsed.value > 8.6, null, { timeout: 22000 });
    const flight = await state();
    assert.equal(flight.ambient, .17);
    assert.equal(flight.emitters, 5);
    assert.equal(flight.smoke, false);
    assert.deepEqual(flight.mounts, []);
    await capture('flight');
    await page.waitForFunction(() => {
      const root = window.__APP.scene.getObjectByName('AsteroidAtmosphere');
      return root.getObjectByName('AsteroidColorSmoke').visible &&
        root.children.some(node => node.isSpotLight && node.intensity > 0);
    }, null, { timeout: 22000 });
    const landed = await state();
    assert.equal(landed.emitters, 0);
    assert.ok(landed.smokeTime > 0 && landed.smokeTime < 3);

    const previews = {};
    for (const view of ['atmosphere', 'atmosphere-house']) {
      await page.goto(base + '&view=' + view);
      await page.waitForFunction(() => {
        const d = JSON.parse(document.querySelector('[data-testid=world-diagnostics]')?.dataset.state || '{}');
        return d.ready && d.atmosphere?.activeLights === 2 && d.atmosphere.smoke && d.performance.fps > 0;
      }, null, { timeout: 90000 });
      await page.waitForTimeout(3400);
      previews[view] = await state();
      previews[view].samples = [previews[view].performance];
      for (let i = 0; i < 2; i++) {
        await page.waitForTimeout(1100);
        previews[view].samples.push((await state()).performance);
      }
      assert.equal(previews[view].atmosphere.fixtures, 10);
      assert.equal(previews[view].atmosphere.vents, 28);
      assert.equal(previews[view].ambient, .62);
      await capture(view);
    }
    assert.ok(previews['atmosphere-house'].mounts.some(mount => mount.origin[1] > 100));
    assert.deepEqual(errors, []);
    const report = { viewport, flight, landed, previews, errors };
    writeFileSync(join(__dirname, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
