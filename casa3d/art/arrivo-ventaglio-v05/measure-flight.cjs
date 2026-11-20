// Compare the two published asset sets already present in this checkout.
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const dir=path.resolve(__dirname,'../..');
const base=process.env.CASA3D_REVIEW_URL || 'http://127.0.0.1:4186/casa3d/';
function summary(values){
  values.sort((a,b)=>a-b);
  return {samples:values.length,medianMs:values[Math.floor(values.length*.5)]??null,
    p95Ms:values[Math.floor(values.length*.95)]??null};
}
async function main(){
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--mute-audio']});
  const results={};
  try {
    for(const version of ['prima','dopo']){
      const page=await browser.newPage({viewport:{width:960,height:580}});
      await page.route('**/casa3d/assets/*',async route=>{
        const file=path.basename(new URL(route.request().url()).pathname);
        return route.fulfill({path:path.join(dir,'assets',decodeURIComponent(file))});
      });
      await page.route(base+'?review',async route=>{
        let html=await fs.readFile(path.join(dir,'index.html'),'utf8');
        if(version==='prima') html=html.replace(/assets\/index-[\w-]+\.js/,'assets/index-CgUznHza.js');
        return route.fulfill({contentType:'text/html',body:html});
      });
      await page.goto(base+'?review');
      await page.getByText('ATTERRA',{exact:true}).waitFor({timeout:180000});
      const trace=await page.evaluate(async()=>{
        const {renderer,scene,camera}=window.__APP;
        const gl=renderer.getContext(),gpu=gl.getExtension('WEBGL_debug_renderer_info');
        const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
        const elapsed=[],gpuTimes=[],queries=[];
        const reset=renderer.info.reset.bind(renderer.info),render=renderer.render.bind(renderer);
        let current,last=performance.now(),start=last;
        renderer.info.reset=()=>{
          reset();
          if(!timer || current || gl.getQuery(timer.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))return;
          current=gl.createQuery();gl.beginQuery(timer.TIME_ELAPSED_EXT,current);
        };
        renderer.render=(s,c)=>{
          render(s,c);
          if(s!==scene || c!==camera)return;
          const now=performance.now();
          if(now-start<=14000)elapsed.push(now-last);
          last=now;
          if(current){gl.endQuery(timer.TIME_ELAPSED_EXT);queries.push([current,now-start]);current=null;}
          while(queries.length && gl.getQueryParameter(queries[0][0],gl.QUERY_RESULT_AVAILABLE)){
            const [q,at]=queries.shift();
            if(at<=14000 && !gl.getParameter(timer.GPU_DISJOINT_EXT))gpuTimes.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);
            gl.deleteQuery(q);
          }
        };
        document.querySelector('.arrival-splash__start').click();
        await new Promise(r=>setTimeout(r,15500));
        renderer.info.reset=reset;renderer.render=render;
        for(const [q] of queries)gl.deleteQuery(q);
        return {gpu:gpu?gl.getParameter(gpu.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
          timedGPU:!!timer,elapsed,gpuTimes};
      });
      results[version]={renderer:trace.gpu,viewport:[960,580],frame:summary(trace.elapsed),
        gpu:summary(trace.gpuTimes)};
      await page.close();
    }
    await fs.writeFile(path.join(__dirname,'tempi.json'),JSON.stringify(results,null,2)+'\n');
    console.log(results);
  } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});




