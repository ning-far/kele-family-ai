import assert from 'node:assert/strict';
import test from 'node:test';
import { UnavailableTransport } from '../packages/device-protocol/src/index.ts';

test('未接入真实设备时明确返回能力未实现', async () => {
  const transport = new UnavailableTransport('web-bluetooth');
  await assert.rejects(() => transport.connect(), { message: 'NOT_IMPLEMENTED' });
  assert.equal(typeof transport.subscribe(() => {}), 'function');
});
