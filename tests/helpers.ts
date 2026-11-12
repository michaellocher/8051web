/** Gemeinsame Test-Helfer (kein Test-File). */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Cpu8051 } from '../src/core/cpu.ts';
import { assemble } from '../src/core/asm.ts';
import type { ModelLogic } from '../src/io/external/logic.ts';

export async function loadExample(asmFile: string): Promise<Cpu8051> {
  const src = await readFile(join(import.meta.dirname, '../src/examples', asmFile), 'utf8');
  const r = assemble(src);
  assert.deepEqual(r.errors, []);
  const cpu = new Cpu8051();
  cpu.loadCode(r.bytes);
  return cpu;
}

/**
 * Koppelt eine Modell-Logik wie im Simulator an P0 (Ax) / P1 (Ex) und lässt das Programm
 * `seconds` simulierte Sekunden laufen (12 MHz → 1 µs pro Zyklus, Modellschritt alle 1 ms).
 * onTick wird nach jedem Modellschritt mit der simulierten Zeit aufgerufen.
 */
export async function runWithModel(asmFile: string, logic: ModelLogic, seconds: number, onTick?: (t: number) => void) {
  const cpu = await loadExample(asmFile);
  cpu.portInput = (p) => (p === 1 ? logic.ex : 0xff);
  let acc = 0;
  while (cpu.cycles < seconds * 1e6) {
    const t = cpu.step();
    if ('kind' in t) assert.fail('ungültiger Befehl');
    acc += t.cycles * 1e-6;
    if (acc >= 0.001) { logic.step(cpu.pin(0), acc); acc = 0; onTick?.(cpu.cycles / 1e6); }
  }
  return cpu;
}

