import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runWithModel } from './helpers.ts';
import { ReaktionLogic } from '../src/io/external/models/reaktion.logic.ts';
import { BiegeLogic } from '../src/io/external/models/biege.logic.ts';
import { FallLogic } from '../src/io/external/models/fall.logic.ts';
import { HebeLogic } from '../src/io/external/models/hebe.logic.ts';
import { Bohr2Logic } from '../src/io/external/models/bohr2.logic.ts';
import { ReakgefLogic } from '../src/io/external/models/reakgef.logic.ts';
import { AbfuellLogic } from '../src/io/external/models/abfuell.logic.ts';
import { SiebenLogic, CHARS } from '../src/io/external/models/sieben.logic.ts';
import { PACK4_MODELS } from '../src/io/external/pack4.ts';

/** true, solange t im Intervall [a, b) liegt */
const within = (t: number, a: number, b: number) => t >= a && t < b;

describe('Modellpaket 2 (Teil 3): Registrierung', () => {
  it('enthält 8 Modelle mit je 8 Ax/Ex-Bezeichnungen und eindeutigen IDs', () => {
    assert.equal(PACK4_MODELS.length, 8);
    assert.equal(new Set(PACK4_MODELS.map((m) => m.id)).size, 8);
    for (const m of PACK4_MODELS) {
      assert.equal(m.group, 'Modellpaket 2');
      assert.ok(m.id.startsWith('ext-'));
      assert.equal(m.ax.length, 8, m.id);
      assert.equal(m.ex.length, 8, m.id);
      assert.ok(m.createLogic().ex >= 0);
    }
  });
});

describe('Reaktionstest', () => {
  it('Programm misst die Reaktionszeit mit Timer 0 (Modell und Programm stimmen überein)', async () => {
    const m = new ReaktionLogic();
    let goT = -1;
    const cpu = await runWithModel('31-reaktion.asm', m, 8, (t) => {
      if (m.p2 && goT < 0) goT = t;
      m.input('s1', within(t, 0.5, 0.7));
      m.input('s2', goT >= 0 && within(t, goT + 0.312, goT + 0.6));
    });
    assert.ok(goT > 1.2 && goT < 3.5, `Signal bei ${goT}`);
    assert.ok(m.reactionMs !== null && Math.abs(m.reactionMs - 312) <= 3, String(m.reactionMs));
    const prog = (cpu.iram[6]! << 8) | cpu.iram[7]!;
    assert.ok(Math.abs(prog - m.reactionMs!) <= 5, `Programm ${prog} ms, Modell ${m.reactionMs} ms`);
    assert.equal(m.falseStarts, 0);
    assert.match(m.status, /Reaktionszeit: 3\d\d ms/);
  });
  it('erkennt einen Fehlstart (Bremsen vor dem Signal)', async () => {
    const m = new ReaktionLogic();
    const cpu = await runWithModel('31-reaktion.asm', m, 3, (t) => {
      m.input('s1', within(t, 0.5, 0.7));
      m.input('s2', within(t, 0.9, 1.0));
    });
    assert.equal(m.falseStarts, 1);
    assert.equal(m.result, 'false');
    assert.equal(cpu.iram[6], 0xff);
    assert.equal(cpu.iram[7], 0xff);
  });
  it('Logik: ohne Bremsen kommt es nach der Grenzzeit zum Aufprall (schwer: früher)', () => {
    const m = new ReaktionLogic();
    m.step(0b11, 0.001);
    for (let i = 0; i < 900; i++) m.step(0b11, 0.001);
    assert.equal(m.crashes, 0);
    for (let i = 0; i < 200; i++) m.step(0b11, 0.001);
    assert.equal(m.crashes, 1);
    assert.match(m.status, /Aufprall/);
    const h = new ReaktionLogic();
    h.input('hard', true);
    for (let i = 0; i < 700; i++) h.step(0b11, 0.001);
    assert.equal(h.crashes, 1);
  });
});

