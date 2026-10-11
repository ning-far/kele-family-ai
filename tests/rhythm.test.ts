import assert from 'node:assert/strict';
import test from 'node:test';
import { createRhythmSession, registerRhythmHit, rhythmBackgrounds, rhythmSongs } from '../apps/web/src/rhythm.ts';

test('保留原型的 3 首歌曲和 5 个背景', () => {
    assert.equal(rhythmSongs.length, 3);
    assert.equal(rhythmBackgrounds.length, 5);
    assert.equal(new Set(rhythmSongs.map((x) => x.id)).size, 3);
    assert.equal(new Set(rhythmBackgrounds.map((x) => x.id)).size, 5);
  });
test('开始后可记录敲击分数和连击', () => {
    const session = createRhythmSession('twinkle', 'beach');
    const next = registerRhythmHit(session);
    assert.equal(next.combo, 1);
    assert.equal(next.score, 110);
  });
