import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runWithModel } from './helpers.ts';
import { bit, type ModelLogic } from '../src/io/external/logic.ts';
import { SpielLogic } from '../src/io/external/models/spiel.logic.ts';
import { GenerLogic } from '../src/io/external/models/gener.logic.ts';
import { MfsLogic } from '../src/io/external/models/mfs.logic.ts';
import { MotgrpLogic } from '../src/io/external/models/motgrp.logic.ts';
import { LueftLogic } from '../src/io/external/models/lueft.logic.ts';
import { MischLogic } from '../src/io/external/models/misch.logic.ts';
import { Sort1Logic } from '../src/io/external/models/sort1.logic.ts';
import { Sort2Logic } from '../src/io/external/models/sort2.logic.ts';
import { SiloLogic } from '../src/io/external/models/silo.logic.ts';
import { FoerderLogic } from '../src/io/external/models/foerder.logic.ts';
import { SchwestLogic } from '../src/io/external/models/schwest.logic.ts';
import { PACK1_MODELS } from '../src/io/external/pack1.ts';

/** Testskript: Ereignisse zu bestimmten Zeiten (jeweils einmal) */
function script() {
  const events: { t: number; fn: () => void; done: boolean }[] = [];
  return {
    at(t: number, fn: () => void) { events.push({ t, fn, done: false }); return this; },
    /** Taster `name` von t0 bis t1 gedrückt halten */
    press(m: ModelLogic, name: string, t0: number, t1: number) {
      return this.at(t0, () => m.input!(name, true)).at(t1, () => m.input!(name, false));
    },
    tick(t: number) { for (const e of events) if (!e.done && t >= e.t) { e.done = true; e.fn(); } },
  };
}

/** Ax-Wert zu bestimmten Zeitpunkten mitschneiden */
function sampler(m: { ax: number }, times: number[]) {
  const out = new Map<number, number>();
  return { out, tick(t: number) { for (const x of times) if (t >= x && !out.has(x)) out.set(x, m.ax); } };
}

describe('Modellpaket 1: Registrierung', () => {
  it('enthält elf Modelle mit eindeutigen IDs und je 8 Ax/Ex-Bezeichnungen', () => {
    assert.equal(PACK1_MODELS.length, 11);
    assert.equal(new Set(PACK1_MODELS.map((d) => d.id)).size, 11);
    for (const d of PACK1_MODELS) {
      assert.equal(d.group, 'Modellpaket 1');
      assert.equal(d.ax.length, 8, d.id);
      assert.equal(d.ex.length, 8, d.id);
      assert.match(d.id, /^ext-/);
    }
  });
});

describe('Spielwiese', () => {
  it('Beispielprogramm gibt Schalter/Taster 1:1 auf Lampen, Motoren und Ventile', async () => {
    const m = new SpielLogic();
    const s = script().at(0.05, () => { m.input('s1', true); m.input('s3', true); m.input('t1', true); m.input('t3', true); });
    await runWithModel('21-spielwiese.asm', m, 1.5, (t) => s.tick(t));
    assert.equal(m.ax, 0b01010101);
    assert.ok(m.motors[0]!.running && !m.motors[1]!.running);
    assert.ok(m.valves[0]! > 0.9 && m.valves[1]! < 0.1);
    assert.equal(m.ex, 0b01010101);
  });
  it('Reset setzt alles zurück', () => {
    const m = new SpielLogic();
    m.input('t4', true); m.step(0b11110000, 1);
    assert.equal(m.ex, 0b10000000);
    m.reset();
    assert.equal(m.ex, 0);
    assert.equal(m.valves[1], 0);
  });
});

describe('Generatorüberwachung', () => {
  it('Beispielprogramm meldet Überlast (> 10 kW) mit H1', async () => {
    const m = new GenerLogic();
    const s = script().at(0.05, () => { m.input('m4', true); m.input('m3', true); }).at(1.5, () => m.input('m4', true));
    const sm = sampler(m, [1.2, 2.5]);
    await runWithModel('22-generator.asm', m, 3, (t) => { s.tick(t); sm.tick(t); });
    assert.equal(m.load, 5); // nur noch M3
    assert.equal(sm.out.get(1.2)! & 1, 1, 'Überlast 12 kW → H1');
    assert.equal(sm.out.get(2.5)! & 1, 0, '5 kW → H1 aus');
  });
  it('Drahtbruch (Variante A) meldet „steht“; fehlende Warnlampe erzeugt Status', () => {
    const m = new GenerLogic();
    m.input('m1', true);
    for (let i = 0; i < 1000; i++) m.step(0, 0.001);
    assert.equal(m.ex & 1, 1);
    m.input('wb1', true);
    assert.equal(m.ex & 1, 0);
    m.input('wb1', true); m.input('m4', true); m.input('m3', true);
    for (let i = 0; i < 3000; i++) m.step(0, 0.001);
    assert.ok(m.overload);
    assert.match(m.status, /H1 fehlt/);
  });
});

