import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runWithModel } from './helpers.ts';
import { ZweitankLogic } from '../src/io/external/models/zweitank.logic.ts';
import { KreiselLogic } from '../src/io/external/models/kreisel.logic.ts';
import { ZweihandLogic } from '../src/io/external/models/zweihand.logic.ts';
import { KompensationLogic } from '../src/io/external/models/kompensation.logic.ts';
import { PalettiererLogic } from '../src/io/external/models/palettierer.logic.ts';
import { RollenbahnLogic } from '../src/io/external/models/rollenbahn.logic.ts';
import { PoliererLogic } from '../src/io/external/models/polierer.logic.ts';
import { KlebeLogic } from '../src/io/external/models/klebeduese.logic.ts';
import { LauflichtLogic } from '../src/io/external/models/lauflicht.logic.ts';
import { SchiebetorLogic } from '../src/io/external/models/schiebetor.logic.ts';
import { GaragentorLogic } from '../src/io/external/models/garagentor.logic.ts';
import { PACK2_MODELS } from '../src/io/external/pack2.ts';

/** true, solange t im Intervall [a, b) liegt */
const within = (t: number, a: number, b: number) => t >= a && t < b;

describe('Modellpaket 2: Registrierung', () => {
  it('enthält 11 Modelle mit je 8 Ax/Ex-Bezeichnungen', () => {
    assert.equal(PACK2_MODELS.length, 11);
    assert.equal(new Set(PACK2_MODELS.map((m) => m.id)).size, 11);
    for (const m of PACK2_MODELS) {
      assert.equal(m.group, 'Modellpaket 2');
      assert.equal(m.ax.length, 8, m.id);
      assert.equal(m.ex.length, 8, m.id);
      assert.ok(m.createLogic().ex >= 0);
    }
  });
});

describe('Zweitanksystem', () => {
  it('füllt beide Becken bis „voll" ohne Überlauf, Entnahme leert Becken 2', async () => {
    const m = new ZweitankLogic();
    await runWithModel('41-zweitank.asm', m, 30, (t) => m.input('ein', within(t, 0.1, 0.3)));
    assert.ok(m.level1 > 0.85 && m.level2 > 0.85, `${m.level1} ${m.level2}`);
    assert.equal(m.overflows, 0);
    await runWithModel('41-zweitank.asm', m, 36, (t) => { m.input('ein', within(t, 0.1, 0.3)); m.input('entnahme', t > 30); });
    assert.equal(m.overflows, 0);
  });
  it('meldet Überlauf, wenn V1 dauerhaft offen ist', () => {
    const m = new ZweitankLogic();
    for (let i = 0; i < 6000; i++) m.step(0b0001, 0.001);
    assert.equal(m.level1, 1);
    assert.match(m.status, /läuft über/);
  });
});

describe('Kreiselpumpe', () => {
  it('fördert nach EIN, stoppt mit AUS', async () => {
    const m = new KreiselLogic();
    await runWithModel('42-kreisel.asm', m, 6, (t) => { m.input('ein', within(t, 0.1, 0.3)); m.input('aus', within(t, 5, 5.2)); });
    assert.ok(m.delivered > 5, String(m.delivered));
    assert.ok(!m.alarm && !m.damaged);
    assert.ok(m.motor.speed < 0.5, 'Pumpe nach AUS aus');
  });
  it('schaltet bei Trockenlauf ab und alarmiert, bevor die Pumpe Schaden nimmt', async () => {
    const m = new KreiselLogic();
    await runWithModel('42-kreisel.asm', m, 10, (t) => { m.input('ein', within(t, 0.1, 0.3)); m.input('dry', t > 3); });
    assert.ok(m.alarm, 'Alarm');
    assert.ok(!m.damaged, 'Pumpe unbeschädigt');
    assert.ok(m.motor.speed < 0.1);
  });
  it('Logik: ohne Programm wird die Pumpe nach 4 s Trockenlauf beschädigt', () => {
    const m = new KreiselLogic();
    m.input('dry', true);
    for (let i = 0; i < 6000; i++) m.step(1, 0.001);
    assert.ok(m.damaged);
    assert.match(m.status, /beschädigt/);
  });
});

