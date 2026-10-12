#!/usr/bin/env python3
"""Migrate visible text with exact English guards; never overlay rules/identities.

The historical v2.33.3 import reports remain provenance records. This migration
records current coverage separately, retains existing reviewed translations first,
and admits community candidates only against matching English text. Book and
adventure document bodies are excluded.
"""
from pathlib import Path
import argparse, json, re, importlib.util, collections, copy, hashlib

ROOT=Path(__file__).resolve().parents[2]
TAG='v2.37.0'
COMMIT='8c026b807fac21862a309379a0c3228a0683198b'
CN_COMMIT='5cc0bbe2c2b241a334e731af4448bdba2168e8bd'

def read(p, default=None):
 return json.loads(p.read_text()) if p.exists() else ({} if default is None else default)
def write(p,d):
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent='\t')+'\n')
def load_module(name,p):
 spec=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
CONTENT=load_module('content_upgrade',Path(__file__).with_name('import-content-translations.py'))
CORE=CONTENT.CORE

DIRECT={'name','shortName','caption','title','label','by','text','quote','entry','note','condition','goldAlternative','subclassTitle','displayName','special','reqAttune','detail1','namePrefix','nameSuffix','nameRemove','template','origin','script','province','symbol','worshipers','capCrewNote','makes','noteCook','serves','sizeNote','focus','order','category','pantheon','plane','signatureSpells','abilityEntry','sizeEntry','speedEntry','creatureTypesEntry'}
CONTAINERS={'entries','entriesHigherLevel','items','footnotes','headerEntries','footerEntries','colLabels','rowLabels','rows','row','tables','default','columns','trait','action','bonus','reaction','legendary','mythic','variant','spellcasting','resource','legendaryHeader','mythicHeader','lairActions','regionalEffects','mythicEncounter','ingredients','instructions','equipment','notes','finishing','stitches','abbreviations','hooks','notions','yarn','gauge','dialects','typicalSpeakers','altNames','goal','cultists','prerequisite','modes','submodes','entriesTemplate','additionalEntries','languages','legendaryActionsLair','m','domains'}
CANONICAL={'source','page','type','uid','id','hash','href','path','url','className','classSource','subclassShortName','subclassSource','raceName','raceSource','abbreviation','classFeature','subclassFeature','classFeatures','subclassFeatures','optionalfeature','item','spell','feat','background','race','creature','conditionImmune','resist','immune','vulnerable','reprintedAs','otherSources','additionalSources','copy','data','images','image','srd','srd52','basicRules','basicRules2024','style','colStyles','rowStyles','roll','formula','attributes','tag','choose','from','specificVariant','genericVariant','legendaryGroup','creatureTypes','damageInflict','savingThrow','skillCheck','abilityCheck','creatureType','creatureTypes','foundryFlags','prop','amount','unit','preparation','currency','noteHidden','version','range','time','ac','hp','speed','weight','value','size','allergenGroups','dishTypes','typeTags','mode','names','hidden','displayAs','castingTime','componentsRequired','consume','charges','recharge','ability','rename','with','replace','regex','flags'}
STRUCTURES={'inherits','components','startingEquipment','startingProficiencies','multiclassing','classTableGroups','subclassTableGroups','optionalfeatureProgression','featProgression','additionalSpells','fluff','recovery','dimensions','hull','movement','control','weapon','other','station','actionStation','_versions','_mod','_abstract','_implementations','_copy','hp'}
REFERENCE=re.compile(r'\{@([\w]+) ([^{}]*)\}')
def identity(e):
 source=e.get('source',e.get('inherits',{}).get('source',''))
 return (str(e.get('ENG_name',e.get('name',''))),source)+tuple(str(e.get(k,'')) for k in ['className','classSource','subclassShortName','subclassSource','level','raceName','raceSource','abbreviation','set'])
def signature(t):
 def sub(m):
  tag,parts=m[1],m[2].split('|')
  if tag in CORE.REFERENCE_TAGS:return '{@'+tag+' '+parts[0].lower()+'}'
  return m[0]
 return REFERENCE.sub(sub,t)
