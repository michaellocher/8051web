import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runWithModel } from './helpers.ts';
import { MischerLogic } from '../src/io/external/models/mischer.logic.ts';
import { DrehrichtungLogic } from '../src/io/external/models/drehrichtung.logic.ts';
import { AbsaugLogic } from '../src/io/external/models/absaug.logic.ts';
import { RolltreppeLogic } from '../src/io/external/models/rolltreppe.logic.ts';
import { WaggonLogic } from '../src/io/external/models/waggon.logic.ts';
import { Foerder2Logic } from '../src/io/external/models/foerder2.logic.ts';
import { Foerder3Logic } from '../src/io/external/models/foerder3.logic.ts';
import { FarbeLogic } from '../src/io/external/models/farbe.logic.ts';
import { PumpeLogic } from '../src/io/external/models/pumpe.logic.ts';
import { PACK3_MODELS } from '../src/io/external/pack3.ts';

/** true, solange t im Intervall [a, b) liegt */
const within = (t: number, a: number, b: number) => t >= a && t < b;

describe('Modellpaket 2 (Teil 2): Registrierung', () => {
  it('enthält Modelle mit je 8 Ax/Ex-Bezeichnungen', () => {
    assert.equal(new Set(PACK3_MODELS.map((m) => m.id)).size, PACK3_MODELS.length);
    for (const m of PACK3_MODELS) {
      assert.equal(m.group, 'Modellpaket 2');
      assert.equal(m.ax.length, 8, m.id);
      assert.equal(m.ex.length, 8, m.id);
      assert.ok(m.createLogic().ex >= 0);
    }
  });
});

describe('Pumpensteuerung', () => {
  it('pumpt zyklisch zwischen oben und unten, ohne Trockenlauf oder Überlauf', async () => {
    const m = new PumpeLogic();
    await runWithModel('51-pumpensteuerung.asm', m, 45, (t) => { m.input('s0', t > 0.1); m.input('v1', t > 0.1); });
    assert.ok(m.starts >= 2, `Starts ${m.starts}`);
    assert.equal(m.dryTime, 0);
    assert.equal(m.overflows, 0);
    assert.ok(m.level > 0.1 && m.level < 0.95);
  });
  it('stoppt bei Motorschutz Q1 und lässt H1 blinken', async () => {
    const m = new PumpeLogic();
    let toggles = 0, last = false;
    await runWithModel('51-pumpensteuerung.asm', m, 20, (t) => {
      m.input('s0', t > 0.1); m.input('v1', t > 0.1); m.input('q1', t > 8);
      if (t > 10 && m.h1 !== last) toggles++;
      last = m.h1;
    });
    assert.ok(m.tripped);
    assert.ok(m.motor.speed < 0.05, 'Pumpe steht');
    assert.ok(toggles >= 4, `Blinken ${toggles}`);
    assert.match(m.status, /Motorschutz/);
  });
  it('Logik: Trockenlauf löst den Motorschutz aus', () => {
    const m = new PumpeLogic();
    m.level = 0;
    for (let i = 0; i < 4000; i++) m.step(1, 0.001);
    assert.ok(m.tripped);
    assert.ok(m.dryTime > 1.9);
  });
  it('Logik: offenes Ventil ohne Pumpe läuft über', () => {
    const m = new PumpeLogic();
    m.input('v1', true);
    for (let i = 0; i < 9000; i++) m.step(0, 0.001);
    assert.ok(m.overflows > 0);
    assert.match(m.status, /läuft über/);
  });
});

