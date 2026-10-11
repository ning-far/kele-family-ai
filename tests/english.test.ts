import assert from 'node:assert/strict';
import test from 'node:test';
import { englishLearningModes, findEnglishMode } from '../packages/mode-registry/src/english.ts';

test('小学英语保留七种学习方式', () => {
  assert.equal(englishLearningModes.length, 7);
  assert.equal(findEnglishMode('speak')?.output, 'speaking');
  assert.equal(findEnglishMode('my-words')?.output, 'vocabulary');
});