describe('Biegevorrichtung', () => {
  it('spannt, biegt, wirft das Teil aus und fährt in die Grundstellung', async () => {
    const m = new BiegeLogic();
    await runWithModel('32-biege.asm', m, 14, (t) => m.input('start', within(t, 0.5, 0.7)));
    assert.equal(m.bentCount, 1);
    assert.equal(m.ruinedCount, 0);
    assert.equal(m.blech, 'none');
    assert.ok(m.a.retracted && m.b.retracted && m.c.retracted);
  });
  it('Logik: Biegen ohne Spannen ergibt Ausschuss', () => {
    const m = new BiegeLogic();
    for (let i = 0; i < 3000; i++) m.step(0b0100, 0.001);
    assert.equal(m.blech, 'ruined');
    assert.match(m.status, /nicht gespannt/);
  });
  it('Logik: Auswerfer wird vom gespannten Werkstück blockiert', () => {
    const m = new BiegeLogic();
    for (let i = 0; i < 1500; i++) m.step(0b0001, 0.001);
    assert.ok(m.a.extended);
    for (let i = 0; i < 2000; i++) m.step(0b10000, 0.001);
    assert.ok(!m.c.extended);
    assert.match(m.status, /blockiert/);
  });
});

describe('Fallmagazin', () => {
  it('schiebt genau die vorgewählte Stückzahl aus und zählt mit der Lichtschranke', async () => {
    const m = new FallLogic();
    const cpu = await runWithModel('33-fallmagazin.asm', m, 20, (t) => m.input('start', within(t, 0.5, 0.7)));
    assert.equal(m.preset, 5);
    assert.equal(m.binCount, 5);
    assert.equal(m.magazine + (m.px === null ? 0 : 1), 4);
    assert.equal(cpu.iram[5], 5);
    assert.ok(m.cyl.retracted);
  });
  it('bricht ab, wenn das Magazin leer wird', async () => {
    const m = new FallLogic();
    m.magazine = 2;
    const cpu = await runWithModel('33-fallmagazin.asm', m, 25, (t) => m.input('start', within(t, 0.5, 0.7)));
    assert.equal(m.binCount, 2);
    assert.equal(cpu.iram[5], 2);
    assert.match(m.status, /Magazin leer/);
    assert.ok(!m.barrier);
  });
  it('Logik: nur halb ausgeschobenes Teil bleibt liegen und blockiert den Schacht', () => {
    const m = new FallLogic();
    for (let i = 0; i < 400; i++) m.step(0, 0.001);
    assert.equal(m.px, 0);
    for (let i = 0; i < 300; i++) m.step(1, 0.001);
    for (let i = 0; i < 1000; i++) m.step(0, 0.001);
    assert.ok(m.px! > 0.3);
    assert.equal(m.magazine, 8);
    assert.match(m.status, /bleibt auf dem Tisch/);
    for (let i = 0; i < 1600; i++) m.step(1, 0.001);
    assert.equal(m.px, null);
    assert.equal(m.binCount, 1);
  });
  it('Logik: Vorwahl-Ziffer erscheint BCD-codiert auf Ex.0–3', () => {
    const m = new FallLogic();
    m.input('up', true); m.input('up', false);
    assert.equal(m.ex & 0x0f, 6);
    m.input('reset', true);
    assert.equal((m.ex >> 5) & 1, 1);
  });
});

describe('Hebevorrichtung', () => {
  it('hebt und schiebt mehrere Kisten ohne Störung auf das obere Band', async () => {
    const m = new HebeLogic();
    await runWithModel('34-hebevorrichtung.asm', m, 30);
    assert.ok(m.done + m.upper.length >= 3, `Kisten: ${m.done}`);
    assert.equal(m.faults, 0);
  });
  it('Logik: Schieben ohne oben stehenden Hubtisch lässt die Kiste fallen, RESET quittiert', () => {
    const m = new HebeLogic();
    for (let i = 0; i < 7000; i++) m.step(0, 0.001);
    assert.equal(m.stage, 'platform');
    for (let i = 0; i < 400; i++) m.step(0b10, 0.001);
    assert.equal(m.stage, 'fallen');
    assert.match(m.status, /heruntergefallen/);
    m.input('s1', true);
    assert.equal(m.faulted, false);
    assert.equal(m.stage, 'none');
  });
  it('Logik: Hubtisch wird von ausgefahrenem Zylinder B blockiert', () => {
    const m = new HebeLogic();
    for (let i = 0; i < 500; i++) m.step(0b10, 0.001);
    for (let i = 0; i < 4000; i++) m.step(0b11, 0.001);
    assert.ok(!m.a.extended);
    assert.match(m.status, /Kollision/);
  });
});

