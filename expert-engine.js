const fs=require('fs'); const path=require('path');
const ROOT=__dirname;
const PROFILES=path.join(ROOT,'analyst-profiles.json');
const SIGNALS=path.join(ROOT,'public-signals.json');
const LEDGER=path.join(ROOT,'results-ledger.json');
function read(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function key(v){return String(v??'').trim().toLowerCase().replace(/\s+/g,' ')}
function settleUnits(result, odds){ if(result==='WIN') return odds>=0 ? odds/100 : 100/Math.abs(odds); if(result==='PUSH') return 0; if(result==='LOSS') return odds>=0 ? -1 : -1; return null; }
function buildExperts(){
 const profiles=read(PROFILES,{analysts:[]}); const ledger=read(LEDGER,{picks:[]});
 const byAnalyst={};
 for(const p of profiles.analysts){byAnalyst[p.id]={...p,tracked:{picks:0,wins:0,losses:0,pushes:0,units:0},markets:{}};}
 for(const pick of ledger.picks||[]){
   for(const a of pick.sources||[]){
    const id=a.analystId; if(!byAnalyst[id]) continue; const x=byAnalyst[id];
    if(!['WIN','LOSS','PUSH'].includes(pick.result)) continue;
    x.tracked.picks++; x.tracked[pick.result.toLowerCase()+'s']=(x.tracked[pick.result.toLowerCase()+'s']||0)+1;
    x.tracked.units+=Number(settleUnits(pick.result,pick.odds||-110)||0);
    const market=pick.market; x.markets[market]??={picks:0,wins:0,losses:0,pushes:0,units:0};
    x.markets[market].picks++; x.markets[market][pick.result.toLowerCase()+'s']=(x.markets[market][pick.result.toLowerCase()+'s']||0)+1; x.markets[market].units+=Number(settleUnits(pick.result,pick.odds||-110)||0);
   }
 }
 return Object.values(byAnalyst).map(x=>{
  const t=x.tracked; const decided=t.wins+t.losses; const winRate=decided? t.wins/decided:null; const roi=t.picks? t.units/t.picks:null;
  return {...x,winRate,roi,rankScore: t.picks>=50?(winRate*70+Math.max(-1,Math.min(1,roi))*30):null};
 }).sort((a,b)=>(b.rankScore??-1)-(a.rankScore??-1));
}
function buildRecord(){const l=read(LEDGER,{picks:[]});const settled=(l.picks||[]).filter(p=>['WIN','LOSS','PUSH'].includes(p.result));const wins=settled.filter(p=>p.result==='WIN').length;const losses=settled.filter(p=>p.result==='LOSS').length;const units=settled.reduce((s,p)=>s+Number(settleUnits(p.result,p.odds||-110)||0),0);return {picks:settled.length,wins,losses,pushes:settled.filter(p=>p.result==='PUSH').length,units,roi:settled.length?units/settled.length:null};}
function buildExpertBoard(){const signals=read(SIGNALS,{signals:[]}); const profiles=buildExperts(); return {generatedAt:new Date().toISOString(),record:buildRecord(),experts:profiles,trackedPickPolicy:'Only picks explicitly captured and settled by LineFoundry count toward the LineFoundry-tracked record.'};}
module.exports={buildExperts,buildRecord,buildExpertBoard};