describe('Mehrfachschaltstellen', () => {
  it('Motor folgt der Parität der vier Schalter (jede Betätigung schaltet um)', async () => {
    const m = new MfsLogic();
    const steps: [number, string, boolean][] = [[0.1, 's1', true], [1.1, 's3', true], [2.1, 's2', true], [3.1, 's1', false], [4.1, 's4', true]];
    const s = script();
    for (const [t, n, v] of steps) s.at(t, () => m.input(n, v));
    const seen: boolean[] = [];
    const checks = [0.9, 1.9, 2.9, 3.9, 4.9];
    await runWithModel('23-mehrfachschaltstellen.asm', m, 5, (t) => {
      s.tick(t);
      const c = checks[seen.length];
      if (c !== undefined && t >= c) { seen.push(m.motor.running); assert.equal(m.motor.running, m.expected, `t=${c}`); }
    });
    assert.deepEqual(seen, [true, false, true, false, true]);
    assert.equal(m.toggles, 5);
  });
  it('Schalter zählt nur echte Änderungen', () => {
    const m = new MfsLogic();
    m.input('s2', true); m.input('s2', true);
    assert.equal(m.toggles, 1);
    assert.equal(m.ex, 0b10);
  });
});

describe('Motorgruppenüberwachung', () => {
  it('Störung wird gespeichert und erst nach Behebung + Quittieren gelöscht', async () => {
    const m = new MotgrpLogic();
    const s = script().at(0.5, () => m.input('f1', true)).at(2.5, () => m.input('f1', true)).press(m, 'quit', 3.5, 3.8);
    const sm = sampler(m, [0.4, 2.0, 3.2, 3.4, 4.5]);
    // Quittieren bei noch gestörtem Motor bleibt wirkungslos
    s.press(m, 'quit', 1.0, 1.3);
    await runWithModel('24-motorgruppen.asm', m, 5, (t) => { s.tick(t); sm.tick(t); });
    const h = (t: number) => sm.out.get(t)! & 3;
    assert.equal(h(0.4), 0);
    assert.equal(h(2.0), 1, 'Gruppe 1 gestört, Quit ohne Wirkung');
    assert.equal(h(3.2), 1, 'Motor läuft wieder, Meldung bleibt gespeichert');
    assert.equal(h(4.5), 0, 'nach Quittieren aus');
    assert.equal(m.ax & 2, 0, 'Gruppe 2 blieb ungestört');
  });
  it('Fehlende Störmeldung wird als Status gemeldet', () => {
    const m = new MotgrpLogic();
    m.input('f4', true);
    for (let i = 0; i < 2500; i++) m.step(0, 0.001);
    assert.equal(m.ex & 0b010000, 0);
    assert.match(m.status, /M_B2.*nicht gemeldet/);
  });
});

describe('Lüftungsüberwachung', () => {
  it('Ampel grün (≥ 3), gelb (2), rot (≤ 1 Lüfter)', async () => {
    const m = new LueftLogic();
    const s = script().at(0.5, () => m.input('f1', true)).at(1.5, () => m.input('f2', true)).at(2.5, () => m.input('f3', true));
    const sm = sampler(m, [0.4, 1.4, 2.4, 3.4]);
    await runWithModel('25-lueftung.asm', m, 4, (t) => { s.tick(t); sm.tick(t); });
    assert.deepEqual([0.4, 1.4, 2.4, 3.4].map((t) => sm.out.get(t)), [4, 4, 2, 1]);
    assert.match(m.status, /1 von 4/);
  });
  it('Falsche Ampel erzeugt Statusmeldung', () => {
    const m = new LueftLogic();
    for (let i = 0; i < 1500; i++) m.step(0b100, 0.001);
    assert.match(m.status, /4 von 4/);
    m.input('f1', true); m.input('f2', true); m.input('f3', true);
    for (let i = 0; i < 2500; i++) m.step(0b100, 0.001);
    assert.equal(m.running, 1);
    assert.match(m.status, /müsste rot/);
  });
});

