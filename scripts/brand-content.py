#!/usr/bin/env python3
"""Deterministic content-only adapter. Never modifies reference or dist."""
from pathlib import Path
from html.parser import HTMLParser
from html import escape, unescape
import json, re, hashlib, subprocess, shutil

ROOT=Path(__file__).resolve().parents[1]
REF=ROOT/'reference'
OUT=ROOT/'brand-content'
GH='https://github.com/Snychng/daily-design'
BRAND='Daily Design .Art'
SLOGAN='Explore the art of UI, one day at a time.'
PROJECT_ROWS=[
('oryzo_ai','Gallery','Existing interface study','Fourteen original graphic studies move through a spatial carousel. Tidal lines, long days and quiet doorways explore typography, reflection and the rhythm of a rotating interface.','iridescent-gallery'),
('atlas_motion','Orbit','Existing interface study','Fourteen pastel cards orbit a central Daily Design wordmark inside a phone composition. Dragging, opening and returning a card studies spatial hierarchy, inertia and chromatic edges.','chromatic-orbit'),
('devin_ai','Interactive Narrative','Existing interface study','A Daily Design D moves through a sequence of interactive scenes. The experiment studies the relationship between camera movement, particles, reflection and the pacing of a scroll-driven story.',None),
('of_the_oak','Spatial Layers','Existing interface study','Three architectural silhouettes share one layered space. Changing viewpoint reveals different structures and makes depth, occlusion and the transitions between orthogonal views visible.',None),
('everswap','Ocean Interface','Existing interface study','A continuous ocean surface connects two interface states. This study explores real-time water, the half-submerged waterline and the shift from an open horizon to underwater typography.',None),
('porsche_dream_machine','Light Studies','Concept study','A concept study of light as an interface material: focal contrast, bright edges, reflection and the way a moving highlight directs attention.',None),
('synthetic_human','Optic Type','Concept study','A concept study of typography seen through optical surfaces. Letterforms, counters and edges provide a readable reference for reflection, refraction and distortion.',None),
('ddd_2024','Gesture Studies','Concept study','A concept study of direct manipulation. Pointer position, drag distance, release velocity and return motion describe a small vocabulary of tactile interface feedback.',None),
('spaace','Focus Field','Concept study','A concept study of focus in a dense visual field. Scale, contrast and spacing help one object become prominent while the surrounding context remains legible.',None),
('choo_choo_world','Glass Slingshot','Concept study','A concept study of curved tracks and elastic release. Its subject is the relation between a visible trajectory, pointer motion and the feeling of a controlled landing.',None),
('zero_tech','Material Lab','Concept study','A concept study of transparent interface materials. Thickness, edge highlights, chromatic separation and background contrast are treated as independent visual variables.',None),
('spatial_fusion','Spatial Notes','Concept study','A concept study of interfaces arranged in depth. Frames, layers and overlaps turn spatial relationships into a visual hierarchy that can still be read at a glance.',None),
('worldcoin','Motion Loop','Concept study','A concept study of repeating movement. The same path can feel calm, mechanical or elastic when its speed profile, phase and pause are changed.',None),
('lusion_labs','Interface Studies','Concept study','A collection of concept notes on interface structure, motion and optical detail. Each note isolates a visible behavior so its cause and response can be studied.',None),
('my_little_story_book','Paper Narrative','Concept study','A concept study of narrative through layered surfaces. Reveals, overlaps and changes in scale connect separate interface moments without losing their visual continuity.',None),
('soda_experience','Liquid Feedback','Concept study','A concept study of responsive surfaces. Displacement, trails and gradual recovery show how a pointer gesture can leave a brief and readable trace.',None),
('infinite_passerella','Afterimage','Concept study','A concept study of temporal traces. A short history of positions makes motion visible and tests the balance between a clear current state and its fading past.',None),
('the_turn_of_the_screw','Sound Forms','Concept study','A visual concept study of rhythm, repetition and amplitude. No original commercial soundtrack or client performance is claimed for this interface experiment.',None),
('maxmara_bearings_gifts','Color Studies','Concept study','A concept study of color across translucent layers. Neighboring hues, gradients and the edges between them help reveal how the surface changes what lies behind it.',None),
]
PROJECTS={slug:dict(title=title,status=status,description=desc,work=work) for slug,title,status,desc,work in PROJECT_ROWS}
SLUGS={slug:re.sub(r'[^a-z0-9]+','-',p['title'].lower()).strip('-') for slug,p in PROJECTS.items()}
assert len(set(SLUGS.values()))==19
def output_relative(path):
 rel=path.relative_to(REF)
 return Path('projects')/SLUGS[path.parent.name]/'index.html' if path.parent.parent.name=='projects' else rel