describe('Mischbehälter', () => {
  it('dosiert 20 + 30 Impulse, heizt, rührt und entleert eine gute Charge', async () => {
    const m = new MischerLogic();
    let maxLevel = 0, maxTemp = 0;
    await runWithModel('52-mischbehaelter.asm', m, 50, (t) => {
      m.input('s1', within(t, 0.1, 0.3));
      maxLevel = Math.max(maxLevel, m.level); maxTemp = Math.max(maxTemp, m.temp);
    });
    assert.equal(m.good, 1, `gut ${m.good}, schlecht ${m.bad}`);
    assert.equal(m.bad, 0);
    assert.equal(m.overflows, 0);
    assert.ok(Math.abs(maxLevel - 0.5) < 0.03, `Füllstand ${maxLevel}`);
    assert.ok(maxTemp >= 60 && maxTemp < 75, `Temperatur ${maxTemp}`);
    assert.ok(m.level < 0.01, 'leer');
  });
  it('Alarm bei Überfüllung: Ventile zu, H1 an', async () => {
    const m = new MischerLogic();
    m.vol1 = 0.88; // Behälter fast voll
    await runWithModel('52-mischbehaelter.asm', m, 8, (t) => m.input('s1', within(t, 0.1, 0.3)));
    assert.ok(m.alarm);
    assert.ok(m.v.every((x) => !x));
    assert.equal(m.overflows, 0);
  });
  it('Logik: Heizen ohne Rühren setzt das Mischgut an, Trockenheizen wird gemeldet', () => {
    const m = new MischerLogic();
    m.vol1 = 0.3;
    for (let i = 0; i < 4000; i++) m.step(0b0010_0000, 0.001);
    assert.ok(m.scorched);
    assert.match(m.status, /ohne Rühren/);
    const d = new MischerLogic();
    for (let i = 0; i < 100; i++) d.step(0b0010_0000, 0.001);
    assert.match(d.status, /ohne Füllung/);
  });
  it('Logik: V3 vor Erreichen von Temperatur/Durchmischung liefert eine schlechte Charge', () => {
    const m = new MischerLogic();
    m.vol1 = 0.2; m.vol2 = 0.3;
    for (let i = 0; i < 300; i++) m.step(0b0001_0000, 0.001);
    assert.equal(m.bad, 1);
    assert.match(m.status, /Charge fehlerhaft/);
  });
});

describe('Drehrichtungserkennung', () => {
  it('erkennt Rechts- und Linkslauf und löscht die Anzeige bei AUS', async () => {
    const m = new DrehrichtungLogic();
    const seen: Record<string, [boolean, boolean]> = {};
    await runWithModel('53-drehrichtung.asm', m, 14, (t) => {
      m.input('s0', within(t, 0.1, 11));
      if (t > 6) m.input('links', true);
      if (t > 3 && t < 3.01) seen['r'] = [m.h1, m.h2];
      if (t > 10.5 && t < 10.51) seen['l'] = [m.h1, m.h2];
    });
    assert.deepEqual(seen['r'], [true, false]);
    assert.deepEqual(seen['l'], [false, true]);
    assert.ok(!m.h1 && !m.h2, 'Anzeige nach AUS gelöscht');
  });
  it('Logik: Sensorreihenfolge entspricht der Drehrichtung', () => {
    const run = (dir: 'rechts' | 'links') => {
      const m = new DrehrichtungLogic();
      m.input(dir, true); m.input('s0', true);
      let first = '';
      let p1 = m.b1, p2 = m.b2;
      for (let i = 0; i < 5000; i++) {
        m.step(0, 0.001);
        if (!first && m.b1 && !p1) first = m.b2 ? 'B2 zuerst' : 'B1 zuerst';
        if (!first && m.b2 && !p2) first = 'B2 zuerst';
        p1 = m.b1; p2 = m.b2;
      }
      return first;
    };
    assert.equal(run('rechts'), 'B1 zuerst');
    assert.equal(run('links'), 'B2 zuerst');
  });
  it('Logik: defekter Sensor B1 liefert nie ein Signal und wird gemeldet', () => {
    const m = new DrehrichtungLogic();
    m.input('b1', true); m.input('s0', true);
    let any = false;
    for (let i = 0; i < 4000; i++) { m.step(0, 0.001); any ||= m.b1; }
    assert.ok(!any);
    assert.match(m.status, /B1 defekt/);
  });
});

