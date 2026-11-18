// Real Chromium check. Run with the same PYTHONPATH as check_optimisation_workflow.py.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root=new URL('../',import.meta.url).pathname;
const backend=spawn(process.env.PYTHON || 'python',['-m','uvicorn','server:app','--app-dir','backend','--host','127.0.0.1','--port','18000'],{cwd:root,stdio:'ignore'});
const frontend=spawn('node',['frontend/node_modules/vite/bin/vite.js','frontend','--host','127.0.0.1','--port','18517','--strictPort'],{cwd:root,stdio:'ignore'});
let browser;
try {
 for(const url of ['http://127.0.0.1:18000/openapi.json','http://127.0.0.1:18517']) {
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready);
 }
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1366,height:768}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://localhost:8000/api/**',async route=>{const response=await route.fetch({url:route.request().url().replace('http://localhost:8000','http://127.0.0.1:18000')});await route.fulfill({response});});
 await page.goto('http://127.0.0.1:18517');
 await page.getByRole('button',{name:/^Bass Reflex/}).click();
 await page.getByRole('button',{name:'Results',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Current result available'}).waitFor();
 await page.getByRole('button',{name:'Full-screen graph',exact:true}).click();
 await page.getByRole('button',{name:'Optimise',exact:true}).click();
 await page.getByLabel('Search evaluations',{exact:true}).fill('8');
 await page.getByLabel('Maximum excursion (mm)',{exact:true}).fill('100');
 await page.getByLabel('Maximum air volume (L)',{exact:true}).fill('300');
 await page.getByRole('button',{name:'Start optimisation',exact:true}).click();
 await page.locator('.optimisation-panel [role=status]').filter({hasText:'complete'}).waitFor({timeout:60000});
 assert(await page.locator('.opt-candidate').count()>0);
 const apply=page.locator('.opt-candidate button').filter({hasText:/Apply candidate [1-9]/}).first();await apply.click();
 await page.getByRole('button',{name:'Memorise',exact:true}).first().click();
 await page.getByRole('button',{name:'Undo last adjustment',exact:true}).click();
 const box=await page.locator('.results-chart').boundingBox();assert(box.height>600 && box.width>800);
 await page.screenshot({path:process.env.OPT_SCREENSHOT || '/tmp/oslem-opt-browser.png'});
 assert.deepEqual(errors,[]);console.log('PASS: Chromium BR search, full-screen graph, candidate Apply/Memorise/Undo, no browser errors at 1366×768.');
} finally {await browser?.close();frontend.kill('SIGTERM');backend.kill('SIGTERM');}
