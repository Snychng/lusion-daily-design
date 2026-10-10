import {chromium} from '../../Hashgraph-Daily-Design/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs/promises';
const root=path.resolve(import.meta.dirname,'..'),dir=path.join(root,'分析/20261010-live');
const mode=process.argv[2]||'reference';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});const page=await context.newPage();
const errors=[],responses=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)responses.push({url:r.url(),status:r.status()});});
await page.route('https://**',r=>{external.push(r.request().url().split('?')[0]);return r.abort()});
try{for(const [p,name]of [['/','home'],['/about','about']]){await page.goto('http://127.0.0.1:4207'+p,{waitUntil:'domcontentloaded'});await page.waitForTimeout(7000);await page.screenshot({path:path.join(dir,`${mode}-smoke-${name}.png`)});console.log(JSON.stringify({page:p,title:await page.title(),canvas:await page.locator('canvas').count(),body:(await page.locator('body').innerText()).slice(0,120),errors,responses}));}}finally{await browser.close();}
await fs.writeFile(path.join(dir,`${mode}-smoke.json`),JSON.stringify({errors,responses,external:[...new Set(external)]},null,2));
