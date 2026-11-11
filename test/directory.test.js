'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createStore,businesses}=require('../server/sources');
const {createApp}=require('../server/app');
test('unverified OSM phone tags are not published and business source is attributed',()=>{
  const xml='<osm><node id="1"><tag k="shop" v="books"/><tag k="name" v="Bookshop"/><tag k="phone" v="+1 415 555 0100"/></node><node id="2"><tag k="name" v="Jane Smith"/><tag k="phone" v="+1 415 555 0101"/></node></osm>';
  const rows=businesses(xml,'2026-11-10T00:00:00.000Z');
  assert.equal(rows.length,1);assert.equal(rows[0].phone,undefined);assert.match(rows[0].sources[0].url,/openstreetmap/);assert.match(rows[0].osm_attribution,/ODbL/);
});
test('failed refresh retains the last successful source and reports stale status',async()=>{
  let fail=false;const fetchImpl=async(url)=>{if(fail)throw Error('source down');return {ok:true,json:async()=>url.includes('frame?')?{nav:[{id:'live',name:'Live',url:'https://openvibe.live/'}]}:{tools:[{id:'yaml',name:'YAML',docs:'https://openvibe.tools/tool/yaml'}],things:[{id:'a/b',name:'B',maker:'A',url:'https://example.com'}],items:[{full_name:'OpenVibers/Test',name:'Test',html_url:'https://github.com/OpenVibers/Test'}]},text:async()=>'<osm><node id="1"><tag k="shop" v="books"/><tag k="name" v="Books"/></node></osm>'};};
  const store=createStore({fetchImpl});await store.refresh();const before=store.list('sites');fail=true;await store.refresh();assert.deepEqual(store.list('sites'),before);assert.equal(store.state.status.sites.ok,false);
});
test('entry page emits structured data and escapes source text',async()=>{
  const store=createStore({fetchImpl:async()=>({ok:false,status:503})});store.start=()=>{};
  store.state.entries.set('sites',[{kind:'sites',id:'x',slug:'x',name:'<bad>',description:'Test',website:'https://example.com/',last_checked:'2026-11-10T00:00:00.000Z',sources:[{url:'https://example.com/',checked_at:'2026-11-10T00:00:00.000Z'}]}]);
  const server=createApp({store}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  try{const r=await fetch(`http://127.0.0.1:${server.address().port}/entries/sites/x`);const html=await r.text();assert.equal(r.status,200);assert.match(html,/schema.org/);assert.ok(!html.includes('<bad>'));}finally{server.close();}
});
