import test from 'node:test';
import assert from 'node:assert/strict';

import { runBatchedTasks } from './scanner.js';

test('runBatchedTasks processes work in small batches with pauses between them', async () => {
  const started = [];

  await runBatchedTasks(
    Array.from({ length: 5 }, (_, index) => index),
    async (value) => {
      started.push({ value, time: Date.now() });
      return value;
    },
    { batchSize: 2, delayMs: 40 }
  );

  assert.equal(started.length, 5);

  const thirdStartGap = started[2].time - started[1].time;
  const fifthStartGap = started[4].time - started[3].time;

  assert.ok(
    thirdStartGap >= 30,
    `expected a pause before batch 2, got ${thirdStartGap}ms`
  );
  assert.ok(
    fifthStartGap >= 30,
    `expected a pause before batch 3, got ${fifthStartGap}ms`
  );
});
