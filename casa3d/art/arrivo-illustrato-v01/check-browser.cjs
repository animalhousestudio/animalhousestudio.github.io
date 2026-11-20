const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

async function run() {
  const version = process.argv[2] || 'dopo';
  const portrait = version === 'verticale';
  const reduced = version === 'ridotto';
  const viewport = portrait ? {width:390,height:780} : {width:960,height:580};
  const output = path.join(__dirname,version);
  await fs.mkdir(output,{recursive:true});
  const browser = await chromium.launch({channel:'msedge',headless:true,
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--mute-audio']});
  try {
    const page = await browser.newPage({viewport,reducedMotion:reduced?'reduce':'no-preference'});
    const errors = [], requests = [];
    page.on('pageerror',e => errors.push(e.message));
    page.on('console',m => { if(m.type()==='error') errors.push(m.text()); });
    page.on('request',r => { if (/vortex-paint.*webp/.test(r.url())) requests.push(r.url()); });
    const base=process.env.CASA3D_REVIEW_URL || 'http://127.0.0.1:4186/casa3d/';
    await page.goto(base+'?review');
    await page.getByText('ATTERRA',{exact:true}).waitFor({timeout:180000});
    assert.equal(requests.length,0);
    await page.evaluate(() => {
      const original = performance.now.bind(performance);
      window.frameOrigin = original();
      window.frameMs = 0;
      performance.now = () => window.frameOrigin + window.frameMs;
    });
    const frames = {};
    const paint = async ms => {
      await page.evaluate(async time => {
        window.frameMs = time;
        for (let i=0;i<3;i++) await new Promise(r => requestAnimationFrame(r));
      },ms);
    };
    async function capture(name) {
      await page.screenshot({path:path.join(output,name+'.jpg'),quality:88});
      frames[name] = await page.evaluate(() => {
        const {renderer,scene,camera}=window.__APP;
        const {calls,triangles,points,lines}=renderer.info.render;
        return {calls,triangles,points,lines,...renderer.info.memory,eye:camera.position.toArray(),
          flight:!!scene.getObjectByName('PaintedArrival'),tunnel:!!document.querySelector('.arrival-flight')};
      });
    }
    await page.getByText('ATTERRA',{exact:true}).click();
    await page.waitForTimeout(1000);
    const diagnostics=page.locator('[data-testid=world-diagnostics]');
    await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid=world-diagnostics]').dataset.state).soundtrack?.playing);
    const firstTrack=await diagnostics.evaluate(el=>JSON.parse(el.dataset.state).soundtrack.track);
    assert.equal(firstTrack,'03.112');
    for (const [time,name] of [[2100,'vortice'],[5750,'scintilla'],[7720,'corona'],[11700,'discesa']]) {
      await paint(time);
      if(time===2100 && version!=='prima' && !reduced) {
        await page.waitForFunction(() => window.__APP.scene.getObjectByName('PaintedTunnel')?.material.uniforms.painted.value===1);
      }
      await capture(name);
    }
    async function trackRelease() {
      await page.evaluate(() => {
        const root=window.__APP.scene.getObjectByName('PaintedArrival');
        const resources=new Set();
        root?.traverse(obj => {
          if(!obj.material) return;
          resources.add(obj.geometry);resources.add(obj.material);
          for(const u of Object.values(obj.material.uniforms)) if(u.value?.isTexture) resources.add(u.value);
        });
        const bitmap=root?.getObjectByName('PaintedTunnel')?.material.uniforms.ink.value.image;
        window.releaseCheck={expected:resources.size,released:0,get decodedWidth(){return bitmap?.width??0;}};
        for(const resource of resources) resource.addEventListener('dispose',()=>window.releaseCheck.released++);
      });
    }
    await trackRelease();
    await paint(14020);
    await paint(18500);
    await capture('vialetto');
    const releases = [await page.evaluate(()=>window.releaseCheck)];
    if(version!=='prima' && !reduced) {
      await page.evaluate(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Rivedi atterraggio').click());
      await paint(20900);
      await page.waitForFunction(() => window.__APP.scene.getObjectByName('PaintedTunnel')?.material.uniforms.painted.value===1);
      await trackRelease();
      await paint(33000);
      releases.push(await page.evaluate(()=>window.releaseCheck));
      assert.ok(releases.every(r=>r.released===r.expected && r.expected>0 && r.decodedWidth===0));
    }
    for(const [button,name] of [['Veranda','veranda'],['Giostra · tunnel','sottacqua']]) {
      await page.evaluate(label=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent===label).click(),button);
      await paint(36000);
      await capture(name);
    }
    assert.equal(frames.vialetto.flight,false);
    if(reduced) assert.equal(requests.length,0);
    const soundtrack={firstTrack,final:await diagnostics.evaluate(el=>JSON.parse(el.dataset.state).soundtrack)};
    if(version==='dopo'){
      await page.goto(base+'?experience=chamber');
      await page.waitForFunction(()=>JSON.parse(document.body.dataset.experience||'{}').phase==='ready');
      await page.screenshot({path:path.join(output,'sala.jpg'),quality:88});
      const chamber=await page.evaluate(()=>JSON.parse(document.body.dataset.experience));
      assert.equal(chamber.worldLoaded,false);
      frames.sala=chamber;
    }
    assert.deepEqual(errors,[]);
    await fs.writeFile(path.join(output,'report.json'),JSON.stringify({viewport,renderer:'Edge / SwiftShader',frames,releases,requests,soundtrack,errors},null,2)+'\n');
    console.log(version,frames.corona,releases);
  } finally { await browser.close(); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
