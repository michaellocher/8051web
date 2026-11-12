import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadExample } from './helpers.ts';
import { Ticker, type PortLogic } from '../src/io/lib/b1-common.ts';
import { AMPEL1, AMPEL2, AMPEL3, Ampel3Logic, lampOn } from '../src/io/lib/ampel.logic.ts';
import { DICE3_LEFT, DICE3_RIGHT, dice1Cells, dice2Cells, dice3Cells, pipCount } from '../src/io/lib/dice.logic.ts';
import { FULL_STEP_TABLE, HALF_STEP_TABLE, StepperLogic, stepIndex } from '../src/io/lib/stepper.logic.ts';
import { DEVICE_BY_ID } from '../src/io/registry.ts';

/** Koppelt eine Logik an Port `port` und lässt das Programm `seconds` simulierte Sekunden laufen. */
async function run(asm: string, logic: PortLogic | undefined, port: number, seconds: number, onTick?: (t: number, pins: number) => void, ext?: (p: number) => number) {
  const cpu = await loadExample(asm);
  cpu.portInput = (p) => (p === port && logic ? logic.drive(0, cpu.latch(port)) : ext ? ext(p) : 0xff);
  const ticker = new Ticker();
  while (cpu.cycles < seconds * 1e6) {
    const t = cpu.step();
    if ('kind' in t) assert.fail('ungültiger Befehl');
    const now = ticker.advance(t.cycles);
    logic?.setPins([cpu.pin(port)], now);
    if (ticker.flush((dt) => logic?.step(dt))) onTick?.(now, cpu.pin(port));
  }
  return cpu;
}
/** Folge der verschiedenen aufeinanderfolgenden Portwerte */
const changes = (list: number[], v: number) => { if (list[list.length - 1] !== v) list.push(v); };

describe('Registrierung', () => {
  it('alle Geräte der Gruppe sind 1-Port und vorhanden; Ampel-4 (1 Port) gibt es nicht mehr', () => {
    for (const id of ['traffic', 'crossing', 'ampel3', 'dice', 'dice2', 'dice3', 'aufzug1', 'aufzug2', 'garage', 'parkhaus', 'stepper', 'behaelter', 'prozess', 'plotter', 'codelineal']) {
      const d = DEVICE_BY_ID.get(id);
      assert.ok(d, id);
      assert.equal(d.ports, 1, id);
      assert.ok(d.desc.includes('D0'), `${id}: desc nennt Pins`);
    }
    assert.equal(DEVICE_BY_ID.get('parkhaus')!.usesP3, true);
    assert.equal(DEVICE_BY_ID.get('ampel4')?.ports ?? 2, 2);
  });
});

describe('Ampel-1', () => {
  it('Pinbelegung nach Handbuch', () => {
    assert.deepEqual(AMPEL1, { carGreen: 0, carYellow: 1, carRed: 2, pedGreen: 3, pedRed: 4 });
    assert.ok(lampOn(0b00001, AMPEL1.carGreen) && !lampOn(0b00001, AMPEL1.carRed));
  });
  it('Beispiel schaltet Kfz- und Fußgängerampel nie gleichzeitig auf grün', async () => {
    const seq: number[] = [];
    await run('03-ampel.asm', undefined, 1, 20, (_, p) => changes(seq, p));
    assert.deepEqual(seq.slice(0, 7), [0x11, 0x12, 0x14, 0x0c, 0x14, 0x16, 0x11]);
    for (const p of seq) assert.ok(!(lampOn(p, 0) && lampOn(p, 3)), 'Kfz und Fußgänger grün');
  });
});

