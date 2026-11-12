const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const url = 'http://127.0.0.1:5194/index.template.html?review';
const diagnostic = '[data-testid=world-diagnostics]';

async function main() {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1100,height:720}});
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',msg=>{if(msg.type()==='error') errors.push(msg.text());});
    const state = () => page.locator(diagnostic+'[data-state]').evaluate(el=>JSON.parse(el.dataset.state));
    const snapshot = name => page.screenshot({path:join(__dirname,name+'.png')});
    const samples = {};
    for (const view of ['terrain','terrain-ufo','atmosphere']) {
      await page.goto(url+'&view='+view);
      await page.waitForFunction(selector=>{
        const data=JSON.parse(document.querySelector(selector)?.dataset.state||'{}');
        return data.ready && !document.querySelector('.arrival-splash');
      },diagnostic,{timeout:90000});
      await page.waitForTimeout(2400);
      const details = await page.evaluate(async view=>{
        const {scene,player}=window.__APP;
        const {Raycaster,Vector3}=await import('/node_modules/three/build/three.module.js');
        const top=scene.getObjectByName('Asteroid_Surface'), rock=scene.getObjectByName('Asteroid_Rock');
        const ufo=scene.getObjectByName('CrashedUFO'), mist=scene.getObjectByName('AsteroidGroundMist');
        const {propPlacements,terrainHeight}=await import('/src/rooms/terrainDetail.mjs');
        const site=propPlacements[0];
        const ufoPosition=ufo.getWorldPosition(new Vector3()).toArray();
        const error=Math.abs(ufoPosition[1]-(terrainHeight(site.x,site.z)-site.buried)*5);
        const probes = [[-29,-15],[-22,-15],[-33,-12],[0,43],[-24,3],[-24,16],[1,0]];
        const ground = probes.map(([x,z])=>{
          const ray=new Raycaster(new Vector3(x*5,22,z*5),new Vector3(0,-1,0));
          const hit=ray.intersectObject(top)[0];
          return {x,z,mesh:hit?.point.y??null,support:player.groundHeightAt(x*5,z*5,22)};
        });
        return {topMap:Boolean(top.material.map),rockMap:Boolean(rock.material.map),mist:mist.visible,
          mistCount:mist.geometry.instanceCount,terrainTriangles:(top.geometry.index?.count??top.geometry.attributes.position.count)/3,
          ufoPosition,error,ground,view};
      },view);
      assert.ok(details.topMap && details.rockMap);
      assert.ok(details.error<1e-5);
      assert.equal(details.mist,view!=='terrain');
      for (const probe of details.ground.slice(0,4)) {
        assert.notEqual(probe.mesh,null);
        assert.ok(Math.abs(probe.mesh-probe.support)<.24,JSON.stringify(probe));
      }
      for (const probe of details.ground.slice(4)) assert.equal(probe.mesh,null);
      await snapshot(view);
      samples[view]={details,performance:(await state()).performance};
    }
    await page.goto(url);
    await page.getByRole('button',{name:'ATTERRA'}).click({timeout:90000});
    await page.waitForFunction(selector=>JSON.parse(document.querySelector(selector)?.dataset.state||'{}').landing,
      diagnostic,{timeout:5000});
    assert.equal(await page.evaluate(()=>window.__APP.scene.getObjectByName('AsteroidGroundMist').visible),false);
    await page.waitForFunction(selector=>{
      const state=JSON.parse(document.querySelector(selector)?.dataset.state||'{}');
      return state.ready && state.landing===false;
    },
      diagnostic,{timeout:22000});
    await page.waitForTimeout(1000);
    const landed=(await state()).playerPosition;
    // The rendered stone path sits a few centimetres above the terrain.
    assert.ok(landed[1]>=1.98 && landed[1]<2.12,JSON.stringify(landed));
    assert.ok(Math.abs(landed[2]-215)<.05,JSON.stringify(landed));
    assert.deepEqual(errors,[]);
    const report={samples,landed,errors};
    writeFileSync(join(__dirname,'report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report));
  } finally {
    await browser.close();
  }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