def visible_leaves(x,path=(),visible=False):
 if isinstance(x,str):
  if visible: yield path,x
 elif isinstance(x,list):
  for i,v in enumerate(x):yield from visible_leaves(v,path+(i,),visible)
 elif isinstance(x,dict):
  for k,v in x.items():
   simple_key=k.rsplit('.',1)[-1]
   if k.startswith('ENG_') or (simple_key in CANONICAL and simple_key not in ['images','hp']):continue
   if k=='name' and '_copy' in path:continue
   if visible or simple_key in DIRECT or simple_key in CONTAINERS or k in STRUCTURES or k in ['images','symbolImg']:
    yield from visible_leaves(v,path+(k,),visible or simple_key in DIRECT or simple_key in CONTAINERS)
def get(x,p):
 try:
  for k in p:x=x[k]
  return x
 except (KeyError,IndexError,TypeError):return None
def set_value(x,p,v):
 for k in p[:-1]:x=x[k]
 x[p[-1]]=v
def carry(old,translated,new):
 if old==new and translated is not None:return copy.deepcopy(translated)
 if isinstance(new,dict):
  out=copy.deepcopy(new)
  if isinstance(old,dict) and isinstance(translated,dict):
   for k,v in new.items():
    if k in old and k in translated:out[k]=carry(old[k],translated[k],v)
   for k,v in translated.items():
    if k.startswith(('_display','ENG_')):out[k]=copy.deepcopy(v)
  return out
 if isinstance(new,list) and isinstance(old,list) and isinstance(translated,list) and len(new)==len(old)==len(translated):return [carry(a,b,c) for a,b,c in zip(old,translated,new)]
 return copy.deepcopy(new)
def pairs(a,b):
 if isinstance(a,str) and isinstance(b,str):yield a,b
 elif isinstance(a,list) and isinstance(b,list) and len(a)==len(b):
  for x,y in zip(a,b):yield from pairs(x,y)
 elif isinstance(a,dict) and isinstance(b,dict):
  for k,x in a.items():
   if k in b and not k.startswith('ENG_'):yield from pairs(x,b[k])
