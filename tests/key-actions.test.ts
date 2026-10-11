import assert from 'node:assert/strict';
import test from 'node:test';
import { actionForKey } from '../packages/device-protocol/src/index.ts';

test('开发板按键映射到平台动作', () => {
  assert.equal(actionForKey('S1'), 'voice-input-toggle');
  assert.equal(actionForKey('S2'), 'assistant-record-toggle');
  assert.equal(actionForKey('S3'), 'mode-rhythm');
});
