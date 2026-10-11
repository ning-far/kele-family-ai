import React from 'react';
export function NetworkStatus(){
 const [state,setState]=React.useState<'online'|'offline'|'restored'>(navigator.onLine?'online':'offline');
 React.useEffect(()=>{
  let disposed=false,checking=false,failed=!navigator.onLine,failures=0;let recovery:ReturnType<typeof setTimeout>|undefined;
  const check=async()=>{if(checking)return;checking=true;try{const r=await fetch('/play/connection.json',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error('unavailable');failures=0;if(!disposed&&failed){failed=false;setState('restored');clearTimeout(recovery);recovery=setTimeout(()=>{if(!failed)setState('online');},5000);}}catch{if(!disposed&&++failures>=2){failed=true;clearTimeout(recovery);setState('offline');}}finally{checking=false;}};
  const offline=()=>{failed=true;clearTimeout(recovery);setState('offline');},online=()=>void check();window.addEventListener('offline',offline);window.addEventListener('online',online);
  const timer=setInterval(()=>{if(!navigator.onLine){offline();return;}void check();},10000);
  return()=>{disposed=true;clearInterval(timer);clearTimeout(recovery);window.removeEventListener('offline',offline);window.removeEventListener('online',online);};
 },[]);
 return state==='online'?null:<p role="status" style={{position:'fixed',top:0,left:0,right:0,zIndex:200,padding:12,margin:0,textAlign:'center',background:state==='offline'?'#fff0cf':'#dff2e3',color:'#294333'}}>{state==='offline'?'网络暂时断开，正在自动检测恢复。当前游戏不会重置。':'网络已恢复，可以继续。'}</p>;
}
