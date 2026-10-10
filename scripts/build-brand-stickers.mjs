/** Original vector stickers; retains the published atlas rectangles and RGBA UV contract. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url),deps=[root,path.join(root,'../Daily-Design-ActiveTheory')];
const sharp=require(require.resolve('sharp',{paths:deps}));
const sourceDir=path.join(root,'src/textures'),out=path.join(root,'brand-assets/textures/tunnels');
await fs.mkdir(sourceDir,{recursive:true});await fs.mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const runtime=await fs.readFile(path.join(root,'reference/_astro/hoisted.CUO_IjfL.js'),'utf8');
const literal=runtime.match(/goalWhiteTunnelStickerData=(\[.*?\]);/)[1];
const slots=JSON.parse(literal.replace(/([xywh]):/g,'"$1":'));assert.equal(slots.length,26);
const glyph=JSON.parse(await fs.readFile(path.join(root,'src/models/bodoni-moda-italic-D.json'),'utf8'));
const dPath=glyph.commands.map(c=>c.type==='M'||c.type==='L'?`${c.type}${c.x} ${-c.y}`:c.type==='Q'?`Q${c.x1} ${-c.y1} ${c.x} ${-c.y}`:c.type==='C'?`C${c.x1} ${-c.y1} ${c.x2} ${-c.y2} ${c.x} ${-c.y}`:'Z').join(' ');
const fontPath=path.join(root,'brand-assets/media/fonts/bodoni-moda-italic.ttf'),fontBytes=await fs.readFile(fontPath);
const threeEntry=require.resolve('three',{paths:deps}),{default:opentype}=await import(path.join(path.dirname(threeEntry),'../examples/jsm/libs/opentype.module.js'));
const font=opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset,fontBytes.byteOffset+fontBytes.byteLength));
function text(content,x,y,w,h,color='#111'){const p=font.getPath(content,0,0,100),b=p.getBoundingBox(),s=Math.min(w/(b.x2-b.x1),h/(b.y2-b.y1));return`<path d="${p.toPathData(3)}" transform="translate(${x-b.x1*s} ${y-b.y1*s}) scale(${s})" fill="${color}" stroke="${color}" stroke-width=".35"/>`;}
const col={blue:'#2659ff',sky:'#81dfff',lime:'#c9f53b',pink:'#e390ff',coral:'#ff725e',white:'#fffef6',black:'#11111b'};
const rect=(x,y,w,h,r,fill)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
const circle=(x,y,r,fill)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const line=(x1,y1,x2,y2,stroke=col.black,width=3)=>`<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`;
const D=(x,y,w,h,color)=>`<path d="${dPath}" transform="translate(${x+71*w/1497} ${y+h}) scale(${w/1497} ${h/1500})" fill="${color}" stroke="${color}" stroke-width="3"/>`;
const star=(x,y,r1,r2,points,fill)=>{let d='';for(let i=0;i<points*2;i++){const a=i*Math.PI/points-Math.PI/2,r=i%2?r2:r1;d+=(i?'L':'M')+(x+Math.cos(a)*r)+' '+(y+Math.sin(a)*r);}return`<path d="${d}Z" fill="${fill}"/>`;};
const cursor=(fill=col.white)=>`<path d="M13 7L80 50L53 56L68 84L52 92L37 63L17 81Z" fill="${fill}"/>`;
const motifs=[
  {id:'daily-disc',w:100,h:100,body:circle(50,50,44,col.blue)+circle(50,50,31,col.white)+D(30,26,39,47,col.black)},
  {id:'elastic-ui',w:100,h:130,body:`<path d="M14 12Q55 -5 86 20Q101 38 83 62Q72 77 81 99Q87 122 66 121Q51 124 45 101Q37 84 27 98Q10 115 7 94Q4 79 15 66Q-2 40 14 12Z" fill="${col.lime}"/>`+text('UI',22,24,55,40)+`<path d="M21 71Q48 89 73 65" fill="none"/>`},
  {id:'bezier-handles',w:100,h:130,body:rect(7,8,86,112,15,col.white)+`<path d="M23 101C88 111 6 25 78 28" fill="none" stroke="${col.blue}" stroke-width="13"/>`+line(23,101,72,101)+line(78,28,26,28)+circle(23,101,7,col.lime)+circle(72,101,5,col.pink)+circle(78,28,7,col.lime)+circle(26,28,5,col.pink)},
  {id:'interface-cards',w:110,h:115,body:`<g transform="rotate(-11 55 57)">`+rect(14,8,81,83,8,col.blue)+rect(7,24,81,83,8,col.white)+line(8,42,87,42)+circle(17,33,2,col.coral)+circle(26,33,2,col.lime)+rect(17,53,27,38,4,col.pink)+rect(51,53,27,15,4,col.sky)+rect(51,76,27,15,4,col.lime)+`</g>`},
  {id:'orbital-geometry',w:100,h:100,body:circle(50,50,43,col.pink)+`<ellipse cx="50" cy="50" rx="38" ry="14" transform="rotate(-28 50 50)" fill="none" stroke-width="5"/><ellipse cx="50" cy="50" rx="14" ry="37" transform="rotate(-28 50 50)" fill="none" stroke-width="5"/>`+circle(50,50,10,col.white)+circle(77,33,7,col.lime)},
  {id:'pointer-focus',w:100,h:100,body:circle(50,50,43,col.lime)+`<g transform="translate(17 14) scale(.73)">${cursor(col.white)}</g>`},
  {id:'motion-path',w:135,h:105,body:`<path d="M13 78C30 80 24 25 54 33S73 96 110 34" fill="none" stroke="${col.white}" stroke-width="23"/><path d="M13 78C30 80 24 25 54 33S73 96 110 34" fill="none" stroke="${col.blue}" stroke-width="12"/><path d="M88 28L125 13L118 53Z" fill="${col.lime}"/>`+circle(13,78,9,col.pink)},
  {id:'faceted-prism',w:100,h:130,body:`<path d="M28 9L69 9L91 44L70 119L25 107L8 47Z" fill="${col.sky}"/><path d="M28 9L40 43L69 9M8 47L40 43L91 44M40 43L70 119M40 43L25 107" fill="none"/><path d="M69 9L91 44L70 119L40 43Z" fill="${col.blue}"/><path d="M8 47L40 43L25 107Z" fill="${col.pink}"/>`},
  {id:'speed-vector',w:100,h:125,body:`<path d="M62 8L12 67L45 70L29 116L90 50L57 47Z" fill="${col.lime}"/>`+line(13,31,35,20,col.blue,5)+line(61,100,88,85,col.pink,5)},
  {id:'optical-droplet',w:72,h:110,body:`<path d="M36 7C28 35 7 52 9 76C11 110 65 110 63 76C63 50 44 34 36 7Z" fill="${col.sky}"/><path d="M36 31C32 55 58 66 43 91C74 81 49 48 36 31Z" fill="${col.blue}"/><path d="M22 65Q14 82 26 90" fill="none" stroke="white" stroke-width="5"/>`},
  {id:'radial-grid',w:100,h:105,body:star(50,53,45,33,8,col.white)+rect(25,28,50,50,8,col.lime)+line(25,53,75,53)+line(50,28,50,78)+circle(50,53,9,col.blue)},
  {id:'daily-optical-badge',w:100,h:100,body:circle(50,50,44,col.black)+circle(50,50,30,col.white)+D(29,24,42,49,col.black)+`<path d="M65 13Q75 14 82 22M14 70Q18 81 27 85" fill="none" stroke="white" stroke-width="4"/>`},
  {id:'toggle-state',w:110,h:95,body:`<g transform="rotate(-17 55 47)">`+rect(9,20,92,54,27,col.blue)+circle(74,47,21,col.white)+circle(31,47,5,col.lime)+`</g>`},
  {id:'ui-ux-letterforms',w:155,h:90,body:`<path d="M10 13L138 7L148 66L87 65L59 84L57 65L8 73Z" fill="${col.pink}"/>`+text('UI / UX',22,21,111,36)},
  {id:'depth-stack',w:95,h:160,body:`<path d="M12 92L56 76L84 97L41 114Z" fill="${col.blue}"/><path d="M12 92V126L41 150V114Z" fill="${col.pink}"/><path d="M41 114L84 97V131L41 150Z" fill="${col.sky}"/><path d="M11 56L55 38L84 60L40 79Z" fill="${col.lime}"/><path d="M11 56V77L40 100V79Z" fill="${col.white}"/><path d="M40 79L84 60V82L40 100Z" fill="${col.coral}"/><path d="M11 21L56 6L83 26L40 43Z" fill="${col.pink}"/><path d="M11 21V39L40 61V43Z" fill="${col.sky}"/><path d="M40 43L83 26V45L40 61Z" fill="${col.blue}"/>`},
  {id:'selection-pivot',w:110,h:100,body:rect(17,15,77,68,3,col.white)+`<path d="M28 70L53 28L84 69Z" fill="${col.coral}"/>`+[rect(12,10,11,11,1,col.blue),rect(88,10,11,11,1,col.blue),rect(12,77,11,11,1,col.blue),rect(88,77,11,11,1,col.blue)].join('')+circle(54,50,7,col.lime)},
  {id:'focus-lenses',w:115,h:90,body:circle(33,43,26,col.white)+circle(82,43,26,col.white)+circle(38,43,16,col.blue)+circle(77,43,16,col.pink)+circle(39,43,6,col.black)+circle(76,43,6,col.black)+line(4,74,108,74,col.lime,7)},
  {id:'timeline-scrubber',w:85,h:185,body:rect(12,7,61,170,24,col.white)+line(43,28,43,158,col.blue,8)+circle(43,118,23,col.lime)+`<path d="M36 106L54 118L36 130Z" fill="${col.black}"/>`+line(22,41,32,41)+line(22,61,32,61)+line(22,81,32,81)+line(54,142,64,142)},
  {id:'play-pause',w:120,h:95,body:`<g transform="rotate(-24 60 48)">`+rect(8,16,104,63,30,col.lime)+`<path d="M27 31L52 48L27 64Z" fill="${col.black}"/>`+rect(71,30,8,34,1,col.blue)+rect(87,30,8,34,1,col.blue)+`</g>`},
  {id:'prototype-window',w:125,h:115,body:rect(8,12,109,92,10,col.sky)+line(8,33,117,33)+circle(20,23,3,col.coral)+circle(32,23,3,col.lime)+`<path d="M36 47L20 63L36 79M86 47L102 63L86 79M70 43L54 83" fill="none" stroke-width="7"/>`},
  {id:'spring-interaction',w:100,h:135,body:circle(48,20,13,col.lime)+`<path d="M48 33L31 43L70 57L28 70L69 85L43 97" fill="none" stroke="${col.white}" stroke-width="15"/><path d="M48 33L31 43L70 57L28 70L69 85L43 97" fill="none" stroke="${col.blue}" stroke-width="7"/>`+rect(18,101,65,23,9,col.pink)+line(49,97,49,102)},
  {id:'daily-wordmark',w:185,h:75,body:`<path d="M9 10L173 5L179 61L13 69Z" fill="${col.white}"/>`+text('Daily Design .Art',20,19,149,29)+line(22,55,160,51,col.blue,4)},
  {id:'mobile-interface',w:100,h:195,body:rect(8,5,84,184,18,col.blue)+rect(16,16,68,160,10,col.white)+rect(34,23,30,5,3,col.black)+rect(24,41,52,48,8,col.pink)+circle(50,65,14,col.lime)+rect(24,99,52,13,5,col.sky)+rect(24,120,22,25,5,col.coral)+rect(54,120,22,25,5,col.lime)+line(39,162,61,162,col.black,4)},
  {id:'material-sliders',w:80,h:180,body:rect(8,6,65,167,16,col.pink)+line(27,29,27,149,col.black,5)+line(54,29,54,149,col.black,5)+circle(27,59,13,col.white)+circle(54,123,13,col.lime)+circle(54,40,5,col.blue)+circle(27,144,5,col.blue)},
  {id:'interaction-pad',w:100,h:110,body:rect(8,9,84,89,25,col.lime)+circle(51,53,30,col.white)+`<path d="M44 27H58V45H76V60H58V79H44V60H26V45H44Z" fill="${col.blue}"/>`+circle(79,91,7,col.pink)},
  {id:'chromatic-refraction',w:120,h:115,body:`<path d="M61 8L108 91L14 91Z" fill="${col.white}"/><path d="M61 8L61 91L108 91Z" fill="${col.sky}"/><path d="M5 56L41 56L63 72L116 36" fill="none" stroke="${col.pink}" stroke-width="8"/><path d="M5 64L41 64L63 79L116 50" fill="none" stroke="${col.blue}" stroke-width="8"/><path d="M5 72L41 72L63 86L116 64" fill="none" stroke="${col.lime}" stroke-width="8"/>`}
];
assert.equal(motifs.length,slots.length);
const defs=`<defs><filter id="outline" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="2.3" result="expanded"/><feFlood flood-color="white"/><feComposite in2="expanded" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>${slots.map((s,i)=>`<clipPath id="slot-${i}"><rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}"/></clipPath>`).join('')}</defs>`;
const groups=slots.map((s,i)=>{const m=motifs[i],pad=7,scale=Math.min((s.w-pad*2)/m.w,(s.h-pad*2)/m.h),x=s.x+(s.w-m.w*scale)/2,y=s.y+(s.h-m.h*scale)/2;return`<g id="${m.id}" clip-path="url(#slot-${i})"><g transform="translate(${x} ${y}) scale(${scale})" stroke="${col.black}" stroke-width="2.7" stroke-linejoin="round" stroke-linecap="round" filter="url(#outline)">${m.body}</g></g>`;}).join('\n');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1465" height="1024" viewBox="0 0 1465 1024">${defs}\n${groups}\n</svg>`;
await fs.writeFile(path.join(sourceDir,'tunnel-stickers.svg'),svg);
await sharp(Buffer.from(svg)).png({palette:false}).toFile(path.join(out,'stickers.png'));
await sharp(path.join(out,'stickers.png')).resize(733,512,{fit:'fill',kernel:'lanczos3'}).png({palette:false}).toFile(path.join(out,'stickers_low.png'));
const report={generator:'scripts/build-brand-stickers.mjs',source:'src/textures/tunnel-stickers.svg',sourceSha256:sha(Buffer.from(svg)),sourceRuntime:'reference/_astro/hoisted.CUO_IjfL.js',font:{path:'brand-assets/media/fonts/bodoni-moda-italic.ttf',sha256:sha(fontBytes),method:'OpenType outline paths embedded into SVG; no system font fallback'},contract:{atlasSize:[1465,1024],lowSize:[733,512],channels:4,alpha:'Transparent outside authored cutout stickers; source pixel artwork not reused',slotsUnchanged:true,runtimeChanges:'Texture mapping only; all 26 UV rectangles, rotation, trajectory, spawn count, scaling, blending, fade and interaction remain unchanged'},slots:slots.map((slot,i)=>({...slot,id:motifs[i].id})),files:[]};
for(const[name,w,h]of[['stickers.png',1465,1024],['stickers_low.png',733,512]]){
  const dest=path.join(out,name),meta=await sharp(dest).metadata();assert.equal(meta.width,w);assert.equal(meta.height,h);assert.equal(meta.channels,4);assert.ok(meta.hasAlpha);
  const {data,info}=await sharp(dest).raw().toBuffer({resolveWithObject:true});let transparent=0,opaque=0,partial=0;for(let p=3;p<data.length;p+=4)if(data[p]===0)transparent++;else if(data[p]===255)opaque++;else partial++;
  assert.ok(transparent>0&&opaque>0&&partial>0);assert.equal(data[3],0);
  const coverage=slots.map(s=>{const x0=Math.floor(s.x/1465*w),y0=Math.floor(s.y/1024*h),x1=Math.ceil((s.x+s.w)/1465*w),y1=Math.ceil((s.y+s.h)/1024*h);let alpha=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)alpha+=data[(y*w+x)*4+3]>0?1:0;assert.ok(alpha>20);return alpha/((x1-x0)*(y1-y0));});
  report.files.push({path:'brand-assets/textures/tunnels/'+name,sha256:sha(await fs.readFile(dest)),width:w,height:h,channels:info.channels,transparent,opaque,partial,slotAlphaCoverage:coverage});
}
const mapPath=path.join(root,'brand-assets/models/runtime-map.json'),map=JSON.parse(await fs.readFile(mapPath,'utf8'));
for(const name of ['stickers.png','stickers_low.png'])map.replacements['/assets/textures/tunnels/'+name]='/brand-assets/textures/tunnels/'+name;
await fs.writeFile(mapPath,JSON.stringify(map,null,2)+'\n');
await fs.writeFile(path.join(sourceDir,'tunnel-stickers-manifest.json'),JSON.stringify(report,null,2)+'\n');
const previewDir=path.join(root,'分析/lusion-2026-10-10/models');await fs.mkdir(previewDir,{recursive:true});
await sharp(path.join(out,'stickers.png')).flatten({background:'#e9eaf0'}).png().toFile(path.join(previewDir,'tunnel-stickers-review.png'));
console.log(JSON.stringify({slots:slots.length,files:report.files.map(({path,width,height,channels,transparent,opaque,partial})=>({path,width,height,channels,transparent,opaque,partial})),runtimeMapEntries:Object.keys(map.replacements).length},null,2));
