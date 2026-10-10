import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const dist=path.join(root,'dist');
await fs.rm(dist,{recursive:true,force:true});await fs.cp(path.join(root,'reference'),dist,{recursive:true});
const routes=JSON.parse(await fs.readFile(path.join(root,'brand-content/routes.json'),'utf8'));
for(const from of Object.keys(routes.pages)){await fs.rm(path.dirname(path.join(dist,from)),{recursive:true,force:true});}
await fs.cp(path.join(root,'brand-content/pages'),dist,{recursive:true});
await fs.cp(path.join(root,'brand-assets'),path.join(dist,'brand-assets'),{recursive:true});
await fs.mkdir(path.join(dist,'brand-content'),{recursive:true});
for(const name of await fs.readdir(path.join(root,'brand-content'))){if(name==='pages')continue;const p=path.join(root,'brand-content',name);if((await fs.stat(p)).isFile())await fs.copyFile(p,path.join(dist,'brand-content',name));}
const media=JSON.parse(await fs.readFile(path.join(root,'brand-content/media-map.json'),'utf8'));
const replacements=media.replacements||{};
for(const [from,to] of Object.entries(replacements)){const src=path.join(root,to.replace(/^\//,''));const dest=path.join(dist,from.replace(/^\//,''));await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(src,dest);}
for(const [alias,source] of Object.entries(routes.assetAliases)){const dest=path.join(dist,alias.replace(/^\//,''));await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(path.join(dist,source.replace(/^\//,'')),dest);}
const modelsPath=path.join(root,'brand-assets/models/runtime-map.json');
try{const map=JSON.parse(await fs.readFile(modelsPath,'utf8'));for(const [from,to]of Object.entries(map.replacements||map)){if(typeof to!=='string')continue;const dest=path.join(dist,from.replace(/^\//,''));await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(path.join(root,to.replace(/^\//,'')),dest);}}catch(e){if(e.code!=='ENOENT')throw e;}
let js=await fs.readFile(path.join(dist,'_astro/hoisted.CUO_IjfL.js'),'utf8');const patches=[];
function patch(a,b,label){if(!js.includes(a))throw Error('Missing runtime contract: '+label);js=js.replace(a,b);patches.push(label);}
const first=js.indexOf('class NewletterForm'),last=js.indexOf('class FooterSection',first);
if(first<0||last<0)throw Error('Newsletter contract missing');
js=js.slice(0,first)+`class NewletterForm{constructor(e,t,r){this.domNewsletterForm=e;this.domNewsletterButton=t;this.domNewsletterMessage=r;const go=n=>{n.preventDefault();window.open('https://github.com/Snychng/daily-design','_blank','noopener,noreferrer');};e.addEventListener('submit',go);t.addEventListener('click',go);}}`+js.slice(last);patches.push('Replace Mailchimp submission with explicit GitHub navigation');
js=js.replace(/MAILCHIMP_URL="[^"]*"/,'MAILCHIMP_URL=""');
const sdkStart=js.indexOf('/*! @vimeo/player v2.30.4'), sdkEnd=js.indexOf('const VIDEO_LIST=',sdkStart);
if(sdkStart<0||sdkEnd<sdkStart)throw Error('Vimeo SDK boundary missing');
js=js.slice(0,sdkStart)+js.slice(sdkEnd);patches.push('Remove inactive remote Vimeo SDK and automatic embeds');
const adapter=await fs.readFile(path.join(root,'src/local-player.js'),'utf8');
patch('const VIDEO_LIST=',`window.DAILY_MEDIA=${JSON.stringify({reel:media.reel,videos:media.videos})};\n${adapter}\nconst VIDEO_LIST=`,'Local recorded-study player adapter');
patch('new Player("video-overlay__vimeo-video",e)','new DailyLocalPlayer("video-overlay__vimeo-video",e)','Keep original overlay and replace remote player');
patch('["#061dfb","#ADFF00","#f6000e","#7e09f5","#ffc000"]','["#7560ee","#62dfce","#e9779b","#c0a9ed","#efba85"]','Own content palette; original material response unchanged');
patch('this.isVideoPlaying?"Play":"Pause"','this.isVideoPlaying?"Pause":"Play"','Keep playback control label consistent');
patch('open(){this.isOpened=!0,setTimeout(()=>{this.videoPlayer.play().then(()=>{this.resize(),this.isVideoPlaying=!0})},500)}close(){this.isVideoReady&&(this.isOpened=!1,this.videoPlayer.pause().then(()=>{this.videoPlayer.setCurrentTime(0).then(()=>{}),this.needsReset=!0,this.isVideoPlaying=!1,this.isProjectPage=!1}))}',
 'open(){clearTimeout(this.playTimer);this.isOpened=!0;this.playTimer=setTimeout(()=>{if(!this.isOpened)return;this.videoPlayer.play().then(()=>{if(!this.isOpened){this.videoPlayer.pause();return}this.resize();this.isVideoPlaying=!0;this.domVideoPlayBtn.textContent="Pause"})},500)}close(){clearTimeout(this.playTimer);this.isOpened=!1;if(this.isVideoReady)this.videoPlayer.pause().then(()=>{this.videoPlayer.setCurrentTime(0);this.needsReset=!0;this.isVideoPlaying=!1;this.isProjectPage=!1})}',
 'Cancel deferred playback on overlay close and guard asynchronous play');
patch('this.videoPlayer.setCurrentTime(this.videoDuration*r).then(()=>{this.videoPlayer.play()}).catch(n=>{this.videoPlayer.play()})','this.videoPlayer.setCurrentTime(this.videoDuration*r).then(()=>{if(this.isOpened)this.videoPlayer.play()}).catch(n=>{if(this.isOpened)this.videoPlayer.play()})','Do not resume a seek after closing the overlay');
js=js.replace('preRun();Object.assign','document.addEventListener("keydown",e=>{if(e.key==="Escape"&&videoOverlay.isOpened)videoOverlay.close()});preRun();Object.assign');
js=js.replace('Created by Lusion: https://lusion.co/','Published runtime by Lusion; local study adapted for Daily Design .Art');
// Optional geometry-specific shader corrections supplied with the procedural assets.
try{const modelPatches=JSON.parse(await fs.readFile(path.join(root,'brand-assets/models/runtime-patches.json'),'utf8'));for(const p of modelPatches)patch(p.from,p.to,p.label);}catch(e){if(e.code!=='ENOENT')throw e;}
await fs.writeFile(path.join(dist,'_astro/hoisted.CUO_IjfL.js'),js);
const cssFile=path.join(dist,'_astro/about.CNa9RfUh.css');let css=await fs.readFile(cssFile,'utf8');
css=css.replaceAll('--color-blue:#1a2ffb','--color-blue:#6455ef').replaceAll('--color-blue: #1a2ffb','--color-blue: #6455ef');
await fs.writeFile(cssFile,css);
const files=[];async function walk(d){for(const f of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())await walk(p);else files.push(p);}}await walk(dist);
for(const f of files.filter(x=>x.endsWith('.html'))){let html=await fs.readFile(f,'utf8');html=html.replace(/<script[^>]*src="https:\/\/www\.googletagmanager[^>]*><\/script>/g,'').replace(/<script>\s*window\.dataLayer[\s\S]*?<\/script>/g,'');html=html.replace('</head>','<meta http-equiv="Content-Security-Policy" content="connect-src \'self\'; media-src \'self\' blob:; frame-src \'none\'"></head>');await fs.writeFile(f,html);}
const report={builtAt:new Date().toISOString(),files:files.length,runtimeSha256:createHash('sha256').update(js).digest('hex'),patches,modelMapPresent:await fs.access(modelsPath).then(()=>true,()=>false)};
await fs.writeFile(path.join(root,'分析/20261010-live/build.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
