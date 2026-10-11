import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';

const fake=vi.hoisted(()=>({
  players:[] as Array<{loaded:boolean;start:ReturnType<typeof vi.fn>;stop:ReturnType<typeof vi.fn>;dispose:ReturnType<typeof vi.fn>}>,
  load:vi.fn(async(player:{loaded:boolean},_url:string)=>{player.loaded=true;}),
  transport:{seconds:0,state:'stopped',bpm:{value:84},position:0,stop:vi.fn(),cancel:vi.fn(),pause:vi.fn(),start:vi.fn(),clear:vi.fn(),getSecondsAtTime:vi.fn(function(this:{seconds:number},_time:number){return this.seconds}),scheduleOnce:vi.fn((_fn:(time:number)=>void,_time:number)=>0)},
}));
vi.mock('tone',()=>({
 Transport:fake.transport,now:()=>100,immediate:()=>99.9,
 Player:class{
  loaded=false;start=vi.fn();stop=vi.fn();dispose=vi.fn();connect=vi.fn();disconnect=vi.fn();
  constructor(){fake.players.push(this);}
  load(url:string){return fake.load(this,url);}
 },
}));
import {MusicEngine} from '../src/audio/music';

describe('MP3 loading and pause clock regression',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.useFakeTimers();fake.players.length=0;fake.transport.seconds=0;fake.load.mockImplementation(async player=>{player.loaded=true;});});
 afterEach(()=>vi.useRealTimers());
 function engine(){const value=new MusicEngine();vi.spyOn(value,'unlock').mockResolvedValue();return value;}
 it('recording judgement uses actual audio time rather than future scheduler time',async()=>{
  const value=engine();await value.play(126,32,4,'audio/babybaby.mp3');fake.transport.seconds=10.1;fake.transport.getSecondsAtTime.mockReturnValueOnce(10);
  expect(value.nowMs()).toBe(10000);expect(fake.transport.getSecondsAtTime).toHaveBeenLastCalledWith(99.9);
 });
 it('does not start a song after the old three-second timeout while audio is still loading',async()=>{
  let complete=()=>{};
  fake.load.mockImplementation(player=>new Promise<void>(resolve=>{complete=()=>{player.loaded=true;resolve();};}));
  const value=engine(),playing=value.play(84,32,4,'audio/babybaby.mp3');
  await vi.advanceTimersByTimeAsync(3500);
  expect(fake.transport.start).not.toHaveBeenCalled();
  complete();await playing;
  expect(fake.transport.start).toHaveBeenCalledOnce();
  fake.transport.scheduleOnce.mock.calls[0][0](100);
  expect(fake.players[0].start).toHaveBeenCalledWith(100,0);
 });
 it('fails visibly and cleans up when audio loading fails instead of starting a silent game',async()=>{
  fake.load.mockRejectedValue(new Error('missing audio'));
  await expect(engine().play(84,32,4,'audio/missing.mp3')).rejects.toThrow('missing audio');
  expect(fake.transport.start).not.toHaveBeenCalled();
  expect(fake.players[0].dispose).toHaveBeenCalledOnce();
 });
 it('resumes from transport offset without subtracting wall-clock pause duration',async()=>{
  const value=engine();await value.play(84,32,4,'audio/babybaby.mp3');
  fake.transport.seconds=10;value.pause();
  await vi.advanceTimersByTimeAsync(20000);value.resume();
  const args=fake.players[0].start.mock.calls.at(-1)!;
  expect(args[0]).toBe(100);expect(args[1]).toBeCloseTo(10-4*60/84);
 });
});
