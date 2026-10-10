import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve,join,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
let threeRoot;
for(const base of [root,resolve(root,'../建筑切片'),resolve(root,'../../../daily-design')]){
 try{threeRoot=dirname(dirname(require.resolve('three',{paths:[base]})));break;}catch{}
}
if(!threeRoot)throw new Error('An existing Three.js installation with opentype.module.js is required.');
const {default:opentype}=await import(pathToFileURL(join(threeRoot,'examples/jsm/libs/opentype.module.js')));
const files={daily:'/System/Library/Fonts/Supplemental/Times New Roman.ttf',design:resolve(root,'brand-assets/media/fonts/bodoni-moda-italic.ttf'),ui:resolve(root,'reference/assets/fonts/Aeonik-Regular.woff')};
const fonts={},sources={};
for(const [id,file] of Object.entries(files)){const bytes=await readFile(file);fonts[id]=opentype.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));sources[id]={path:relative(root,file),font:fonts[id].names.fullName?.en,sha256:createHash('sha256').update(bytes).digest('hex')};}
function lettering(id,text,x,y,size,width){
 const p=fonts[id].getPath(text,0,0,size),b=p.getBoundingBox();
 const sx=width===undefined?1:width/(b.x2-b.x1);
 for(const c of p.commands)for(const k of ['x','x1','x2'])if(k in c)c[k]=x+(c[k]-b.x1)*sx;
 for(const c of p.commands)for(const k of ['y','y1','y2'])if(k in c)c[k]+=y;
 return p.toPathData(3);
}
const shapes={
 wordmark:{viewBox:'0 0 260 52',d:[lettering('daily','Daily',0,40,29,64),lettering('design','Design',66,42,48,148),lettering('design','.Art',218,20,20,39)].join(' ')},
 monogram:{viewBox:'0 0 40 48',d:lettering('design','D',2,39,48,36)},
 studies:{viewBox:'0 0 311 56',d:lettering('ui','STUDIES',0,46,56,310)},
 notes:{viewBox:'0 0 1440 1250',d:[lettering('ui','STUDY',25,550,500,1390),lettering('ui','NOTES',25,1100,500,1390)].join(' ')}
};
await mkdir(resolve(root,'brand-content'),{recursive:true});
await writeFile(resolve(root,'brand-content/lettering.json'),JSON.stringify({generator:'node scripts/build-brand-lettering.mjs',sources,shapes,note:'Existing brand typography converted to real SVG path commands for the original SVGLoader. SVG text nodes are not supported by that runtime. No font file from the operating system is redistributed.'},null,2)+'\n');
console.log(JSON.stringify({lettering:Object.keys(shapes),allHaveMove: Object.values(shapes).every(s=>s.d.startsWith('M'))}));
