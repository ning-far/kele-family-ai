import type {Chart} from './chart';
import type {Difficulty} from '../settings';

/** Recorded audio stays at its original tempo. Difficulty only thins notes. */
export function chartForDifficulty(chart:Chart,difficulty:Difficulty):Chart{
 if(!chart.meta.audioFile)return chart;
 const notes=chart.notes.filter(n=>difficulty==='hard'||(difficulty==='normal'?Number.isInteger(n.beat):Number.isInteger(n.beat)&&n.beat%2===0)).map(n=>({...n,lanes:[...n.lanes]}));
 return {...chart,meta:{...chart.meta,difficulty},notes};
}
