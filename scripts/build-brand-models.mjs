/** Self-authored Daily Design meshes in Lusion's published BufItem wire format. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const dependencyRoots=[root,path.join(root,'../Daily-Design-ActiveTheory')];
const threeEntry=require.resolve('three',{paths:dependencyRoots});
const THREE = require(threeEntry);
const sharp = require(require.resolve('sharp',{paths:dependencyRoots}));
const { mergeVertices, mergeGeometries } = await import(path.join(path.dirname(threeEntry), '../examples/jsm/utils/BufferGeometryUtils.js'));
const { ShapePath, Shape, Path, ShapeGeometry, ShapeUtils, ExtrudeGeometry, BufferGeometry, BufferAttribute, Vector2, Vector3, BoxGeometry, TorusGeometry, TorusKnotGeometry, IcosahedronGeometry } = THREE;
const out = path.join(root, 'brand-assets');
const source = JSON.parse(await fs.readFile(path.join(root, 'src/models/bodoni-moda-italic-D.json'), 'utf8'));
const unionBytes=await fs.readFile(path.join(root,'src/models/monogram-union-contours.json'));
const unionContours=JSON.parse(unionBytes.toString('utf8'));
const manifest = { generator:'scripts/build-brand-models.mjs', generatedAt: new Date().toISOString(), sourceGlyph: {font:source.font,fontSha256:source.fontSha256,glyph:source.glyph}, files:[], notes:[] };
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
const sha = b=>createHash('sha256').update(b).digest('hex');
function seedRandom(seed=8297){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function glyphShapes(commands=source.commands,divisor=1000){
  const p=new ShapePath();
  for(const c of commands){
    if(c.type==='M')p.moveTo(c.x/divisor,c.y/divisor);
    else if(c.type==='L')p.lineTo(c.x/divisor,c.y/divisor);
    else if(c.type==='Q')p.quadraticCurveTo(c.x1/divisor,c.y1/divisor,c.x/divisor,c.y/divisor);
    else if(c.type==='C')p.bezierCurveTo(c.x1/divisor,c.y1/divisor,c.x2/divisor,c.y2/divisor,c.x/divisor,c.y/divisor);
    else if(c.type==='Z')p.currentPath.closePath();
  }
  return p.toShapes(false);
}

async function wordmark(){
  const outlinePath=path.join(root,'src/models/daily-design-art-wordmark.json');let outline;
  try{outline=JSON.parse(await fs.readFile(outlinePath,'utf8'));}catch{
    const fontPath=path.join(root,'../Daily-Design-ActiveTheory/src/assets/bodoni-moda-italic.ttf'),fontBytes=await fs.readFile(fontPath);
    const {default:opentype}=await import(path.join(path.dirname(threeEntry),'../examples/jsm/libs/opentype.module.js'));
    const font=opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset,fontBytes.byteOffset+fontBytes.byteLength));let advance=0;
    outline={text:'Daily Design .Art',font:font.names.fullName.en,fontSha256:sha(fontBytes),unitsPerEm:font.unitsPerEm,glyphs:[]};
    for(const character of outline.text){const glyph=font.charToGlyph(character);outline.glyphs.push({character,advance,commands:glyph.path.commands});advance+=glyph.advanceWidth;}
    await fs.writeFile(outlinePath,JSON.stringify(outline,null,2)+'\n');
  }
  const positions=[],indices=[],chars=[],components=[];let globalMin=[Infinity,Infinity],globalMax=[-Infinity,-Infinity];
  for(let i=0;i<outline.glyphs.length;i++){const glyph=outline.glyphs[i],shapes=glyphShapes(glyph.commands,outline.unitsPerEm);components.push({shapes,offset:glyph.advance/outline.unitsPerEm,char:i/(outline.glyphs.length-1)*5});for(const shape of shapes){const g=new ShapeGeometry(shape,12);g.computeBoundingBox();globalMin[0]=Math.min(globalMin[0],g.boundingBox.min.x+glyph.advance/outline.unitsPerEm);globalMax[0]=Math.max(globalMax[0],g.boundingBox.max.x+glyph.advance/outline.unitsPerEm);globalMin[1]=Math.min(globalMin[1],g.boundingBox.min.y);globalMax[1]=Math.max(globalMax[1],g.boundingBox.max.y);}}
  const scale=1/(globalMax[0]-globalMin[0]),height=(globalMax[1]-globalMin[1])*scale,yOffset=(.200956762-height)*.5;
  const append=(x,y,z,id)=>{const index=positions.length/3;positions.push((x-globalMin[0])*scale,(y-globalMin[1])*scale+yOffset,z);chars.push(id);return index;};
  for(const item of components)for(const shape of item.shapes){const g=new ShapeGeometry(shape,12),p=g.attributes.position,base=positions.length/3;for(let i=0;i<p.count;i++)append(p.getX(i)+item.offset,p.getY(i),1,item.char);for(const index of g.index.array)indices.push(index+base);
    const rings=[{ring:shape.getPoints(12),hole:false},...shape.holes.map(h=>({ring:h.getPoints(12),hole:true}))];
    for(const {ring,hole}of rings){if(ring[0].distanceTo(ring.at(-1))<1e-8)ring.pop();const clockwise=ShapeUtils.isClockWise(ring),side=(clockwise?1:-1)*(hole?-1:1),fringe=.0006/scale;
      for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,ox=-dy/len*fringe*side,oy=dx/len*fringe*side;const v0=append(a.x+item.offset,a.y,1,item.char),v1=append(b.x+item.offset,b.y,1,item.char),v2=append(a.x+item.offset+ox,a.y+oy,0,item.char),v3=append(b.x+item.offset+ox,b.y+oy,0,item.char);indices.push(v0,v1,v2,v2,v1,v3);}
    }
  }
  if(positions.some(x=>!Number.isFinite(x)))throw Error('Wordmark bounds '+JSON.stringify({globalMin,globalMax,scale,height,yOffset,bad:positions.findIndex(x=>!Number.isFinite(x))}));
  await writeBuf('models/about/logo_text.buf',{position:{array:new Float32Array(positions),size:3},char:{array:new Float32Array(chars),size:1}},new Uint16Array(indices),'Mesh',{vectorWordmark:'Daily Design .Art',contract:'position.xy in original 1 × .200956762 box; position.z is edge coverage, not geometric depth; char normalized 0..5 for original transition'});
}

function smoothGeometry(g){
  g.deleteAttribute('normal');g.deleteAttribute('uv');
  const merged=mergeVertices(g,1e-5);
  // Earcut can bridge collinear points of the serif and counter with one cap
  // edge. Split such cap edges at existing side-wall vertices to avoid T-junctions.
  for(let iteration=0;iteration<6;iteration++){
    const p=merged.attributes.position.array,idx=merged.index.array,edges=new Map();
    const key=(a,b)=>a<b?a+','+b:b+','+a;
    for(let i=0;i<idx.length;i+=3)for(const[a,b]of[[idx[i],idx[i+1]],[idx[i+1],idx[i+2]],[idx[i+2],idx[i]]])edges.set(key(a,b),(edges.get(key(a,b))||0)+1);
    const boundary=[...edges].filter(([,n])=>n===1).map(([k])=>k.split(',').map(Number)),candidates=[...new Set(boundary.flat())];if(!candidates.length)break;
    const rebuilt=[];let repaired=0;
    for(let i=0;i<idx.length;i+=3){const tri=[idx[i],idx[i+1],idx[i+2]];let split=false;
      for(let e=0;e<3&&!split;e++){const a=tri[e],b=tri[(e+1)%3],c=tri[(e+2)%3];if(edges.get(key(a,b))!==1)continue;const ab=[p[b*3]-p[a*3],p[b*3+1]-p[a*3+1],p[b*3+2]-p[a*3+2]],len=ab.reduce((v,x)=>v+x*x,0);for(const v of candidates){if(v===a||v===b)continue;const av=[p[v*3]-p[a*3],p[v*3+1]-p[a*3+1],p[v*3+2]-p[a*3+2]],t=av.reduce((sum,x,k)=>sum+x*ab[k],0)/len,dist=Math.hypot(...av.map((x,k)=>x-t*ab[k]));if(t>1e-6&&t<1-1e-6&&dist<1e-6){rebuilt.push(a,v,c,v,b,c);repaired++;split=true;break;}}}
      if(!split)rebuilt.push(...tri);
    }
    if(!repaired)break;merged.setIndex(rebuilt);
  }
  merged.computeVertexNormals();
  return merged;
}
function fitGeometry(g, size=[2,2,2], center=[0,0,0]){
  g.computeBoundingBox();const b=g.boundingBox,c=b.getCenter(new Vector3()),s=b.getSize(new Vector3());
  g.translate(-c.x,-c.y,-c.z);g.scale(size[0]/s.x,size[1]/s.y,size[2]/s.z);g.translate(...center);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function makeD(low=false){
  // The font has overlapping stem/bowl contours. Use the established unioned
  // Daily Design contour so refraction sees one solid with one open counter.
  function simplify(points,epsilon){
    if(points.length<3)return points;const a=points[0],b=points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;let max=-1,index=0;
    for(let i=1;i<points.length-1;i++){const p=points[i],t=den?clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den,0,1):0,d=Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);if(d>max)max=d,index=i;}
    if(max<=epsilon)return[a,b];return[...simplify(points.slice(0,index+1),epsilon).slice(0,-1),...simplify(points.slice(index),epsilon)];
  }
  const shapes=unionContours.map(rings=>{const contours=rings.map(ring=>{const clean=ring.filter((p,i)=>!i||Math.hypot(p[0]-ring[i-1][0],p[1]-ring[i-1][1])>1e-9),mid=Math.floor(clean.length/2),epsilon=low?.013:.0018;const pts=[...simplify(clean.slice(0,mid+1),epsilon).slice(0,-1),...simplify([...clean.slice(mid),clean[0]],epsilon).slice(0,-1)].map(([x,y])=>new Vector2(x/3.475,y/3.475));let changed=true;while(changed){changed=false;for(let i=pts.length-1;i>=0;i--){const a=pts[(i+pts.length-1)%pts.length],b=pts[i],c=pts[(i+1)%pts.length],ab=b.clone().sub(a),bc=c.clone().sub(b);if(ab.lengthSq()<1e-16||Math.abs(ab.cross(bc))<1e-12&&ab.dot(bc)>=0){pts.splice(i,1);changed=true;}}}return pts;});const shape=new Shape(contours[0]);for(const hole of contours.slice(1))shape.holes.push(new Path(hole));return shape;});
  const g=smoothGeometry(new ExtrudeGeometry(shapes,{depth:1.64,bevelEnabled:true,bevelSegments:low?3:5,steps:1,bevelThickness:.18,bevelSize:.015,curveSegments:low?7:14}));
  return fitGeometry(g);
}

// Small median-split BVH used only at build time to bake actual geometry occlusion.
function buildBVH(g){
  const p=g.attributes.position.array,idx=g.index.array,triangles=[];
  for(let i=0;i<idx.length;i+=3){const v=[idx[i]*3,idx[i+1]*3,idx[i+2]*3];const min=[0,1,2].map(a=>Math.min(...v.map(j=>p[j+a]))),max=[0,1,2].map(a=>Math.max(...v.map(j=>p[j+a])));triangles.push({v,min,max,c:min.map((x,a)=>(x+max[a])*.5)});}
  function node(ts){const min=[0,1,2].map(a=>Math.min(...ts.map(t=>t.min[a]))),max=[0,1,2].map(a=>Math.max(...ts.map(t=>t.max[a])));if(ts.length<12)return{min,max,ts};const axis=max.map((x,a)=>x-min[a]).indexOf(Math.max(...max.map((x,a)=>x-min[a])));ts.sort((a,b)=>a.c[axis]-b.c[axis]);const m=ts.length>>1;return{min,max,l:node(ts.slice(0,m)),r:node(ts.slice(m))};}
  const tree=node(triangles);
  return function ray(origin,dir,maxDist=4){
    let best=maxDist;
    function visit(n){let lo=0,hi=best;for(let a=0;a<3;a++){if(Math.abs(dir[a])<1e-9){if(origin[a]<n.min[a]||origin[a]>n.max[a])return;}else{let x=(n.min[a]-origin[a])/dir[a],y=(n.max[a]-origin[a])/dir[a];if(x>y)[x,y]=[y,x];lo=Math.max(lo,x);hi=Math.min(hi,y);if(hi<lo)return;}}
      if(n.ts){for(const t of n.ts){const a=t.v[0],b=t.v[1],c=t.v[2],e1=[p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]],e2=[p[c]-p[a],p[c+1]-p[a+1],p[c+2]-p[a+2]],h=[dir[1]*e2[2]-dir[2]*e2[1],dir[2]*e2[0]-dir[0]*e2[2],dir[0]*e2[1]-dir[1]*e2[0]],det=e1[0]*h[0]+e1[1]*h[1]+e1[2]*h[2];if(Math.abs(det)<1e-9)continue;const inv=1/det,s=[origin[0]-p[a],origin[1]-p[a+1],origin[2]-p[a+2]],u=(s[0]*h[0]+s[1]*h[1]+s[2]*h[2])*inv;if(u<0||u>1)continue;const q=[s[1]*e1[2]-s[2]*e1[1],s[2]*e1[0]-s[0]*e1[2],s[0]*e1[1]-s[1]*e1[0]],v=(dir[0]*q[0]+dir[1]*q[1]+dir[2]*q[2])*inv;if(v<0||u+v>1)continue;const hit=(e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])*inv;if(hit>1e-5&&hit<best)best=hit;}}
      else{visit(n.l);visit(n.r);}}
    visit(tree);return best===maxDist?Infinity:best;
  };
}
function bake(g){
  const p=g.attributes.position,n=g.attributes.normal,N=p.count,ray=buildBVH(g),ao=new Float32Array(N),thickness=new Float32Array(N),daoN=new Float32Array(N*3),daoP=new Float32Array(N*3),uv=new Float32Array(N*2),rand=seedRandom(42);
  for(let i=0;i<N;i++){
    const pos=[p.getX(i),p.getY(i),p.getZ(i)],nor=[n.getX(i),n.getY(i),n.getZ(i)],origin=pos.map((x,a)=>x+nor[a]*.002);let occ=0;
    for(let j=0;j<20;j++){const y=rand()*2-1,a=rand()*Math.PI*2,s=Math.sqrt(1-y*y);let d=[Math.cos(a)*s,Math.sin(a)*s,y];if(d.reduce((v,x,k)=>v+x*nor[k],0)<0)d=d.map(x=>-x);const h=ray(origin,d,1.3);if(Number.isFinite(h))occ+=Math.max(0,1-h/1.3);}
    ao[i]=clamp(1-occ/20*.7,.3,1);const h=ray(pos.map((x,a)=>x-nor[a]*.003),nor.map(x=>-x),4);thickness[i]=clamp(Number.isFinite(h)?h/2:0.1,.015,1);
    for(let a=0;a<3;a++)for(const sign of [-1,1]){const d=[0,0,0];d[a]=sign;const h=ray(origin,d,3);(sign<0?daoN:daoP)[i*3+a]=Number.isFinite(h)?clamp(h/3,.05,1):1;}
    uv[i*2]=(pos[0]+1)*.5;uv[i*2+1]=(pos[1]+1)*.5;
  }
  g.setAttribute('SN',n.clone());g.setAttribute('ao',new BufferAttribute(ao,1));g.setAttribute('thickness',new BufferAttribute(thickness,1));g.setAttribute('daoN',new BufferAttribute(daoN,3));g.setAttribute('daoP',new BufferAttribute(daoP,3));g.setAttribute('uv',new BufferAttribute(uv,2));
  return g;
}

async function writeBuf(rel,attrs,index=null,meshType='Mesh',extra={}){
  const count=attrs.position.array.length/attrs.position.size;
  const items=Object.entries(attrs).map(([id,a])=>({id,needsPack:false,componentSize:a.size,storageType:a.array.constructor.name}));
  if(index)items.push({id:'indices',needsPack:false,componentSize:1,storageType:index.constructor.name});
  let header=JSON.stringify({vertexCount:count,indexCount:index?.length||0,attributes:items,meshType,...extra}).replace(/[^\x00-\x7f]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));header+=' '.repeat((4-header.length%4)%4);
  const h=Buffer.alloc(4);h.writeUInt32LE(header.length);const buffers=[h,Buffer.from(header)];
  for(const a of Object.values(attrs))buffers.push(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));
  if(index)buffers.push(Buffer.from(index.buffer,index.byteOffset,index.byteLength));
  const b=Buffer.concat(buffers),dest=path.join(out,rel);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,b);
  const pos=attrs.position.array,bounds={min:[0,1,2].map(a=>{let v=Infinity;for(let i=a;i<pos.length;i+=3)v=Math.min(v,pos[i]);return v;}),max:[0,1,2].map(a=>{let v=-Infinity;for(let i=a;i<pos.length;i+=3)v=Math.max(v,pos[i]);return v;})};
  // Assert the actual loader's typed array alignment, size and finite-value contract.
  let offset=4+header.length;
  for(const a of items){const ctor=globalThis[a.storageType],length=(a.id==='indices'?index.length:count)*a.componentSize;if(offset%ctor.BYTES_PER_ELEMENT)throw Error('Unaligned '+a.id);const array=new ctor(b.buffer,b.byteOffset+offset,length);if(array.some(v=>!Number.isFinite(v)))throw Error('Non-finite '+a.id);offset+=array.byteLength;}
  if(offset!==b.length)throw Error('BUF byte count mismatch');
  manifest.files.push({path:rel,bytes:b.length,sha256:sha(b),vertexCount:count,indexCount:index?.length||0,attributes:items,bounds,...extra});
}
async function writeMesh(g,rel){const attrs={};for(const [id,a]of Object.entries(g.attributes))attrs[id]={array:a.array,size:a.itemSize};await writeBuf(rel,attrs,g.index.array);}

function roundedRect(w,h,r){const s=new Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
function roundedMesh(w,h,depth,x=0,y=0,z=0){const g=new ExtrudeGeometry(roundedRect(w,h,.09),{depth,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:3,steps:1,curveSegments:8});g.translate(x,y,z-depth/2);return g;}
function combine(list){return mergeGeometries(list.map(g=>g.index?g.toNonIndexed():g));}
function experiments(d){
  const interfaceModel=combine([roundedMesh(1.8,1.5,.08,0,0,-.15),roundedMesh(.68,.58,.15,-.43,.25,.1),roundedMesh(.68,.58,.15,.43,.25,.1),roundedMesh(1.5,.2,.18,0,-.43,.1)]);
  const motion=new TorusKnotGeometry(.58,.18,160,12,2,3);motion.rotateX(.35);
  const refraction=new IcosahedronGeometry(.95,0);refraction.rotateY(.45);refraction.rotateX(.25);
  const particle=new IcosahedronGeometry(.9,3);
  const spatial=combine([new TorusGeometry(.85,.035,8,96),new TorusGeometry(.85,.035,8,96).rotateX(Math.PI/2),new TorusGeometry(.85,.035,8,96).rotateY(Math.PI/2),new BoxGeometry(.38,.38,.38)]);
  const arrow=new Shape();arrow.moveTo(-.8,.95);arrow.lineTo(.72,-.14);arrow.lineTo(.13,-.24);arrow.lineTo(.5,-.84);arrow.lineTo(.17,-1);arrow.lineTo(-.17,-.38);arrow.lineTo(-.58,-.79);arrow.closePath();
  const prototype=new ExtrudeGeometry(arrow,{depth:.45,bevelEnabled:true,bevelSize:.04,bevelThickness:.08,bevelSegments:5,steps:1});
  return [{id:'daily',name:'Daily Design .Art',role:'Brand form<br>Concept study',g:d.clone()},{id:'interface',name:'Interface',role:'UI systems<br>Concept study',g:interfaceModel},{id:'motion',name:'Motion',role:'Movement & timing<br>Concept study',g:motion},{id:'refraction',name:'Refraction',role:'Optical materials<br>Concept study',g:refraction},{id:'particle',name:'Particles',role:'Generative systems<br>Concept study',g:particle},{id:'spatial',name:'Spatial UI',role:'Depth & interaction<br>Concept study',g:spatial},{id:'prototype',name:'Prototype',role:'Interaction design<br>Concept study',g:prototype}];
}
async function points(g,id){
  g=fitGeometry(g,[1.95,1.95,.95],[0,0,.5]);if(g.index)g=g.toNonIndexed();g.computeVertexNormals();
  const p=g.attributes.position,n=g.attributes.normal,rand=seedRandom(1000+id.charCodeAt(0)),tri=[],a=new Vector3,b=new Vector3,c=new Vector3,u=new Vector3,v=new Vector3;let sum=0;
  for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);u.subVectors(b,a);v.subVectors(c,a);const area=u.cross(v).length()*.5;if(area>1e-8){sum+=area;tri.push({i,sum});}}
  const pos=new Float32Array(8192*3),ns=new Uint8Array(8192*4);
  for(let j=0;j<8192;j++){const pick=rand()*sum;let lo=0,hi=tri.length-1;while(lo<hi){const m=(lo+hi)>>1;if(tri[m].sum<pick)lo=m+1;else hi=m;}const i=tri[lo].i,s=Math.sqrt(rand()),t=rand(),w=[1-s,s*(1-t),s*t];let normal=[0,0,0];for(let axis=0;axis<3;axis++){for(let k=0;k<3;k++){pos[j*3+axis]+=p.array[(i+k)*3+axis]*w[k];normal[axis]+=n.array[(i+k)*3+axis]*w[k];}}const len=Math.hypot(...normal)||1;normal=normal.map(x=>x/len);for(let axis=0;axis<3;axis++)ns[j*4+axis]=Math.round((normal[axis]*.5+.5)*255);ns[j*4+3]=Math.round(70+75*Math.max(0,normal[2]));}
  await writeBuf('team/'+id+'.buf',{position:{array:pos,size:3},nShade:{array:ns,size:4}},null,'Points',{conceptStudy:true});
}

// The source sprite is 8 cells wide, with 3 independent silhouettes in RGB.
// Each mask below is authored as SVG, rasterized and packed into that same contract.
async function spriteAtlas(){
  const dPath=source.commands.map(c=>c.type==='M'||c.type==='L'?`${c.type}${c.x} ${-c.y}`:c.type==='Q'?`Q${c.x1} ${-c.y1} ${c.x} ${-c.y}`:c.type==='C'?`C${c.x1} ${-c.y1} ${c.x2} ${-c.y2} ${c.x} ${-c.y}`:'Z').join(' ');
  const motifs=[`<path d="${dPath}" transform="translate(7 57) scale(.038)"/>`,'<path d="M12 8H22V39Q22 48 32 48Q42 48 42 39V8H52V39Q52 58 32 58Q12 58 12 39Z"/>','<path d="M14 9H50V18H37V47H50V56H14V47H27V18H14Z"/>','<rect x="8" y="10" width="48" height="44" rx="8" fill="none" stroke="white" stroke-width="6"/>','<path d="M10 7L56 39L35 42L45 57L33 63L23 45L12 56Z"/>','<circle cx="32" cy="32" r="22" fill="none" stroke="white" stroke-width="9"/>','<path d="M32 4L60 32L32 60L4 32Z"/>','<path d="M4 32Q18 4 32 32T60 32" fill="none" stroke="white" stroke-width="8"/>','<rect x="8" y="8" width="20" height="20" rx="4"/><rect x="36" y="8" width="20" height="20" rx="4"/><rect x="8" y="36" width="20" height="20" rx="4"/><rect x="36" y="36" width="20" height="20" rx="4"/>'];
  const width=1024,height=128,raw=Buffer.alloc(width*height*3);
  for(let shape=0;shape<24;shape++){const slot=Math.floor(shape/3),channel=shape%3;const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 64 64"><g fill="white">${motifs[shape%motifs.length]}</g></svg>`;const mask=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();for(let y=0;y<height;y++)for(let x=0;x<height;x++)raw[(y*width+slot*height+x)*3+channel]=mask[(y*height+x)*4+3];}
  const target=path.join(out,'textures/flip_texture.png');await sharp(raw,{raw:{width,height,channels:3}}).png().toFile(target);const bytes=await fs.readFile(target);manifest.files.push({path:'textures/flip_texture.png',bytes:bytes.length,sha256:sha(bytes),width,height,contract:'8 horizontal cells × RGB silhouettes; 23 used by published shader'});
}

console.time('brand models');
const high=makeD(),low=makeD(true);
await writeMesh(bake(high),'models/home/cross.buf');
await writeMesh(bake(low),'models/home/cross_ld.buf');
await wordmark();
const studies=experiments(high);
for(const item of studies)await points(item.g,item.id);
await fs.writeFile(path.join(out,'team/team.json'),JSON.stringify(studies.map(({g,...item})=>item),null,2)+'\n');
await spriteAtlas();
const replacements={};
for(const file of manifest.files)replacements['/assets/'+file.path]='/brand-assets/'+file.path;
replacements['/assets/team/team.json']='/brand-assets/team/team.json';
await fs.writeFile(path.join(out,'models/runtime-map.json'),JSON.stringify({replacements},null,2)+'\n');
const runtime=await fs.readFile(path.join(root,'reference/_astro/hoisted.CUO_IjfL.js'),'utf8');
const functionStart=runtime.indexOf('vec3 getCrossAoShadowIntersect(');if(functionStart<0)throw Error('Published cross function missing');
let open=runtime.indexOf('{',functionStart),cursor=open+1,depth=1;while(depth){if(runtime[cursor]==='{')depth++;if(runtime[cursor]==='}')depth--;cursor++;}
const originalFunction=runtime.slice(functionStart,cursor),proxy=await fs.readFile(path.join(root,'src/models/daily-neighbour-shadow.glsl'),'utf8');
await fs.writeFile(path.join(out,'models/runtime-patches.json'),JSON.stringify([
  {from:'faceId="edan"',to:'faceId="daily"',label:'Use authored Daily Design experiment particles at About entry'},
  {from:originalFunction,to:proxy,label:'D-shaped analytic neighbour optical proxy; material shaders retained'}
],null,2)+'\n');
manifest.notes.push('D generated by bevelled extrusion of the established Bodoni Moda Medium Italic D outline; each local axis refit to [-1,1] to keep original body scale and placement contract. UV, normal, smooth normal, AO, directional occlusion and thickness are generated; no flat logo is substituted for geometry.');
manifest.notes.push('The source font stem and bowl overlap. The watertight monogram therefore uses the existing unioned Daily Design contour from Daily-Design-ActiveTheory/src/assets/monogram-shape.json, copied locally as src/models/monogram-union-contours.json; SHA-256 '+sha(unionBytes)+'. Its single counter remains open.');
manifest.notes.push('AO uses 20 deterministic hemisphere rays per vertex; directional occlusion uses 6 cardinal rays; thickness uses inward normal ray distance. These are geometry-derived baked approximations, not Lusion original offline bake values.');
manifest.notes.push('Seven new 8192-point surface samples replace real team portraits. Original GPU particles, mouse light, scanline, blur, glitch, transitions and point counts remain runtime-owned. faceId default must be patched from edan to daily.');
manifest.notes.push('Original astronaut helmet/wearpack base and face images were opened and inspected. No Lusion wordmark was visible in those maps. Retain the 53-bone rig, original cloth/metal normal/roughness/albedo maps and original animation buffers.');
manifest.notes.push('The published getCrossAoShadowIntersect still assumes 3-axis crosses; apply src/models/daily-neighbour-shadow.glsl as the function replacement for a D-shaped conservative analytic proxy, or explicitly report cross-shaped neighbour shadow/reflection approximation as unresolved.');
await fs.writeFile(path.join(root,'src/models/model-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.timeEnd('brand models');console.log(JSON.stringify(manifest.files.map(({path,bytes,vertexCount,indexCount})=>({path,bytes,vertexCount,indexCount})),null,2));
