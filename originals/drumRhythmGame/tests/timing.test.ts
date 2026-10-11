import {describe,it,expect} from 'vitest';
import {noteTimeMs,type Chart} from '../src/core/chart';
import {chartForDifficulty} from '../src/core/difficulty';
import {GameEngine} from '../src/core/engine';
const chart:Chart={format:'drumgame-chart/1',meta:{title:'recording',bpm:126,beatsPerBar:4,stepsPerBar:16,audioOffsetMs:0,audioFile:'audio/test.mp3',audioDurationMs:5000},lanes:[{id:0,name:'hat',key:'S1',color:'#fff',shape:'circle'}],notes:[{beat:0,timeMs:237,lanes:[0],vel:90},{beat:.5,timeMs:471,lanes:[0],vel:80},{beat:1,timeMs:717,lanes:[0],vel:90},{beat:2,timeMs:1193,lanes:[0],vel:90}]};
describe('recording alignment survives difficulty and pause clock',()=>{
 it('difficulty changes density, preserving retained exact recording times and original data',()=>{for(const d of ['easy','normal','hard'] as const){const c=chartForDifficulty(chart,d);expect(c.meta.bpm).toBe(126);for(const n of c.notes)expect(noteTimeMs(n,70,c)).toBe(n.timeMs);}expect(chart.notes).toHaveLength(4);expect(chartForDifficulty(chart,'easy').notes).toHaveLength(2);expect(chartForDifficulty(chart,'normal').notes).toHaveLength(3);});
 it('engine scores actual time including lead-in/calibration, and does not end before recording',()=>{const engine=new GameEngine(chart,{nowMs:()=>0},{bpm:126,leadInMs:2000,calibrationMs:40});expect(engine.notes[0].timeMs).toBe(2277);expect(engine.endTimeMs).toBeGreaterThanOrEqual(7000);});
 it('legacy synthesized melody keeps its existing difficulty behavior',()=>{const synthetic={...chart,meta:{...chart.meta,audioFile:undefined}};expect(chartForDifficulty(synthetic,'easy')).toBe(synthetic);});
});