describe('Absauganlage', () => {
  it('saugt ohne Staubaustritt ab, leert den Abscheider und läuft nach', async () => {
    const m = new AbsaugLogic();
    let m1On = 0;
    await runWithModel('54-absauganlage.asm', m, 36, (t) => {
      m.input('s1', within(t, 0.1, 0.4)); m.input('machine', within(t, 5, 15)); m.input('s2', within(t, 20, 20.3));
      if (m.m1.running) m1On = t;
    });
    assert.ok(m.leak < 0.01, `Staub in der Halle ${m.leak}`);
    assert.ok(m.peakSep > 0.03 && m.peakSep < 0.5, `Abscheider ${m.peakSep}`);
    assert.ok(m.bin > 0.1, 'Behälter gefüllt');
    assert.ok(m.sep < 0.02, 'Abscheider leer');
    assert.ok(m1On > 22 && m1On < 26, `M1 lief bis ${m1On}`);
    assert.ok(m.m1.speed < 0.05 && m.m2.speed < 0.05, 'alles aus');
  });
  it('Motorschutz Q1 während des Betriebs: Ventilator aus, H3 blinkt, Staubmeldung', async () => {
    const m = new AbsaugLogic();
    let toggles = 0, last = false;
    await runWithModel('54-absauganlage.asm', m, 14, (t) => {
      m.input('s1', within(t, 0.1, 0.4)); m.input('machine', t > 4); m.input('q1', t > 8);
      if (t > 8.5 && m.lamps[2] !== last) toggles++;
      last = m.lamps[2]!;
    });
    assert.ok(m.m1.speed < 0.05);
    assert.ok(toggles >= 4, `Blinken ${toggles}`);
    assert.ok(m.leak > 0.05);
    assert.match(m.status, /Motorschutz Q1/);
  });
  it('Logik: ohne Zellenradschleuse verstopft der Abscheider', () => {
    const m = new AbsaugLogic();
    m.input('machine', true);
    for (let i = 0; i < 25000; i++) m.step(0b0001, 0.001);
    assert.equal(m.sep, 1);
    assert.ok(m.leak > 0);
    assert.match(m.status, /Abscheider voll|Zellenradschleuse|Staub/);
  });
});

describe('Rolltreppe', () => {
  it('startet über die Lichtschranke, bringt den Fahrgast hinauf und schaltet nach der Nachlaufzeit ab', async () => {
    const m = new RolltreppeLogic();
    let lastRun = 0;
    await runWithModel('55-rolltreppe.asm', m, 32, (t) => { m.input('person', within(t, 1, 1.3)); if (m.running) lastRun = t; });
    assert.equal(m.arrived, 1);
    assert.equal(m.stranded, 0);
    assert.equal(m.hazards, 0);
    assert.ok(lastRun > 15 && lastRun < 22, `lief bis ${lastRun}`);
    assert.ok(m.speed < 0.05);
  });
  it('STOP unten hält sofort an und sperrt den Automatikstart; EIN fährt weiter', async () => {
    const m = new RolltreppeLogic();
    let atStop = 0, whileStopped = 0;
    await runWithModel('55-rolltreppe.asm', m, 30, (t) => {
      m.input('person', within(t, 1, 1.3));
      m.input('s2', within(t, 6, 7));
      m.input('s0', within(t, 12, 12.3));
      if (t > 8 && t < 8.01) atStop = m.speed;
      if (t > 10 && t < 10.01) whileStopped = m.people[0]?.pos ?? -1;
      if (t > 8 && t < 11.9) assert.ok(m.speed < 0.05, `steht bei ${t}`);
    });
    assert.ok(atStop < 0.05);
    assert.ok(whileStopped > 0.1 && whileStopped < 0.9, `Fahrgast bleibt auf der Treppe: ${whileStopped}`);
    assert.equal(m.hazards, 0);
    assert.equal(m.stranded, 0, 'Not-Halt ist keine Fehlabschaltung');
    assert.equal(m.arrived, 1);
  });
  it('Logik: STOP ohne Reaktion des Programms ist eine Gefahr', () => {
    const m = new RolltreppeLogic();
    m.input('s2', true);
    for (let i = 0; i < 800; i++) m.step(0b001, 0.001);
    assert.equal(m.hazards, 1);
    assert.match(m.status, /GEFAHR/);
  });
  it('Logik: zu kurze Nachlaufzeit lässt Fahrgäste auf der Treppe stranden', () => {
    const m = new RolltreppeLogic();
    m.input('person', true);
    for (let i = 0; i < 300; i++) m.step(0b001, 0.001);
    m.input('person', false);
    for (let i = 0; i < 4000; i++) m.step(0b001, 0.001);
    for (let i = 0; i < 100; i++) m.step(0, 0.001);
    assert.equal(m.stranded, 1);
    assert.match(m.status, /zu früh/);
  });
});

