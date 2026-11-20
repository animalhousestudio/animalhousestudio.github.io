const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--mute-audio']});
 try{
 const page=await browser.newPage({viewport:{width:864,height:520}, reducedMotion:'no-preference'});
 await page.goto('http://127.0.0.1:4186/casa3d/?review');
 await page.getByText('ATTERRA',{exact:true}).waitFor({timeout:180000});
 await page.evaluate(()=>{const start=performance.now();window.filmFrame=0;performance.now=()=>start+window.filmFrame*1000/30;});
 await page.getByText('ATTERRA',{exact:true}).click();
 await page.waitForFunction(()=>window.__APP.scene.getObjectByName('ArrivalSmoke'));
 const output=process.env.ARRIVAL_FRAMES;await fs.mkdir(output,{recursive:true});
 for(let f=0;f<450;f++){
   const data=await page.evaluate(index=>new Promise(done=>{
     window.filmFrame=index;
     requestAnimationFrame(()=>done(window.__APP.renderer.domElement.toDataURL('image/jpeg',.95).split(',')[1]));
   }),f);
   await fs.writeFile(path.join(output,String(f).padStart(4,'0')+'.jpg'),Buffer.from(data,'base64'));
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
