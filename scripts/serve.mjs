import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const mode=process.argv.find(x=>x.startsWith('--mode='))?.slice(7)||'brand';
if(!['brand','reference'].includes(mode))throw new Error('mode must be brand or reference');
const dir=path.join(root,mode==='reference'?'reference':'dist');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4','.webm':'video/webm','.ogg':'audio/ogg','.woff2':'font/woff2','.ico':'image/x-icon','.wasm':'application/wasm','.exr':'application/octet-stream','.buf':'application/octet-stream'};
const server=http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);return res.end();}
 let file=path.resolve(dir,'.'+pathname);if(!file.startsWith(dir+path.sep)&&file!==dir){res.writeHead(403);return res.end();}
 try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');}catch{}
 if(!fs.existsSync(file)){res.writeHead(404,{'Content-Type':'text/plain'});return res.end('Not found: '+pathname);}
 const stat=fs.statSync(file);const headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Accept-Ranges':'bytes','X-Study-Mode':mode};
 // Keep the unmodified reference files while excluding tracking at response time.
 if(file.endsWith('.html')){
  let html=fs.readFileSync(file,'utf8').replace(/<script[^>]*src="https:\/\/www\.googletagmanager[^>]*><\/script>/g,'').replace(/<script>\s*window\.dataLayer[\s\S]*?<\/script>/g,'');
  if(mode==='reference') html=html.replace('</head>','<meta http-equiv="Content-Security-Policy" content="connect-src \'self\' https://vimeo.com https://player.vimeo.com; frame-src https://player.vimeo.com"></head>');
  res.writeHead(200,headers);return res.end(req.method==='HEAD'?'':html);
 }
 const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);let start=0,end=stat.size-1,status=200;
 if(range){start=Number(range[1]);end=range[2]?Math.min(Number(range[2]),end):end;if(start>end){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});return res.end();}status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;}
 headers['Content-Length']=end-start+1;res.writeHead(status,headers);if(req.method==='HEAD')res.end();else fs.createReadStream(file,{start,end}).pipe(res);
});
server.listen(4207,'127.0.0.1',()=>console.log(JSON.stringify({mode,root:dir,address:'http://127.0.0.1:4207',pid:process.pid})));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