def public_path(path):
 return '/'+str(output_relative(path)).replace('index.html','')
def route_url(url):
 for old,new in SLUGS.items():
  url=re.sub(r'(?<!assets)(?<!assets/)(^/projects/|^projects/|https?://[^/]+/projects/)'+re.escape(old)+r'(?=[/#?]|$)',lambda m:('/projects/' if m.group(1).startswith('http') else m.group(1))+new,url)
 return url
TITLES={
'Oryzo AI':'Gallery','Atlas Motion':'Orbit','Devin AI':'Interactive Narrative','Of The Oak':'Spatial Layers','Everswap':'Ocean Interface','Porsche: Dream Machine':'Light Studies','Synthetic Human':'Optic Type','DDD 2024':'Gesture Studies','Spaace - NFT Marketplace':'Focus Field','Spaace':'Focus Field','Choo Choo World':'Glass Slingshot','Zero Tech':'Material Lab','Meta: Spatial Fusion':'Spatial Notes','Worldcoin Globe':'Motion Loop','Lusion Labs':'Interface Studies','My Little Storybook':'Paper Narrative','Soda Experience':'Liquid Feedback','Infinite Passerella':'Afterimage','The Turn Of The Screw':'Sound Forms','Max Mara: Bearing Gifts':'Color Studies'}
VOID={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
class Node:
 def __init__(self,tag,attrs,parent,start,opening):self.tag=tag;self.attrs=dict(attrs);self.parent=parent;self.start=start;self.opening=opening;self.open_end=start+len(opening);self.end=self.open_end;self.close_start=self.open_end;self.children=[];self.texts=[]
 def has(self,key):return self.attrs.get('id')==key or key in self.attrs.get('class','').split()
 def under(self,key):return self.has(key) or bool(self.parent and self.parent.under(key))
 def leaves(self):
  return [t for t in self.texts if t['raw'].strip()] + [t for n in self.children for t in n.leaves()]
class Doc(HTMLParser):
 def __init__(self,raw):
  super().__init__(convert_charrefs=False);self.raw=raw;self.lines=[0];self.lines.extend(m.end() for m in re.finditer('\n',raw));self.nodes=[];self.texts=[];self.stack=[];self.feed(raw)
 def pos(self):l,c=self.getpos();return self.lines[l-1]+c
 def handle_starttag(self,tag,attrs):
  n=Node(tag,attrs,self.stack[-1] if self.stack else None,self.pos(),self.get_starttag_text());self.nodes.append(n)
  if n.parent:n.parent.children.append(n)
  if tag not in VOID:self.stack.append(n)
 def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs);self.stack=[n for n in self.stack if n.start!=self.pos()]
 def handle_endtag(self,tag):
  for i in range(len(self.stack)-1,-1,-1):
   if self.stack[i].tag==tag:
    n=self.stack[i];n.close_start=self.pos();n.end=self.raw.find('>',self.pos())+1;self.stack=self.stack[:i];break
 def data(self,raw):
  if self.stack:
   t={'start':self.pos(),'end':self.pos()+len(raw),'raw':raw,'parent':self.stack[-1]};self.texts.append(t);self.stack[-1].texts.append(t)
 def handle_data(self,d):self.data(d)
 def handle_entityref(self,n):self.data('&'+n+';')
 def handle_charref(self,n):self.data('&#'+n+';')
 def find(self,key):return [n for n in self.nodes if n.has(key)]