describe('Zweihandverriegelung', () => {
  it('presst, wenn beide Taster innerhalb 0,5 s gedrückt und gehalten werden', async () => {
    const m = new ZweihandLogic();
    await runWithModel('43-zweihand.asm', m, 6, (t) => { m.input('s1', within(t, 0.5, 3)); m.input('s2', within(t, 0.7, 3)); });
    assert.equal(m.pressed, 1);
    assert.equal(m.hazards, 0);
    assert.ok(m.ram < 0.05, 'Stempel wieder oben');
  });
  it('lässt den Stempel nicht fahren, wenn das Zeitfenster überschritten wird', async () => {
    const m = new ZweihandLogic();
    await runWithModel('43-zweihand.asm', m, 5, (t) => { m.input('s1', within(t, 0.5, 4)); m.input('s2', within(t, 1.5, 4)); });
    assert.equal(m.pressed, 0);
    assert.equal(m.hazards, 0);
  });
  it('bricht ab, wenn ein Taster während des Hubs losgelassen wird', async () => {
    const m = new ZweihandLogic();
    await runWithModel('43-zweihand.asm', m, 3, (t) => { m.input('s1', within(t, 0.5, 4)); m.input('s2', within(t, 0.6, 1.2)); });
    assert.equal(m.pressed, 0);
    assert.ok(m.ram < 0.05);
  });
  it('Logik: K1 mit nur einem Taster ist eine Gefahr', () => {
    const m = new ZweihandLogic();
    m.input('s1', true);
    for (let i = 0; i < 100; i++) m.step(1, 0.001);
    assert.equal(m.hazards, 1);
    assert.match(m.status, /GEFAHR/);
  });
  it('Logik: festgeklebter Taster verletzt das Zeitfenster', () => {
    const m = new ZweihandLogic();
    m.input('tape1', true);
    for (let i = 0; i < 1000; i++) m.step(0, 0.001);
    m.input('s2', true);
    for (let i = 0; i < 100; i++) m.step(1, 0.001);
    assert.equal(m.hazards, 1);
  });
});

describe('Blindleistungskompensation', () => {
  it('gleicht steigende und fallende Last ohne Schaltstoß aus', async () => {
    const m = new KompensationLogic();
    await runWithModel('44-kompensation.asm', m, 40, (t) => {
      m.input('plus', within(t, 1, 1.1) || within(t, 1.5, 1.6) || within(t, 2, 2.1));
      m.input('minus', within(t, 25, 25.1) || within(t, 25.5, 25.6) || within(t, 26, 26.1));
    });
    assert.equal(m.loadStep, 1 + 3 - 3);
    assert.equal(m.surges, 0);
    assert.ok(Math.abs(m.net) < 2.5, `Netto ${m.net}`);
    assert.equal(m.stages.filter(Boolean).length, 1);
  });
  it('kompensiert Volllast', async () => {
    const m = new KompensationLogic();
    await runWithModel('44-kompensation.asm', m, 20, (t) => m.input('plus', within(t, 1, 1.1) || within(t, 1.5, 1.6) || within(t, 2, 2.1)));
    assert.equal(m.load, 20);
    assert.ok(Math.abs(m.net) < 2.5);
    assert.ok(m.cosPhi > 0.99);
  });
  it('Logik: Wiedereinschalten vor der Entladezeit erzeugt Schaltstoß', () => {
    const m = new KompensationLogic();
    for (let i = 0; i < 100; i++) m.step(1, 0.01);
    for (let i = 0; i < 100; i++) m.step(0, 0.01);
    for (let i = 0; i < 10; i++) m.step(1, 0.01);
    assert.equal(m.surges, 1);
    assert.match(m.status, /Schaltstoß/);
  });
  it('Logik: Überkompensation wird gemeldet', () => {
    const m = new KompensationLogic();
    m.loadStep = 0;
    m.step(0b1111, 0.01);
    assert.ok(m.net < 0);
    assert.match(m.status, /Überkompensation/);
  });
});

describe('Palettierungsanlage', () => {
  it('palettiert 12 Kartons auf eine volle Palette (4 Lagen)', async () => {
    const m = new PalettiererLogic();
    await runWithModel('45-palettierer.asm', m, 60, (t) => {
      m.input('start', within(t, 0.2, 0.4));
      m.input('box', [...Array(12).keys()].some((i) => within(t, 1 + i * 3, 1.05 + i * 3)));
    });
    assert.equal(m.moved, 12);
    assert.equal(m.pallet, 4, m.status);
    assert.equal(m.layer, 0);
    assert.ok(!m.motor.running, 'Band steht bei voller Palette');
  });
  it('Logik: Zylinder 2 gegen ausgefahrenen Zylinder 1 ist eine Kollision', () => {
    const m = new PalettiererLogic();
    for (let i = 0; i < 1000; i++) m.step(0b0001, 0.001);
    for (let i = 0; i < 1000; i++) m.step(0b0101, 0.001);
    assert.match(m.status, /Kollision/);
    assert.ok(m.c2.pos <= 0.3);
  });
  it('Logik: Kartons stauen am Anschlag', () => {
    const m = new PalettiererLogic();
    m.input('box', true);
    for (let i = 0; i < 6000; i++) m.step(0b10000, 0.001);
    assert.ok(m.atEnd);
    m.input('box', true);
    for (let i = 0; i < 6000; i++) m.step(0b10000, 0.001);
    assert.equal(m.boxes.length, 2);
    assert.ok(m.boxes[0]! - m.boxes[1]! >= 0.12);
  });
});