describe('Ampel-2', () => {
  it('Pinbelegung nach Handbuch', () => {
    assert.deepEqual(AMPEL2, { sideRed: 0, sideYellow: 1, sideGreen: 2, mainRed: 3, mainYellow: 4, mainGreen: 5, pedRed: 6, pedGreen: 7 });
  });
  it('Beispiel: Phasenplan ohne Konflikt (nie beide Straßen grün, Fußgänger nur bei Rot)', async () => {
    const seq: number[] = [];
    await run('7N-ampel2.asm', undefined, 1, 40, (_, p) => changes(seq, p));
    const start = seq.indexOf(0x61);
    assert.deepEqual(seq.slice(start, start + 9), [0x61, 0x51, 0x89, 0x4b, 0x4c, 0x4a, 0x89, 0x59, 0x61]);
    for (const p of seq.slice(start)) {
      assert.ok(!(lampOn(p, AMPEL2.mainGreen) && lampOn(p, AMPEL2.sideGreen)));
      if (lampOn(p, AMPEL2.pedGreen)) assert.ok(lampOn(p, AMPEL2.mainRed) && lampOn(p, AMPEL2.sideRed));
      assert.equal(lampOn(p, AMPEL2.pedGreen), !lampOn(p, AMPEL2.pedRed));
    }
  });
});

describe('Ampel-3', () => {
  it('Pinbelegung nach Handbuch; D6/D7 sind Schalter (Eingänge, 1 = Fahrzeug)', () => {
    assert.deepEqual(AMPEL3, { sideRed: 0, mainGreen: 1, sideYellow: 2, mainYellow: 3, sideGreen: 4, mainRed: 5, loop1: 6, loop2: 7 });
    const l = new Ampel3Logic();
    assert.equal(l.drive(), 0x3f); // keine Schleife belegt: D6/D7 werden gegen Masse gezogen
    l.loop[0] = true;
    assert.equal(l.drive(), 0x7f);
    l.loop[1] = true;
    assert.equal(l.drive(), 0xff);
  });
  it('Beispiel: Hauptstraße grün bis zur Anforderung, dann Nebenstraße, danach zurück', async () => {
    const l = new Ampel3Logic();
    const seq: number[] = [];
    await run('7N-ampel3.asm', l, 1, 30, (t, p) => {
      l.loop[1] = (t > 4 && t < 6) || (t > 12 && t < 14);
      changes(seq, p & 0x3f);
    });
    const i = seq.indexOf(0x01 | 0x02);
    assert.ok(i >= 0, 'Start: Haupt grün, Neben rot');
    assert.deepEqual(seq.slice(i, i + 9), [0x03, 0x09, 0x21, 0x25, 0x30, 0x24, 0x21, 0x29, 0x03]);
    for (const p of seq) assert.ok(!(lampOn(p, AMPEL3.mainGreen) && lampOn(p, AMPEL3.sideGreen)));
  });
  it('Nebenstraße bleibt grün, solange die Schleife belegt ist', async () => {
    const l = new Ampel3Logic();
    let sideGreenStart = -1, sideGreenEnd = -1;
    await run('7N-ampel3.asm', l, 1, 40, (t, p) => {
      l.loop[0] = t > 1 && t < 20;
      const g = lampOn(p, AMPEL3.sideGreen);
      if (g && sideGreenStart < 0) sideGreenStart = t;
      if (!g && sideGreenStart >= 0 && sideGreenEnd < 0) sideGreenEnd = t;
    });
    assert.ok(sideGreenStart > 3 && sideGreenStart < 6, String(sideGreenStart));
    assert.ok(sideGreenEnd >= 20 && sideGreenEnd < 21, String(sideGreenEnd));
  });
});

describe('Würfel-1', () => {
  it('jeder Pin D0–D6 schaltet einen Punkt, D7 ist der Schiebeschalter', () => {
    const where = ['TL', 'ML', 'BL', 'C', 'TR', 'MR', 'BR'];
    const idx = (n: string) => ({ TL: 0, C: 4, TR: 2, ML: 3, MR: 5, BL: 6, BR: 8 })[n]!;
    for (let b = 0; b < 7; b++) {
      const cells = dice1Cells(1 << b);
      assert.equal(pipCount(cells), 1);
      assert.ok(cells[idx(where[b]!)]);
    }
    assert.equal(pipCount(dice1Cells(0x7f)), 7);
    assert.equal(pipCount(dice1Cells(0x80)), 0);
  });
  it('Beispiel: Schalter rechts würfelt, links hält 1–6 Augen', async () => {
    const seen = new Set<number>();
    let held = -1;
    let sw = false;
    const logic: PortLogic = {
      setPins() {}, step() {},
      drive: () => (sw ? 0xff : 0x7f),
    };
    await run('04-wuerfel.asm', logic, 2, 3, (t, p) => {
      sw = t > 1 && t < 1.0123;
      if (t > 1.5) { const n = pipCount(dice1Cells(p & 0x7f)); seen.add(n); held = n; }
    });
    assert.ok(held >= 1 && held <= 6);
    assert.equal(seen.size, 1, 'bleibt stehen');
    // Schalter lange rechts: alle Werte kommen vor
    const all = new Set<number>();
    sw = false;
    await run('04-wuerfel.asm', logic, 2, 0.5, (_, p) => { sw = true; all.add(pipCount(dice1Cells(p & 0x7f))); });
    assert.deepEqual([...all].sort(), [1, 2, 3, 4, 5, 6]);
  });
});

