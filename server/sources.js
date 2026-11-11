'use strict';
const {XMLParser} = require('fast-xml-parser');
const URLS = Object.freeze({
  sites: 'https://openvibe.network/api/frame?host=openvibe.network',
  tools: 'https://openvibe.tools/api/v1/tools',
  models: 'https://openvibe.compare/api/v1/comparisons/ai-models',
  projects: 'https://api.github.com/search/repositories?q=org%3AOpenVibers+archived%3Afalse&per_page=100',
  businesses: 'https://api.openstreetmap.org/api/0.6/map?bbox=-122.425,37.774,-122.415,37.780'
});
const kinds = Object.freeze({sites:'OpenVibe sites',tools:'OpenVibe tools',models:'AI models',providers:'AI providers',projects:'Open-source projects',businesses:'Local businesses',people:'Opt-in people'});
const iso = value => { const d = new Date(value); return Number.isFinite(d.getTime()) ? d.toISOString() : null; };
const safeUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null; } catch { return null; } };
const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
function entry(kind, id, name, description, website, source, checked, details={}) {
  if (!id || !name || !safeUrl(source)) return null;
  return {kind,id:String(id),slug:slug(id),name:String(name).slice(0,160),description:String(description||'').slice(0,500),website:safeUrl(website),sources:[{url:safeUrl(source),checked_at:checked}],last_checked:checked,...details};
}
function sites(data, checked) {
  return [...(data.nav||[]),...(data.soon||[])].map(s=>entry('sites',s.id,s.name,s.tagline,s.url,s.url||URLS.sites,checked,{group:s.group||null})).filter(Boolean);
}
function tools(data, checked) {
  return (data.tools||[]).map(t=>entry('tools',t.id,t.name,t.summary,t.docs||`https://openvibe.tools/tool/${encodeURIComponent(t.id)}`,URLS.tools,iso(data.updated_at)||checked,{group:t.family||null})).filter(Boolean);
}
function models(data, checked) {
  const out=[], makers=new Map();
  for (const m of data.things||[]) {
    const id=m.id, maker=m.maker||String(id).split('/')[0];
    const source=safeUrl(m.url)||URLS.models;
    const e=entry('models',id,m.name,`AI model from ${maker}. See the dated comparison for prices and measured results.`,`https://openvibe.compare/things/${encodeURIComponent(id)}`,source,iso(data.updated_at)||checked,{provider:maker});
    if(e) out.push(e);
    if(maker && !makers.has(maker)) makers.set(maker,entry('providers',maker,maker,'AI model provider.',source,URLS.models,iso(data.updated_at)||checked));
  }
  return [...out,...[...makers.values()].filter(Boolean)];
}
function projects(data, checked) {
  return (data.items||[]).map(p=>entry('projects',p.full_name,p.name,p.description,p.html_url,p.html_url,iso(p.updated_at)||checked,{group:p.topics?.[0]||'other',topics:(p.topics||[]).slice(0,12)})).filter(Boolean);
}
function businesses(xml, checked) {
  const doc=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false}).parse(xml);
  const nodes=[...toArray(doc.osm?.node),...toArray(doc.osm?.way),...toArray(doc.osm?.relation)];
  const out=[];
  for(const n of nodes){
    const tags=Object.fromEntries(toArray(n.tag).filter(t=>t.k && t.v).map(t=>[t.k,String(t.v)]));
    if(!tags.name || !(tags.shop || ['restaurant','cafe','bar','pub','pharmacy','bank','clinic','fast_food'].includes(tags.amenity))) continue;
    const type=n.nd?'way':n.member?'relation':'node';
    const id=`${type}-${n.id}`;
    const source=`https://www.openstreetmap.org/${type}/${n.id}`;
    const website=safeUrl(tags.website)||safeUrl(tags['contact:website'])||source;
    // OSM contact tags can be contributed by anyone; show a number only after checking a business-owned source.
    out.push(entry('businesses',id,tags.name,`${tags.shop||tags.amenity} in San Francisco, mapped in OpenStreetMap.`,website,source,checked,{group:tags.shop||tags.amenity,osm_attribution:'© OpenStreetMap contributors, ODbL 1.0'}));
  }
  return out.filter(Boolean);
}
function toArray(value){return value==null?[]:Array.isArray(value)?value:[value];}
const parsers={sites,tools,models,projects,businesses};
function createStore({fetchImpl=fetch,now=()=>new Date(),intervalMs=6*60*60*1000}={}){
  const state={entries:new Map(Object.keys(kinds).map(k=>[k,[]])),status:{},refreshed_at:null};
  let pending=null, timer=null;
  async function refresh(){
    if(pending)return pending;
    pending=(async()=>{
      const checked=now().toISOString();
      await Promise.all(Object.entries(parsers).map(async([kind,parse])=>{
        try{
          const r=await fetchImpl(URLS[kind],{headers:{'Accept':kind==='businesses'?'application/xml':'application/json','User-Agent':'OpenVibe.Directory/0.1 (+https://openvibe.directory)'},signal:AbortSignal.timeout(12000)});
          if(!r.ok)throw Error(`upstream ${r.status}`);
          const data=kind==='businesses'?await r.text():await r.json();
          const entries=parse(data,checked);
          if(!entries.length)throw Error('source returned no usable entries');
          if(kind==='models'){
            state.entries.set('models',entries.filter(e=>e.kind==='models'));
            state.entries.set('providers',entries.filter(e=>e.kind==='providers'));
          } else state.entries.set(kind,entries);
          state.status[kind]={ok:true,last_checked:checked,count:entries.length};
        }catch(err){state.status[kind]={ok:false,last_checked:checked,count:state.entries.get(kind).length,error:String(err.message).slice(0,100)};}
      }));
      state.refreshed_at=checked;
      return state;
    })().finally(()=>{pending=null;});
    return pending;
  }
  function start(){if(!timer){void refresh();timer=setInterval(()=>{void refresh();},intervalMs);timer.unref?.();}}
  function stop(){if(timer)clearInterval(timer);timer=null;}
  function list(kind){return kind?state.entries.get(kind)||[]:[...state.entries.values()].flat();}
  return {state,refresh,start,stop,list};
}
module.exports={URLS,kinds,sites,tools,models,projects,businesses,createStore};
