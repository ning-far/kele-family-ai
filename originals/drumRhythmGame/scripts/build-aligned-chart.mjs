import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
const id=process.argv[2];if(!/^[a-z][a-z0-9-]{1,40}$/.test(id??''))throw new Error('Use a stable song id');
const analysisPath=resolve(root,'.analysis',id,'analysis.json'),target=resolve(root,'public/charts',id+'.json');
const analysis=JSON.parse(await readFile(analysisPath,'utf8'));
const audio=await readFile(resolve(root,'public/audio',analysis.audioFile));
if(createHash('sha256').update(audio).digest('hex')!==analysis.audioSha256)throw new Error('Recording changed; analyze it again');
if(analysis.beatTimesMs.length<16||analysis.bpm<40||analysis.bpm>220||analysis.detectedBeatToOnsetMedianMs>60)throw new Error('Beat confidence insufficient: review and edit timing before generating');
const old=JSON.parse(await readFile(target,'utf8'));
await mkdir(resolve(root,'timing/legacy-20261008'),{recursive:true});
const backup=resolve(root,'timing/legacy-20261008',id+'.json');try{await copyFile(target,backup,1);}catch(e){if(e.code!=='EEXIST')throw e;}
const notes=[];
const groove=old.meta.drumKit==='groove'||['red-star','white-rabbit'].includes(id);
analysis.beatTimesMs.forEach((timeMs,i)=>{
 const strengths=analysis.beatStrengths,normalized=strengths[i]/Math.max(...strengths);
 const lane=groove?(i%16===15?3:[0,1,2,1][i%4]):i%16===14?1:[0,2,0,3][i%4];
 notes.push({beat:i,timeMs,lanes:[lane],vel:Math.round(75+Math.min(1,normalized)*35)});
 if(i+1<analysis.beatTimesMs.length){const end=analysis.beatTimesMs[i+1],mid=(timeMs+end)/2,candidates=analysis.onsetTimesMs.filter(t=>t>timeMs+(end-timeMs)*.28&&t<end-(end-timeMs)*.28).sort((a,b)=>Math.abs(a-mid)-Math.abs(b-mid));
  if(candidates[0]!==undefined&&Math.abs(candidates[0]-mid)<65&&i%4!==3)notes.push({beat:i+.5,timeMs:candidates[0],lanes:[groove?1:0],vel:72});
 }
});
const chart={...old,meta:{...old.meta,bpm:analysis.bpm,audioOffsetMs:0,audioDurationMs:analysis.durationMs,audioSha256:analysis.audioSha256,lengthBeats:analysis.durationMs*analysis.bpm/60000,source:'recording-specific percussive beat analysis; original drum score not claimed'},notes};
if(groove){chart.meta.drumKit='groove';chart.lanes=chart.lanes.map((lane,i)=>({...lane,name:['底鼓 Kick','闭镲 Hi-hat','军鼓 Snare','开镲 Open-hat'][i],gm:[36,42,38,46][i]}));}
await writeFile(target,JSON.stringify(chart,null,2)+'\n');
await mkdir(resolve(root,'timing'),{recursive:true});await writeFile(resolve(root,'timing',id+'.json'),JSON.stringify(analysis,null,2)+'\n');
console.log(JSON.stringify({song:id,bpm:analysis.bpm,durationMs:analysis.durationMs,notes:notes.length,primaryBeats:analysis.beatTimesMs.length,backup,automaticDraft:true}));