describe('Verpackungsrollenbahn', () => {
  it('befördert zwei Pakete von Hubtisch auf die obere Bahn', async () => {
    const m = new RollenbahnLogic();
    await runWithModel('46-rollenbahn.asm', m, 30, (t) => {
      m.input('start', within(t, 0.2, 0.4));
      m.input('pack', within(t, 1, 1.1) || within(t, 14, 14.1));
    });
    assert.equal(m.delivered, 2);
    assert.ok(m.lift.retracted && m.push.retracted);
    assert.ok(!m.pkg);
  });
  it('Logik: Schieber bei abgesenktem Hubtisch kollidiert', () => {
    const m = new RollenbahnLogic();
    for (let i = 0; i < 1000; i++) m.step(0b0100, 0.001);
    assert.match(m.status, /Kollision/);
    assert.ok(m.push.pos <= 0.2);
  });
});

describe('Poliermaschine', () => {
  it('poliert das Werkstück bei einem Hin- und Rückweg', async () => {
    const m = new PoliererLogic();
    await runWithModel('47-polierer.asm', m, 16, (t) => m.input('start', within(t, 0.2, 0.4)));
    assert.equal(m.polished, 1, m.status);
    assert.ok(m.pos <= 0.02 && m.m2.speed < 0.3);
    assert.ok(!m.lampFault);
  });
  it('schaltet bei Übertemperatur von M2 ab und meldet Störung', async () => {
    const m = new PoliererLogic();
    await runWithModel('47-polierer.asm', m, 6, (t) => { m.input('start', within(t, 0.2, 0.4)); m.input('heat2', t > 2.5); });
    assert.ok(m.lampFault);
    assert.ok(m.m2.speed < 0.3 && m.m1.speed < 0.3);
    assert.equal(m.polished, 0);
  });
  it('Logik: Polierscheibe aus → nicht poliert; M1R+M1L → Kurzschluss', () => {
    const m = new PoliererLogic();
    for (let i = 0; i < 6000; i++) m.step(0b0100, 0.001);
    assert.ok(m.finish.every((f) => f === 0));
    m.step(0b1100, 0.001);
    assert.match(m.status, /Kurzschluss/);
  });
});

describe('Klebedüse', () => {
  it('klebt jeden Karton so lange wie Vorwahl × 0,2 s', async () => {
    const m = new KlebeLogic();
    m.preset = 5;
    await runWithModel('48-klebeduese.asm', m, 20, (t) => m.input('box', within(t, 0.5, 0.6) || within(t, 4.5, 4.6) || within(t, 8.5, 8.6)));
    assert.equal(m.good, 3, m.status);
    assert.equal(m.bad, 0);
    assert.equal(m.beltGlue, 0);
  });
  it('Vorwahl 0 klebt nicht', async () => {
    const m = new KlebeLogic();
    m.preset = 0;
    await runWithModel('48-klebeduese.asm', m, 12, (t) => m.input('box', within(t, 0.5, 0.6)));
    assert.equal(m.good, 1);
  });
  it('Logik: Düse ohne Karton verschmutzt das Band; zu kurze Zeit ist falsch', () => {
    const m = new KlebeLogic();
    for (let i = 0; i < 100; i++) m.step(1, 0.01);
    assert.ok(m.beltGlue > 0);
    assert.match(m.status, /Förderband/);
    m.input('box', true);
    for (let i = 0; i < 1000; i++) m.step(0, 0.01);
    assert.equal(m.bad, 1);
  });
});