describe('Einfache Bohrvorrichtung', () => {
  it('fährt unter den Bohrer, bohrt bei laufendem Motor und kehrt zurück', async () => {
    const m = new Bohr2Logic();
    await runWithModel('35-bohrvorr-einfach.asm', m, 14, (t) => m.input('start', within(t, 0.5, 0.7)));
    assert.equal(m.piece, 'drilled');
    assert.equal(m.drilledCount, 1);
    assert.equal(m.bitBroken, false);
    assert.ok(m.z1.retracted && m.z2.retracted);
    assert.ok(m.motor.speed < 0.1);
  });
  it('Logik: Bohrer ohne Drehung bricht, RESET wechselt ihn', () => {
    const m = new Bohr2Logic();
    for (let i = 0; i < 2200; i++) m.step(0b00001, 0.001);
    assert.ok(m.z1.extended);
    for (let i = 0; i < 2000; i++) m.step(0b00100, 0.001);
    assert.ok(m.bitBroken);
    assert.match(m.status, /ohne Drehung/);
    m.input('reset', true);
    assert.equal(m.bitBroken, false);
  });
  it('Logik: Bohrer senken, bevor Z1 vorn steht, trifft den Schlitten', () => {
    const m = new Bohr2Logic();
    for (let i = 0; i < 2000; i++) m.step(0b10100, 0.001);
    assert.ok(m.bitBroken);
    assert.match(m.status, /Schlitten/);
  });
});

describe('Reaktionsgefäß', () => {
  it('fährt an und hält Druck und Temperatur im Normalbetrieb', async () => {
    const m = new ReakgefLogic();
    const cpu = await runWithModel('36-reaktionsgefaess.asm', m, 50);
    assert.equal(m.damage, '');
    assert.ok(m.T > 95 && m.T < 112, `T = ${m.T}`);
    assert.ok(m.p > 25 && m.p < 75, `p = ${m.p}`);
    assert.equal(cpu.pin(0) & 0x03, 0b01, 'P1 an, P2 aus');
    assert.equal(cpu.pin(0) & 0x04, 0, 'kein Alarm');
  });
  it('beherrscht Störungen: Drucksprung öffnet V2, Temperatursprung kühlt mit V1 (mit Alarm)', async () => {
    const m = new ReakgefLogic();
    let alarm = false, v2 = false, v1 = false;
    await runWithModel('36-reaktionsgefaess.asm', m, 55, (t) => {
      m.input('pup', within(t, 30, 33));
      m.input('tup', within(t, 40, 50));
      v2 ||= within(t, 30, 34) && (m.ax & 0x10) !== 0;
      v1 ||= within(t, 40, 55) && (m.ax & 0x08) !== 0;
      alarm ||= (m.ax & 0x04) !== 0;
    });
    assert.equal(m.damage, '');
    assert.ok(v2 && v1 && alarm, `V2 ${v2} V1 ${v1} Alarm ${alarm}`);
    assert.ok(m.T < 160, `T = ${m.T}`);
  });
  it('Logik: ohne Regelung platzt der Behälter bei Überdruck bzw. geht bei Überhitzung durch', () => {
    const m = new ReakgefLogic();
    for (let i = 0; i < 20000; i++) m.step(0b1100000, 0.001);
    m.input('pup', true);
    for (let i = 0; i < 3000; i++) m.step(0, 0.001);
    assert.equal(m.damage, 'burst');
    assert.match(m.status, /geborsten/);
    m.input('pup', false);
    m.input('repair', true);
    assert.equal(m.damage, '');
    for (let i = 0; i < 80000 && !m.damage; i++) m.step(0b1100000, 0.001);
    assert.equal(m.damage, 'overheat');
    assert.ok(m.T >= 199, String(m.T));
  });
  it('Logik: Heizen ohne Rührwerk wird gewarnt und wärmt langsamer', () => {
    const a = new ReakgefLogic(), b = new ReakgefLogic();
    for (let i = 0; i < 10000; i++) { a.step(0b0100000, 0.001); b.step(0b1100000, 0.001); }
    assert.match(a.status, /ohne Rührwerk/);
    assert.ok(a.T < b.T - 20);
  });
});

