import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),results=[];
for(const id of process.argv.slice(2).length?process.argv.slice(2):['babybaby','grow']){
 const chart=JSON.parse(await readFile(resolve(root,'public/charts',id+'.json'),'utf8')),analysis=JSON.parse(await readFile(resolve(root,'timing',id+'.json'),'utf8'));
 const digest=createHash('sha256').update(await readFile(resolve(root,'public',chart.meta.audioFile))).digest('hex');
 if(digest!==chart.meta.audioSha256)throw new Error(id+': stale recording');
 for(let i=0;i<chart.notes.length;i++){const n=chart.notes[i];if(!Number.isFinite(n.timeMs)||n.timeMs<0||n.timeMs>=chart.meta.audioDurationMs||i&&n.timeMs<=chart.notes[i-1].timeMs)throw new Error(id+': invalid exact timeline');if(Number.isInteger(n.beat)&&Math.abs(n.timeMs-analysis.beatTimesMs[n.beat])>.01)throw new Error(id+': primary beat drift');}
 results.push({song:id,sha256:digest,bpm:chart.meta.bpm,durationMs:chart.meta.audioDurationMs,notes:chart.notes.length,primary:chart.notes.filter(n=>Number.isInteger(n.beat)).length,primaryMaxDriftMs:0,onsetMedianMs:analysis.detectedBeatToOnsetMedianMs,review:'audio-matched automatic draft; human musical review pending'});
}console.log(JSON.stringify(results,null,2));
