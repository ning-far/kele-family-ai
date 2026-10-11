// Reuse the original keyboard input and authoritative audio clock for touch hits.
const pads = document.createElement('div');
pads.className = 'platform-touch-pads';
pads.setAttribute('aria-label', '触屏架子鼓');
const style = document.createElement('style');
style.textContent = `.platform-touch-pads{position:fixed;bottom:max(12px,env(safe-area-inset-bottom));left:5%;width:90%;display:none;gap:8px;z-index:30}.hud-bar.active~.platform-touch-pads{display:flex}.screen-pause.active~.platform-touch-pads{display:none}.platform-touch-pads button{flex:1;min-height:58px;border:2px solid #ffffff88;border-radius:16px;background:#152a48dd;color:white;font:bold 20px system-ui;touch-action:none}.platform-touch-pads button:active{background:#775be8} .platform-touch-pads small{display:block;font-size:12px}@media(max-width:600px){.screen-home{overflow-y:auto}.screen-home .home-inner{width:100%;max-width:100%;padding:0 12px;box-sizing:border-box}.song-row{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:100%;max-width:100%}.song-card{width:auto!important;min-width:0!important;min-height:110px;padding:14px 4px}.song-ico{font-size:36px}.song-name{font-size:15px}.diff-row{display:flex;flex-wrap:nowrap;gap:6px;width:100%}.diff-btn{min-width:0;flex:1;padding:12px 4px}.game-title{font-size:30px}}`;
document.head.append(style);
style.textContent += `.platform-touch-pads,.platform-touch-pads button{pointer-events:auto;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}.platform-touch-pads button.pressed{background:#775be8;transform:scale(.96)}`;
style.textContent += `body:has(.hud-bar.active) .wireless-panel{display:none}@media(max-width:600px){.wireless-panel{top:10px!important;font-size:12px!important}.drum-history{top:50px!important;font-size:12px!important}.btn-start{font-size:23px;padding:14px 28px;margin-top:16px}.subtitle{font-size:14px;margin-bottom:14px}}@media(max-height:500px) and (orientation:landscape){.screen-home{overflow-y:auto}.home-inner{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:8px;padding:10px;width:min(98vw,780px)}.game-title,.subtitle{grid-column:1/-1}.game-title{font-size:26px}.subtitle{font-size:12px;margin:0}.song-row{grid-column:1;grid-row:3/5;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0}.song-card{width:auto;min-width:0;min-height:92px;padding:8px}.song-card .song-ico{font-size:27px}.song-card .song-name{font-size:14px}.diff-row{grid-column:2;grid-row:3;flex-wrap:nowrap;gap:4px}.diff-btn{min-width:0;padding:7px 3px;flex:1}.diff-label{font-size:14px}.diff-bpm{font-size:10px}.btn-start{grid-column:2;grid-row:4;font-size:19px;padding:10px;margin:0}.wireless-panel,.drum-history{display:none}.platform-touch-pads button{min-height:45px}}`;
['KeyD','KeyF','KeyJ','KeyK'].forEach((code, lane) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.innerHTML = `${['🥁','🪘','🔔','🎵'][lane]}<small>${['D','F','J','K'][lane]} · S${lane+1}</small>`;
  button.setAttribute('aria-label', `敲鼓 S${lane+1}`);
  const emit = type => window.dispatchEvent(new KeyboardEvent(type, { code, key: code.slice(3).toLowerCase(), bubbles: true }));
  const pointers = new Set();
  const release = event => { pointers.delete(event.pointerId); if(!pointers.size){button.classList.remove('pressed');emit('keyup');} };
  button.addEventListener('pointerdown', event => { event.preventDefault(); if(!pointers.size)emit('keydown');pointers.add(event.pointerId);button.classList.add('pressed');button.setPointerCapture(event.pointerId); });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  window.addEventListener('blur',()=>{pointers.clear();button.classList.remove('pressed');emit('keyup');});
  pads.append(button);
});
const overlay=document.querySelector('#overlay');
const mount=()=>{if(!overlay.querySelector('.hud-bar'))return;overlay.append(pads);observer.disconnect();};
const observer=new MutationObserver(mount);observer.observe(overlay,{childList:true});mount();
