// Requires Playwright and Chromium; PYTHON selects the backend environment.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = new URL('../', import.meta.url).pathname;
const backend = spawn(process.env.PYTHON || 'python', ['-m','uvicorn','server:app','--app-dir','backend','--host','127.0.0.1','--port','18000'], {cwd:root,stdio:'ignore'});
const frontend = spawn('node',['frontend/node_modules/vite/bin/vite.js','frontend','--host','127.0.0.1','--port','18517','--strictPort'], {cwd:root,stdio:'ignore'});
const work = await mkdtemp(join(tmpdir(),'studio-browser-'));
let browser;
try {
  for (const url of ['http://127.0.0.1:18000/openapi.json','http://127.0.0.1:18517']) {
    let ready=false;
    for(let i=0;i<100;i++) {
      try {if((await fetch(url)).ok){ready=true;break;}} catch {}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert(ready,`Server did not start: ${url}`);
  }
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  let requests=0;
  await page.route('http://localhost:8000/api/simulate',async route=>{
    requests++;
    await new Promise(resolve=>setTimeout(resolve,300));
    const response=await route.fetch({url:'http://127.0.0.1:18000/api/simulate'});
    await route.fulfill({response});
  });
  await page.goto('http://127.0.0.1:18517');
  await page.getByRole('button',{name:'Reset to exact Closed Box anchor'}).click();
  // Discover the actual run label from the rendered header if copy evolves.
  const runButton=page.locator('button').filter({hasText:/^Run /}).first();
  await runButton.click();
  await page.getByRole('status').filter({hasText:'Current result available'}).waitFor();
  const observable=page.getByLabel('Current observable');
  assert.equal(await observable.inputValue(),'spl','Closed Box must display its front SPL by default');
  assert(await page.locator('canvas').count()>0,'Chart canvas missing');
  const bounds=await page.locator('.results-chart').boundingBox();
  assert(bounds && bounds.height>=360,'Results chart must not collapse');
  await page.getByRole('button',{name:'Files & details',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Save Canonical Model',exact:true}).click();
  const download=await downloadPromise; const filename=join(work,'model.json');
  await download.saveAs(filename);
  const saved=JSON.parse(await readFile(filename,'utf8'));
  assert(saved.driver && saved.elements.length>0);
  await page.locator('input[type=file]').setInputFiles(filename);
  await page.getByRole('button',{name:'Run Loaded Canonical Model',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Current result available'}).waitFor();
  await page.getByRole('button',{name:'Files & details',exact:true}).click();
  await page.getByText('Current loaded override',{exact:true}).waitFor();
  await page.locator('input[type=file]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
  assert((await page.locator('body').innerText()).includes('JSON'));
  await page.getByRole('button',{name:'Revert Active Source to Graph-Derived Model'}).click();
  await page.getByRole('status').filter({hasText:'Stale result'}).waitFor();
  // Holding a request open must prevent a second run, even on a rapid click.
  const before=requests;
  await runButton.click();
  assert(await page.getByRole('button',{name:'Simulating…',exact:true}).isDisabled());
  await page.getByRole('status').filter({hasText:'Current result available'}).waitFor();
  await runButton.waitFor({state:'visible'});
  assert.equal(requests,before+1);
  // Failed rerun exposes an error and releases the run control.
  await page.unroute('http://localhost:8000/api/simulate');
  await page.route('http://localhost:8000/api/simulate',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'OS-LEM kernel is unavailable'})}));
  await runButton.click();
  await page.getByText('OS-LEM kernel is unavailable',{exact:true}).waitFor();
  assert(await runButton.isEnabled());
  assert.deepEqual(errors,[]);
  console.log('PASS: real Chromium run, SPL chart, download/upload, source lifecycle, request lock and service error.');
} finally {
  if(browser) await browser.close();
  backend.kill(); frontend.kill();
  await rm(work,{recursive:true,force:true});
}
