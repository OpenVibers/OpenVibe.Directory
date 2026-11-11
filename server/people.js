'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {Pool}=require('pg');
const {createSsoClient}=require('openvibe-sdk/sso');
const SUBJECT=/^usr_[A-Za-z0-9_-]{8,100}$/;
const nameRe=/^[^<>\r\n]{1,100}$/;
const websiteOf=value=>{if(!value)return null;try{const u=new URL(value);return u.protocol==='https:'&&u.username===''&&u.password===''?u.href:null;}catch{return null;}};
function validate(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||!nameRe.test(String(input.display_name||'')))return null;
  const display_name=String(input.display_name).trim();if(!display_name)return null;
  const bio=String(input.bio||'').trim();if(bio.length>500||/[<>]/.test(bio))return null;
  const website=websiteOf(input.website);if(input.website&&!website)return null;
  if(typeof input.visible!=='boolean')return null;
  return {display_name,bio,website,visible:input.visible};
}
function publicEntry(row){const id=row.subject_id;const checked=new Date(row.confirmed_at).toISOString();return {kind:'people',id,slug:id,name:row.display_name,description:row.bio,website:row.website,sources:[{url:`https://openvibe.directory/entries/people/${encodeURIComponent(id)}`,checked_at:checked,label:'Owner confirmed'}],last_checked:checked};}
async function createPeopleStore({connectionString=process.env.DATABASE_URL,pool,entries}={}){
  if(!pool&&!connectionString)throw Error('DATABASE_URL required for people listings');
  const db=pool||new Pool({connectionString,max:4});
  const migration=fs.readFileSync(path.join(__dirname,'../migrations/0001_people.sql'),'utf8');
  await db.query(migration);
  const sync=async()=>{const {rows}=await db.query('SELECT subject_id,display_name,bio,website,visible,confirmed_at FROM directory_people WHERE visible ORDER BY updated_at DESC LIMIT 10000');entries.set('people',rows.map(publicEntry));};
  await sync();
  const get=async subject=>{const {rows}=await db.query('SELECT subject_id,display_name,bio,website,visible,confirmed_at FROM directory_people WHERE subject_id=$1',[subject]);return rows[0]||null;};
  const put=async(subject,data)=>{if(!SUBJECT.test(subject))throw Error('invalid subject');const input=validate(data);if(!input)return null;const {rows}=await db.query(`INSERT INTO directory_people(subject_id,display_name,bio,website,visible,confirmed_at,updated_at) VALUES($1,$2,$3,$4,$5,now(),now()) ON CONFLICT(subject_id) DO UPDATE SET display_name=EXCLUDED.display_name,bio=EXCLUDED.bio,website=EXCLUDED.website,visible=EXCLUDED.visible,confirmed_at=now(),updated_at=now() RETURNING subject_id,display_name,bio,website,visible,confirmed_at`,[subject,input.display_name,input.bio,input.website,input.visible]);await sync();return rows[0];};
  const remove=async subject=>{if(!SUBJECT.test(subject))throw Error('invalid subject');await db.query('DELETE FROM directory_people WHERE subject_id=$1',[subject]);await sync();};
  return {get,put,remove,close:()=>db.end()};
}
function createAuth(env=process.env){if(!env.OV_OAUTH_CLIENT_ID||!env.OV_OAUTH_CLIENT_SECRET)return null;return createSsoClient({site:'directory',siteName:'OpenVibe.Directory',baseUrl:env.BASE_URL||'https://openvibe.directory',clientId:env.OV_OAUTH_CLIENT_ID,clientSecret:env.OV_OAUTH_CLIENT_SECRET,networkUrl:env.OV_NETWORK_URL||'https://openvibe.network',networkInternalUrl:env.OV_NETWORK_INTERNAL_URL||'http://127.0.0.1:4000',secureCookies:env.NODE_ENV==='production'});}
function writeGuard(req,res,next){const origin=req.get('Origin');const own=(process.env.BASE_URL||'https://openvibe.directory').replace(/\/$/,'');const bearer=/^Bearer\s+\S+$/i.test(req.get('Authorization')||'');if(origin!==own&&!(!origin&&bearer))return res.status(403).json({error:'origin.invalid'});if(!req.is('application/json')&&req.method!=='DELETE')return res.status(415).json({error:'content_type.invalid'});next();}
module.exports={createPeopleStore,createAuth,validate,publicEntry,writeGuard};