def words_across(leaves,new):
 """Retain every inline element; distribute replacement prose across text leaves."""
 leaves=sorted(leaves,key=lambda t:t['start']);words=new.split();total=sum(max(1,len(unescape(t['raw']).split())) for t in leaves);done=0;out=[]
 for i,t in enumerate(leaves):
  end=len(words) if i==len(leaves)-1 else min(len(words),done+max(1,round(len(words)*max(1,len(unescape(t['raw']).split()))/total)))
  chunk=' '.join(words[done:end]);done=end
  if chunk:chunk=(' ' if i else '')+chunk+(' ' if i<len(leaves)-1 else '')
  out.append((t,chunk))
 return out

def brand_svg(n,label=None):
 attrs=dict(n.attrs);attrs['role']='img';attrs['aria-label']=label or BRAND
 shapes=json.loads((OUT/'lettering.json').read_text())['shapes']
 key='notes' if label=='STUDY NOTES' else 'studies' if label else 'monogram' if n.attrs.get('id')=='header-menu-labs-lucy-svg' else 'wordmark'
 shape=shapes[key];attrs['viewbox']=shape['viewBox']
 # SVGLoader parses this WebGL heading without CSS currentColor resolution.
 fill='#ffffff' if n.attrs.get('id')=='about-award-title' else 'currentColor'
 inside='<path fill="'+fill+'" d="'+shape['d']+'"></path>'
 return '<svg '+' '.join(('viewBox' if k=='viewbox' else k)+'="'+escape(str(v),quote=True)+'"' for k,v in attrs.items() if v is not None)+'>'+inside+'</svg>'

