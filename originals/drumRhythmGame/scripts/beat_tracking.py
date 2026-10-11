"""Small transparent numpy DP tracker; avoids native JIT compilation on Windows."""
import numpy as np
from scipy.signal import fftconvolve, find_peaks

def track(envelope, sr, hop, bpm=None):
 env=np.asarray(envelope,dtype=float)
 if not np.any(env>0):return 0.,np.array([])
 fps=sr/hop
 corr=fftconvolve(env-env.mean(),(env-env.mean())[::-1],mode='full')[len(env)-1:]
 lags=np.arange(max(2,int(fps*60/200)),min(len(corr),int(fps*60/50)))
 if bpm is None:
  tempos=60*fps/lags;prior=np.exp(-.5*(np.log(tempos/120)/.4)**2)
  candidates,_=find_peaks(corr[lags]);candidates=candidates if len(candidates) else np.arange(len(lags))
  selected=candidates[np.argmax(corr[lags[candidates]]*prior[candidates])];period=float(lags[selected])
 else:period=fps*60/bpm
 tempo=60*fps/period
 normalized=env/(env.std()+1e-9)
 radius=max(1,int(period/32));x=np.arange(-radius*4,radius*4+1);kernel=np.exp(-.5*(x/radius)**2);kernel/=kernel.sum()
 local=np.convolve(normalized,kernel,'same')
 offsets=np.arange(-int(2*period),-max(1,int(period*.5)))
 penalty=-80*np.log(-offsets/period)**2
 scores=np.zeros(len(env));back=np.full(len(env),-1,dtype=int)
 for i in range(len(env)):
  predecessors=i+offsets;mask=predecessors>=0;indices=predecessors[mask]
  if len(indices):
   candidates=scores[indices]+penalty[mask];j=int(np.argmax(candidates))
   if candidates[j]>0:scores[i]=local[i]+candidates[j];back[i]=indices[j];continue
  scores[i]=local[i]
 peaks,_=find_peaks(local,distance=max(1,int(period*.5)))
 eligible=peaks[local[peaks]>max(.1,np.median(local[peaks])*.25)]
 if not len(eligible):return tempo,np.array([])
 recent=eligible[eligible>=eligible[-1]-period*2];end=int(recent[np.argmax(scores[recent])]);beats=[]
 while end>=0:beats.append(end);end=int(back[end])
 beats=np.asarray(beats[::-1]);support=local[beats];good=np.flatnonzero(support>max(.1,np.median(support)*.25))
 if len(good):beats=beats[good[0]:good[-1]+1]
 return tempo,beats*hop/sr