describe('Würfel-2', () => {
  it('D0–D2 = Muster, 0 und 7 leer, 1–6 Augen wie ein Würfel', () => {
    assert.equal(pipCount(dice2Cells(0)), 0);
    assert.equal(pipCount(dice2Cells(7)), 0);
    for (let v = 1; v <= 6; v++) assert.equal(pipCount(dice2Cells(v)), v);
    assert.equal(pipCount(dice2Cells(0xf8 | 3)), 3, 'höhere Bits werden ignoriert');
    // 1 = Mitte, 6 = je 3 links und rechts
    assert.deepEqual(dice2Cells(1).map(Number), [0, 0, 0, 0, 1, 0, 0, 0, 0]);
    assert.deepEqual(dice2Cells(6).map(Number), [1, 0, 1, 1, 0, 1, 1, 0, 1]);
  });
  it('Beispiel: Start rollt, Loslassen hält, Reset löscht; LEDs an D5–D7', async () => {
    let start = false, reset = false;
    const logic: PortLogic = { setPins() {}, step() {}, drive: () => (0xff & ~(start ? 0 : 8) & ~(reset ? 0 : 0x10)) };
    const values = new Set<number>();
    let afterRelease = -1, ledOk = true, afterReset = -1;
    await run('7N-wuerfel2.asm', logic, 1, 3, (t, p) => {
      start = t > 0.5 && t < 0.5123;
      reset = t > 2.5;
      if (t > 0.5 && t < 0.5123) values.add(p & 7);
      if (t > 1.5 && t < 2.4) { afterRelease = p & 7; const v = p & 7; const exp = v === 6 ? 0x20 : v % 2 === 0 ? 0x40 : 0x80; if ((p & 0xe0) !== (v === 6 ? 0x60 : exp)) ledOk = false; }
      if (t > 2.6) afterReset = p & 7;
    });
    assert.ok(afterRelease >= 1 && afterRelease <= 6, String(afterRelease));
    assert.ok(ledOk);
    assert.equal(afterReset, 0);
    assert.ok(values.size >= 2);
  });
});

describe('Würfel-3', () => {
  it('Gegenüberliegende Augen am selben Bit; linker Würfel D4–D7, rechter D0–D3', () => {
    for (const [map, shift] of [[DICE3_RIGHT, 0], [DICE3_LEFT, 4]] as const) {
      const bits = new Set(map.filter((b) => b >= 0));
      assert.deepEqual([...bits].sort(), [0, 1, 2, 3].map((b) => b + shift));
      // Mitte (Zelle 4) = niedrigstes Bit, TL/BR gemeinsam, TR/BL gemeinsam, ML/MR gemeinsam
      assert.equal(map[4], shift);
      assert.equal(map[0], map[8]); assert.equal(map[2], map[6]); assert.equal(map[3], map[5]);
      assert.equal(new Set([map[0], map[2], map[3], map[4]]).size, 4);
    }
    assert.equal(pipCount(dice3Cells(0x0f, DICE3_RIGHT)), 7);
    assert.equal(pipCount(dice3Cells(0x0f, DICE3_LEFT)), 0);
    assert.equal(pipCount(dice3Cells(0xf0, DICE3_LEFT)), 7);
  });
  it('Beispiel: zeigt nacheinander alle 36 Augenpaare', async () => {
    const pairs: string[] = [];
    await run('7N-wuerfel3.asm', undefined, 1, 11.5, (_, p) => {
      const key = `${pipCount(dice3Cells(p, DICE3_LEFT))}${pipCount(dice3Cells(p, DICE3_RIGHT))}`;
      if (pairs[pairs.length - 1] !== key) pairs.push(key);
    });
    const exp: string[] = [];
    for (let r = 1; r <= 6; r++) for (let l = 1; l <= 6; l++) exp.push(`${l}${r}`);
    const start = pairs.indexOf('11');
    assert.deepEqual(pairs.slice(start, start + 36), exp);
  });
});