COMMON={"Let's talk":"GITHUB","About us":"About","About Us":"About","Our Projects":"Studies","Projects":"Studies","Contact":"Connect","Subscribe to":"Explore the","our newsletter":"source on GitHub","Labs":"Source","Play Reel":"Motion Studies","Featured Work":"Selected Studies","Our Approach":"The Practice","See all projects":"See all studies","Is Your Big Idea Ready to Go Wild?":"Curious About the Details Behind the Motion?","Let's work":"Explore the","together!":"art of UI.","Suite 2":"Daily Design .Art","9 Marsh Street":"UI / UX / Motion","Bristol, BS1 4AA":"Independent Studies","United Kingdom":"Online, one day at a time.","Twitter / X":"GitHub","Instagram":"Source","Linkedin":"Ideas","General enquires":"Explore the code","hello@lusion.co":"GitHub / daily-design","New business":"Share an idea","business@lusion.co":"Ideas & feedback","©2026 LUSION Creative Studio":"©2026 Daily Design .Art","R&D: labs.lusion.co":"UI / UX / Motion Studies","Built by Lusion with ❤️":SLOGAN,"Launch Project":"Explore Study","Watch Video":"Explore Study","NEXT PROJECT":"NEXT STUDY","PROJECTS":"STUDIES"}
IDS={
'home-hero-title':SLOGAN+' UI, motion & interaction studies.',
'home-reel-title-line-1':'Small Details,','home-reel-title-line-2':'Brought to Life',
'home-reel-desc':'Daily Design .Art collects interfaces worth studying and turns their visual details into working experiments. Follow the relationship between design, motion, three-dimensional space and the code that makes each response possible.',
'home-featured-disclaimer':'A selection of existing interface experiments and clearly labelled concept studies in UI, UX, motion and optical materials.',
'home-goal-title':'Where Interface Details Become Interactive Studies',
'about-who-title-left-1':'THIS IS','about-who-title-left-3':'A PERSONAL',
'footer-bottom-labs':'UI / UX / Motion Studies','about-who-team-name-text':'Gallery','about-who-team-desc-text':'Seven study themes connect typography, motion, depth and materials. Each explores how small visual changes reshape the way an interface is read and used, through existing experiments and clearly identified concept studies.',
'about-clients-title':'DETAILS WORTH STUDYING','about-clients-desc':'A vocabulary of interface materials and behaviors, collected through independent experiments.',
'about-capability-title-line-1':'AREAS OF','about-capability-title-line-2':'EXPLORATION',
'about-capability-subheader-text':'Personal practice across interface structure, visual design, motion, code and three-dimensional materials.'}
ABOUT_EXACT={'WE ARE':'THIS IS','A CREATIVE':'A PERSONAL','PRODUCTION':'INTERFACE','STUDIO':'PRACTICE','CRAFTING UNIQUE':'EXPLORING UI','DIGITAL EXPERIENCES':'ONE DAY AT A TIME','A worldwide team':'A personal collection','specialists in design,':'studies in design,','motion, 3D, and technology':'motion, space, and materials','working together to':'built one detail at a time','turn ambitious ideas into':'to make visual ideas into','immersive digital':'readable interactive','experiences.':'experiments.','Cofounder &':'Personal study /','Creative Director':'UI & motion','AREA OF':'AREAS OF','EXPERTISE':'EXPLORATION','Strategy':'Structure','Creative':'Visual','Tech':'Code','Production':'Geometry','Digital Experience Strategy':'Interface Structure','Technology Strategy':'Interaction States','Creative Direction':'Visual Hierarchy','Discovery':'Reference Analysis','Research':'Design Research','Art Direction':'Color & Contrast','UX/UI Design':'UX / UI Studies','Motion Design':'Motion Timing','Interactive Design':'Pointer Feedback','Illustration':'Original Card Artwork','WebGL Development':'WebGL Studies','Front End Development':'Frontend Experiments','Unity/Unreal':'Shader Composition','Interactive Installations':'Browser Interaction','AR and VR Experiences':'Responsive Layouts','Procedural Modeling':'Procedural Geometry','3D Asset Creation':'Brand D Modeling','3D Optimization':'Geometry Budgets','Animation':'Camera & Motion','3D Pipeline Development':'Material Contracts'}
AWARD_NAMES=['Card geometry','Pointer response','Color dispersion','Scroll progress','Media transitions','Surface normals','Optical thickness','Layer overlap','Motion timing','Type hierarchy','Curve continuity','Focus states','Camera paths','Responsive scale','Source notes','Repeatable states']
PALETTES=[('#e7efe8','#14362f','#ca573e'),('#101a24','#edf5f0','#c5ef89'),('#171d1e','#edf1e8','#ce765a'),('#e7e8df','#253227','#547e65'),('#e4edf1','#193548','#da8252'),('#efe7df','#352e31','#a44432')]