describe('Waggonbeladung', () => {
  it('belädt zwei Waggons, Silo wird dazwischen nachgefüllt', async () => {
    const m = new WaggonLogic();
    let fullAt14 = 0, siloAt14 = 0;
    await runWithModel('56-waggonbeladung.asm', m, 47, (t) => {
      m.input('s1', within(t, 0.1, 0.3) || within(t, 27, 27.3));
      m.input('s7', within(t, 15, 18) || within(t, 42, 45));
      m.input('s6', within(t, 19, 22));
      m.input('s8', within(t, 23, 26));
      if (t > 14 && t < 14.01) { fullAt14 = m.fill; siloAt14 = m.silo; }
    });
    assert.ok(fullAt14 >= 0.9 && fullAt14 <= 1, `Waggon ${fullAt14}`);
    assert.ok(Math.abs(siloAt14 - 0.3) < 0.06, `Silo ${siloAt14}`);
    assert.equal(m.delivered, 2);
    assert.equal(m.underfilled, 0);
    assert.equal(m.spilled, 0);
    assert.equal(m.overflows, 0);
    assert.ok(!m.clogged);
    assert.ok(m.p1.speed < 0.05 && m.p2.speed < 0.05 && m.p3.speed < 0.05);
  });
  it('bricht bei leerem Silo ab, ohne dass die Schleuse leerläuft', async () => {
    const m = new WaggonLogic();
    m.silo = 0.14;
    await runWithModel('56-waggonbeladung.asm', m, 12, (t) => m.input('s1', within(t, 0.1, 0.3)));
    assert.ok(m.silo >= 0.09, `Silo ${m.silo}`);
    assert.ok(m.fill > 0.05 && m.fill < 0.9);
    assert.ok(m.p3.speed < 0.05 && m.p2.speed < 0.05);
    assert.equal(m.spilled, 0);
  });
  it('Logik: Schleuse ohne Gebläse verstopft, Freiblasen löst es', () => {
    const m = new WaggonLogic();
    for (let i = 0; i < 500; i++) m.step(0b101, 0.001);
    assert.ok(m.clogged);
    assert.match(m.status, /verstopft/);
    for (let i = 0; i < 3000; i++) m.step(0b010, 0.001);
    assert.ok(!m.clogged);
  });
  it('Logik: ohne Fluidisierung fließt nichts (Brückenbildung); ohne Waggon wird Material verschüttet', () => {
    const m = new WaggonLogic();
    for (let i = 0; i < 1000; i++) m.step(0b010, 0.001);
    for (let i = 0; i < 1000; i++) m.step(0b110, 0.001);
    assert.equal(m.silo, 0.7);
    assert.match(m.status, /Brückenbildung/);
    const n = new WaggonLogic();
    n.wx = -1;
    for (let i = 0; i < 1000; i++) n.step(0b011, 0.001);
    for (let i = 0; i < 2000; i++) n.step(0b111, 0.001);
    assert.ok(n.spilled > 0);
    assert.match(n.status, /Gleis/);
  });
});

