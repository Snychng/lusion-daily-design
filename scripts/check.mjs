import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'), checks=[];
function check(name,pass,detail){checks.push({name,pass:!!pass,...(detail?{detail}: {})});}
async function exists(p){try{await fs.access(path.join(root,p));return true}catch{return false}}
for(const file of ['scripts/build.mjs','scripts/serve.mjs','src/local-player.js','dist/_astro/hoisted.CUO_IjfL.js']){const r=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});check('syntax '+file,r.status===0,r.stderr||undefined);}
const walk=async d=>{const all=[];for(const f of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())all.push(...await walk(p));else all.push(p);}return all;};
const originals=await walk(path.join(root,'reference'));
for(const f of originals){check('original exists '+path.relative(root,f),(await fs.stat(f)).size>0);}
const mf=JSON.parse(await fs.readFile(path.join(root,'分析/20261010-live/asset-manifest.json'),'utf8'));
const rows=mf.assets||mf.files||mf;
if(Array.isArray(rows))for(const row of rows){const p=row.file||row.localPath||row.local_path||row.path;const hash=row.sha256;if(p&&hash){let file=path.isAbsolute(p)?p:path.join(root,p);if(!await fs.access(file).then(()=>true,()=>false))file=path.join(root,'reference',p.replace(/^\//,''));const buf=await fs.readFile(file);check('original SHA-256 '+p,createHash('sha256').update(buf).digest('hex')===hash);}}
const pages=(await walk(path.join(root,'dist'))).filter(f=>f.endsWith('.html'));
check('22 pages retained',pages.length===22,pages.length);
for(const f of pages){const s=await fs.readFile(f,'utf8');check('brand title '+path.relative(root,f),/<title>[^<]*Daily Design/.test(s));check('no original contacts '+path.relative(root,f),!/(mailto:[^"']*lusion|business@lusion|hello@lusion)/i.test(s));check('slogan '+path.relative(root,f),s.includes('Explore the art of UI, one day at a time.'));check('GitHub '+path.relative(root,f),s.includes('https://github.com/Snychng/daily-design'));check('no analytics '+path.relative(root,f),!s.includes('googletagmanager.com'));}
const routes=JSON.parse(await fs.readFile(path.join(root,'brand-content/routes.json'),'utf8'));
check('19 branded project routes',Object.keys(routes.slugMap||{}).length===19);
check('38 dynamic thumbnail aliases',Object.keys(routes.assetAliases||{}).length===38);
for(const [from,to]of Object.entries(routes.pages||{})){check('branded route '+to,await exists('dist/'+to));check('original project page removed '+from,!await exists('dist/'+from));}
for(const [alias,source]of Object.entries(routes.assetAliases||{})){
 const aliasFile='dist/'+alias.replace(/^\//,''),sourceFile='dist/'+source.replace(/^\//,'');
 const available=await exists(aliasFile)&&await exists(sourceFile);check('route thumbnail '+alias,available);
 if(available){const a=await fs.readFile(path.join(root,aliasFile)),b=await fs.readFile(path.join(root,sourceFile));check('route thumbnail parity '+alias,a.equals(b));}
}
for(const f of pages){const s=await fs.readFile(f,'utf8');for(const old of Object.keys(routes.slugMap||{})){check('no old visible route '+old+' '+path.relative(root,f),!s.includes('href="/projects/'+old+'"')&&!s.includes('href="/projects/'+old+'/"')&&!s.includes('data-id="'+old+'"')&&!s.includes('data-next-id="'+old+'"'));}check('canonical route '+path.relative(root,f),s.includes('rel="canonical"'));}
const js=await fs.readFile(path.join(root,'dist/_astro/hoisted.CUO_IjfL.js'),'utf8');
for(const q of ['GoalTunnelAstronauts','GoalTunnelGlass','GoalBlackTunnel','GoalWhiteTunnel','FlipAnimation','AboutHeroParticlesSimulation','HomeBalloonsPhysics','DailyLocalPlayer'])check('runtime retained '+q,js.includes(q));
check('no instantiated Vimeo player',!js.includes('new Player("video-overlay__vimeo-video"'));
check('no Mailchimp endpoint',!js.includes('list-manage.com'));
check('brand team default',js.includes('faceId="daily"'));
const media=JSON.parse(await fs.readFile(path.join(root,'brand-content/media-map.json'),'utf8'));
for(const [from,to]of Object.entries(media.replacements||{})){check('media source '+to,await exists(to.replace(/^\//,'')));check('media slot '+from,await exists('dist/'+from.replace(/^\//,'')));}
const report={at:new Date().toISOString(),passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length,checks};await fs.writeFile(path.join(root,'分析/20261010-live/checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed,failures:checks.filter(x=>!x.pass)},null,2));if(report.failed)process.exitCode=1;