def adapt(path):
 raw=path.read_text();doc=Doc(raw);edits={};log=[];slug=path.parent.name if path.parent.parent.name=='projects' else None;project=PROJECTS.get(slug)
 def edit(start,end,value,kind):edits[(start,end)]=(value,kind)
 def settext(t,value,kind='text'):
  value=escape(value,quote=False);edit(t['start'],t['end'],value,kind)
 def setnode(n,value,kind='text'):
  for t,v in words_across(n.leaves(),value):settext(t,v,kind)
 def attr(n,k,v):
  n.attrs[k]=v;n.changed=True
 for n in doc.nodes:n.changed=False
 # Common and leaf-level copy keeps all animation-bearing wrappers.
 for t in doc.texts:
  if t['parent'].under('script') or t['parent'].tag in ('script','style'):continue
  old=unescape(t['raw']).strip()
  if old in COMMON:settext(t,COMMON[old])
  elif old in TITLES:settext(t,TITLES[old])
  if path.parent.name=='about' and old in ABOUT_EXACT:settext(t,ABOUT_EXACT[old])
 for key,value in IDS.items():
  for n in doc.find(key):setnode(n,value)
 for n in doc.find('home-goal-texts-paragraph'):
  idx=doc.find('home-goal-texts-paragraph').index(n);setnode(n,['The collection starts with a visible detail: the shape of a reflection, the path of a card or the response to a gesture. Each experiment follows that detail through its structure, material and timing.','Reference mechanisms are studied carefully, then adapted with Daily Design content. The aim is to make the work observable, understandable and open to further experiments.'][idx%2])
 for i,n in enumerate(doc.find('home-goal-tunnel-title-line')):setnode(n,['Step into an interface','and follow the','details in motion'][i%3])
 for n in doc.find('about-who-team-job-text'):setnode(n,'Personal study / UI & motion')
 for n in doc.find('project-details-preview'):
  nxt=PROJECTS.get(n.attrs.get('data-next-id'))
  if nxt:
   for x in doc.find('project-details-preview-title'):
    if n.start<x.start<n.end:setnode(x,nxt['title'])
 # Convert award/client/career claims to a specification and practice index.
 if path.parent.name=='about':
  for i,n in enumerate(doc.find('about-award-header-title')):setnode(n,['Research','Reading','Practice'][i%3])
  for i,n in enumerate(doc.find('about-award-header-text')):setnode(n,['19','03','05'][i%3])
  label_index=0;number_index=0;group_index=0
  old_groups={'Awwwards','FWA','CSSDA','Webby Awards','Lovie Awards','Drum Awards','CommArts'}
  for n in doc.find('about-award-item-wrapper-text'):
   old=''.join(unescape(t['raw']) for t in n.leaves()).strip()
   if n.under('award-category-awards'):
    if old.isdigit():number_index+=1;setnode(n,f'{number_index:03d}')
    elif old in old_groups:setnode(n,['Interface','Motion','Material','Space','Typography','Process','Source'][group_index%7]);group_index+=1
    else:setnode(n,AWARD_NAMES[label_index%len(AWARD_NAMES)]);label_index+=1
   elif n.under('award-category-articles'):
    setnode(n,['Read the project overview','Explore the interface source','Trace the design references'][label_index%3]);label_index+=1
   elif n.under('award-category-talks'):
    isdate=bool(re.search(r'\b20\d\d\b',old));setnode(n,'Independent practice' if isdate else ['Observe','Rebuild','Compare','Adapt','Share'][label_index%5]);label_index+=not isdate
 # Project metadata, rich paragraph leaves and all service/award links.
 if project:
  for n in doc.find('project-details-title'):setnode(n,project['title'])
  for key in ['project-details-launch-cta-text','project-details-launch-cta-mobile-text']:
   for n in doc.find(key):setnode(n,'Open Experiment' if project['work'] else 'Study Collection')
  for n in doc.find('project-details-item-text'):setnode(n,project['status']+'. '+project['description']+' The media documents an existing experiment or a concept reference; its original sources are preserved in the local study manifest.')
  descnodes=[n for n in doc.nodes if n.tag=='p' and n.under('project-details-desc')]
  paras=[project['status']+'. '+project['description'], 'Explore the details in these existing captures and concept images. Where a dedicated recording is unavailable, previously recorded Gallery or Orbit experiments provide the motion reference. Original capture and artwork sources are recorded with the study.']
  if len(descnodes)==1 and slug not in ('oryzo_ai','atlas_motion','of_the_oak','the_turn_of_the_screw'):paras[0]+=' Motion reference: previously recorded Gallery / Orbit experiments.'
  for i,n in enumerate(descnodes):setnode(n,paras[min(i,1)])
  for n in doc.find('project-details-side-list-title'):setnode(n,'Study Focus' if n.under('project-details-side-list-services') else 'Source Notes')
  services=['UI / UX study','Visual structure','Motion behavior','Optical materials','Creative coding','Concept notes']
  for i,n in enumerate(doc.find('project-details-side-list-item')):setnode(n,services[i%len(services)] if n.under('project-details-side-list-services') else ['Project overview','Source collection','Design references'][i%3])
 # A consistent study label in every thumbnail slot; technical slug is retained.
 for n in doc.find('project-item'):
  p=PROJECTS.get(n.attrs.get('data-id'))
  if p:
   for child in n.children:
    for x in doc.nodes:
     if x.under('project-item-line-1') and x.start>n.start and x.end<n.end:setnode(x,p['status'].lower()+' • ui • motion • materials')
 # Non-visible metadata and destinations.
 title=BRAND+' — '+(project['title'] if project else 'About the Practice' if path.parent.name=='about' else 'Interface Studies' if path.parent.name=='projects' else 'UI, Motion & Interaction')
 for n in doc.nodes:
  a=n.attrs
  if n.tag=='title':setnode(n,title)
  if n.tag=='meta':
   key=a.get('property',a.get('name',''))
   if key in ('description','og:description'):attr(n,'content',SLOGAN+' '+(project['status']+'. '+project['description'] if project else 'Independent interface studies in UI, UX, motion and optical materials.'))
   elif key in ('og:title','og:site_name','og:image:alt'):attr(n,'content',title)
   elif key=='og:image':attr(n,'content','/brand-assets/media/gallery.webp')
   elif key=='og:url':attr(n,'content',public_path(path))
  if n.tag=='a' and (a.get('href','').startswith(('http:','https:','mailto:','tel:')) or n.has('project-details-launch-cta') or n.has('project-details-launch-cta-mobile')):
   href=GH
   if n.under('footer-socials-line'):href=GH+'/tree/main/src/demos'
   if n.has('footer-business-link'):href=GH+'/issues'
   if n.has('project-details-launch-cta') or n.has('project-details-launch-cta-mobile'):href=('https://dailydesign.art/#work/'+project['work']) if project and project['work'] else GH
   attr(n,'href',href);attr(n,'target','_blank');attr(n,'rel','noopener noreferrer')
  if n.tag=='a' and a.get('href') in ['/about','/projects'] and a.get('target')=='_blank':attr(n,'target','_self')
  if n.tag=='input' and ('newsletter' in a.get('id','')):
   attr(n,'type','text');attr(n,'placeholder','github.com/Snychng/daily-design');attr(n,'value','github.com/Snychng/daily-design');attr(n,'disabled',None);attr(n,'aria-disabled','true');attr(n,'aria-label','Source repository address');attr(n,'autocomplete','off')
  if n.tag=='form' and ('newsletter' in a.get('id','')):attr(n,'action',GH);attr(n,'method','get');attr(n,'data-brand-destination',GH);attr(n,'aria-label','Open the Daily Design source repository')
  if n.tag=='button' and 'newsletter-input-arrow' in a.get('id',''):attr(n,'type','button');attr(n,'data-brand-href',GH);attr(n,'aria-label','Open GitHub source')
  if n.tag=='script' and ('googletagmanager' in a.get('src','') or 'gtag(' in raw[n.open_end:n.close_start]):
   attr(n,'type','application/x-disabled');n.attrs.pop('src',None);n.changed=True
  if n.tag=='link' and a.get('rel') in ('icon','shortcut icon','apple-touch-icon','mask-icon'):attr(n,'href','/brand-assets/media/favicon.svg');attr(n,'type','image/svg+xml')
  if n.tag=='link' and a.get('rel')=='manifest':attr(n,'href','/brand-content/site.webmanifest')
  if n.tag=='link' and a.get('rel')=='sitemap':attr(n,'href','/brand-content/sitemap.xml')
  if n.tag=='link' and a.get('rel')=='canonical':attr(n,'href',public_path(path))
  # Color is intentional content adaptation; controls/opacity/shadow stay original.
  slot=a.get('data-id') if n.has('project-item') else a.get('data-next-id') if n.has('project-details-preview') else slug if n.has('project-details') else None
  if slot in PROJECTS:
   colors=PALETTES[list(PROJECTS).index(slot)%len(PALETTES)];bg,fg,accent=colors
   for k in list(a):
    if k in ('data-color-bg','data-next-color-bg','data-color-btn-bg'):attr(n,k,bg)
    elif k in ('data-color-text','data-next-color-text','data-color-btn-text','data-color-icon-bg'):attr(n,k,fg)
    elif k in ('data-color-highlight','data-color-btn-bg-hover'):attr(n,k,accent)
   if n.has('project-details'):attr(n,'style','background-color:'+bg)
  # Route IDs drive both navigation and the ProjectItem cache. Asset aliases cover its two dynamic image requests.
  for key in ('data-id','data-next-id'):
   if a.get(key) in SLUGS:attr(n,key,SLUGS[a[key]])
  for key in ('href','data-path'):
   if isinstance(a.get(key),str):
    branded_url=route_url(a[key])
    if branded_url!=a[key]:attr(n,key,branded_url)
 # Replace letter artwork only, keeping each SVG root's ID/class/size.
 svg_ranges=[]
 for n in doc.nodes:
  if n.tag=='svg' and (n.under('header-logo') or n.under('about-who-title-left-2') or n.has('header-menu-labs-lucy-svg') or n.has('about-who-team-title') or n.has('about-award-title')):
   label='STUDIES' if n.has('about-who-team-title') else 'STUDY NOTES' if n.has('about-award-title') else None
   edit(n.start,n.end,brand_svg(n,label),'svg-artwork');svg_ranges.append((n.start,n.end))
 for n in doc.nodes:
  if n.changed and not any(s<=n.start<e for s,e in svg_ranges):
   new='<'+n.tag+''.join(' '+k if v is None else ' '+k+'="'+escape(str(v),quote=True)+'"' for k,v in n.attrs.items())+('/>' if n.opening.endswith('/>') else '>');edit(n.start,n.open_end,new,'attributes')
 # Drop edits nested in artwork replacement.
 for key in list(edits):
  if any(s<=key[0] and key[1]<=e and key!=(s,e) for s,e in svg_ranges):del edits[key]
 result=raw
 for (s,e),(value,kind) in sorted(edits.items(),reverse=True):result=result[:s]+value+result[e:];log.append({'kind':kind,'offset':s})
 result=result.replace('</head>','<link rel="stylesheet" href="/brand-content/brand.css">'+('' if any(n.tag=='link' and n.attrs.get('rel')=='canonical' for n in doc.nodes) else '<link rel="canonical" href="'+public_path(path)+'">')+'</head>')
 dest=OUT/'pages'/output_relative(path);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(result)
 after=Doc(result)
 def in_svg(n):return n.tag=='svg' or bool(n.parent and in_svg(n.parent))
 def signature(d):return [(n.tag,n.attrs.get('id'),n.attrs.get('class')) for n in d.nodes if not in_svg(n) and not (n.tag=='link' and (n.attrs.get('href')=='/brand-content/brand.css' or n.attrs.get('rel')=='canonical'))]
 structure=signature(doc)==signature(after)
 if not structure:raise RuntimeError('DOM structure changed: '+str(path))
 text=' '.join(unescape(t['raw']) for t in after.texts if t['parent'].tag not in ('script','style'))
 prohibited=re.findall(r'(?i)\b(?:Lusion|Cognition|Porsche|Max Mara|Coca-Cola|Edan Kwan|Awwwards|Webby|Bristol|commissioned|cofounder)\b',text)
 return {'page':str(output_relative(path)),'sourcePage':str(path.relative_to(REF)),'publicPath':public_path(path),'sourceSha256':hashlib.sha256(raw.encode()).hexdigest(),'outputSha256':hashlib.sha256(result.encode()).hexdigest(),'edits':len(edits),'structurePreservedOutsideSvg':structure,'remainingOriginalClaims':prohibited}