describe('Mischanlage', () => {
  it('Silo A zuerst: halb A, dann B, Behälter voll, Ventile zu', async () => {
    const m = new MischLogic();
    const s = script().press(m, 'start', 0.1, 0.3);
    await runWithModel('26-mischanlage.asm', m, 14, (t) => s.tick(t));
    assert.ok(m.total >= 0.95 && m.total <= 1);
    assert.ok(Math.abs(m.mix[0]! - 0.5) < 0.02, `A=${m.mix[0]}`);
    assert.ok(Math.abs(m.mix[1]! - 0.45) < 0.03, `B=${m.mix[1]}`);
    assert.equal(m.ax & 0b1100, 0);
    assert.ok(!m.overflow);
    assert.match(m.status, /voll/);
  });
  it('Schalter S2 vertauscht die Reihenfolge (B zuerst)', async () => {
    const m = new MischLogic();
    m.input('sel', true);
    const s = script().press(m, 'start', 0.1, 0.3);
    let atHalf = [0, 0];
    await runWithModel('26-mischanlage.asm', m, 14, (t) => { s.tick(t); if (t > 5.2 && t < 5.3) atHalf = [...m.mix]; });
    assert.ok(atHalf[1]! > 0.45 && atHalf[0]! < 0.05, `bei halb: ${atHalf}`);
    assert.ok(m.total >= 0.95);
  });
  it('Überlauf und trockenes Ventil werden gemeldet', () => {
    const m = new MischLogic();
    for (let i = 0; i < 12000; i++) m.step(0b1100, 0.001);
    assert.ok(m.overflow);
    assert.match(m.status, /läuft über/);
    const e = new MischLogic();
    e.silo = [0, 1];
    e.step(0b0100, 0.01);
    assert.equal(e.ex >> 2 & 1, 1);
    assert.match(e.status, /Silo A ist leer/);
  });
});

describe('Einfache Sortieranlage', () => {
  it('Kleine Teile landen im Seitenbehälter, große am Bandende', async () => {
    const m = new Sort1Logic(false);
    const s = script().at(0.5, () => m.feed('small')).at(8.5, () => m.feed('large')).at(16.5, () => m.feed('small'));
    await runWithModel('27-sortierer-einfach.asm', m, 26, (t) => s.tick(t));
    assert.equal(m.count('z1', 'small'), 2);
    assert.equal(m.count('end', 'large'), 1);
    assert.equal(m.wrong, 0, m.status);
  });
  it('Zylinder schiebt auch ein großes Teil ab → falsch sortiert; Lichtschranken sehen Teillänge', () => {
    const m = new Sort1Logic(false);
    m.feed('large');
    let both = false;
    for (let i = 0; i < 12000; i++) {
      m.step(0b1, 0.001);
      if (bit(m.ex, 0) && bit(m.ex, 1)) both = true;
    }
    assert.ok(both, 'großes Teil unterbricht S1 und S2 zugleich');
    assert.equal(m.wrong, 1);
    assert.match(m.status, /Falsch sortiert/);
    const k = new Sort1Logic(false);
    k.feed('small');
    for (let i = 0; i < 9000; i++) { k.step(0, 0.001); assert.ok(!(bit(k.ex, 0) && bit(k.ex, 1))); }
    assert.equal(k.count('end', 'small'), 1);
    assert.equal(k.wrong, 1);
  });
});

describe('Sortieranlage', () => {
  it('Drei Größen werden auf Z1, Z2 und Bandende verteilt', async () => {
    const m = new Sort2Logic(false);
    const s = script().at(0.5, () => m.feed('small')).at(8.5, () => m.feed('medium')).at(16.5, () => m.feed('large')).at(24.5, () => m.feed('small')).at(32.5, () => m.feed('medium'));
    await runWithModel('28-sortierer.asm', m, 42, (t) => s.tick(t));
    assert.equal(m.count('z1', 'small'), 2);
    assert.equal(m.count('z2', 'medium'), 2);
    assert.equal(m.count('end', 'large'), 1);
    assert.equal(m.wrong, 0, m.status);
  });
  it('Mittleres Teil ohne Z2 fällt am Bandende; Z1 schiebt mittleres Teil falsch ab', () => {
    const a = new Sort2Logic(false);
    a.feed('medium');
    for (let i = 0; i < 8000; i++) a.step(0, 0.001);
    assert.equal(a.count('end', 'medium'), 1);
    assert.equal(a.wrong, 1);
    const b = new Sort2Logic(false);
    b.feed('medium');
    for (let i = 0; i < 8000; i++) b.step(0b01, 0.001);
    assert.equal(b.count('z1', 'medium'), 1);
    assert.equal(b.wrong, 1);
  });
});

