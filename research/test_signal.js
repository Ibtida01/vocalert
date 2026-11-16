import assert from 'node:assert/strict';
import { analyzePpg, makeSyntheticPpg } from '../signal.js';

const cases = [60, 76, 90, 110];
for (const expectedBpm of cases) {
  const samples = makeSyntheticPpg(32, expectedBpm, 30);
  const result = analyzePpg(samples);
  assert.notEqual(result.bpm, null, `No pulse estimate for ${expectedBpm} BPM signal`);
  assert.ok(Math.abs(result.bpm - expectedBpm) <= 4, `Expected near ${expectedBpm}, got ${result.bpm}`);
  assert.ok(result.sampleCount >= 900, 'Synthetic sample count unexpectedly low');
  console.log(`PASS: expected ${expectedBpm} BPM; detected ${result.bpm.toFixed(1)} BPM; quality heuristic=${result.qualityScore}/100`);
}
console.log('\nThese are synthetic software tests only, not clinical validation.');
