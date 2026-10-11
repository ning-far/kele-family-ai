import {InvitationsPanel} from './InvitationsPanel.tsx';
import React from 'react';
import {FamilyManager} from './FamilyManager.tsx';
import {sessionBootstrap} from './session-bootstrap.ts';
type Profile={id:string;familyId:string;displayName:string;ageBand:'child'|'adult'|'senior'};
export function FamilyPage(){
 const [profiles,setProfiles]=React.useState<Profile[]>([]);
 const [status,setStatus]=React.useState('正在加载家庭档案…');
 const [loading,setLoading]=React.useState(false);
 const [ready,setReady]=React.useState(false);
 const controller=React.useRef<AbortController|null>(null);
 const load=React.useCallback(async()=>{
  controller.current?.abort();const active=new AbortController();controller.current=active;setReady(false);setLoading(true);setProfiles([]);setStatus('正在加载家庭档案…');
  try{
   const result=await sessionBootstrap.load();
   if(active.signal.aborted)return;
   if(!result){setStatus('登录后可管理家庭成员和同步进度。登录服务正在接入，本机游戏仍可使用。');return;}
   setProfiles(result.profiles);setReady(true);setStatus(result.profiles.length?'以下是你获授权使用的家庭档案。':'暂时没有可用的家庭档案。');
  }catch{if(!active.signal.aborted)setStatus('连接家庭服务失败，请重试。');}
  finally{if(!active.signal.aborted)setLoading(false);}
 },[]);
 React.useEffect(()=>{void load();return()=>controller.current?.abort()},[load]);
 return <><h1>我们的家庭</h1><p className="intro">每个人都有自己的进度和使用方式。</p><section className="notice"><h2>家庭成员</h2><p role="status">{status}</p>{ready&&<p>当前可使用 {profiles.length} 位成员的档案。</p>}<button className="secondary" disabled={loading} onClick={()=>void load()}>{loading?'加载中…':'刷新家庭档案'}</button></section>{ready&&<><FamilyManager profiles={profiles} refresh={load}/><InvitationsPanel/></>}</>;
}