describe('Förderanlage II', () => {
  it('Automatik: Reihenfolge M3 → M2 → M1, Stopp umgekehrt, kein Stau, keine Fehlermeldung', async () => {
    const m = new Foerder2Logic();
    const order: string[] = [];
    let last = [false, false, false];
    await runWithModel('57-foerderanlage2.asm', m, 42, (t) => {
      m.input('s8', true);
      m.input('s5', within(t, 0.5, 0.8)); m.input('s6', within(t, 25, 25.3));
      const now = m.m.map((x) => x.running);
      now.forEach((on, i) => { if (on !== last[i]) order.push(`M${i + 1}${on ? '+' : '-'}`); });
      last = now;
    });
    assert.deepEqual(order, ['M3+', 'M2+', 'M1+', 'M1-', 'M2-', 'M3-']);
    assert.equal(m.piles, 0);
    assert.deepEqual(m.errors, []);
    assert.ok(m.delivered > 15, `gefördert ${m.delivered}`);
  });
  it('Hand: M1/M2 starten nur bei laufendem M3; NOT-AUS stoppt alles und wird gemeldet', async () => {
    const m = new Foerder2Logic();
    let m1BeforeM3 = false, m1Running = false;
    await runWithModel('57-foerderanlage2.asm', m, 24, (t) => {
      m.input('s1', within(t, 0.5, 0.8) || within(t, 5, 5.3));   // erster Versuch ohne M3 wird ignoriert
      m.input('s5', within(t, 2, 2.3));
      m.input('s3', within(t, 7, 7.3));
      m.input('s7', t > 20);
      if (t < 4.9 && m.m[0].speed > 0.1) m1BeforeM3 = true;
      if (t > 15 && t < 15.01) m1Running = m.m[0].running && m.m[1].running && m.m[2].running;
    });
    assert.ok(!m1BeforeM3, 'M1 darf ohne M3 nicht anlaufen');
    assert.ok(m1Running, 'alle Bänder liefen');
    assert.equal(m.piles, 0);
    assert.ok(m.m.every((x) => x.speed < 0.05), 'NOT-AUS stoppt alle Bänder');
    assert.ok(m.errors.some((e) => /NOT-AUS/.test(e)));
    assert.ok(!m.errors.some((e) => /Antrieb läuft weiter/.test(e)));
  });
  it('Logik: M1 ohne M3 verursacht Stau und Fehlermeldungen', () => {
    const m = new Foerder2Logic();
    for (let i = 0; i < 9000; i++) m.step(0b001, 0.001);
    assert.ok(m.piles >= 1);
    assert.ok(m.pile > 0.5);
    assert.ok(m.errors.some((e) => /STAU/.test(e)));
    assert.ok(m.errors.some((e) => /M1 gestartet, obwohl/.test(e)));
    m.input('clear', true);
    assert.equal(m.errors.length, 0);
  });
});

describe('Förderanlage III', () => {
  it('pendelt im Dauerbetrieb: voll beladen, vollständig entleert, ohne Fehlermeldung', async () => {
    const m = new Foerder3Logic();
    let maxLoad = 0;
    await runWithModel('58-foerderanlage3.asm', m, 62, (t) => { m.input('s0', within(t, 0.1, 50)); maxLoad = Math.max(maxLoad, m.load); });
    assert.equal(m.cycles, 3);
    assert.equal(m.underfilled, 0);
    assert.equal(m.notEmptied, 0);
    assert.equal(m.overflows, 0);
    assert.equal(m.crashes, 0);
    assert.deepEqual(m.errors, []);
    assert.ok(maxLoad >= 0.99);
    assert.ok(m.pos < 0.02 && m.dir === 0 && m.load === 0, 'nach Start AUS links angehalten');
  });
  it('Logik: zu frühes Abfahren und Überfahren der Endlage werden gemeldet', () => {
    const m = new Foerder3Logic();
    for (let i = 0; i < 4200; i++) m.step(0b01, 0.001); // nach rechts
    assert.ok(m.pos >= 0.99);
    for (let i = 0; i < 1000; i++) m.step(0, 0.001);     // nur 1 s beladen
    for (let i = 0; i < 500; i++) m.step(0b10, 0.001);   // zurück
    assert.equal(m.underfilled, 1);
    assert.match(m.status, /teilweise beladen/);
    for (let i = 0; i < 6000; i++) m.step(0b10, 0.001);  // am Anschlag weiterlaufen
    assert.ok(m.crashes >= 1);
    assert.ok(m.errors.some((e) => /Endlage überfahren/.test(e)));
  });
  it('Logik: zu langes Beladen läuft über', () => {
    const m = new Foerder3Logic();
    m.pos = 1;
    for (let i = 0; i < 7500; i++) m.step(0, 0.001);
    assert.equal(m.overflows, 1);
    assert.ok(m.errors.some((e) => /läuft über/.test(e)));
  });
});

