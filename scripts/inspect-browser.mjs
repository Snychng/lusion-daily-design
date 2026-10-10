import {chromium} from '../../Hashgraph-Daily-Design/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'), out=path.join(root,'分析/20261010-live');
const opts=JSON.parse(process.argv[2]||'{}');
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const context=browser.contexts()[0];
const page=context.pages().find(p=>p.url().startsWith('https://lusion.co/')||p.url().includes('127.0.0.1:4207'));
if(!page)throw new Error('Lusion task tab not found');
if(opts.viewport)await page.setViewportSize(opts.viewport);
if(opts.mobile!==undefined){const c=await context.newCDPSession(page);await c.send('Emulation.setTouchEmulationEnabled',{enabled:opts.mobile});await c.send('Network.setUserAgentOverride',{userAgent:opts.mobile?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1':''});await c.detach();}
if(opts.shot)await page.screenshot({path:path.join(out,opts.shot)});
const info=await page.evaluate(()=>({url:location.href,title:document.title,viewport:[innerWidth,innerHeight,devicePixelRatio],text:document.body.innerText,links:[...document.querySelectorAll('a')].map(a=>({text:a.innerText,href:a.getAttribute('href')})),scripts:[...document.scripts].map(s=>s.src),resources:performance.getEntriesByType('resource').map(r=>({url:r.name,type:r.initiatorType,duration:r.duration})),canvas:[...document.querySelectorAll('canvas')].map(c=>({width:c.width,height:c.height})),sections:[...document.querySelectorAll('section,[id]')].filter(e=>e.getBoundingClientRect().height>100).map(e=>({tag:e.tagName,id:e.id,class:e.className,y:Math.round(e.getBoundingClientRect().y),height:Math.round(e.getBoundingClientRect().height)}))}));
if(opts.dom)await fs.writeFile(path.join(out,opts.dom),await page.content());
if(opts.save)await fs.writeFile(path.join(out,opts.save),JSON.stringify(info,null,2));
if(opts.perf){info.performance=await page.evaluate(()=>new Promise(resolve=>{const dt=[];let start=performance.now(),last=start;function f(t){dt.push(t-last);last=t;if(t-start<4000)requestAnimationFrame(f);else{dt.sort((a,b)=>a-b);resolve({frames:dt.length,elapsed:t-start,fps:dt.length/(t-start)*1000,p95:dt[Math.floor(dt.length*.95)],heap:performance.memory?.usedJSHeapSize});}}requestAnimationFrame(f);}));await fs.writeFile(path.join(out,opts.perf),JSON.stringify(info.performance,null,2));}
console.log(JSON.stringify({...info,resources:opts.resources?info.resources:info.resources.length,text:info.text.slice(0,opts.text||500)},null,2));
await browser.close();
