import {chromium} from '../../.tools/browser-tests/node_modules/playwright/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {idioms} from '../apps/web/src/play-data.ts';
const site='https://ning-and-far-d4gnalnk55f9133e8-1251364700.tcloudbaseapp.com',out='docs/reviews/evidence-mobile-fixes-20261004';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--autoplay-policy=document-user-activation-required']});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,locale:'zh-CN'});
await context.addInitScript(()=>{window.__audioEvents=[];const original=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){window.__audioEvents.push({samples:this.buffer?.length??0,state:this.context.state});return original.apply(this,args);};});
const page=await context.newPage(),errors=[],result={site,checkedAt:new Date().toISOString(),browser:'Headless Edge, mobile viewport; not physical iPhone'};page.on('pageerror',e=>errors.push(e.message));
const networkFailures=[];page.on('requestfailed',request=>{networkFailures.push({url:request.url(),error:request.failure()?.errorText});});page.on('console',msg=>{if(msg.text().includes('[ASR]')||msg.type()==='error')console.log(msg.text());});
result.badResponses=[];page.on('response',r=>{if(r.status()>=400)result.badResponses.push({url:r.url(),status:r.status()});});
try{
 await page.goto(site+'/play/?mode=idiom&v=mobile-fixes-20261004',{waitUntil:'networkidle'});
 await Promise.race([page.locator('.play-kicker').waitFor(),page.getByText('确定访问',{exact:true}).waitFor()]);
 if(await page.getByText('确定访问',{exact:true}).isVisible()){console.log('Confirming CloudBase test-domain notice');await page.getByText('确定访问',{exact:true}).click();await page.waitForLoadState('networkidle');}
 if(!process.argv.includes('--audio-drum')){
 assert.match(await page.locator('.play-kicker').innerText(),/1 \/ 8/);
 const pick=async(text)=>{for(const char of text){await page.locator('.idiom-pool button:not(:disabled)').filter({hasText:new RegExp('^'+char+'$')}).first().tap();}};
 await pick([...idioms[1].text].reverse().join(''));await page.getByRole('button',{name:'确认成语',exact:true}).tap();
 assert.match(await page.locator('.play-feedback[role=status]').innerText(),/重新选/);assert.equal(await page.locator('.idiom-pool button:disabled').count(),0);result.wrongAnswerRecoverable=true;
 await pick(idioms[1].text);await page.getByRole('button',{name:'确认成语',exact:true}).tap();await page.locator('.idiom-reward').waitFor();await page.screenshot({path:out+'/idiom-reward.png',fullPage:true});
 await page.waitForFunction(()=>document.querySelector('.play-kicker')?.textContent.includes('2 / 8'));result.automaticNext=true;
 await page.getByRole('button',{name:'自动下一题',exact:true}).tap();
 for(let i=2;i<idioms.length;i++){await pick(idioms[i].text);await page.getByRole('button',{name:'确认成语',exact:true}).tap();await page.locator('.idiom-reward').waitFor();await page.locator('.idiom-reward button').tap();}
 await page.getByRole('heading',{name:'三关完成，接龙达人！'}).waitFor();assert.equal(await page.locator('.play-result strong').innerText(),'1200 分');result.all24Questions=true;assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kele-play-v1')).filter(r=>r.mode==='idiom').length),1);result.singleSavedResult=true;
 await page.screenshot({path:out+'/idiom-complete.png',fullPage:true});
 await context.setOffline(true);await page.getByText('网络暂时断开，正在自动检测恢复。当前游戏不会重置。',{exact:true}).waitFor();await context.setOffline(false);await page.getByText('网络已恢复，可以继续。',{exact:true}).waitFor();assert.match(await page.locator('.play-result h1').innerText(),/接龙达人/);result.networkRecoveryKeepsProgress=true;
 }
 await page.goto(site+'/legacy/english/index.html?v=mobile-fixes-20261004',{waitUntil:'networkidle'});
 // Exercise the released TTS implementation with real cloud synthesis, without
 // substituting a provider response or disabling browser autoplay restrictions.
 await page.evaluate(async()=>{const {BaiduTTS}=await import('/legacy/english/src/speech/baiduTts.js?v=mobile-audio-touch-20261008-r2');window.__tts=new BaiduTTS();const b=document.createElement('button');b.textContent='测试真实朗读';b.onclick=async()=>{window.__ttsResult=await window.__tts.speak('apple');};document.body.prepend(b);});
 const ttsResponse=page.waitForResponse(r=>r.url().includes('/kele-english-api/baidu/tts')&&r.request().method()==='POST');await page.getByRole('button',{name:'测试真实朗读',exact:true}).tap();const response=await ttsResponse;assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/audio/);await page.waitForFunction(()=>window.__ttsResult!==undefined,{timeout:30000});assert.equal(await page.evaluate(()=>window.__ttsResult),true);assert.ok(await page.evaluate(()=>window.__audioEvents.some(e=>e.samples>100&&e.state==='running')));result.cloudTtsDecodedAndPlayed=true;result.ttsType=response.headers()['content-type'];
 await page.getByRole('button',{name:'Start (S1 + S8)',exact:true}).tap();assert.equal(await page.locator('.module-card').count(),5);await page.getByText('Speak',{exact:true}).tap();
 const previousAudio=await page.evaluate(()=>window.__audioEvents.filter(e=>e.samples>100&&e.state==='running').length);const replay=page.waitForResponse(r=>r.url().includes('/kele-english-api/baidu/tts')&&r.request().method()==='POST');await page.getByRole('button',{name:/Play again/}).tap();assert.equal((await replay).status(),200);await page.waitForFunction(count=>window.__audioEvents.filter(e=>e.samples>100&&e.state==='running').length>count,previousAudio);result.englishFiveModulesAndReplayUi=true;
 await page.goto(site+'/play/?mode=rhythm&v=mobile-fixes-20261004',{waitUntil:'networkidle'});const frame=page.frameLocator('iframe');await frame.locator('[data-start]').tap();await frame.locator('.hud-bar.active').waitFor({timeout:25000});await frame.locator('.platform-touch-pads button').first().waitFor();
 const pad=frame.locator('.platform-touch-pads button').first(),bounds=await pad.boundingBox();assert.ok(bounds&&bounds.y>=0&&bounds.y+bounds.height<=844,JSON.stringify(bounds));
 await page.frames().find(f=>f.url().includes('/legacy/drum/')).evaluate(()=>{window.__keys=[];window.addEventListener('keydown',e=>window.__keys.push(['down',e.code]));window.addEventListener('keyup',e=>window.__keys.push(['up',e.code]));});
 for(let i=0;i<4;i++)await frame.locator('.platform-touch-pads button').nth(i).tap();
 const drumFrame=page.frames().find(f=>f.url().includes('/legacy/drum/'));const keys=await drumFrame.evaluate(()=>window.__keys);for(const code of ['KeyD','KeyF','KeyJ','KeyK']){assert.ok(keys.some(([phase,key])=>phase==='down'&&key===code));assert.ok(keys.some(([phase,key])=>phase==='up'&&key===code));}result.touchFourTracks=true;result.padsVisibleInMobileViewport=true;
 const cdp=await context.newCDPSession(page),left=await frame.locator('.platform-touch-pads button').nth(0).boundingBox(),right=await frame.locator('.platform-touch-pads button').nth(2).boundingBox();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:left.x+left.width/2,y:left.y+left.height/2,id:1},{x:right.x+right.width/2,y:right.y+right.height/2,id:2}]});
 assert.equal(await frame.locator('.platform-touch-pads button.pressed').count(),2);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(await frame.locator('.platform-touch-pads button.pressed').count(),0);await frame.locator('.platform-touch-pads button').first().tap();result.multiTouchCancelRecovers=true;
 await page.screenshot({path:out+'/drum-touch.png',fullPage:true});await frame.locator('[data-pause]').tap();assert.equal(await frame.locator('.platform-touch-pads').isVisible(),false);await frame.locator('[data-resume]').tap();await frame.locator('.platform-touch-pads button').first().waitFor();result.pauseResume=true;
 // Tap with real touch events for a short stretch, letting the real engine
 // judge timing against its own music clock rather than injecting scores.
 for(let i=0;i<64;i++){await frame.locator('.platform-touch-pads button').nth(i%4).tap();await page.waitForTimeout(120);}
 await frame.locator('.screen-result.active').waitFor({timeout:120000});result.naturalDrumResult=true;await page.screenshot({path:out+'/drum-result.png',fullPage:true});
 const score=Number((await frame.locator('[data-score]').innerText()).replace(/[^0-9]/g,''));assert.ok(score>0,'Real touch play must earn a non-zero engine score');result.realTouchScore=score;
 const root=await fetch(site+'/');result.oldCompanionTitle=(await root.text()).match(/<title>(.*?)<\/title>/)?.[1];assert.match(result.oldCompanionTitle,/老伙计/);
 result.pageErrors=errors;assert.deepEqual(errors,[]);result.pass=true;
}catch(error){result.pass=false;result.error=String(error.stack||error);result.pageErrors=errors;result.url=page.url();result.visibleText=(await page.locator('body').innerText()).slice(0,2000);await writeFile(out+'/failure.html',await page.content());await page.screenshot({path:out+'/failure.png',fullPage:true});process.exitCode=1;}finally{result.networkFailures=networkFailures;await writeFile(out+(process.argv.includes('--audio-drum')?'/audio-drum-results.json':'/results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();}