describe('Farbrührwerk', () => {
  it('füllt, rührt, lässt eine gemischte Charge ab und endet leer', async () => {
    const m = new FarbeLogic();
    await runWithModel('59-farbruehrwerk.asm', m, 36, (t) => m.input('s1', within(t, 0.2, 0.5)));
    assert.equal(m.good, 1);
    assert.equal(m.bad, 0);
    assert.equal(m.overflows, 0);
    assert.equal(m.dryStir, 0);
    assert.ok(m.peakLevel >= 0.9 && m.peakLevel < 0.97, `Pegel ${m.peakLevel}`);
    assert.ok(m.level < 0.01 && !m.v1 && m.pump.speed < 0.05 && m.stir.speed < 0.05);
    assert.equal(m.status, '');
  });
  it('Motorschutz F2 beim Rühren: Rührwerk aus, H1 an; nach Rücksetzen und Quittieren wieder bereit', async () => {
    const m = new FarbeLogic();
    let h1At14 = false, stirAt14 = 1, statusAt14 = '';
    await runWithModel('59-farbruehrwerk.asm', m, 20, (t) => {
      m.input('s1', within(t, 0.2, 0.5));
      m.input('f2', within(t, 12, 15));
      m.input('s2', within(t, 16, 16.3));
      if (t > 14 && t < 14.01) { h1At14 = m.h1; stirAt14 = m.stir.speed; statusAt14 = m.status; }
    });
    assert.ok(h1At14);
    assert.ok(stirAt14 < 0.05);
    assert.match(statusAt14, /Motorschutz F2/);
    assert.ok(!m.h1, 'Störung quittiert');
    assert.equal(m.good + m.bad, 0, 'keine Charge abgelassen');
    assert.ok(m.level > 0.85, 'Farbe steht noch im Behälter');
  });
  it('Handbetrieb: Pumpe nur im Tipp-Betrieb, stoppt bei voll', async () => {
    const m = new FarbeLogic();
    await runWithModel('59-farbruehrwerk.asm', m, 20, (t) => { m.input('s5', true); m.input('s1', t > 1); });
    assert.ok(m.level >= 0.9 && m.level < 1);
    assert.equal(m.overflows, 0);
    assert.ok(m.pump.speed < 0.05);
  });
  it('Logik: Ablassen ohne Rühren ergibt eine schlechte Charge; Rührwerk ohne Farbe läuft trocken', () => {
    const m = new FarbeLogic();
    m.level = 0.8;
    for (let i = 0; i < 100; i++) m.step(0b100, 0.001);
    assert.equal(m.bad, 1);
    assert.match(m.status, /ungemischt/);
    const d = new FarbeLogic();
    for (let i = 0; i < 3000; i++) d.step(0b010, 0.001);
    assert.ok(d.dryStir >= 1);
  });
  it('Logik: Dauerlauf der Pumpe lässt den Behälter überlaufen', () => {
    const m = new FarbeLogic();
    for (let i = 0; i < 13000; i++) m.step(0b001, 0.001);
    assert.ok(m.overflows > 0);
    assert.match(m.status, /läuft über/);
  });
});
