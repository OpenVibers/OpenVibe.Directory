'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validate,publicEntry,createPeopleStore}=require('../server/people');
const {createStore}=require('../server/sources');
const {createApp}=require('../server/app');
test('opt-in fields exclude private phone, age and city, and default unlisted',()=>{
  assert.equal(validate({display_name:'Ada',visible:false,phone:'123',age:42,city:'SF'}).visible,false);
  assert.equal(validate({display_name:'Ada',visible:'yes'}),null);
  assert.equal(validate({display_name:'<script>',visible:true}),null);
  const e=publicEntry({subject_id:'usr_12345678',display_name:'Ada',bio:'Hello',website:null,confirmed_at:new Date('2026-11-10T00:00:00Z'),phone:'123',age:42,city:'SF'});
  assert.equal(e.phone,undefined);assert.equal(e.age,undefined);assert.equal(e.city,undefined);
});
test('migration uses owner connection while listing reads use runtime connection',async()=>{
  const ownerCalls=[],runtimeCalls=[];
  const migrationPool={query:async sql=>{ownerCalls.push(sql);return {rows:[]};}};
  const pool={query:async sql=>{runtimeCalls.push(sql);return {rows:[]};},end:async()=>{}};
  const people=await createPeopleStore({pool,migrationPool,entries:new Map()});
  assert.equal(ownerCalls.length,1);assert.match(ownerCalls[0],/CREATE TABLE/);
  assert.equal(runtimeCalls.length,1);assert.match(runtimeCalls[0],/^SELECT /);
  await people.close();
});
test('only the signed-in subject can write and unpublished entries stay out of search',async()=>{
  const store=createStore({fetchImpl:async()=>({ok:false,status:503})});store.start=()=>{};
  const rows=new Map();
  const peopleStore={get:async s=>rows.get(s)||null,put:async(s,b)=>{const valid=validate(b);if(!valid)return null;const row={subject_id:s,...valid,confirmed_at:new Date()};rows.set(s,row);store.state.entries.set('people',[...rows.values()].filter(r=>r.visible).map(publicEntry));return row;},remove:async s=>{rows.delete(s);store.state.entries.set('people',[...rows.values()].filter(r=>r.visible).map(publicEntry));}};
  const auth={router:()=>((_q,_r,next)=>next()),optionalAuth:()=>((q,_r,next)=>{q.user={subject_id:'usr_12345678'};next();}),requireAuth:()=>((q,r,next)=>{if(q.get('Authorization')==='Bearer valid'){q.user={subject_id:'usr_12345678'};next();}else r.sendStatus(401);})};
  const server=createApp({store,peopleStore,auth}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  try{
    let r=await fetch(base+'/api/v1/people/me',{method:'PUT',headers:{'Content-Type':'application/json','Origin':'https://openvibe.directory'},body:JSON.stringify({display_name:'Ada',visible:true})});assert.equal(r.status,401);
    r=await fetch(base+'/api/v1/people/me',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer valid','Origin':'https://evil.example'},body:JSON.stringify({display_name:'Ada',visible:true})});assert.equal(r.status,403);
    r=await fetch(base+'/api/v1/people/me',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer valid','Origin':'https://openvibe.directory'},body:JSON.stringify({display_name:'Ada',visible:false})});assert.equal(r.status,200);assert.equal(store.list('people').length,0);
    r=await fetch(base+'/api/v1/people/me',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer valid','Origin':'https://openvibe.directory'},body:JSON.stringify({display_name:'Ada',visible:true})});assert.equal(r.status,200);assert.equal(store.list('people').length,1);
    r=await fetch(base+'/api/v1/people/me',{method:'DELETE',headers:{'Authorization':'Bearer valid','Origin':'https://openvibe.directory'}});assert.equal(r.status,204);assert.equal(store.list('people').length,0);
  }finally{server.close();}
});
