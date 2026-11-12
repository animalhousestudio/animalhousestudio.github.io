const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const output=__dirname+require('node:path').sep;
const base=process.env.CASA3D_BASE || 'http://127.0.0.1:5194/index.template.html';
const viewport={width:1100,height:720};
const read=()=>JSON.parse(document.querySelector('[data-testid=world-diagnostics]').dataset.state);
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{const Original=window.Audio;window.Audio=function(...a){const obj=new Original(...a);if(!window.__testAudio)window.__testAudio=obj;return obj;};window.Audio.prototype=Original.prototype;});
 await page.goto(base+'?review');
 const button=page.getByRole('button',{name:'ATTERRA'});await button.waitFor({timeout:90000});
 const spots=await page.evaluate(async()=>{
  const {Vector3,Raycaster}=await import('/node_modules/three/build/three.module.js');
  const app=window.__APP;const surface=app.scene.getObjectByName('Asteroid_Surface');
  const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
  return ['LandingBeehive','LollipopBasket','LandingMug','ContactBooth'].map(name=>{
   const point=app.scene.getObjectByName(name).getWorldPosition(new Vector3());
   let clear=true;
   for(let i=0;i<16;i++){
    const angle=i*Math.PI/8;const dx=Math.cos(angle)*5.5,dz=Math.sin(angle)*5.5;
    ray.ray.origin.set(point.x+dx,15,point.z+dz);
    const ground=ray.intersectObject(surface,false)[0]?.point.y;
    if(ground===undefined||Math.abs(ground-point.y)>.22){clear=false;break;}
    const eye=new Vector3(point.x+dx,ground+1.65,point.z+dz);
    if(app.collisionWorld.move(eye,new Vector3(),{radius:1.1,eyeHeight:1.6}).position.distanceTo(eye)>.07){clear=false;break;}
   }
   return {name,position:point.toArray(),clear};
  });
 });
 assert.ok(spots.every(s=>s.clear));
 await button.click();
 await page.waitForFunction(()=>window.__testAudio.src.endsWith('03.112.mp3')&&Number.isFinite(window.__testAudio.duration),null,{timeout:20000});
 await page.waitForFunction(()=>{const g=window.__APP.scene.getObjectByName('ArrivalFireworks');return g?.children[0].material.uniforms.elapsed.value>5.1;},null,{timeout:18000});
 await page.screenshot({path:output+'arrival.png'});
 const arrival=await page.evaluate(()=>{const g=window.__APP.scene.getObjectByName('ArrivalFireworks');return{parent:g.parent.type,plane:g.userData.rearPlane,points:g.children[0].geometry.attributes.position.count};});
 assert.equal(arrival.parent,'Scene');
 const tracks=['03.112'];
 for(const track of ['03.113','ANIMALOUD%201']){
  await page.evaluate(()=>{const a=window.__testAudio;a.currentTime=a.duration-.15;});
  await page.waitForFunction(track=>window.__testAudio.src.endsWith(track+'.mp3')&&!window.__testAudio.paused&&Number.isFinite(window.__testAudio.duration),track,{timeout:20000});
  tracks.push(track);
 }
 await page.waitForFunction(()=>!window.__APP.scene.getObjectByName('ArrivalFireworks'),null,{timeout:20000});
 await page.goto(base+'?review&view=coaster-fireworks');
 await page.waitForFunction(()=>window.__APP?.scene.getObjectByName('ArrivalFireworks')?.children[0].material.uniforms.elapsed.value>2,null,{timeout:90000});
 await page.screenshot({path:output+'coaster.png'});
 const ride=await page.evaluate(()=>{const g=window.__APP.scene.getObjectByName('ArrivalFireworks');return{parent:g.parent.type,plane:g.userData.rearPlane,points:g.children[0].geometry.attributes.position.count};});
 assert.equal(ride.parent,'Scene');assert.ok(ride.points<arrival.points);
 await page.locator('details summary').first().click();
 await page.getByRole('button',{name:'Giostra · partenza',exact:true}).click();
 await page.getByRole('button',{name:'Sali sulla giostra'}).click();
 await page.locator('button[data-ride=yes]').click();
 await page.evaluate(()=>{
  const ride=window.__APP.rooms[0].userData.coaster.ride;
  const old=ride.update.bind(ride);let run=true;
  ride.update=dt=>{if(run){run=false;for(let i=0;i<627;i++)old(.1);}return old(dt);};
 });
 await page.waitForFunction(()=>window.__APP.scene.getObjectByName('ArrivalFireworks'),null,{timeout:15000});
 await page.waitForFunction(()=>!window.__APP.scene.getObjectByName('ArrivalFireworks'),null,{timeout:20000});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(output+'browser-report.json',JSON.stringify({base,viewport,spots,tracks,arrival,ride,errors},null,2)+'\n');
 console.log(JSON.stringify({spots,tracks,arrival,ride}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});

