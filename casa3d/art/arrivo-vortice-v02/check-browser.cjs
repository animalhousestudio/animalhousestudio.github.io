const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path');
const base=process.env.CASA3D_REVIEW_URL || 'http://127.0.0.1:4186/casa3d/';

async function check(browser,mode){
  const reduced=mode==='ridotto';
  const viewport=mode==='verticale'?{width:390,height:780}:{width:960,height:580};
  const page=await browser.newPage({viewport,reducedMotion:reduced?'reduce':'no-preference'});
  const output=path.join(__dirname,mode),errors=[],requests=[];
  await fs.mkdir(output,{recursive:true});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  page.on('request',req=>{if(req.url().includes('vortex-paint'))requests.push(req.url());});
  await page.goto(base+'?review');
  await page.getByText('ATTERRA',{exact:true}).waitFor({timeout:120000});
  await page.evaluate(()=>{
    const origin=performance.now();window.ms=0;performance.now=()=>origin+window.ms;
    const {renderer}=window.__APP,original=renderer.render.bind(renderer);
    window.registerResources=()=>{
      const registry=new Set(),counts={expected:0,released:0};
      window.releases=counts;
      window.track=r=>{
        if(registry.has(r))return;
        registry.add(r);counts.expected++;r.addEventListener('dispose',()=>counts.released++);
      };
    };
    window.registerResources();
    renderer.render=(scene,camera)=>{
      const mesh=scene.children[0],uniforms=mesh?.material?.uniforms;
      if(mesh?.material?.defines?.STEPS && uniforms?.noiseMap){
        const target=renderer.getRenderTarget();
        window.track(target);window.track(mesh.material);window.track(uniforms.noiseMap.value);
        if(window.probeMovement){
          window.probeMovement=false;
          const read=()=>{
            original(scene,camera);
            const data=new Uint8Array(target.width*target.height*4);
            renderer.readRenderTargetPixels(target,0,0,target.width,target.height,data);
            return data;
          };
          const before=read(),clock=uniforms.seconds.value;
          uniforms.seconds.value=clock+.45;
          const after=read();uniforms.seconds.value=clock;
          let changed=0;
          for(let i=0;i<before.length;i+=4){
            if(Math.max(...[0,1,2].map(c=>Math.abs(before[i+c]-after[i+c])))>=12)changed++;
          }
          window.changedFraction=changed/(target.width*target.height);
        }
      }
      original(scene,camera);
    };
  });
  const frames={};
  async function advance(ms){
    await page.evaluate(async time=>{
      window.ms=time;
      for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));
    },ms);
  }
  async function capture(name){
    await page.screenshot({path:path.join(output,name+'.jpg'),quality:88});
    frames[name]=await page.evaluate(()=>{
      const {renderer,scene}=window.__APP;
      const has=name=>!!scene.getObjectByName(name);
      const {calls,triangles,points,lines}=renderer.info.render;
      return {flight:has('PaintedArrival'),smoke:has('ArrivalSmoke'),
        fireworks:!!scene.getObjectByName('ArrivalFireworks')?.visible,
        calls,triangles,points,lines,...renderer.info.memory};
    });
  }
  async function trackVisible(){
    await page.evaluate(()=>{
      window.__APP.scene.getObjectByName('PaintedArrival')?.traverse(node=>{
        if(node.geometry){window.track(node.material);window.track(node.geometry);}
      });
    });
  }
  await page.getByText('ATTERRA',{exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid=world-diagnostics]').dataset.state).soundtrack?.playing);
  const track=await page.evaluate(()=>JSON.parse(document.querySelector('[data-testid=world-diagnostics]').dataset.state).soundtrack.track);
  assert.equal(track,'03.112');
  await trackVisible();
  await page.evaluate(()=>{window.probeMovement=true;});
  for(const [time,name] of [[2300,'vortice'],[5800,'primi-scoppi'],[8700,'fuochi'],[12700,'braci'],[14300,'vialetto']]){
    await advance(time);await capture(name);
  }
  const motion=await page.evaluate(()=>window.changedFraction??0);
  const releases=[await page.evaluate(()=>window.releases)];
  if(!reduced){
    assert.ok(motion>.10,'visible smoke must move with fixed camera and fixed lighting');
    assert.ok(frames.vortice.smoke && frames['primi-scoppi'].fireworks && frames.fuochi.fireworks);
    await page.evaluate(()=>{
      window.registerResources();
      [...document.querySelectorAll('button')].find(b=>b.textContent==='Rivedi atterraggio').click();
    });
    await advance(15100);await trackVisible();await advance(28600);
    releases.push(await page.evaluate(()=>window.releases));
    assert.ok(releases.every(r=>r.expected>0 && r.released===r.expected));
  }else{
    assert.ok(Object.values(frames).every(f=>!f.flight));assert.equal(releases[0].expected,0);
  }
  assert.ok(!frames.braci.smoke && !frames.braci.fireworks && !frames.vialetto.flight);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify({viewport,frames,motion,releases,track,requests,errors},null,2)+'\n');
  console.log(mode,{motion,releases});await page.close();
}
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--mute-audio']});
  try{for(const name of process.argv.slice(2))await check(browser,name);}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
