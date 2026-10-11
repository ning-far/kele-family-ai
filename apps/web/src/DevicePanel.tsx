import React from 'react';
import './device.css';
type Status={available?:boolean;name?:string;paired?:boolean;connected?:boolean;easyInputRunning?:boolean;error?:string};
export function DevicePanel(){
 const active=React.useRef(new Set<string>());
 const [status,setStatus]=React.useState<Status|null>(null),[loading,setLoading]=React.useState(false),[message,setMessage]=React.useState(''),[keys,setKeys]=React.useState<string[]>([]),[events,setEvents]=React.useState<string[]>([]);
 const refresh=async()=>{setLoading(true);setMessage('正在读取电脑的蓝牙状态…');try{const response=await fetch('/local/device-status',{cache:'no-store'});if(!response.ok)throw new Error('设备状态仅支持在本机入口读取');const value:Status=await response.json();setStatus(value);setMessage(value.available?'系统状态已更新；请继续验证实体按键。':'暂时无法读取系统状态，请打开系统蓝牙设置核对。');}catch(error){setMessage(error instanceof Error?error.message:'读取失败，请重试。');}finally{setLoading(false)}};
 React.useEffect(()=>{void refresh()},[]);
 React.useEffect(()=>{const listen=(event:KeyboardEvent)=>{
  if(!event.isTrusted||event.isComposing)return;
  const hotkey=event.code==='Space'&&((event.type==='keydown'&&event.ctrlKey&&event.shiftKey&&!event.altKey&&!event.metaKey)||(event.type==='keyup'&&active.current.has('Ctrl + Shift + Space')));
  if(!hotkey&&!/^Digit[1-8]$/.test(event.code))return;
  if(event.target instanceof Element&&event.target.closest('input,textarea,[contenteditable="true"]'))return;
  if(event.repeat)return;
  const label=hotkey?'Ctrl + Shift + Space':`S${event.code.slice(-1)}`;
  if(event.type==='keyup'&&!active.current.has(label))return;
  if(event.type==='keydown')active.current.add(label);else active.current.delete(label);
  setKeys([...active.current]);
  setEvents(previous=>[`${new Date().toLocaleTimeString()} ${label} ${event.type==='keydown'?'按下':'松开'}`,...previous].slice(0,12));
 };const blur=()=>{active.current.clear();setKeys([])};addEventListener('keydown',listen,true);addEventListener('keyup',listen,true);addEventListener('blur',blur);return()=>{removeEventListener('keydown',listen,true);removeEventListener('keyup',listen,true);removeEventListener('blur',blur)}},[]);
 return <section className="device-panel"><h1>蓝牙与语音输入</h1><p>先连接，再选模式，最后试按。开发板不需要数据线传输。</p><div className="device-status-grid"><article><h2>EasyInput Board</h2><strong>{status?.connected===true?'系统蓝牙已连接':status?.connected===false?'系统蓝牙未连接':'等待系统检测'}</strong><p>{status?.paired===true?'已配对':status?.paired===false?'尚未配对':'配对状态待核实'}</p></article><article><h2>EasyInput 应用</h2><strong>{status?.easyInputRunning===true?'正在运行':status?.easyInputRunning===false?'未运行':'等待系统检测'}</strong><p>语音输入通过它的快捷键启动。</p></article></div><div className="device-actions"><button disabled={loading} onClick={()=>{void refresh()}}>{loading?'检测中…':'重新检测连接'}</button><a href="ms-settings:bluetooth">打开 Windows 蓝牙设置</a></div><p role="status">{message}</p><h2>选择开发板模式</h2><div className="device-mode-grid"><article><h3>架子鼓游戏</h3><p>长按 S1 + S5 约一秒，松开全部按键。模式灯为绿色。</p><p>S1–S4 打鼓；长按 S7 暂停或继续。</p><a href="/modes/rhythm-game">进入完整架子鼓 →</a></article><article><h3>小学英语</h3><p>长按 S1 + S8 约一秒，松开全部按键。模式灯为青色。</p><p>按键功能随词汇、听力、口语等页面变化。</p><a href="/modes/primary-english">进入完整英语学习 →</a></article><article><h3>S1 语音输入</h3><p>长按 S1 + S7 约一秒，松开全部按键。模式灯为紫色。</p><p>EasyInput 的启动快捷键设为 Ctrl + Shift + Space。点击要输入文字的位置，按 S1 开始，再按 S1 停止。</p><p>当前固件发送这个固定快捷键；其他输入法的快捷键映射尚未接入，不能在此假装已配置。</p></article></div><h2>实体按键检测</h2><p>点击下面的检测区，切到游戏或英语模式，再按 S1–S8。普通数字键盘也会产生相同信号，此处不区分设备来源。</p><button className="key-test" onBlur={()=>{active.current.clear();setKeys([])}}>检测区 · {keys.length?`正在按住 ${keys.join('、')}`:'等待按键'}</button><ol className="key-events" aria-live="polite">{events.length?events.map((value,index)=><li key={index}>{value}</li>):<li>尚未收到按键。语音模式的系统快捷键可能被 EasyInput 直接接收，请看它的录音提示。</li>}</ol></section>;
}
export function DevicePage(){return <main className="device-page"><nav><a href="/modes/">← 模式中心</a><a href="/play">直接试玩</a></nav><DevicePanel/></main>}
