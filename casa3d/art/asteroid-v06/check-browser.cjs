const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const base = 'http://127.0.0.1:5194/index.template.html?review';
const diagnostic = '[data-testid=world-diagnostics]';

async function main() {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1100,height:720}});
    const errors = [], requests = [];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
    page.on('response',response=>{
      if (/\/terrain-detail\/(?:ground-.*\.glb|rock-micro\.png)(?:\?|$)/.test(response.url())
        && response.request().resourceType()!=='script') {
        assert.ok(response.ok() || response.status()===304,response.url());
        requests.push(response.url().split('/').at(-1));
      }
    });
    const state = () => page.locator(diagnostic+'[data-state]').evaluate(el=>JSON.parse(el.dataset.state));
    const wait = (condition,timeout=65000) => page.waitForFunction(({diagnostic,condition})=>{
      const data=JSON.parse(document.querySelector(diagnostic)?.dataset.state||'{}');
      return data.ready && !document.querySelector('.arrival-splash') &&
        (condition==='near' ? data.groundDetail?.texture && data.groundDetail.cells.length :
          condition==='released' ? !data.groundDetail.texture && !data.groundDetail.cells.length : true);
    },{diagnostic,condition},{timeout});
    const shot = name => page.screenshot({path:join(__dirname,name+'.png')});

    await page.goto(base+'&view=terrain');
    await wait('far');
    const far = (await state()).groundDetail;
    assert.deepEqual(far,{texture:false,cells:[],visible:false});
    assert.deepEqual(requests,[]);
    await page.locator('summary').filter({hasText:'Visita un ambiente'}).click();
    await page.getByRole('button',{name:'Terreno · cratere UFO',exact:true}).click();
    await wait('near');
    const near = await state();
    assert.ok(near.groundDetail.cells.length<=3);
    assert.ok(requests.includes('rock-micro.png'));
    await shot('cratere-gioco');
    const geometry = await page.evaluate(()=>{
      const {scene}=window.__APP;
      const top=scene.getObjectByName('Asteroid_Surface');
      const mist=scene.getObjectByName('AsteroidGroundMist');
      const smoke=scene.getObjectByName('AsteroidColorSmoke');
      const mistOrigins=mist.geometry.getAttribute('origin');
      const smokeOrigins=smoke.geometry.getAttribute('origin');
      const index=top.geometry.index;
      return {vertices:top.geometry.getAttribute('position').count,triangles:index.count/3,
        mist:mistOrigins.count,pairedMist:Array.from({length:mistOrigins.count},(_,i)=>
          ['getX','getY','getZ'].every(k=>mistOrigins[k](i)===smokeOrigins[k](i*18))).every(Boolean)};
    });
    assert.equal(geometry.pairedMist,true);
    await page.locator('summary').filter({hasText:'Visita un ambiente'}).click();
    await page.getByRole('button',{name:'Terreno · panoramica',exact:true}).click();
    await wait('released',22000);
    const released=(await state()).groundDetail;
    assert.deepEqual(released,{texture:false,cells:[],visible:false});

    await page.goto(base);
    await page.getByRole('button',{name:'ATTERRA',exact:true}).click({timeout:75000});
    await page.waitForFunction(()=>{
      const core=window.__APP.camera.getObjectByName('ArrivalFlares')?.children[0];
      return core?.material.uniforms.elapsed.value>4;
    },null,{timeout:12000});
    const flare = await page.evaluate(()=>{
      const {camera}=window.__APP;
      const core=camera.getObjectByName('ArrivalFlares').children[0];
      return core.material.uniforms.origins.value.map(p=>p.clone().applyMatrix4(camera.projectionMatrix).y);
    });
    assert.equal(flare.length,5);
    assert.ok(flare.every(value=>value<-1.1));
    await shot('bengala');
    assert.deepEqual(errors,[]);
    const result={far,near:near.groundDetail,released,geometry,flare,requests:[...new Set(requests)],errors};
    writeFileSync(join(__dirname,'runtime-report.json'),JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify(result));
  } finally {
    await browser.close();
  }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
