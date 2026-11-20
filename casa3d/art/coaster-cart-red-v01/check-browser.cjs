const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');

const base = process.env.CASA3D_REVIEW_URL || 'http://127.0.0.1:4186/casa3d/';
const url = base + '?review&view=coaster';
const root = path.resolve(__dirname, '../..');
const viewport = { width: 1100, height: 690 };

async function check(browser, before) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type()==='error') errors.push(message.text()); });
  if (before) {
    await page.route(url, async route => {
      const current = await readFile(path.join(root,'index.html'),'utf8');
      const body = current.replace(/assets\/index-[\w-]+\.js/,'assets/index-CrDpK_MY.js');
      await route.fulfill({contentType:'text/html',body});
    });
    await page.route('**/casa3d/assets/*', route =>
      route.fulfill({path:path.join(root,'assets',decodeURIComponent(path.basename(new URL(route.request().url()).pathname)))}));
  }
  await page.goto(url);
  await page.waitForFunction(() => !document.querySelector('.arrival-splash')
    && JSON.parse(document.querySelector('[data-testid=world-diagnostics]')?.dataset.state||'{}').coaster?.available,
    null,{timeout:120000});
  const screenshot = name => page.screenshot({path:path.join(__dirname,name+'.jpg'),quality:94});
  const stats = () => page.evaluate(() => {
    const {scene,renderer}=window.__APP;
    const root=scene.getObjectByName('AsteroidCoaster');
    const {board,submergedScene,stationMesh}=root.parent.userData.coaster;
    const cart=board.children[0];
    let batches=0,triangles=0;
    cart.traverse(node=>{
      if(!node.isMesh)return;
      batches++;
      triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;
    });
    const underwaterCart=submergedScene.getObjectByName('Coaster_Cart');
    const hasSign=stationMesh.children.some(node=>node.material?.map?.isCanvasTexture);
    return { cars:board.children.length,batches,triangles,hasSign,
      signPosts:!!stationMesh.getObjectByName('Coaster_EntryPosts'),
      sharedUnderwater:cart.children.filter(node=>node.isMesh).every(node=>
        underwaterCart.children.some(copy=>copy.geometry===node.geometry)),
      draws:renderer.info.render.calls,renderedTriangles:renderer.info.render.triangles };
  });
  async function waitFrames(){
    await page.evaluate(async()=>{
      for(let i=0;i<3;i++) await new Promise(resolve=>requestAnimationFrame(resolve));
    });
  }
  await waitFrames();
  const station=await stats();
  await screenshot(before?'prima-stazione':'stazione');
  const pose=await page.evaluate(()=>{
    const {scene,player,camera}=window.__APP;
    const train=scene.getObjectByName('Coaster_Train');
    const parked={position:player.getPosition().toArray(),pitch:player.pitch,yaw:player.yaw,bodyLayers:[]};
    const eye=train.localToWorld(camera.position.clone().set(-5.7,4.2,5.9));
    const focus=train.localToWorld(camera.position.clone().set(0,1.10,-1.3));
    const forward=focus.sub(eye).normalize();
    window.__APP.inputBlocked=true;
    // The exterior reference shot uses a free camera. Restore the normal rig before boarding.
    scene.getObjectByName('FirstPersonBear').traverse(node=>{
      if(!node.isMesh)return;
      parked.bodyLayers.push([node.uuid,node.layers.mask]);
      node.layers.disable(0);
    });
    player.setPosition(eye);player.yaw=Math.atan2(forward.x,forward.z);player.pitch=Math.asin(forward.y);player.updateCamera();
    return parked;
  });
  await waitFrames();
  await screenshot(before?'prima-carrelli':'carrelli');
  const result={viewport,station,errors};
  assert.equal(station.cars,4);
  assert.equal(station.batches,7);
  if(!before){
    assert.ok(!station.hasSign && !station.signPosts);
    assert.ok(station.sharedUnderwater);
    await page.evaluate(saved=>{
      const {player,camera,scene}=window.__APP;
      player.setPosition(camera.position.clone().fromArray(saved.position));
      player.yaw=saved.yaw;player.pitch=saved.pitch;player.updateCamera();
      for(const [uuid,mask] of saved.bodyLayers)scene.getObjectByProperty('uuid',uuid).layers.mask=mask;
      window.__APP.inputBlocked=false;
    },pose);
    await page.keyboard.press('e');
    await page.getByRole('heading',{name:'Vuoi fare un giro?'}).waitFor();
    await page.getByRole('button',{name:'Non ora'}).click();
    const point=await page.evaluate(()=>{
      const {scene,camera,renderer}=window.__APP;
      const lead=scene.getObjectByName('Coaster_Cart');
      const screen=lead.localToWorld(camera.position.clone().set(0,1.11,1.03)).project(camera);
      const rect=renderer.domElement.getBoundingClientRect();
      return {x:rect.left+(screen.x+1)*rect.width/2,y:rect.top+(1-screen.y)*rect.height/2};
    });
    await page.mouse.click(point.x,point.y);
    await page.getByRole('heading',{name:'Vuoi fare un giro?'}).waitFor();
    await page.getByRole('button',{name:'Sì, partiamo!'}).click();
    await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid=world-diagnostics]').dataset.state).coaster?.progress>.002);
    const boarding=await page.evaluate(()=>{
      const {camera,scene,inputBlocked}=window.__APP;
      const coaster=scene.getObjectByName('AsteroidCoaster').parent.userData.coaster;
      const eye=coaster.board.worldToLocal(camera.position.clone()).toArray();
      const bar=coaster.board.children[0].userData.interactable;
      return {eye,inputBlocked,interactable:bar,active:coaster.ride.active};
    });
    assert.ok(boarding.active && boarding.inputBlocked && boarding.interactable);
    assert.ok(Math.abs(boarding.eye[0])<.001 && Math.abs(boarding.eye[1]-2.08)<.001 && Math.abs(boarding.eye[2])<.001);
    await screenshot('a-bordo');
    await page.evaluate(()=>{
      const {scene}=window.__APP;
      const {ride,containsWater}=scene.getObjectByName('AsteroidCoaster').parent.userData.coaster;
      while(ride.progress<.97 && !containsWater(ride.sample(ride.progress).eye)) ride.update(.1);
    });
    await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid=world-diagnostics]').dataset.state).coaster?.underwater);
    await screenshot('in-immersione');
    await page.evaluate(()=>{
      const {scene}=window.__APP;
      const {ride}=scene.getObjectByName('AsteroidCoaster').parent.userData.coaster;
      while(ride.progress<1) ride.update(.1);
    });
    await page.waitForFunction(()=>{
      const {inputBlocked,scene}=window.__APP;
      return !inputBlocked && !scene.getObjectByName('AsteroidCoaster').parent.userData.coaster.ride.active;
    });
    const exit=await page.evaluate(()=>{
      const {player,scene}=window.__APP;
      const coaster=scene.getObjectByName('AsteroidCoaster').parent.userData.coaster;
      return {position:player.getPosition().toArray(),distance:player.getPosition().distanceTo(coaster.exitPosition)};
    });
    assert.ok(exit.distance<.1);
    Object.assign(result,{keyboard:true,click:true,boarding,underwater:true,exit});
  }
  assert.deepEqual(errors,[]);
  await writeFile(path.join(__dirname,before?'prima.json':'report.json'),JSON.stringify(result,null,2)+'\n');
  console.log(result);
  await page.close();
}

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--mute-audio']});
  try{
    await check(browser,true);
    if(!process.argv.includes('--before'))await check(browser,false);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
