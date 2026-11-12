import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runWithModel } from './helpers.ts';
import { BohrLogic } from '../src/io/external/models/bohr.logic.ts';

describe('Bohrvorrichtung', () => {
  it('Beispielprogramm bohrt ein Werkstück nach START', async () => {
    const m = new BohrLogic();
    await runWithModel('20-bohrvorrichtung.asm', m, 8, (t) => m.input('start', t > 0.1 && t < 0.3));
    assert.equal(m.piece, 'drilled', m.status);
    assert.ok(m.a.retracted && m.b.retracted);
  });
  it('erkennt Bohren ohne Motor als Störung', () => {
    const m = new BohrLogic();
    for (let i = 0; i < 200; i++) m.step(0b0001, 0.01); // spannen
    for (let i = 0; i < 400; i++) m.step(0b0100, 0.01); // ab, ohne Motor
    assert.equal(m.piece, 'broken');
  });
});
