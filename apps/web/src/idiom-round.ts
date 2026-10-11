import {idioms} from './play-data.ts';
type Item={text:string;meaning:string};
// A reviewed closed chain permits random starting points without breaking the
// actual same-character rule. A round is 1 prompt + 24 distinct answers.
const extra:Item[]=[
 ['久别重逢','分别很久以后再次相见。'],['逢凶化吉','遇到危险后转为平安。'],['吉祥如意','祝愿平安美好，事事顺心。'],
 ['意气相投','志趣和性情合得来。'],['投其所好','顺着对方的爱好做事。'],['好事多磨','好事实现前常经历波折。'],
 ['磨杵成针','坚持努力，困难的事也能成功。'],['针锋相对','双方意见尖锐对立。'],['对答如流','回答问题流畅自如。'],
 ['流连忘返','喜欢一个地方，不愿离开。'],['返老还童','形容老人恢复青春活力。'],['童颜鹤发','白发而面容红润，精神很好。'],
 ['发奋图强','振作精神，努力进步。'],['强身健体','锻炼身体，增强体质。'],['体贴入微','关心照顾细致周到。'],
 ['微不足道','非常微小，不值得一提。'],['道听途说','没有根据地听来并传播消息。'],['说一不二','说话算数，不随意改变。'],
 ['二龙戏珠','两条龙围绕宝珠的传统图案。'],['珠联璧合','优秀的人或事物结合在一起。'],['合情合理','符合情理。'],
 ['理直气壮','理由充分，说话有底气。'],['壮志凌云','志向非常远大。'],['云开见日','困难过去，见到希望。'],
 ['日新月异','每天每月都有新的进步。'],['异口同声','大家说出相同的话。'],['声名鹊起','名声迅速提高。'],
 ['起死回生','把濒临失败的情况挽救过来。'],['生龙活虎','活泼健壮，充满活力。'],['虎虎生威','气势雄壮，很有精神。'],
 ['威风凛凛','气势庄严，让人敬畏。'],['凛若冰霜','态度严肃冷峻。'],['霜露之思','对已故亲人的思念。'],
 ['思前想后','反复考虑事情。'],['后来居上','后来者超过先前的人。'],['上善若水','美好的品德如水一样滋养万物。'],
 ['水落石出','事情真相终于显露。'],['出人头地','取得突出成就。'],['地久天长','时间长久。'],
 ['长驱直入','快速向前深入。'],['入木三分','形容分析深刻。'],['分秒必争','珍惜每一分每一秒。'],
 ['争先恐后','争着向前，唯恐落后。'],['后发制人','先观察，再采取有效行动。'],['人山人海','聚集的人非常多。'],
 ['海阔天空','天地广阔，也形容想法开阔。'],['空前绝后','以前没有，以后也很难再有。'],['后顾之忧','对身后事情的担心。'],
 ['忧国忧民','关心国家和百姓。'],['民富国强','百姓富足，国家强盛。'],['强词夺理','没有道理却强行辩解。'],
 ['理所当然','按道理应当如此。'],['然荻读书','勤奋读书的古代故事。'],
 ['书不尽言','书信难以表达全部想说的话。'],['言行一致','说的和做的一样。'],['致远任重','责任重大，路途长远。'],
 ['重见天日','摆脱困境，重新看到光明。'],['日行千里','行进速度很快。'],['里应外合','里面和外面相互配合。'],['合二为一','把两者结合成一个整体。'],
].map(([text,meaning])=>({text,meaning}));
export const idiomBank=[...idioms,...extra];
const historyKey='kele-idiom-recent-v2';let memory:number[]=[];
export function buildIdiomRound(rng=Math.random):Item[]{
 let recent=memory;try{const raw=JSON.parse(globalThis.localStorage?.getItem(historyKey)??'null');if(Array.isArray(raw))recent=raw.filter(n=>Number.isInteger(n)&&n>=0&&n<idiomBank.length);}catch{}
 const costs=idiomBank.map((_,i)=>Array.from({length:25},(_,j)=>recent.includes((i+j)%idiomBank.length)?j<9?100:1:0).reduce<number>((a,b)=>a+b,0));
 const best=Math.min(...costs);const candidates=idiomBank.map((_,i)=>i).filter(i=>costs[i]===best&&i!==recent[0]);
 const pool=candidates.length?candidates:idiomBank.map((_,i)=>i).filter(i=>i!==recent[0]);
 const start=pool[Math.floor(rng()*pool.length)]??0;
 const round=Array.from({length:25},(_,j)=>idiomBank[(start+j)%idiomBank.length]);
 memory=[...Array.from({length:25},(_,j)=>(start+j)%idiomBank.length),...recent].filter((n,i,a)=>a.indexOf(n)===i).slice(0,Math.floor(idiomBank.length/2));
 try{globalThis.localStorage?.setItem(historyKey,JSON.stringify(memory));}catch{}
 return round;
}
export function shuffledLetters<T>(values:T[],rng=Math.random):T[]{const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