describe('Abfüllanlage', () => {
  it('füllt Flaschen genau voll und befördert sie in die Kiste', async () => {
    const m = new AbfuellLogic();
    await runWithModel('37-abfuellanlage.asm', m, 40, (t) => m.input('main', t > 0.3));
    assert.ok(m.goodCount >= 7, `gut: ${m.goodCount}`);
    assert.equal(m.badCount, 0);
    assert.equal(m.spilled, 0);
    assert.ok(Math.abs(m.level - (1 - (m.goodCount + m.bottles.length) / 16)) < 0.07, `Silo ${m.level}`);
  });
  it('meldet „Silo leer“ (Lampe P) und fährt nach dem Nachfüllen fort', async () => {
    const m = new AbfuellLogic();
    m.level = 0.2;
    await runWithModel('37-abfuellanlage.asm', m, 30, (t) => {
      m.input('main', t > 0.3);
      m.input('refill', within(t, 24, 24.1));
    });
    assert.ok(m.goodCount >= 2, `gut: ${m.goodCount}`);
    const m2 = new AbfuellLogic();
    m2.level = 0.1;
    const cpu2 = await runWithModel('37-abfuellanlage.asm', m2, 20, (t) => m2.input('main', t > 0.3));
    assert.equal(cpu2.pin(0) & 0x80, 0x80, 'Lampe P leuchtet');
    assert.equal(cpu2.pin(0) & 0x04, 0, 'Band steht');
    assert.equal(m2.goodCount, 0);
  });
  it('Logik: Ventil ohne Flasche verschüttet Produkt, zu langes Füllen läuft über', () => {
    const m = new AbfuellLogic();
    for (let i = 0; i < 1000; i++) m.step(0b10, 0.001);
    assert.ok(m.spilled > 0.4);
    assert.match(m.status, /läuft aus/);
    const o = new AbfuellLogic();
    o.bottles.push({ x: 0.55, fill: 0 });
    for (let i = 0; i < 2600; i++) o.step(0b010, 0.001);
    assert.ok(o.bottles[0]!.fill > 1.1);
    assert.match(o.status, /läuft über/);
    for (let i = 0; i < 4000; i++) o.step(0b100, 0.001);
    assert.equal(o.badCount, 1);
  });
});

describe('Sieben-Segment-Anzeige', () => {
  it('decodiert alle 16 Schalterstellungen richtig', async () => {
    const m = new SiebenLogic();
    const seen: string[] = [];
    await runWithModel('38-sieben-segment.asm', m, 0.7, (t) => {
      const k = Math.floor(t / 0.04);
      if (k > 15) return;
      for (let b = 0; b < 4; b++) m.input(`s${b + 1}`, ((k >> b) & 1) === 1);
      if (t - k * 0.04 > 0.03) seen[k] = m.shown;
    });
    assert.equal(seen.join(''), CHARS);
    assert.ok(m.matches);
  });
  it('Logik: falsches oder ungültiges Segmentmuster wird gemeldet', () => {
    const m = new SiebenLogic();
    m.input('s1', true); m.input('s2', true);
    m.step(0x06);
    assert.equal(m.shown, '1');
    assert.equal(m.matches, false);
    assert.match(m.status, /stimmt nicht/);
    m.step(0x41);
    assert.equal(m.shown, '?');
    m.step(0);
    assert.match(m.status, /dunkel/);
    m.step(0x4f);
    assert.ok(m.matches);
    assert.equal(m.ex, 3);
  });
});
