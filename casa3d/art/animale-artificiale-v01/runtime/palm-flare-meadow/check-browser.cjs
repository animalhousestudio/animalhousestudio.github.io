const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const path=require('node:path');
const base=process.env.CASA3D_BASE || 'http://127.0.0.1:5194/index.template.html?review';
const output=process.env.PROOF_DIR || __dirname;
const grass=process.env.EXPECT_MEADOW==='on';
const viewport={width:1100,height:720};
const selector='[data-testid=world-diagnostics]';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport});
 const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(/\/fluffy-grass\/(?:grassLODs\.glb|grass\.jpeg)(?:\?|$)/.test(r.url())&&r.request().resourceType()!=='script')requests.push(r.url());});
 await page.goto(base+'&view=atmosphere');
 await page.waitForFunction(selector=>{const d=JSON.parse(document.querySelector(selector)?.dataset.state||'{}');return d.ready&&d.atmosphere?.activeLights===2;},selector,{timeout:90000});
 await page.waitForTimeout(4300);
 const getState=()=>page.locator(selector).evaluate(el=>JSON.parse(el.dataset.state));
 const resources=await page.evaluate(()=>{
  const {scene,renderer}=window.__APP;
  const meadow=scene.getObjectByName('FluffyMeadow');
  const data={present:Boolean(meadow),instanceMatrices:0,instanceMatrixBytes:0,geometryAttributesBytes:0};
  const buffers=new Set();
  meadow?.traverse(node=>{
   if(!node.isInstancedMesh)return;
   data.instanceMatrices+=node.instanceMatrix.count;
   buffers.add(node.instanceMatrix.array);
  });
  for(const buffer of buffers)data.instanceMatrixBytes+=buffer.byteLength;
  buffers.clear();
  meadow?.traverse(node=>{
   if(!node.isInstancedMesh)return;
   for(const attr of Object.values(node.geometry.attributes))buffers.add(attr.array);
   if(node.geometry.index)buffers.add(node.geometry.index.array);
  });
  for(const buffer of buffers)data.geometryAttributesBytes+=buffer.byteLength;
  const gl=renderer.getContext(), info=gl.getExtension('WEBGL_debug_renderer_info');
  return {meadow:data,adapter:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
 });
 assert.equal(resources.meadow.present,grass);
 assert.equal(requests.length>0,grass);
 const samples=[];
 for(let i=0;i<4;i++){
  const s=await getState();
  samples.push({...s.performance,geometries:s.geometryCount,textures:s.textureCount,collisionTriangles:s.collisionTriangles});
  await page.waitForTimeout(1050);
 }
 await page.screenshot({path:path.join(output,grass?'meadow-on.png':'meadow-off.png')});
 const atmosphere=(await getState()).atmosphere;
 assert.equal(atmosphere.vents,20);
 assert.equal(atmosphere.activeLights,2);
 await page.goto(base);
 await page.getByRole('button',{name:'ATTERRA'}).click({timeout:90000});
 await page.waitForFunction(()=>window.__APP.camera.getObjectByName('ArrivalFlares')?.children[0].material.uniforms.elapsed.value>7.15,null,{timeout:18000});
 const emitters=await page.evaluate(()=>window.__APP.camera.getObjectByName('ArrivalFlares').userData.emitters);
 assert.equal(emitters,5);
 await page.screenshot({path:path.join(output,'five-bengals.png')});
 await page.waitForFunction(()=>!window.__APP.camera.getObjectByName('ArrivalFlares'),null,{timeout:18000});
 assert.deepEqual(errors,[]);
 const report={base,viewport,grass,resources,samples,requests:[...new Set(requests)],atmosphere,emitters,errors};
 fs.writeFileSync(path.join(output,grass?'meadow-on.json':'meadow-off.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
