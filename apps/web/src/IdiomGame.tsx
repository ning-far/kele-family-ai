import React from 'react';
import {createPortal} from 'react-dom';
import {idioms,idiomMatches,saveRecord} from './play-data.ts';
import './idiom.css';
import {IdiomScenery,Celebration} from './IdiomScenery.tsx';
import './idiom-upgrade.css';
import {buildIdiomRound,shuffledLetters} from './idiom-round.ts';

const themes=[{name:'春日花园',icon:'🌸',className:'garden'},{name:'山水漫游',icon:'🏞️',className:'mountain'},{name:'灯火团圆',icon:'🏮',className:'lantern'}];
const perLevel=8,total=idioms.length-1;
export function IdiomGame(){
 const [roundItems,setRoundItems]=React.useState(buildIdiomRound);
 const [index,setIndex]=React.useState(1),[selected,setSelected]=React.useState<number[]>([]),[hint,setHint]=React.useState(false),[solved,setSolved]=React.useState(false),[done,setDone]=React.useState(false),[message,setMessage]=React.useState(''),[saved,setSaved]=React.useState('');
 const [sound,setSound]=React.useState(true),[auto,setAuto]=React.useState(true),[theme,setTheme]=React.useState(0),[streak,setStreak]=React.useState(0),[mistakes,setMistakes]=React.useState(0);
 const [mode,setMode]=React.useState('chain'),[difficulty,setDifficulty]=React.useState('normal');
 const audio=React.useRef<AudioContext|null>(null),lock=React.useRef(false);
 React.useEffect(()=>()=>{void audio.current?.close();},[]);
 const tone=(correct:boolean|'tap')=>{
  if(!sound)return;
  try{audio.current ||= new AudioContext();const ctx=audio.current;void ctx.resume();
   (correct==='tap'?[620+selected.length*65]:correct?[523,659,784,1046]:[220,174]).forEach((hz,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain(),start=ctx.currentTime+i*.14,duration=correct==='tap'?.07:.22;osc.frequency.value=hz;osc.type=correct?'sine':'triangle';gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(correct==='tap'?.065:.12,start+.008);gain.gain.exponentialRampToValueAtTime(.001,start+duration);osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(start+duration+.02);});
   if(correct===true){for(let i=0;i<3;i++){const buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.055),ctx.sampleRate),data=buffer.getChannelData(0);for(let j=0;j<data.length;j++)data[j]=(Math.random()*2-1)*(1-j/data.length);const source=ctx.createBufferSource(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=1700;gain.gain.value=.025;source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);source.start(ctx.currentTime+.25+i*.23);}}
  }catch{setMessage('声音未能播放，画面提示仍然有效。');}
 };
 const target=roundItems[index],previous=roundItems[index-1],level=Math.ceil(index/perLevel),round=(index-1)%perLevel+1;
 const pool=React.useMemo(()=>shuffledLetters([...target.text,...['春','天','福','乐','山','云','花','月'].slice(0,difficulty==='easy'?2:difficulty==='hard'?8:4)].map((char,id)=>({char,id}))),[index,target.text,difficulty]);
 const prefix=mode==='cloze'?target.text[0]:'',needed=4-prefix.length;
 const answer=prefix+selected.map(id=>pool.find(p=>p.id===id)!.char).join('');
 React.useEffect(()=>{lock.current=false;},[index]);
 const next=React.useCallback(()=>{
  if(lock.current)return;lock.current=true;
  if(index===total){try{saveRecord('idiom',total*50);setSaved('成绩已保存在这台设备。');}catch{setSaved('浏览器未能保存成绩，本次奖励仍可查看。');}setDone(true);}
  else{setIndex(i=>i+1);setSelected([]);setSolved(false);setHint(false);setMessage('');if(index%perLevel===0)setTheme(Math.floor(index/perLevel));}
 },[index]);
 React.useEffect(()=>{if(!solved||!auto||done)return;const timer=setTimeout(next,3600);return()=>clearTimeout(timer);},[solved,auto,done,next]);
 const check=()=>{
  if(solved||answer.length!==4)return;
  if(idiomMatches(previous.text,answer,target.text)){tone(true);setSolved(true);setStreak(n=>n+1);setMessage(`接对了！${target.text}：${target.meaning}`);}
  else{tone(false);setMistakes(n=>n+1);setStreak(0);setSelected([]);setMessage('这次还没接对，已帮您清空。请重新选字，也可以看提示。');}
 };
 const restart=()=>{lock.current=false;setRoundItems(buildIdiomRound());setIndex(1);setSelected([]);setSolved(false);setDone(false);setHint(false);setMessage('');setStreak(0);setMistakes(0);};
 if(done)return <section className={`play-result senior idiom-scene ${themes[theme].className}`}><span>🏆</span><h1>三关完成，接龙达人！</h1><div className="idiom-medals">🌸 🏞️ 🏮</div><strong>{total*50} 分</strong><p>接对 {total} 道题，收集 {total*10} 颗星。答错可以重试，提示免费。</p><p>{saved}</p><button className="play-primary" onClick={restart}>再玩一局</button></section>;
 return <section className={`play-game senior idiom-scene ${themes[theme].className}`}>
  <IdiomScenery theme={theme}/>
  <div className="idiom-options"><label>画面 <select aria-label="选择接龙背景" value={theme} onChange={e=>setTheme(Number(e.target.value))}>{themes.map((t,i)=><option key={t.name} value={i}>{t.icon} {t.name}</option>)}</select></label><button aria-pressed={sound} onClick={()=>setSound(v=>!v)}>{sound?'🔊 声音开':'🔇 声音关'}</button><button aria-pressed={auto} onClick={()=>setAuto(v=>!v)}>{auto?'自动下一题':'手动下一题'}</button></div>
  <details className="idiom-play-settings"><summary>玩法与难度</summary><label>玩法 <select aria-label="选择成语玩法" disabled={solved} value={mode} onChange={e=>{setMode(e.target.value);setSelected([]);setHint(false);setMessage('');}}><option value="chain">接龙拼字</option><option value="cloze">补字接龙 · 首字已给出</option><option value="meaning">看意思拼成语</option></select></label><label>难度 <select aria-label="选择成语难度" disabled={solved} value={difficulty} onChange={e=>{setDifficulty(e.target.value);setSelected([]);setMessage('');}}><option value="easy">轻松 · 6个候选字</option><option value="normal">标准 · 8个候选字</option><option value="hard">挑战 · 12个候选字</option></select></label></details>
  <p className="play-kicker">{themes[level-1].icon} 第 {level} / 3 关 · 本关 {round} / {perLevel} 题</p>
  <div className="idiom-journey" aria-label={`已完成${index-1}题，共${total}题`}>{themes.map((t,i)=><span key={t.name} className={level===i+1?'current':level>i+1?'complete':''}>{level>i+1?'✓':t.icon} {t.name}</span>)}</div>
  <div className="idiom-stars">⭐ {(index-1+(solved?1:0))*10} 颗星 · 连续答对 {streak} 题</div>
  <div className="play-progress"><i style={{width:`${((index-1+(solved?1:0))/total)*100}%`}}/></div>
  <h1>{mode==='meaning'?'看意思，拼出成语':`请接“${previous.text.at(-1)}”开头的成语`}</h1><div className="idiom-previous">{mode==='meaning'?<><span>这句话说的是……</span><p>{target.meaning}</p></>:<><h2>{previous.text}</h2><p>{previous.meaning}</p></>}</div>
  <p className="idiom-instruction">按顺序选{needed}个字，再确认。答错可重新选。</p>
  <div className={`idiom-answer ${solved?'correct':''}`} aria-label="已选成语">{Array.from({length:4},(_,i)=><span className={i<prefix.length?'given':''} key={`${index}-${i}-${answer[i]||'empty'}`}>{answer[i]||'·'}</span>)}</div>
  <div className="idiom-pool">{pool.filter(p=>mode!=='cloze'||p.id!==0).map(p=><button aria-pressed={selected.includes(p.id)} disabled={solved||selected.length===needed||selected.includes(p.id)} key={p.id} onClick={()=>{tone('tap');try{navigator.vibrate?.(8);}catch{}setSelected(prev=>[...prev,p.id]);setMessage('');}}>{p.char}</button>)}</div>
  <p className="idiom-selection-count" aria-live="polite">已选 {selected.length} / {needed} 个字</p>
  <div className="play-actions"><button className="play-secondary" disabled={solved||!selected.length} onClick={()=>{setSelected(v=>v.slice(0,-1));setMessage('');}}>撤销一个字</button><button className="play-secondary" disabled={solved||!selected.length} onClick={()=>{setSelected([]);setMessage('');}}>清空</button><button className="play-secondary" disabled={solved||hint} onClick={()=>setHint(true)}>给我提示</button></div>
  {hint&&<p className="play-feedback">{target.meaning} 提示成语：“{target.text}”。</p>}
  <p className={`play-feedback ${solved?'success':''}`} role="status" aria-live="polite">{message||'慢慢想，不限时。'}</p>
  {!solved&&<button className="play-primary" disabled={selected.length!==needed} onClick={check}>确认成语</button>}
  {solved&&createPortal(<><Celebration/><div className="idiom-reward" role="status"><span aria-hidden="true">🎉 ⭐ 🎉</span><h2>{round===perLevel?'这一关完成啦！':'接得真好！'}</h2><p>+10 颗星 · +50 分</p><p>{target.meaning}</p><button className="play-primary" onClick={next}>{index===total?'查看总奖励':'下一题'}</button>{auto&&<small>奖励展示后自动继续</small>}</div></>,document.body)}
  <p className="play-muted">已接对 {index-1+(solved?1:0)} 题 · 重试 {mistakes} 次 · 提示不扣分</p>
 </section>;
}
