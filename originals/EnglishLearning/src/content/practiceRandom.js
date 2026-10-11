// Bounded, device-local recent exposure history; no recordings or personal data.
const memory=new Map();
export function randomPractice(pool,n,key,rng=Math.random){
 const id=x=>String(x.word??x.text??x.prompt??x);
 const unique=[...new Map(pool.map(x=>[id(x),x])).values()];
 let recent=memory.get(key)??[];try{const raw=globalThis.localStorage?.getItem('ela_recent_'+key);if(raw)recent=JSON.parse(raw);}catch{}
 if(!Array.isArray(recent))recent=[];
 const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 const seen=new Set(recent);const selected=[...shuffle(unique.filter(x=>!seen.has(id(x)))),...shuffle(unique.filter(x=>seen.has(id(x))))].slice(0,n);
 // Rotate a finite pool even when all items have been seen: the last first item
 // must not remain first when another item is available.
 if(selected.length>1&&id(selected[0])===recent[0])[selected[0],selected[1]]=[selected[1],selected[0]];
 const next=[...selected.map(id),...recent.filter(x=>!selected.some(y=>id(y)===x))].slice(0,Math.min(48,Math.max(1,Math.floor(unique.length/2))));
 memory.set(key,next);try{globalThis.localStorage?.setItem('ela_recent_'+key,JSON.stringify(next));}catch{}
 return selected;
}
