import sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'.tools/music-analysis'))
import numpy as np
from beat_tracking import track

class BeatTests(unittest.TestCase):
 def test_silence_refuses_beats(self):
  tempo,beats=track(np.zeros(1000),22050,128)
  self.assertEqual(tempo,0);self.assertEqual(len(beats),0)
 def test_known_pulses_preserve_recording_phase(self):
  sr,hop,bpm=22050,128,126
  times=np.arange(.77,35,60/bpm);env=np.zeros(int(36*sr/hop))
  for t in times:env[int(round(t*sr/hop))]=1
  tempo,beats=track(env,sr,hop)
  self.assertLess(abs(tempo-bpm),2)
  self.assertGreater(len(beats),50)
  self.assertLess(np.median([np.min(abs(times-b)) for b in beats]),.02)

if __name__=='__main__':unittest.main()
