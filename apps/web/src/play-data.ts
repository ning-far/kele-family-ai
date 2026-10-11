export const words=[
 {word:'apple',meaning:'苹果',picture:'🍎'}, {word:'cat',meaning:'猫',picture:'🐱'},
 {word:'dog',meaning:'狗',picture:'🐶'}, {word:'sun',meaning:'太阳',picture:'☀️'},
 {word:'book',meaning:'书',picture:'📖'}, {word:'ball',meaning:'球',picture:'⚽'},
];
export const idioms=[
 {text:'一心一意',meaning:'心思专一，专心做一件事。'},
 {text:'意气风发',meaning:'精神振奋，充满干劲。'},
 {text:'发扬光大',meaning:'让好的传统或精神进一步发展。'},
 {text:'大功告成',meaning:'一项重要的工作圆满完成。'},
 {text:'成人之美',meaning:'帮助别人实现好的愿望。'},
 {text:'美不胜收',meaning:'美好的东西很多，一时欣赏不过来。'},
 {text:'收放自如',meaning:'能够灵活控制，放开或收住都很自然。'},
 {text:'如鱼得水',meaning:'好像鱼得到水一样，遇到了适合自己的环境。'},
 {text:'水到渠成',meaning:'条件成熟了，事情自然就能成功。'},
 {text:'成竹在胸',meaning:'做事之前，心里已经有了完整的计划。'},
 {text:'胸有成竹',meaning:'做事之前已经有了把握。'},
 {text:'竹报平安',meaning:'家书传来平安的消息。'},
 {text:'安居乐业',meaning:'生活安定，工作愉快。'},
 {text:'业精于勤',meaning:'学业和本领因为勤奋而精进。'},
 {text:'勤学苦练',meaning:'认真学习，坚持练习。'},
 {text:'练达老成',meaning:'阅历丰富，处事成熟稳重。'},
 {text:'成千上万',meaning:'数量非常多。'},
 {text:'万事如意',meaning:'祝愿每件事都顺心如愿。'},
 {text:'意犹未尽',meaning:'兴致还没有完全满足，还想继续。'},
 {text:'尽善尽美',meaning:'十分完善，没有欠缺。'},
 {text:'美中不足',meaning:'整体很好，还有一点不够完美。'},
 {text:'足智多谋',meaning:'富有智慧，有许多好办法。'},
 {text:'谋事在人',meaning:'做事需要人尽力谋划和努力。'},
 {text:'人定胜天',meaning:'人的努力能够克服自然带来的困难。'},
 {text:'天长地久',meaning:'时间长久，常用来表达长久不变的情谊。'},
];
// Public-domain traditional melody, synthesized locally; no commercial recording.
export const melody=[0,0,7,7,9,9,7,5,5,4,4,2,2,0,7,7,5,5,4,4,2,7,7,5,5,4,4,2,0,0,7,7,9,9,7,5,5,4,4,2,2,0];
export type Beat={time:number;lane:number;resolved:boolean};
export const beatSeconds=.48;
export const chart=():Beat[]=>melody.map((_,i)=>({time:2+i*beatSeconds,lane:i%4,resolved:false}));
export function judgeHit(beats:Beat[],lane:number,time:number):{index:number;points:number;label:string}|null{
 let index=-1,delta=Infinity;
 beats.forEach((beat,i)=>{const d=Math.abs(beat.time-time);if(!beat.resolved&&beat.lane===lane&&d<=.28&&d<delta){index=i;delta=d;}});
 return index<0?null:{index,points:delta<=.12?100:60,label:delta<=.12?'精准！':'不错！'};
}
export function expiredBeats(beats:Beat[],time:number):number[]{return beats.flatMap((beat,i)=>!beat.resolved&&time>beat.time+.28?[i]:[]);}
export function idiomMatches(previous:string,answer:string,target:string):boolean{return answer===target&&previous.at(-1)===answer[0];}
export type PlayRecord={id:string;mode:'english'|'rhythm'|'idiom';score:number;date:string};
const key='kele-play-v1';
export function readRecords():PlayRecord[]{
 try{const data:unknown=JSON.parse(localStorage.getItem(key)??'[]');if(!Array.isArray(data))return [];
 return data.filter((r):r is PlayRecord=>r&&typeof r.id==='string'&&['english','rhythm','idiom'].includes(r.mode)&&Number.isFinite(r.score)&&r.score>=0&&typeof r.date==='string').slice(0,20);
 }catch{return [];}
}
export function saveRecord(mode:PlayRecord['mode'],score:number){
 // LAN HTTP pages do not expose randomUUID on every mobile browser. Record IDs
 // are local deduplication labels, never credentials or authorization tokens.
 const id=typeof crypto.randomUUID==='function'?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
 const record={id,mode,score,date:new Date().toISOString()};
 localStorage.setItem(key,JSON.stringify([record,...readRecords()].slice(0,20)));
}
