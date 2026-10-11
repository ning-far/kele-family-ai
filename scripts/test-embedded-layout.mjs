import {chromium} from '../../.tools/browser-tests/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const site=process.argv[2]||'http://127.0.0.1:5181';
const out='docs/reviews/evidence-layout-20261009';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const rows=[];
for(const [width,height] of [[360,640],[390,650],[390,844],[412,700],[844,390],[1280,900]].filter(([w,h])=>!process.argv[3]||w===Number(process.argv[3])||`${w}x${h}`===process.argv[3])){
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:width<1000});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const row={width,height,errors};
 const cdp=await context.newCDPSession(page);
 async function swipe(x,y,direction=1){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*18*direction}]});await page.waitForTimeout(16)}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(180)}
 async function reach(locator){for(let i=0;i<15;i++){const box=await locator.boundingBox();const iframe=await page.locator('iframe').count()?await page.locator('iframe').boundingBox():null;const top=iframe?iframe.y:0;if(box&&box.y>=top&&box.y+box.height<height-4)return box;const above=box&&box.y<top;await swipe(width*.62,above?top+40:height-45,above?-1:1)}throw new Error('action unreachable by native touch: '+locator)}
 try{
  await page.goto(site+'/play/?v=layout-20261009-r10',{waitUntil:'networkidle'});
  const gate=page.getByText('确定访问',{exact:true});await Promise.race([gate.waitFor(),page.locator('.play-app').waitFor()]);if(await gate.isVisible()){await gate.click();await page.waitForLoadState('networkidle')}
  await page.getByRole('button',{name:/开始演奏/}).tap();
  const frame=page.frameLocator('iframe');await frame.locator('[data-start]').waitFor();
  if(width>=1000){await page.mouse.move(width-4,height-50);await page.mouse.wheel(0,500);await page.waitForTimeout(250)}
  await reach(frame.locator('[data-start]'));
  await page.screenshot({path:`${out}/${width}-${height}-start.png`});row.nativeHomeScroll=true;
  await frame.locator('[data-start]').tap();
  await frame.locator('.hud-bar.active').waitFor();
  await page.waitForTimeout(3600);
  await frame.locator('.hud-bar [data-pause]').tap();
  await frame.locator('.screen-pause.active').waitFor();
  await reach(frame.locator('[data-home2]'));
  await frame.locator('[data-home2]').tap();row.drumPause=true;
  if(process.argv.includes('--natural')){
   await frame.locator('.diff-btn').last().tap();
   await reach(frame.locator('[data-start]'));await frame.locator('[data-start]').tap();
   await frame.locator('.screen-result.active').waitFor({timeout:180000});
   await reach(frame.locator('[data-home3]'));await frame.locator('[data-home3]').tap();row.drumNaturalResult=true;
  }
  await frame.locator('[data-settings]').tap();
  const close=frame.locator('[data-close-top]');await close.waitFor();
  const panelBox=await frame.locator('.settings-panel').boundingBox();
  for(let i=0;i<8;i++)await swipe(panelBox.x+panelBox.width*.7,Math.min(height-50,panelBox.y+panelBox.height-30));
  await close.tap();assert.equal(await frame.locator('.modal.show').count(),0);row.modalClose=true;
  await page.getByRole('button',{name:'← 返回试玩首页',exact:true}).tap();
  await page.getByRole('button',{name:/开始学习/}).tap();
  await frame.getByRole('button',{name:/Start|开始学习/}).tap();
  for(const activity of ['Vocabulary','Listening','Speak','Translator','My Words']){
   await frame.getByText(activity,{exact:true}).tap();await frame.getByRole('button',{name:'🏠 Home',exact:true}).waitFor();
   const child=page.frames().find(f=>f.url().includes('/legacy/english/'));
   assert.ok(await child.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await reach(frame.getByRole('button',{name:'🏠 Home',exact:true}));
   await frame.getByRole('button',{name:'🏠 Home',exact:true}).tap();
  }row.englishFivePages=true;
  await frame.getByText('Vocabulary',{exact:true}).tap();
  await frame.getByRole('button',{name:'⏸',exact:true}).tap();
  await reach(frame.getByRole('button',{name:'▶ Resume',exact:true}));
  await frame.getByRole('button',{name:'▶ Resume',exact:true}).tap();
  for(let i=0;i<16&&!(await frame.locator('.finale').count());i++){await page.keyboard.press('5');await page.waitForTimeout(250)}
  await frame.locator('.finale').waitFor({timeout:5000});
  await reach(frame.getByRole('button',{name:/Play again/}));
  await frame.getByRole('button',{name:/Play again/}).tap();row.englishPauseAndFinale=true;
  await page.getByRole('button',{name:'← 返回试玩首页',exact:true}).tap();
  await page.getByRole('button',{name:/开始接龙/}).tap();
  await reach(page.getByRole('button',{name:'确认成语',exact:true}));row.idiomActions=true;
  await page.getByRole('button',{name:'自动下一题',exact:true}).tap();
  await page.getByRole('button',{name:'给我提示',exact:true}).tap();
  const answer=(await page.locator('.play-feedback').first().innerText()).match(/提示成语：“(.{4})”/)[1];
  for(const char of answer){await page.locator('.idiom-pool button:not(:disabled)').filter({hasText:new RegExp('^'+char+'$')}).first().tap()}
  await page.getByRole('button',{name:'确认成语',exact:true}).tap();
  await page.locator('.idiom-reward').waitFor();await reach(page.getByRole('button',{name:'下一题',exact:true}));
  await page.getByRole('button',{name:'下一题',exact:true}).tap();row.idiomReward=true;
  assert.deepEqual(errors,[]);row.pass=true;
 }catch(e){row.pass=false;row.error=String(e.stack);await page.screenshot({path:`${out}/${width}-${height}-failure.png`})}
 rows.push(row);console.log(JSON.stringify(row));await context.close();
}
await browser.close();await writeFile(out+(process.argv[3]?`/results-${process.argv[3]}.json`:'/results.json'),JSON.stringify({site,rows,pass:rows.every(r=>r.pass)},null,2));if(rows.some(r=>!r.pass))process.exitCode=1;
