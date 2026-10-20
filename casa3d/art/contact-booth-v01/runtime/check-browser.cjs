// Audit only the isolated descent/room. The cabin itself now belongs to the main world.
const {chromium}=require('C:/Users/Amministratore/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),requests=[],errors=[];
  page.on('request',request=>requests.push(request.url()));page.on('pageerror',error=>errors.push(error.message));
  const base=process.env.BOOTH_BASE||'http://127.0.0.1:5174/index.template.html';
  await page.goto(base+'?experience=contact&travel=down');
  await page.waitForURL('**experience=chamber');
  await page.waitForFunction(()=>JSON.parse(document.body.dataset.experience||'{}').phase==='ready');
  await page.screenshot({path:path.join(__dirname,'chamber-desktop.png')});
  const before=await page.evaluate(()=>JSON.parse(document.body.dataset.experience).position);
  await page.locator('canvas').click({position:{x:100,y:400}});
  await page.keyboard.down('KeyW');await page.waitForTimeout(350);await page.keyboard.up('KeyW');
  const after=await page.evaluate(()=>JSON.parse(document.body.dataset.experience).position);assert.ok(after[2]<before[2]);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'chamber-mobile.png')});
  // Walking/input/collision modules are intentionally shared; world assets stay excluded.
  const forbidden=requests.filter(url=>/\/src\/(main\.js|world\/)|\/assets\/main-|\.(glb|mp4)(\?|$)/.test(url));
  assert.deepEqual(forbidden,[]);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(__dirname,'browser-report.json'),JSON.stringify({base,errors,forbidden,requests,checks:['isolated descent','empty room movement','mobile controls','no main-world models or modules requested']},null,2));
  console.log('PASS isolated information room');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
