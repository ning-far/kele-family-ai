import React from 'react';
import {memberContext} from './member-context.ts';
export type FamilyProfile={id:string;familyId:string;displayName:string;ageBand:'child'|'adult'|'senior'};
type Progress={profileId:string;points:number;items:{contentId:string;skill:string;completedCount:number}[]};
const contentNames:Record<string,string>={apple:'苹果',banana:'香蕉',cat:'小猫',dog:'小狗',twinkle:'小星星',babybaby:'宝贝宝贝',grow:'生长吧'};
const skillNames:Record<string,string>={recognize:'词汇识别',listening:'听力理解',speaking:'口语练习',reading:'阅读练习',writing:'书写练习',rhythm:'节奏练习',idiom:'成语接龙'};
export function FamilyManager({profiles,refresh}:{profiles:FamilyProfile[];refresh:()=>Promise<void>}){
 const [selected,setSelected]=React.useState<FamilyProfile|null>(null),[progress,setProgress]=React.useState<Progress|null>(null),[message,setMessage]=React.useState('');
 const [name,setName]=React.useState(''),[age,setAge]=React.useState<FamilyProfile['ageBand']>('child'),[busy,setBusy]=React.useState(false);
 const families=[...new Set(profiles.map(profile=>profile.familyId))];
 const [family,setFamily]=React.useState(families[0]??'');
 const controller=React.useRef<AbortController|null>(null),operation=React.useRef<{signature:string;id:string}|null>(null);
 React.useEffect(()=>()=>controller.current?.abort(),[]);
 const select=async(profile:FamilyProfile)=>{
  controller.current?.abort();const active=new AbortController();controller.current=active;
  memberContext.select(profile.id);setSelected(profile);setProgress(null);setMessage('正在同步这位成员的进度…');
  try{
   const response=await fetch('/api/v1/members/'+encodeURIComponent(profile.id)+'/progress',{credentials:'same-origin',signal:active.signal});
   if(!response.ok)throw new Error(response.status===401?'登录已过期，请重新登录。':response.status===403?'无权查看这位成员的进度。':'进度暂时不可用，请重试。');
   const body=await response.json();if(body.data?.profileId!==profile.id||!Array.isArray(body.data.items)||!Number.isFinite(body.data.points))throw new Error('进度数据异常，请重试。');
   if(!active.signal.aborted){setProgress(body.data);setMessage(body.data.items.length?'进度已同步。':'还没有完成的练习。');}
  }catch(error){if(!active.signal.aborted)setMessage(error instanceof Error?error.message:'同步失败。');}
 };
 React.useEffect(()=>{const current=memberContext.getSnapshot().member;if(current&&profiles.some(profile=>profile.id===current.id))void select(current)},[]);
 const create=async()=>{
  setBusy(true);const body=families.length?{displayName:name.trim(),ageBand:age}:{name:name.trim()};
  const path=families.length?'/api/v1/families/'+encodeURIComponent(family)+'/members':'/api/v1/families';
  const signature=JSON.stringify([path,body]);if(operation.current?.signature!==signature)operation.current={signature,id:crypto.randomUUID()};
  try{
   const response=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','idempotency-key':operation.current!.id},body:JSON.stringify(body)});
   const result=await response.json();if(!response.ok)throw new Error(result.error?.message??'创建失败，请重试。');
   operation.current=null;await refresh();
  }catch(error){setMessage(error instanceof Error?error.message:'创建失败。');}
  finally{setBusy(false);}
 };
 const logout=async()=>{
  controller.current?.abort();memberContext.setSession(null);setSelected(null);setProgress(null);setBusy(true);
  try{const response=await fetch('/api/v1/auth/logout',{method:'POST',credentials:'same-origin'});if(!response.ok)throw new Error('服务端退出未确认，请重试。');await refresh();}
  catch(error){setMessage(error instanceof Error?error.message:'退出失败。');}
  finally{setBusy(false);}
 };
 return <section className="notice family-manager"><h2>成员与进度</h2><p role="status">{message}</p>
  <div className="member-switcher">{profiles.map(profile=><button className="secondary" key={profile.id} aria-pressed={selected?.id===profile.id} disabled={busy} onClick={()=>void select(profile)}>{profile.displayName}</button>)}</div>
  {selected&&<section aria-label={selected.displayName+'的进度'}><h3>{selected.displayName}的进度</h3>{progress&&<><p>累计奖励 {progress.points} 分</p>{progress.items.map(item=><p key={item.contentId+':'+item.skill}>{contentNames[item.contentId]??'学习内容'} · {skillNames[item.skill]??'学习练习'} · 完成 {item.completedCount} 次</p>)}</>}<button className="secondary" disabled={busy} onClick={()=>void select(selected)}>重新同步</button></section>}
  <form onSubmit={event=>{event.preventDefault();void create()}}><h3>{families.length?'添加成员':'创建家庭'}</h3>
   {families.length>0&&<label>所属家庭<select value={family} onChange={event=>setFamily(event.target.value)}>{families.map((id,index)=><option key={id} value={id}>家庭 {index+1}</option>)}</select></label>}
   <label>{families.length?'成员称呼':'家庭名称'}<input required maxLength={80} value={name} onChange={event=>setName(event.target.value)}/></label>
   {families.length>0&&<label>使用方式<select value={age} onChange={event=>setAge(event.target.value as FamilyProfile['ageBand'])}><option value="child">儿童</option><option value="senior">长辈</option><option value="adult">成人</option></select></label>}
   <p>家庭使用档案不会自动开放私密聊天记录。</p><button disabled={busy||!name.trim()}>{busy?'处理中…':families.length?'添加成员':'创建家庭'}</button>
  </form><button className="secondary" disabled={busy} onClick={()=>void logout()}>退出登录</button>
 </section>;
}