describe('Schrittmotor', () => {
  it('Tabellen aus dem Handbuch', () => {
    assert.deepEqual([...FULL_STEP_TABLE], [0xa, 0x6, 0x5, 0x9]);
    assert.deepEqual([...HALF_STEP_TABLE], [0xa, 0x2, 0x6, 0x4, 0x5, 0x1, 0x9, 0x8]);
    // Vollschritte sind jeder zweite Halbschritt
    assert.deepEqual(FULL_STEP_TABLE.map((v) => stepIndex(v)), [0, 2, 4, 6]);
  });
  it('Rechtslauf dreht im Uhrzeigersinn, Linkslauf zurück; Voll- und Halbschritte', () => {
    const s = new StepperLogic();
    s.setPins([0xa]);
    for (const v of [0x6, 0x5, 0x9, 0xa]) s.setPins([v]); // 4 Vollschritte = 8 Halbschritte = 1 Umdrehung
    assert.equal(s.net, 8);
    assert.equal(s.angle, 45 + 360, 'Vollschritt-Zustand Ah: Feld zwischen den Spulen D3 und D1');
    for (const v of [0x9, 0x5, 0x6, 0xa]) s.setPins([v]); // Linkslauf
    assert.equal(s.net, 0);
    for (const v of [0x2, 0x6, 0x4]) s.setPins([v]); // 3 Halbschritte rechts
    assert.equal(s.net, 3);
    assert.equal(s.angle, 180, 'Zustand 4h (nur D2): Nordpol unten');
    assert.ok(!s.undefinedState);
    const single = new StepperLogic();
    for (const [v, a] of [[0x8, 0], [0x2, 90], [0x4, 180], [0x1, 270]] as const) { single.setPins([v]); assert.equal(single.angle % 360, a, v.toString(16)); }
  });
  it('undefinierte Zustände zeigen ein Fragezeichen und lassen den Rotor stehen', () => {
    const s = new StepperLogic();
    s.setPins([0x6]);
    for (const v of [0x0, 0xf, 0x3, 0xc, 0x7, 0xe]) {
      s.setPins([v]);
      assert.ok(s.undefinedState, v.toString(16));
      assert.equal(s.net, 0);
    }
    s.setPins([0x5]);
    assert.ok(!s.undefinedState);
    assert.equal(s.net, 2);
    s.setPins([0xf6]); // obere Pinbits sind egal
    assert.equal(s.net, 0);
  });
  it('Schiebeschalter an D7: Eingang, rechts = 1', () => {
    const s = new StepperLogic();
    assert.equal(s.drive() & 0x80, 0);
    s.slider = true;
    assert.equal(s.drive(), 0xff);
  });
  it('Beispiel: Halbschrittbetrieb, Richtung und Stopp über die Schalter an P2', async () => {
    const s = new StepperLogic();
    let sw = 0x03;
    const cpu = await loadExample('08-schrittmotor.asm');
    cpu.portInput = (p) => (p === 2 ? sw : 0xff);
    const ticker = new Ticker();
    const net = (sec: number) => { while (cpu.cycles < sec * 1e6) { const t = cpu.step(); if ('kind' in t) assert.fail(); ticker.advance(t.cycles); s.setPins([cpu.pin(1)]); } return s.net; };
    const a = net(1);
    assert.ok(a >= 24 && a <= 26, `rechts ${a}`);
    sw = 0x02; // Schalter 0 aus: Linkslauf
    const b = net(2);
    assert.ok(b - a <= -24 && b - a >= -26, `links ${b - a}`);
    sw = 0x00; // Motor stoppen
    const c = net(3);
    assert.ok(Math.abs(c - b) <= 1, `stopp ${c - b}`);
    assert.ok(!s.undefinedState);
  });
});
