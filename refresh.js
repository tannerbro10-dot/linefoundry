const fs = require('fs');
const path = require('path');

const cachePath = path.join(__dirname, 'refresh-state.json');
const sourceConfig = [
  { id:'draftkings', name:'DraftKings / DK Network', url:'https://dknetwork.draftkings.com/draftkings-sportsbook-player-props/' },
  { id:'actionnetwork', name:'Action Network', url:'https://www.actionnetwork.com/nfl/nfl-player-props-week-1-sept-13' },
  { id:'nypost', name:'NY Post Betting', url:'https://nypost.com/2026/09/13/betting/' },
  { id:'tallysight', name:'Tallysight', url:'https://tally.site/rankings/verified/nfl/all/overall' },
  { id:'vsin', name:'VSiN', url:'https://data.vsin.com/propicks/' }
];

async function fetchSource(s){
  const started=Date.now();
  try {
    const r=await fetch(s.url,{redirect:'follow',headers:{'user-agent':'TannerPropConsensusBot/3.0 (+public research site)'}});
    const text=await r.text();
    return {id:s.id,name:s.name,url:s.url,ok:r.ok,status:r.status,bytes:text.length,ms:Date.now()-started};
  } catch(e){
    return {id:s.id,name:s.name,url:s.url,ok:false,error:e.message,ms:Date.now()-started};
  }
}

async function refresh(){
  const sources=[];
  for(const s of sourceConfig) sources.push(await fetchSource(s));
  let engine=null;
  try {
    engine=await require('./engine').refreshEngine();
  } catch (e) {
    engine={mode:'error',error:e.message};
  }
  const state={version:'4.0.0', refreshedAt:new Date().toISOString(), sources, engine:{mode:engine.mode, props:engine.props?.length||0, usage:engine.usage||null, error:engine.error||null}};
  fs.writeFileSync(cachePath,JSON.stringify(state,null,2));
  return state;
}

if(require.main===module) refresh().then(s=>console.log(JSON.stringify(s,null,2))).catch(e=>{console.error(e);process.exit(1)});
module.exports={refresh};
