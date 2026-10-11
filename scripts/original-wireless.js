const english=location.pathname.includes('/english/');
document.body.dataset.layout=english?'document':'game';
const key='kele-wireless-keymap-v1';
let mapping=Array.from({length:8},(_,i)=>'Digit'+(i+1));
try{const value=JSON.parse(localStorage.getItem(key));if(Array.isArray(value)&&value.length===8&&value.every(v=>typeof v==='string'))mapping=value;}catch{}
const panel=document.createElement('details');panel.className='wireless-panel';
panel.innerHTML='<summary>📶 蓝牙开发板 / 按键设置</summary><p>先在电脑或手机的系统蓝牙设置中配对开发板（蓝牙键盘模式），再回到此页。不需要数据线。<a href="/devices" target="_blank" rel="noopener">检测连接与语音输入</a></p><p>按键必须发送键盘键码；仅有串口输出的旧固件需升级后才能无线操作。架子鼓：长按 S1+S5；英语：长按 S1+S8；语音输入：长按 S1+S7。切换后松开全部按键。</p><div class="wireless-mapping"></div><p class="wireless-status" role="status">等待按键。也可以直接用屏幕操作。</p><button type="button" class="wireless-reset">恢复数字键 1–8</button>';
let capture=-1;const held=new Map();let startTimer;
const status=panel.querySelector('.wireless-status'),row=panel.querySelector('.wireless-mapping');
const buttons=mapping.map((code,i)=>{const b=document.createElement('button');b.type='button';b.textContent=`S${i+1}: ${code}`;b.onclick=()=>{capture=i;status.textContent=`请按开发板的 S${i+1}（Esc 取消）。`;};row.append(b);return b;});
panel.querySelector('.wireless-reset').onclick=()=>{mapping=Array.from({length:8},(_,i)=>'Digit'+(i+1));save();capture=-1;status.textContent='已恢复默认映射。';};
function save(){buttons.forEach((b,i)=>b.textContent=`S${i+1}: ${mapping[i]}`);try{localStorage.setItem(key,JSON.stringify(mapping));}catch{status.textContent='映射已生效，但当前浏览器无法保存。';}}
function deliver(i,down){
 if(english){window.__englishApp?.keypad.setKey(i,down);return;}
 const code=['KeyD','KeyF','KeyJ','KeyK'][i];
 if(code)window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:code.slice(3).toLowerCase(),bubbles:true}));
 else if(i===6){clearTimeout(startTimer);if(down)startTimer=setTimeout(()=>{const pause=document.querySelector('.hud-bar.active [data-pause]'),start=document.querySelector('.screen-home.active [data-start]');(pause||start)?.click();},500);}
}
function receiveKey(code,down,repeat=false){
 if(repeat)return;
 if(!down){const i=held.get(code);if(i===undefined)return;held.delete(code);deliver(i,false);return;}
 const i=mapping.indexOf(code);if(i<0||held.has(code))return;
 held.set(code,i);deliver(i,true);
 status.textContent=`收到 S${i+1} · ${code}（键盘输入，无法区分有线/蓝牙来源）`;
}
function releaseAll(){held.forEach(i=>deliver(i,false));held.clear();clearTimeout(startTimer);}
window.addEventListener('keydown',event=>{
 if(!event.isTrusted||event.repeat||event.isComposing)return;
 if(capture>=0){event.preventDefault();event.stopImmediatePropagation();if(event.code==='Escape'){capture=-1;status.textContent='已取消。';return;}if(event.ctrlKey||event.altKey||event.metaKey){status.textContent='请使用独立按键，避免系统快捷键。';return;}if(mapping.some((v,i)=>v===event.code&&i!==capture)){status.textContent='这个键已映射到其他按键，请换一个。';return;}mapping[capture]=event.code;capture=-1;save();status.textContent='映射已保存，请在游戏中试按。';return;}
 if(event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
 if(event.ctrlKey||event.altKey||event.metaKey||!mapping.includes(event.code))return;
 event.preventDefault();event.stopImmediatePropagation();receiveKey(event.code,true,event.repeat);
},true);
window.addEventListener('keyup',event=>{if(!event.isTrusted||!held.has(event.code))return;event.preventDefault();event.stopImmediatePropagation();receiveKey(event.code,false);},true);
window.addEventListener('blur',releaseAll);
window.addEventListener('message',event=>{
 if(window.parent===window||event.source!==window.parent||event.origin!==location.origin)return;
 const value=event.data;
 if(value?.type==='kele-wireless-release'){releaseAll();return;}
 if(value?.type!=='kele-wireless-key'||typeof value.code!=='string'||!['keydown','keyup'].includes(value.phase))return;
 receiveKey(value.code,value.phase==='keydown',Boolean(value.repeat));
});
const style=document.createElement('style');style.textContent='.wireless-panel{position:relative;padding:10px 14px;background:#eef9ff;color:#153948;border-radius:12px;font:14px/1.6 system-ui;margin:8px;z-index:40}.wireless-panel summary{cursor:pointer;font-weight:700}.wireless-mapping{display:flex;flex-wrap:wrap;gap:6px}.wireless-panel button{border:1px solid #8bbac7;border-radius:8px;padding:8px;background:white;color:#153948}.wireless-panel p{margin:6px 0}';
if(!english){style.textContent+='.wireless-panel{position:fixed;top:54px;left:8px;max-width:min(480px,calc(100vw - 32px));margin:0}.device-dock,.drum-mode-hint{display:none!important}';document.body.append(panel);}else document.querySelector('#status-bar').after(panel);
 document.head.append(style);
if(english)style.textContent+='@media(max-width:600px){.module-card{min-width:0!important;max-width:100%;box-sizing:border-box}.board{flex-wrap:wrap}}';
if(!english){
 const history=document.createElement('details');history.className='drum-history';
 const summary=document.createElement('summary');summary.textContent='🏆 我的歌曲成绩';history.append(summary);
 const list=document.createElement('div');history.append(list);document.body.append(history);
 // Keep optional controls in the home scroll surface instead of over the game.
 const dock=document.createElement('div');dock.className='home-tools';
 const mountTools=()=>{const home=document.querySelector('.home-inner');if(!home)return;home.querySelector('.subtitle').after(dock);dock.append(panel,history);toolsObserver.disconnect();};
 const toolsObserver=new MutationObserver(mountTools);toolsObserver.observe(document.body,{childList:true,subtree:true});mountTools();
 style.textContent+='.drum-history{position:fixed;top:100px;left:16px;z-index:40;max-width:calc(100vw - 32px);max-height:240px;overflow:auto;background:#ffffffed;color:#153948;padding:8px 12px;border-radius:10px;font:13px/1.7 system-ui}.drum-history summary{cursor:pointer}.drum-history p{margin:4px 0}body:has(.hud-bar.active) .drum-history{display:none}';
 const storageKey='kele-drum-history-v1';let records=[];
 try{const data=JSON.parse(localStorage.getItem(storageKey));if(Array.isArray(data))records=data.filter(r=>r&&typeof r.songTitle==='string'&&Number.isFinite(r.score)&&Number.isFinite(r.maxCombo)&&typeof r.date==='string').slice(0,30);}catch{}
 function render(){list.replaceChildren();if(!records.length){list.textContent='完成一首歌后，成绩会保存在这台设备。';return;}for(const r of records.slice(0,10)){const p=document.createElement('p');p.textContent=`${r.songTitle} · ${{easy:'慢慢来',normal:'刚刚好',hard:'挑战一下'}[r.difficulty]||r.difficulty} · ${r.score} 分 · 连击 ${r.maxCombo} · ${r.stars} 星`;list.append(p);}}render();
 window.addEventListener('kele-drum-result',event=>{const r=event.detail;if(!r||!Number.isFinite(r.score)||!Number.isFinite(r.maxCombo)||typeof r.songTitle!=='string')return;records.unshift({...r,date:new Date().toISOString()});records=records.slice(0,30);try{localStorage.setItem(storageKey,JSON.stringify(records));}catch{summary.textContent='🏆 本次成绩（浏览器未能保存）';}render();});
}