def main():
 OUT.mkdir(exist_ok=True)
 subprocess.run(['node',str(ROOT/'scripts/build-brand-lettering.mjs')],check=True,cwd=ROOT)
 pages=[REF/'index.html',REF/'about/index.html',REF/'projects/index.html']+sorted((REF/'projects').glob('*/index.html'))
 if len(pages)!=22:raise RuntimeError(f'Expected 22 pages, found {len(pages)}')
 if (OUT/'pages').exists():shutil.rmtree(OUT/'pages')
 audit=[adapt(p) for p in pages]
 routes={'schemaVersion':1,'slugMap':SLUGS,'paths':{'/projects/'+old:'/projects/'+new for old,new in SLUGS.items()},'pages':{'projects/'+old+'/index.html':'projects/'+new+'/index.html' for old,new in SLUGS.items()},'assetAliases':{'/assets/projects/'+new+'/'+name:'/assets/projects/'+old+'/'+name for old,new in SLUGS.items() for name in ('home.webp','home_depth.webp')},'contract':{'engineChangesRequired':False,'dynamicAssetUse':'ProjectItem concatenates settings.PROJECT_PATH + data-id + /home.webp or /home_depth.webp. Copy the already-branded source files to the 38 alias paths after applying media-map.','preserved':'All detail data-filename values and media-map keys are unchanged. Original reference remains untouched.','routing':'ProjectPage regex accepts every non-slash slug; RouteManager and ProjectDetailsData use pathNodes[1], data-id and data-next-id.'}}
 (OUT/'routes.json').write_text(json.dumps(routes,ensure_ascii=False,indent=2)+'\n')
 (OUT/'projects.json').write_text(json.dumps({SLUGS[k]:dict(v,sourceAssetId=k) for k,v in PROJECTS.items()},ensure_ascii=False,indent=2)+'\n')
 (OUT/'brand.css').write_text('@font-face{font-family:DailyBodoni;src:url(/brand-assets/media/fonts/bodoni-moda-italic.ttf) format("truetype");font-style:italic;font-weight:100 900;font-display:swap}input[aria-disabled="true"]{opacity:1;-webkit-text-fill-color:currentColor}#header-logo svg{overflow:visible}\n')
 (OUT/'site.webmanifest').write_text(json.dumps({'name':BRAND,'short_name':'Daily Design','start_url':'/','display':'standalone','theme_color':'#e7efe8','background_color':'#e7efe8','icons':[{'src':'/brand-assets/media/favicon.svg','sizes':'any','type':'image/svg+xml'}]},indent=2)+'\n')
 (OUT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+escape('http://localhost:4207'+public_path(p))+'</loc></url>' for p in pages)+'</urlset>\n')
 report={'generatedBy':'python3 scripts/brand-content.py','brand':BRAND,'slogan':SLOGAN,'github':GH,'pageCount':len(audit),'projectCount':len(PROJECTS),'pages':audit,'notes':['Reference files are read only. Project IDs and routes use branded slugs. Original media filenames remain technical asset keys; routes.json declares the required thumbnail aliases.','All 22 pages preserve tag/id/class structure outside intentional SVG letter-artwork replacements and the added stylesheet/canonical links.','Video/media URL rewriting is supplied separately by brand-content/media-map.json and applied by the integration build.','Newsletter forms and input/button nodes remain present. Inputs are disabled and buttons carry data-brand-href. Integration must replace submit behavior and click destinations.','Existing interface study and concept study are content categories, not client commissions.','No new images or recordings were generated by this adapter.']}
 (OUT/'content-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 if any(p['remainingOriginalClaims'] for p in audit):raise RuntimeError('Original visible copy remains; inspect content-audit.json')
 print(json.dumps({'pages':len(audit),'projects':len(PROJECTS),'structurePreserved':all(p['structurePreservedOutsideSvg'] for p in audit),'originalVisibleClaims':sum(len(p['remainingOriginalClaims']) for p in audit)},ensure_ascii=False))
if __name__=='__main__':main()
