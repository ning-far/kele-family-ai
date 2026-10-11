"""Recording-specific beat draft, diagnostics and click preview. No sheet music claim."""
import argparse, hashlib, json, sys, subprocess
from pathlib import Path
project = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(project / '.tools/music-analysis'))
import numpy as np
import librosa
import soundfile as sf
from beat_tracking import track

p=argparse.ArgumentParser();p.add_argument('audio');p.add_argument('--out',required=True);p.add_argument('--bpm',type=float);p.add_argument('--percussive',action='store_true');a=p.parse_args()
audio=Path(a.audio);out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
print('Decoding recording',flush=True)
try:
 import imageio_ffmpeg
 decoded=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-i',str(audio),'-vn','-ac','1','-ar','22050','-f','f32le','pipe:1'],capture_output=True,timeout=90,check=True)
 y=np.frombuffer(decoded.stdout,dtype='<f4').copy();sr=22050
except ImportError:
 y,sr=librosa.load(str(audio),sr=22050,mono=True)
hop=128
# Harmonic notes and vocals are not all drum attacks. Analyze percussive energy
# separately, while retaining the original mix for transparent review.
print('Preparing spectral onset analysis',flush=True)
percussive=librosa.effects.percussive(y,margin=2.0,n_fft=1024,hop_length=256,kernel_size=17) if a.percussive else y
print('Tracking beats',flush=True)
env=librosa.onset.onset_strength(y=percussive,sr=sr,hop_length=hop)
onsets=librosa.onset.onset_detect(onset_envelope=env,sr=sr,hop_length=hop,units='time',backtrack=False)
tempo,beats=track(env,sr,hop,a.bpm)
print('Beat tracking complete',flush=True)
bpm=float(np.asarray(tempo).reshape(-1)[0]);duration=len(y)/sr
if len(beats)<16 or bpm<=0:raise SystemExit('Insufficient beat evidence; manual timing required')
intervals=np.diff(beats);period=float(np.median(intervals));
windows=[]
for start in np.arange(0,duration,20):
 local=beats[(beats>=start)&(beats<start+20)]
 if len(local)>8:windows.append({'startMs':round(start*1000),'bpm':round(60/np.median(np.diff(local)),3)})
strengths=[]
for t in beats:
 frame=int(round(t*sr/hop));strengths.append(float(np.max(env[max(0,frame-2):min(len(env),frame+3)])))
def distance_ms(times):
 return [float(np.min(np.abs(onsets-t)))*1000 for t in times]
old=np.arange(0,min(duration,110),.5);new=distance_ms(beats);prior=distance_ms(old)
result={'version':1,'audioFile':audio.name,'audioSha256':hashlib.sha256(audio.read_bytes()).hexdigest(),'durationMs':round(duration*1000),'sampleRate':sr,'hopLength':hop,'analysis':'librosa percussive spectral flux + dynamic-programming beat tracking; draft, not isolated original drum transcription','librosaVersion':librosa.__version__,'bpm':round(bpm,5),'medianBeatPeriodMs':round(period*1000,3),'firstDetectedBeatMs':round(float(beats[0])*1000,3),'beatTimesMs':[round(float(t)*1000,3) for t in beats],'beatStrengths':strengths,'onsetTimesMs':[round(float(t)*1000,3) for t in onsets],'windows':windows,'detectedBeatToOnsetMedianMs':round(float(np.median(new)),3),'old120BpmZeroOffsetToOnsetMedianMs':round(float(np.median(prior)),3),'reviewStatus':'automatic-draft-needs-listening','silenceTrimmed':False}
result['analysis']=('percussive-separated ' if a.percussive else 'mixed-recording ')+'spectral flux + numpy dynamic-programming beat tracking; draft, not original drum transcription'
(out/'analysis.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
# Private review preview: source mixed with audible clicks; do not publish it as
# an extra commercial recording or pretend it is a separated drum stem.
clicks=np.zeros(len(y));click_len=int(sr*.025);click=np.sin(2*np.pi*1000*np.arange(click_len)/sr)*np.exp(-np.arange(click_len)/(sr*.006))
for t in beats:
 start=int(t*sr);end=min(len(y),start+click_len);clicks[start:end]+=click[:end-start]
sf.write(str(out/'beat-review.wav'),np.clip(y*.7+clicks*.18,-1,1),sr)
print(json.dumps({k:result[k] for k in ['audioFile','durationMs','bpm','firstDetectedBeatMs','detectedBeatToOnsetMedianMs','old120BpmZeroOffsetToOnsetMedianMs','windows']},ensure_ascii=False))
