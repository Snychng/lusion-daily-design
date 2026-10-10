// API adapter for the published overlay. Media is an existing Daily Design
// recording, never the original studio reel or a fabricated recording.
class DailyLocalPlayer {
 constructor(id, options) {
  this.element=document.createElement('video');
  this.element.playsInline=true; this.element.preload='metadata';
  this.element.style.cssText='width:100%;height:100%;object-fit:contain;background:#11111b';
  this.element.setAttribute('aria-label','Daily Design .Art — recorded interface study');
  document.getElementById(id).append(this.element);
  this.handlers=new Map();
  this.element.addEventListener('timeupdate',()=>this.emit('timeupdate',{percent:this.element.duration?this.element.currentTime/this.element.duration:0}));
  this.element.addEventListener('ended',()=>this.emit('ended',{}));
  this.loadVideo(options.id);
 }
 source(id){return window.DAILY_MEDIA.videos?.[id]||window.DAILY_MEDIA.reel.desktop;}
 ready(){return this.element.readyState>=1?Promise.resolve():new Promise((resolve,reject)=>{this.element.addEventListener('loadedmetadata',resolve,{once:true});this.element.addEventListener('error',()=>reject(new Error('Local study media could not be decoded')),{once:true});});}
 loadVideo(id){const src=this.source(id);if(this.element.getAttribute('src')!==src){this.element.src=src;this.element.load();}return this.ready();}
 setCurrentTime(t){return this.ready().then(()=>{this.element.currentTime=t;return t;});}
 getVideoWidth(){return this.ready().then(()=>this.element.videoWidth);}
 getVideoHeight(){return this.ready().then(()=>this.element.videoHeight);}
 getDuration(){return this.ready().then(()=>this.element.duration);}
 on(name,cb){const list=this.handlers.get(name)||[];list.push(cb);this.handlers.set(name,list);}
 emit(name,event){for(const cb of this.handlers.get(name)||[])cb.call(videoOverlay,event);}
 play(){return this.element.play().catch(()=>{this.element.muted=true;return this.element.play();});}
 pause(){this.element.pause();return Promise.resolve();}
 setVolume(v){this.element.volume=v;this.element.muted=v===0;return Promise.resolve(v);}
}