describe('Siloentleerung', () => {
  it('Pumpen arbeiten mit Hysterese; Silo läuft weder über noch leer', async () => {
    const m = new SiloLogic();
    let p2 = false, dry = false;
    const s = script().at(0.05, () => { m.input('s0', true); m.input('v1', true); }).at(18, () => m.input('v1', true));
    await runWithModel('29-siloentleerung.asm', m, 32, (t) => {
      s.tick(t);
      if (bit(m.ax, 2)) p2 = true;
      if (m.dryRun[0] || m.dryRun[1]) dry = true;
    });
    assert.ok(m.maxLevel > 0.78 && m.maxLevel < 0.95, `max=${m.maxLevel}`);
    assert.ok(p2, 'P2 war an');
    assert.ok(!dry && !m.overflow);
    assert.ok(m.level > 0.1 && m.level < 0.16, `Endstand ${m.level}`);
    assert.equal(m.ax & 0b111, 0);
  });
  it('Drahtbruch an S2 (unplausibel) löst die Störlampe aus', async () => {
    const m = new SiloLogic();
    const s = script().at(0.05, () => { m.input('s0', true); m.input('v1', true); m.input('f2', true); });
    const sm = sampler(m, [4, 14]);
    await runWithModel('29-siloentleerung.asm', m, 15, (t) => s.tick(t) ?? sm.tick(t));
    assert.equal(sm.out.get(4)! & 1, 0);
    assert.equal(sm.out.get(14)! & 1, 1);
  });
  it('Ohne Pumpen läuft das Silo über; Pumpe ohne Medium läuft trocken', () => {
    const m = new SiloLogic();
    m.input('v1', true);
    for (let i = 0; i < 11000; i++) m.step(0, 0.001);
    assert.ok(m.overflow);
    assert.match(m.status, /läuft über/);
    const e = new SiloLogic();
    e.step(0b010, 0.01);
    assert.match(e.status, /P1 läuft trocken/);
  });
});

describe('Förderanlage', () => {
  it('Anfahren gegen den Materialfluss, Verriegelung beim Ausschalten, NOT-AUS mit Alarm', async () => {
    const m = new FoerderLogic();
    const s = script().press(m, 'start3', 0.2, 0.5).press(m, 'start2', 1.0, 1.3).press(m, 'start1', 1.8, 2.1)
      .press(m, 'stop2', 15, 15.3).at(18, () => m.input('estop', true));
    const sm = sampler(m, [2.5, 14, 16, 19]);
    await runWithModel('2A-foerderanlage.asm', m, 20, (t) => { s.tick(t); sm.tick(t); assert.equal(m.jammed, -1, `Stau bei t=${t}`); });
    assert.equal(sm.out.get(2.5), 0b0111);
    assert.ok(m.delivered >= 5, `geliefert: ${m.delivered}`);
    assert.equal(sm.out.get(16), 0b0100, 'Stopp Band 2 schaltet Band 1 mit ab, Band 3 läuft weiter');
    assert.equal(sm.out.get(19), 0b1000, 'NOT-AUS: alle aus, Alarm an');
  });
  it('Band 1 ohne Band 2 erzeugt Materialstau; Öffner liefern in Ruhe 1', () => {
    const m = new FoerderLogic();
    assert.equal(m.ex, 0b1101010);
    for (let i = 0; i < 12000; i++) m.step(0b001, 0.001);
    assert.equal(m.jammed, 0);
    assert.match(m.status, /Materialstau.*Band 1/);
    m.input('stop2', true);
    assert.equal(m.ex & 0b1000, 0);
  });
});

describe('Schwesternrufanlage', () => {
  it('Ruf: Flurlampe + Anzeige + Summer; Quittieren schaltet nur den Summer aus, Anwesenheit löscht den Ruf', async () => {
    const m = new SchwestLogic();
    assert.equal(m.ex, 0b1111111, 'Öffner: in Ruhe 1');
    const s = script().press(m, 'call2', 0.3, 0.5).press(m, 'quit', 1.0, 1.2).press(m, 'pres2', 2.0, 2.2);
    const sm = sampler(m, [0.9, 1.9, 2.9]);
    await runWithModel('2B-schwesternruf.asm', m, 3.2, (t) => { s.tick(t); sm.tick(t); });
    assert.equal(sm.out.get(0.9), 0b1010010);
    assert.equal(sm.out.get(1.9), 0b0010010);
    assert.equal(sm.out.get(2.9), 0);
    assert.ok(!m.waiting[1]);
  });
  it('Ruf ohne Anzeige wird als Status gemeldet', () => {
    const m = new SchwestLogic();
    m.input('call3', true);
    for (let i = 0; i < 1500; i++) m.step(0, 0.001);
    assert.equal(m.ex & 0b010000, 0);
    assert.match(m.status, /Zimmer 3 ruft/);
    m.input('call3', false); m.input('pres3', true);
    m.step(0, 0.001);
    assert.ok(!m.waiting[2]);
  });
});