describe('Verkehrslauflicht', () => {
  it('läuft in Reihenfolge H1→H6; schneller bei F3 als bei F1', async () => {
    const speeds: Record<number, number> = {};
    for (const sp of [1, 2, 3]) {
      const m = new LauflichtLogic();
      m.speed = sp;
      await runWithModel('49-lauflicht.asm', m, 6, (t) => m.input('on', t > 0.1));
      assert.equal(m.badSteps, 0);
      assert.ok(m.steps > 5);
      speeds[sp] = m.interval;
    }
    assert.ok(Math.abs(speeds[1]! - 0.4) < 0.03, String(speeds[1]));
    assert.ok(Math.abs(speeds[2]! - 0.2) < 0.03);
    assert.ok(Math.abs(speeds[3]! - 0.1) < 0.03);
  });
  it('geht bei AUS dunkel und begrenzt die Geschwindigkeitswahl', async () => {
    const m = new LauflichtLogic();
    await runWithModel('49-lauflicht.asm', m, 3, (t) => { m.input('on', within(t, 0.1, 0.2)); m.input('off', within(t, 1.5, 1.6)); });
    assert.equal(m.lamps, 0);
    m.input('faster', true); m.input('faster', true); m.input('faster', true);
    assert.equal(m.speed, 3);
    assert.equal(m.ex, 0b1000);
    m.input('slower', true); m.input('slower', true); m.input('slower', true); m.input('slower', true);
    assert.equal(m.speed, 1);
  });
});

describe('Schiebetorsteuerung', () => {
  it('öffnet und schließt bis zu den Endschaltern', async () => {
    const m = new SchiebetorLogic();
    await runWithModel('4A-schiebetor.asm', m, 8, (t) => m.input('open', within(t, 0.5, 0.7)));
    assert.ok(m.pos >= 0.98 && m.dir === 0);
    await runWithModel('4A-schiebetor.asm', m, 8, (t) => m.input('close', within(t, 0.5, 0.7)));
    assert.ok(m.pos <= 0.02 && m.dir === 0);
    assert.equal(m.crushed, 0);
  });
  it('öffnet bei Hindernis in der Lichtschranke wieder, ohne zu klemmen', async () => {
    const m = new SchiebetorLogic();
    m.pos = 1;
    await runWithModel('4A-schiebetor.asm', m, 14, (t) => { m.input('close', within(t, 0.5, 0.7)); m.input('obstacle', t > 2 && t < 4); });
    assert.equal(m.crushed, 0);
    assert.ok(m.pos >= 0.98, 'wieder offen');
  });
  it('Logik: Schließen gegen Hindernis klemmt; K1+K2 ist Kurzschluss', () => {
    const m = new SchiebetorLogic();
    m.pos = 0.6; m.obstacle = true;
    for (let i = 0; i < 1000; i++) m.step(0b01000, 0.001);
    assert.equal(m.crushed, 1);
    assert.match(m.status, /GEFAHR/);
    m.step(0b11000, 0.001);
    assert.match(m.status, /Kurzschluss/);
  });
  it('STOP hält das Tor an', async () => {
    const m = new SchiebetorLogic();
    await runWithModel('4A-schiebetor.asm', m, 4, (t) => { m.input('open', within(t, 0.5, 0.7)); m.input('stop', within(t, 2, 2.2)); });
    assert.ok(m.pos > 0.1 && m.pos < 0.9 && m.dir === 0, String(m.pos));
  });
});

describe('Garagentorsteuerung', () => {
  it('Impulstaster öffnet und schließt das Tor', async () => {
    const m = new GaragentorLogic();
    await runWithModel('4B-garagentor.asm', m, 20, (t) => { m.input('s2', within(t, 0.5, 0.6)); m.input('s1', within(t, 10, 10.1)); });
    assert.ok(m.pos <= 0.02 && m.dir === 0, String(m.pos));
    assert.equal(m.crushed, 0);
    assert.ok(!m.warn);
  });
  it('erneuter Impuls hält das Tor in der Fahrt an', async () => {
    const m = new GaragentorLogic();
    await runWithModel('4B-garagentor.asm', m, 6, (t) => { m.input('s2', within(t, 0.5, 0.6) || within(t, 3, 3.1)); });
    assert.ok(m.pos > 0.2 && m.pos < 0.9 && m.dir === 0, String(m.pos));
  });
  it('Lichtschranke öffnet das Tor beim Schließen wieder', async () => {
    const m = new GaragentorLogic();
    m.pos = 1;
    await runWithModel('4B-garagentor.asm', m, 14, (t) => { m.input('s1', within(t, 0.5, 0.6)); m.input('obstacle', within(t, 2, 4)); });
    assert.equal(m.crushed, 0);
    assert.ok(m.pos >= 0.98);
  });
  it('Logik: Hindernis wird ohne Lichtschrankenauswertung eingeklemmt', () => {
    const m = new GaragentorLogic();
    m.pos = 0.7; m.obstacle = true;
    for (let i = 0; i < 1000; i++) m.step(0b010, 0.001);
    assert.equal(m.crushed, 1);
  });
});