def configs():
 specs={}
 for group in ['spells','character-options','items','monsters','cults-boons','reference-pages','craft-pages','psionics']:
  cfg=CONTENT.get_group_config(group)
  for rel,props in cfg['specs']:specs[rel]=(cfg['folder'],props)
 for p in (ROOT/'vendor/5etools-src/data/class').glob('*.json'):
  if p.name not in ['index.json','fluff-index.json','foundry.json']:specs['class/'+p.name]=('class',('class','subclass','classFeature','subclassFeature','classFluff','subclassFluff'))
 for rel,props in CORE.FILE_SPECS:
  if rel!='generated/bookref-quick.json':specs[rel]=('rules',props)
 for rel,props in [('bastions.json',('facility',)),('fluff-bastions.json',('facilityFluff',))]:specs[rel]=('bastions',props)
 for rel,props in [('trapshazards.json',('trap','hazard')),('decks.json',('deck','card')),('objects.json',('object',)),('tables.json',('table','tableGroup')),('generated/gendata-tables.json',('table','tableGroup'))]:specs[rel]=('utility-pages',props)
 return specs

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--old',type=Path,required=True);ap.add_argument('--community',type=Path,required=True);ap.add_argument('--baseline',type=Path,required=True);args=ap.parse_args()
 old=args.old/'data';new=ROOT/'vendor/5etools-src/data';cn=args.community
 CONTENT.UPSTREAM_ROOT=new
 specs=configs();locale=ROOT/'data/zh-TW';baseline=args.baseline/'data/zh-TW'
 loc=CONTENT.ContentLocalizer()
 overrides=read(ROOT/'translation/zh-TW/upstream-v2.37.0/text-overrides.json')
 outputs={};pending=[];excluded=[];qa=[];stats=collections.Counter();proposed={};global_mem=collections.defaultdict(set);cn_global=collections.defaultdict(set);old_docs={}
 # Snapshot current sidecars before generating any output, including chunked items.
 for rel,(folder,props) in specs.items():
  target_rel=rel if rel.startswith('generated/') else Path(rel).name
  doc=read(baseline/folder/target_rel)
  if rel=='items.json':
   doc={};index=read(baseline/'items/index.json')
   for name in index.get('fileChunks',{}).get('items.json',[]):
    for k,v in read(baseline/'items'/name).items():
     if isinstance(v,list):doc.setdefault(k,[]).extend(v)
  old_docs[rel]=doc
  eng=read(old/rel)
  for prop in props:
   byid={identity(e):e for e in doc.get(prop,[]) if isinstance(e,dict)}
   for e in eng.get(prop,[]):
    tr=byid.get(identity(e))
    if not tr:continue
    for path,text in visible_leaves(e):
     translated=tr.get('_displayName',get(tr,path)) if folder=='utility-pages' and path==('name',) else get(tr,path)
     if isinstance(translated,str) and translated!=text:global_mem[signature(text)].add(translated)
 # Names are registered across the source for tag reconciliation.
 for rel in specs:
  if not (cn/'data'/rel).exists():continue
  loc.register_source_names(read(cn/'data'/rel))
  ce=read(cn/'data-bak'/rel);ct=read(cn/'data'/rel)
  for prop,entities in ce.items():
   if not isinstance(entities,list) or not isinstance(ct.get(prop),list):continue
   for a,b in zip(entities,ct[prop]):
    if not isinstance(a,dict) or not isinstance(b,dict) or a.get('name')!=b.get('ENG_name',b.get('name')):continue
    for p,t in visible_leaves(a):
     v=get(b,p)
     if isinstance(v,str) and v!=t:cn_global[t].add(v)
 # Reuse guarded translations of standalone generated table cells and labels
 # from the same licensed community book source; no whole-book output is built.
 for p in (cn/'data-bak/book').glob('*.json'):
  translated_path=cn/'data/book'/p.name
  if not translated_path.exists():continue
  for t,v in pairs(read(p),read(translated_path)):
   if t!=v and re.search('[\u3400-\u9fff]',v):cn_global[t].add(v)
 loc.register_source_names(old_docs)
 for rel,(folder,props) in specs.items():
  ed=read(new/rel);od=read(old/rel);td=old_docs[rel];ce=read(cn/'data-bak'/rel);ct=read(cn/'data'/rel)
  out={'_meta':{'locale':'zh-TW','upstreamTag':TAG,'upstreamCommit':COMMIT,'baselineTranslationTag':'v2.33.3','communityCandidateCommit':CN_COMMIT}}
  for prop in props:
   if prop not in ed:continue
   out[prop]=[]
   oldby={identity(e):e for e in od.get(prop,[]) if isinstance(e,dict)};trby={identity(e):e for e in td.get(prop,[]) if isinstance(e,dict)}
   cnby={identity(e):e for e in ce.get(prop,[]) if isinstance(e,dict)}
   cntby={identity(a):b for a,b in zip(ce.get(prop,[]),ct.get(prop,[])) if isinstance(a,dict) and isinstance(b,dict) and a.get('name')==b.get('ENG_name',b.get('name'))}
   for ix,e in enumerate(ed[prop]):
    if not isinstance(e,dict):out[prop].append(e);continue
    ident=identity(e);prev=oldby.get(ident);tr=trby.get(ident);cprev=cnby.get(ident);ctr=cntby.get(ident)
    enmem=collections.defaultdict(set);cnmem={}
    if prev and tr:
     for p,t in visible_leaves(prev):
      v=tr.get('_displayName',get(tr,p)) if folder=='utility-pages' and p==('name',) else get(tr,p)
      if isinstance(v,str) and v!=t:enmem[signature(t)].add(v)
    if cprev and ctr:
     for p,t in visible_leaves(cprev):
      v=get(ctr,p)
      if isinstance(v,str) and v!=t:cnmem[t]=v
    n=carry(prev,tr,e)
    if 'name' in e:n['ENG_name']=e['name']
    if 'shortName' in e:n['ENG_shortName']=e['shortName']
    for p,t in visible_leaves(e):
     context=f'{rel}/{prop}/{ix}/'+ '/'.join(map(str,p));sig=signature(t);v=None;method=None
     if e.get('source')=='HFLotT' and p!=('name',):
      excluded.append({'context':context,'reason':'complete cookbook body excluded by requested whole-book scope'})
      set_value(n,p,t)
      continue
     if p[-1] in ['category','statblockType','spellcastingFocus','credit','by'] or 'spellcastingFocus' in p:continue
     if re.fullmatch(r'(?:[A-Z][A-Za-z\u00c0-\u017f\x27\u2019 -]+, ){4,}[A-Z][A-Za-z\u00c0-\u017f\x27\u2019 -]+',t):continue
     if context in overrides:
      ov=overrides[context]
      if ov['english']!=t:raise ValueError('Stale override: '+context)
      v=ov['translation'];method='reviewed'
     elif prev and tr and get(prev,p)==t and isinstance(get(tr,p),str):
      v=tr.get('_displayName',get(tr,p)) if folder=='utility-pages' and p==('name',) else get(tr,p)
      method='preserved'
     elif len(enmem[sig])==1:v=next(iter(enmem[sig]));method='reused-entity'
     elif len(global_mem[sig])==1:v=next(iter(global_mem[sig]));method='reused-exact'
     elif t in cnmem:v=cnmem[t];method='community-candidate'
     elif len(cn_global[t])==1:v=next(iter(cn_global[t]));method='community-candidate'
     elif not re.search('[A-Za-z]{2,}',CORE.strip_inline_tags(t)):
      v=t;method='literal'
     if v is None:
      pending.append({'context':context,'file':rel,'prop':prop,'name':e.get('name'),'source':e.get('source'),'english':t,'previousEnglish':get(prev,p) if prev else None,'previousTranslation':get(tr,p) if tr else None})
      continue
     if method=='preserved' and t==get(prev,p):translated=v
     elif method=='reviewed' and loc._canonical_tag_signature(t)==loc._canonical_tag_signature(v) and loc._dice_signature(t)==loc._dice_signature(v):translated=v
     else:
      before={k:len(vv) for k,vv in loc.report.items() if isinstance(vv,list)}
      translated=loc.localize_string(t,v,'upgrade/'+context)
      for key in ['tagCanonicalDifferences','diceDifferences','numericDifferences','unmatchedTranslatedTags','tagShapeMismatches']:
       for issue in loc.report[key][before[key]:]:qa.append({'kind':key,**issue})
     if folder=='utility-pages' and p==('name',):n['_displayName']=translated
     else:set_value(n,p,translated)
     stats[method]+=1
     if method=='community-candidate' and p==('name',):proposed[f'{prop}|{e.get("name")}|{e.get("source")}']=translated
    out[prop].append(n)
  outputs[rel]=(folder,out)
 # Write deterministically and regenerate current manifests without altering historical reports.
 counts=collections.defaultdict(collections.Counter);files=collections.defaultdict(list)
 for rel,(folder,out) in outputs.items():
  for prop,v in out.items():
   if isinstance(v,list):counts[folder][prop]+=len(v)
  target_rel=rel if rel.startswith('generated/') else Path(rel).name
  if folder=='utility-pages':out.pop('_meta',None)
  files[folder].append(target_rel)
  if rel=='items.json':
   CONTENT.OUTPUT_ROOT=locale
   chunks=CONTENT.write_item_sidecar_chunks(out)
  else:write(locale/folder/target_rel,out)
 for folder in files:
  index=read(baseline/folder/'index.json');index.setdefault('_meta',{}).update({'upstreamTag':TAG,'upstreamCommit':COMMIT});index['files']=files[folder];index['entityCounts']=dict(counts[folder])
  if folder=='items':index['fileChunks']['items.json']=chunks
  write(locale/folder/'index.json',index)
 report={'upstream':{'tag':TAG,'commit':COMMIT},'communityCandidate':{'repository':CONTENT.SOURCE_REPOSITORY,'commit':CN_COMMIT},'scope':'entity data; no new adventure/book/cookbook body translation','excludedBodyStrings':len(excluded),'counts':{k:dict(v) for k,v in counts.items()},'textMethods':dict(stats),'pendingCount':len(pending),'qaCount':len(qa),'resolvedTagShapeCount':sum(x['kind']=='tagShapeMismatches' for x in qa),'status':'needs-review' if pending or any(x['kind']!='tagShapeMismatches' for x in qa) else 'pass'}
 dest=ROOT/'translation/zh-TW/upstream-v2.37.0'
 write(dest/'coverage.json',report);write(dest/'pending.json',pending);write(dest/'excluded.json',excluded);write(dest/'candidate-qa.json',qa);write(dest/'proposed-terms.json',proposed)
 print(json.dumps(report,ensure_ascii=False));print('Pending words',sum(len(x['english'].split()) for x in pending))

if __name__=='__main__':main()
