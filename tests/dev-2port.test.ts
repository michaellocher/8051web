import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadExample } from './helpers.ts';
import type { Cpu8051 } from '../src/core/cpu.ts';
import { SEVEN_SEG } from '../src/io/kit.ts';
import {
  DotMatrix, SEG2_OF_BIT, led16Bit, led16Port, mux4Masks, seg2Byte, seg2Mask,
} from '../src/io/lib/disp2p.logic.ts';
import {
  IC_KEY_BIT, IC_TYPES, IC_VARIANTS, IcTester, gate, type IcType,
} from '../src/io/lib/ictester.logic.ts';
import {
  Keyboard, ToneGenerator, WHOLE_US, decodeTone, encodeTone, noteFreq, noteName,
} from '../src/io/lib/tongeber.logic.ts';
import { Ampel4, lampOn, type LampName } from '../src/io/lib/ampel4.logic.ts';
import { DOOR_TIME, ELEVATOR_TIME, Speiseaufzug } from '../src/io/lib/speiseaufzug.logic.ts';

/** Programm `seconds` simulierte Sekunden laufen lassen; `each` wird nach jedem Befehl mit Zeit (s) und Zyklen aufgerufen. */
function run(cpu: Cpu8051, seconds: number, each?: (t: number, cycles: number) => void) {
  const end = cpu.cycles + seconds * 1e6;
  while (cpu.cycles < end) {
    const r = cpu.step();
    if ('kind' in r) assert.fail('ungültiger Befehl');
    each?.(cpu.cycles / 1e6, r.cycles);
  }
}

describe('16 LEDs', () => {
  it('Zuordnung LED → Port/Bit', () => {
    assert.deepEqual([0, 7, 8, 15].map(led16Port), [0, 0, 1, 1]);
    assert.deepEqual([0, 7, 8, 15].map(led16Bit), [0, 7, 0, 7]);
  });
  it('Beispiel: eine LED wandert über alle 16 Positionen', async () => {
    const cpu = await loadExample('7N-16leds.asm');
    const seen: string[] = [];
    cpu.onPortWrite = () => {
      const s = `${cpu.latch(0).toString(16)}:${cpu.latch(1).toString(16)}`;
      if (seen[seen.length - 1] !== s) seen.push(s);
    };
    run(cpu, 2.2);
    const singles = seen.filter((s) => { const [a, b] = s.split(':').map((x) => parseInt(x, 16)) as [number, number]; return (a === 0 || b === 0) && (a | b) !== 0 && ((a | b) & ((a | b) - 1)) === 0; });
    const uniq = new Set(singles);
    assert.equal(uniq.size, 16);
  });
});

describe('2×7-Segment (direkt)', () => {
  it('Belegung D0 = dp, D1 = c, D2 = d, D3 = e, D4 = b, D5 = a, D6 = f, D7 = g', () => {
    assert.deepEqual([...SEG2_OF_BIT], [7, 2, 3, 4, 1, 0, 5, 6]); // dp, c, d, e, b, a, f, g
    assert.equal(seg2Mask(0x20), 0x01); // D5 = a
    assert.equal(seg2Mask(0x80), 0x40); // D7 = g
    assert.equal(seg2Mask(0x01), 0x80); // D0 = dp
    assert.equal(seg2Byte(0x3f), 0x7e); // Ziffer 0
    for (let v = 0; v < 256; v++) assert.equal(seg2Byte(seg2Mask(v)), v);
  });
  it('Beispiel zählt 00–99 mit der Original-Belegung', async () => {
    const cpu = await loadExample('7N-2x7seg.asm');
    const digitOf = (b: number) => SEVEN_SEG.findIndex((m) => seg2Byte(m) === (b & 0xfe));
    const shown: number[] = [];
    cpu.onPortWrite = (p) => {
      if (p !== 1) return;
      const v = digitOf(cpu.latch(0)) * 10 + digitOf(cpu.latch(1));
      if (shown[shown.length - 1] !== v) shown.push(v);
    };
    run(cpu, 1.7);
    assert.deepEqual(shown.slice(0, 8), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.ok(shown.length >= 6);
  });
});

describe('4×7-Segment (Daten + Select)', () => {
  it('Select low-aktiv: 0 = Stelle an', () => {
    assert.deepEqual(mux4Masks(0xfe, 0x3f), [0x3f, 0, 0, 0]);
    assert.deepEqual(mux4Masks(0xf7, 0x06), [0, 0, 0, 0x06]);
    assert.deepEqual(mux4Masks(0xff, 0xff), [0, 0, 0, 0]);
    assert.deepEqual(mux4Masks(0xf0, 0x01), [1, 1, 1, 1]);
  });
  it('Beispiel: Zähler läuft, jede Stelle zeigt ihre Ziffer', async () => {
    const cpu = await loadExample('7N-4x7mux.asm');
    const last = [0, 0, 0, 0];
    let count = 0;
    run(cpu, 2.0, () => {
      const m = mux4Masks(cpu.pin(0), cpu.pin(1));
      m.forEach((v, i) => { if (v) last[i] = v; });
      count++;
    });
    const digit = (m: number) => SEVEN_SEG.indexOf(m);
    const value = digit(last[3]!) * 1000 + digit(last[2]!) * 100 + digit(last[1]!) * 10 + digit(last[0]!);
    assert.ok(count > 1000);
    assert.ok(value >= 15 && value <= 20, `Anzeige ${value}`);
  });
});

describe('Punktmatrix', () => {
  it('Punkt leuchtet bei Zeile high und Spalte low; Spaltendaten bleiben gespeichert', () => {
    const m = new DotMatrix();
    m.update(0xff, 0x7f); // keine Spalte aktiv
    assert.equal(m.dot(0, 0), false);
    m.update(0xfe, 0x05); // C1 aktiv, R1 und R3
    assert.ok(m.dot(0, 0) && m.dot(0, 2) && !m.dot(0, 1));
    assert.ok(!m.dot(1, 0));
    m.update(0xff, 0x00); // Spalten sperren, Zeilen neu: C1 bleibt stehen
    assert.ok(m.dot(0, 0) && m.dot(0, 2));
    m.update(0xff, 0x7f);
    m.update(0xfd, 0x7f); // C2 aktiv mit allen Zeilen
    assert.equal(m.cols[1], 0x7f);
    assert.equal(m.cols[0], 0x05);
    m.update(0xfe, 0x01); // C1 überschreiben
    assert.equal(m.cols[0], 0x01);
    assert.equal(m.cols[1], 0x7f);
    m.update(0xe0, 0x2a); // Bits 5–7 sind keine Spalten; alle fünf aktiv
    assert.deepEqual(m.cols, [0x2a, 0x2a, 0x2a, 0x2a, 0x2a]);
  });
  it('Beispiel zeigt nacheinander H, leer, A', async () => {
    const cpu = await loadExample('82-punktmatrix.asm');
    const m = new DotMatrix();
    const at = new Map<number, number[]>();
    run(cpu, 1.6, (t) => {
      m.update(cpu.pin(0), cpu.pin(1));
      for (const probe of [0.3, 0.7, 1.3]) if (t >= probe && !at.has(probe)) at.set(probe, [...m.cols]);
    });
    assert.deepEqual(at.get(0.3), [0x7f, 0x08, 0x08, 0x08, 0x7f]); // H
    assert.deepEqual(at.get(0.7), [0, 0, 0, 0, 0]);
    assert.deepEqual(at.get(1.3), [0x7e, 0x11, 0x11, 0x11, 0x7e]); // A
  });
});

describe('Ampel 4', () => {
  const lampsAt = (pins: number[]) => (n: LampName) => lampOn(n, pins);
  it('Belegung wie im Handbuch', () => {
    assert.ok(lampOn('mainR', [0x08, 0]) && !lampOn('mainR', [0x07, 0]));
    assert.ok(lampOn('mainY', [0x10, 0]));
    assert.ok(lampOn('mainG', [0, 0x01]) && lampOn('pmR', [0, 0x02]) && lampOn('pmG', [0, 0x04]));
    assert.ok(lampOn('sideR', [0, 0x08]) && lampOn('sideY', [0, 0x10]) && lampOn('sideG', [0, 0x20]));
    assert.ok(lampOn('psR', [0, 0x40]) && lampOn('psG', [0, 0x80]));
    const a = new Ampel4();
    assert.equal(a.drive(0) & 7, 7);
    a.ruf1 = true; assert.equal(a.drive(0) & 7, 6);
    a.ruf2 = true; assert.equal(a.drive(0) & 7, 4);
    a.day = false; assert.equal(a.drive(0) & 7, 0);
    assert.equal(a.drive(1), 0xff);
  });
  it('Beispiel: Hauptstraße grün, Ruf schaltet auf Nebenstraße, nie beide grün; Nacht blinkt gelb', async () => {
    const cpu = await loadExample('80-kreuzung.asm');
    const amp = new Ampel4();
    cpu.portInput = (p) => (p === 4 ? amp.drive(0) : 0xff);
    let sideGreen = false, conflict = false, mainGreenAtStart = false;
    let nightY = 0, nightOff = 0;
    run(cpu, 30, (t) => {
      const L = lampsAt([cpu.pin(4), cpu.pin(5)]);
      if (t > 0.5 && t < 1) mainGreenAtStart ||= L('mainG') && L('sideR') && L('pmR');
      if (t >= 5 && t < 5.5) amp.ruf1 = true; else amp.ruf1 = false;
      if (L('sideG')) sideGreen = true;
      if (t < 0.001) return; // Reset-Zustand: alle Ports 1
      if (t < 25 && (L('mainG') || L('mainY')) && (L('sideG') || L('sideY'))) conflict = true;
      if (L('pmG') && L('mainG')) conflict = true;
      if (L('psG') && L('sideG')) conflict = true;
      if (t > 25) {
        if (t < 25.1) amp.day = false;
        if (t > 27) { if (L('mainY') && L('sideY') && !L('mainR') && !L('mainG')) nightY++; if (!L('mainY') && !L('sideY')) nightOff++; }
      }
    });
    assert.ok(mainGreenAtStart);
    assert.ok(sideGreen);
    assert.ok(!conflict);
    assert.ok(nightY > 100 && nightOff > 100, `${nightY}/${nightOff}`);
  });
});

describe('Tongeber', () => {
  it('Kodierung der Beispiele des Handbuchs', () => {
    assert.deepEqual(decodeTone(0x31), { note: 1, length: 3, us: 500_000 });
    assert.deepEqual(decodeTone(0x40), { note: 0, length: 4, us: 1_000_000 });
    assert.equal(decodeTone(0x51)?.us, WHOLE_US);
    assert.equal(decodeTone(0x11)?.us, 125_000);
    assert.equal(decodeTone(0x21)?.us, 250_000);
    assert.equal(decodeTone(0x01), undefined); // keine Länge
    assert.equal(decodeTone(0xff), undefined); // Länge 7 ungültig
    assert.equal(decodeTone(0x00), undefined);
    assert.equal(encodeTone(1, 3), 0x31);
    assert.equal(noteName(1), 'C1'); assert.equal(noteName(13), 'C2'); assert.equal(noteName(15), 'D2');
    assert.ok(Math.abs(noteFreq(10) - 440) < 1e-9);
    assert.ok(Math.abs(noteFreq(13) - 2 * noteFreq(1)) < 1e-9);
    assert.ok(Math.abs(noteFreq(1) - 261.63) < 0.01);
  });
  it('Ton dauert die Notenlänge in Simulationszeit', () => {
    const g = new ToneGenerator();
    g.write(0x31);
    assert.ok(g.sounding);
    g.advance(400_000); assert.ok(g.sounding);
    g.advance(100_001); assert.ok(!g.sounding); assert.equal(g.current, undefined);
    g.write(0x40); // Pause
    assert.ok(g.current && !g.sounding);
    g.advance(1_000_000); assert.equal(g.current, undefined);
  });
  it('Folgetöne werden angestellt, Wiederholung desselben Werts während des Tons wird ignoriert', () => {
    const g = new ToneGenerator();
    g.write(0x31); g.write(0x31); g.write(0x31);
    assert.equal(g.serial, 1);
    g.write(0x33);
    g.advance(500_000);
    assert.equal(g.current?.note, 3);
    assert.equal(g.serial, 2);
    g.advance(500_000);
    assert.equal(g.current, undefined);
    g.write(0x31); g.write(0x31); // zwei gleiche Töne nacheinander (zweiter am Ende des ersten) werden beide gespielt
    g.advance(300_000); g.write(0x31); g.advance(250_000);
    assert.equal(g.serial, 4);
  });
  it('Beispiel 83: Alle meine Entchen in richtiger Reihenfolge und Länge', async () => {
    const cpu = await loadExample('83-tongeber.asm');
    const g = new ToneGenerator();
    cpu.onPortWrite = (p, v) => { if (p === 1) g.write(v); };
    const notes: number[] = [];
    const starts: number[] = [];
    let serial = 0;
    run(cpu, 20, (t, c) => {
      g.advance(c);
      if (g.serial !== serial) { serial = g.serial; notes.push(g.current!.note); starts.push(t); }
    });
    assert.deepEqual(notes.slice(0, 22), [1, 3, 5, 6, 8, 8, 10, 10, 10, 10, 8, 6, 6, 6, 6, 5, 5, 3, 3, 3, 3, 1]);
    // C D E F je 0,5 s, G halbe Noten je 1 s
    assert.ok(Math.abs(starts[1]! - starts[0]! - 0.5) < 0.03);
    assert.ok(Math.abs(starts[5]! - starts[4]! - 1.0) < 0.05);
  });
});

describe('Keyboard', () => {
  it('liefert den Tongeber-Code, 00h ohne Taste', () => {
    const k = new Keyboard();
    assert.equal(k.drive(), 0x00);
    k.press(1); assert.equal(k.drive(), 0x31);
    k.press(13); assert.equal(k.drive(), 0x3d);
    k.release(13); assert.equal(k.drive(), 0x31);
    k.release(1); assert.equal(k.drive(), 0x00);
  });
  it('Beispiel 84 gibt den Tastencode an den Tongeber aus', async () => {
    const cpu = await loadExample('84-keyboard.asm');
    const k = new Keyboard();
    cpu.portInput = (p) => (p === 0 ? k.drive() : 0xff);
    run(cpu, 0.01);
    assert.equal(cpu.latch(1), 0x00);
    k.press(8); run(cpu, 0.01);
    assert.equal(cpu.latch(1), 0x38); // G, Viertelnote
    k.release(8); run(cpu, 0.01);
    assert.equal(cpu.latch(1), 0x00);
  });
});

describe('IC-Tester', () => {
  const tt = (t: IcType) => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => gate(t, a!, b!));
  it('Wahrheitstabellen', () => {
    assert.deepEqual(tt('7400'), [1, 1, 1, 0]);
    assert.deepEqual(tt('7408'), [0, 0, 0, 1]);
    assert.deepEqual(tt('7432'), [0, 1, 1, 1]);
    assert.deepEqual(tt('7486'), [0, 1, 1, 0]);
  });
  it('Tasten: NAND = D3, AND = D4, OR = D5, EXOR = D6; gewählte Taste = 0', () => {
    assert.deepEqual(IC_TYPES.map((t) => IC_KEY_BIT[t]), [3, 4, 5, 6]);
    const t = new IcTester();
    assert.equal(t.drivePortB() & 0x78, 0x70);
    t.type = '7408'; assert.equal(t.drivePortB() & 0x78, 0x68);
    t.type = '7432'; assert.equal(t.drivePortB() & 0x78, 0x58);
    t.type = '7486'; assert.equal(t.drivePortB() & 0x78, 0x38);
  });
  it('Start liegt an Port_unten D7 (gedrückt = 0), D0–D2 werden nicht getrieben', () => {
    const t = new IcTester();
    assert.equal(t.drivePortB() & 0x87, 0x87);
    t.start = true;
    assert.equal(t.drivePortB() & 0x87, 0x07);
  });
  it('Ausgänge Y1–Y4 an D2–D5; A, B werden nicht getrieben', () => {
    const t = new IcTester();
    t.type = '7408';
    assert.equal(t.drive(0, 0x03), 0xff); // 1 AND 1 = 1 an allen Gattern
    assert.equal(t.drive(0, 0x01), 0xc3); // 1 AND 0 = 0
    assert.equal(t.drive(0, 0x00) & 0xc3, 0xc3);
  });
  it('Defekte Gatter hängen fest; die Wechsel-Taste schaltet durch alle ICs', () => {
    const t = new IcTester();
    const seen: number[] = [];
    for (let i = 0; i < IC_VARIANTS.length + 1; i++) { seen.push(t.defects.length); t.nextIc(); }
    assert.deepEqual(seen, [0, 1, 1, 2, 3, 4, 0]);
    t.variant = 1; // Gatter 1 hängt auf 0
    t.type = '7400';
    assert.equal(t.outputs(0, 0), 0b1110);
    assert.ok(t.isDefective(0) && !t.isDefective(1));
    t.variant = 2; // Gatter 3 hängt auf 1
    t.type = '7408';
    assert.equal(t.outputs(0, 0), 0b0100);
    assert.equal(t.outputs(1, 1), 0b1111);
  });
  it('Beispiel 7N-ictester erkennt Typ und defekte Gatter', async () => {
    for (const type of IC_TYPES) {
      for (let variant = 0; variant < IC_VARIANTS.length; variant++) {
        const cpu = await loadExample('7N-ictester.asm');
        const t = new IcTester();
        t.type = type; t.variant = variant;
        cpu.portInput = (p) => (p === 0 ? t.drive(0, cpu.latch(0)) : p === 1 ? t.drive(1, cpu.latch(1)) : 0xff);
        run(cpu, 0.01);
        assert.equal(cpu.latch(1) & 0x07, 0, 'vor Start keine Anzeige');
        t.start = true; run(cpu, 0.01); t.start = false; run(cpu, 0.01);
        const bad = new Set(t.defects.map((d) => d.gate));
        const er = [cpu.latch(0) >> 6 & 1, cpu.latch(0) >> 7 & 1, cpu.latch(1) & 1, cpu.latch(1) >> 1 & 1];
        const ok = cpu.latch(1) >> 2 & 1;
        assert.deepEqual(er, [0, 1, 2, 3].map((g) => (bad.has(g) ? 1 : 0)), `${type} Variante ${variant}`);
        assert.equal(ok, bad.size === 0 ? 1 : 0, `${type} Variante ${variant}`);
      }
    }
  });
});

describe('Speiseaufzug', () => {
  it('Aufzugmotor: H = abwärts, I = aufwärts, gleich = Stillstand', () => {
    const s = new Speiseaufzug();
    s.setMotors(0x02); s.step(ELEVATOR_TIME / 2);
    assert.ok(Math.abs(s.pos - 0.5) < 1e-9);
    s.setMotors(0x03); s.step(10); assert.ok(Math.abs(s.pos - 0.5) < 1e-9); // beide = Stillstand
    s.setMotors(0x00); s.step(10); assert.ok(Math.abs(s.pos - 0.5) < 1e-9);
    s.setMotors(0x01); s.step(ELEVATOR_TIME * 2); assert.equal(s.pos, 0);
    s.setMotors(0x02); s.step(ELEVATOR_TIME * 2); assert.equal(s.pos, 1);
  });
  it('Türmotoren: J = schließen, K = öffnen; L/M unten', () => {
    const s = new Speiseaufzug();
    s.setMotors(0x08); s.step(DOOR_TIME / 2); assert.ok(Math.abs(s.doorTop - 0.5) < 1e-9); assert.equal(s.doorBottom, 0);
    s.setMotors(0x0c); s.step(10); assert.ok(Math.abs(s.doorTop - 0.5) < 1e-9); // J = K
    s.setMotors(0x04); s.step(10); assert.equal(s.doorTop, 0);
    s.setMotors(0x20); s.step(DOOR_TIME * 2); assert.equal(s.doorBottom, 1);
    s.setMotors(0x10); s.step(DOOR_TIME * 2); assert.equal(s.doorBottom, 0);
  });
  it('Sensoren A–F an PORT-oben D2–D7 (0 = aktiv), Tasten D0/D1, unten D6/D7', () => {
    const s = new Speiseaufzug();
    // Start: Aufzug unten (F), Türen zu (B, D)
    assert.equal(s.drivePortA(), 0xff & ~(1 << 3) & ~(1 << 5) & ~(1 << 7));
    s.setMotors(0x02 | 0x08 /* I + K? */);
    s.setMotors(0x02 | 0x20); // Aufzug auf, Tür unten auf
    s.step(DOOR_TIME);
    assert.equal(s.drivePortA() & (1 << 4), 0); // C = Tor unten auf
    assert.equal(s.drivePortA() & (1 << 5), 0x20); // D inaktiv
    s.setMotors(0x02); s.step(ELEVATOR_TIME);
    assert.equal(s.drivePortA() & (1 << 6), 0); // E oben
    assert.equal(s.drivePortA() & (1 << 7), 0x80); // F inaktiv
    s.setMotors(0x0a & 0x08); s.step(DOOR_TIME); // Tür oben auf
    assert.equal(s.drivePortA() & (1 << 2), 0); // A
    s.keyTopUp = true; assert.equal(s.drivePortA() & 1, 0);
    s.keyTopDown = true; assert.equal(s.drivePortA() & 2, 0);
    assert.equal(s.drivePortB(), 0xff);
    s.keyBottomUp = true; assert.equal(s.drivePortB(), 0xbf);
    s.keyBottomDown = true; assert.equal(s.drivePortB(), 0x3f);
  });
  it('Lichtschranken ziehen INT0 (P3.2) bzw. INT1 (P3.3) auf Low', () => {
    const s = new Speiseaufzug();
    assert.equal(s.driveP3(), 0xff);
    s.barrierTop = true; assert.equal(s.driveP3(), 0xfb);
    s.barrierBottom = true; assert.equal(s.driveP3(), 0xf3);
    s.barrierTop = false; assert.equal(s.driveP3(), 0xf7);
  });
  it('Beispiel 85: Ruf unten fährt nach oben, Tür öffnet und schließt; Lichtschranke öffnet die Tür erneut; Ruf oben fährt zurück', async () => {
    const cpu = await loadExample('85-speiseaufzug.asm');
    const s = new Speiseaufzug();
    cpu.portInput = (p) => (p === 0 ? s.drivePortA() : p === 1 ? s.drivePortB() : p === 3 ? s.driveP3() : 0xff);
    const tick = (_t: number, c: number) => { s.setMotors(cpu.pin(1)); s.step(c * 1e-6); };
    run(cpu, 3, tick);
    assert.ok(s.elevatorBottom && s.doorTopClosedSensor && s.doorBottomClosedSensor, 'Grundstellung');
    // Ruf aufwärts (unten)
    s.keyBottomUp = true; run(cpu, 0.1, tick); s.keyBottomUp = false;
    let reachedTop = false, topOpen = false;
    run(cpu, 12, (t, c) => { tick(t, c); reachedTop ||= s.elevatorTop; topOpen ||= s.doorTopOpenSensor; });
    assert.ok(reachedTop && topOpen);
    assert.ok(s.doorTopClosedSensor && s.elevatorTop, 'Tür nach 3 s wieder zu');
    assert.ok(s.doorBottomClosedSensor);
    // Zweiter Ruf: Tür oben öffnen, beim Schließen Lichtschranke auslösen
    s.keyTopDown = true; run(cpu, 0.1, tick); s.keyTopDown = false; // Aufzug ist oben: nur nach unten gewünscht → fährt
    let reachedBottom = false, botOpen = false;
    run(cpu, 12, (t, c) => { tick(t, c); reachedBottom ||= s.elevatorBottom; botOpen ||= s.doorBottomOpenSensor; });
    assert.ok(reachedBottom && botOpen);
    // Lichtschranke beim Schließen: erneut nach oben, Tür öffnet; INT0 während Tür oben zugeht
    s.keyBottomUp = true; run(cpu, 0.1, tick); s.keyBottomUp = false;
    let n = 0, reopened = false;
    run(cpu, 14, (t, c) => {
      tick(t, c);
      if (s.doorTopOpenSensor && n === 0) n = 1;
      if (n === 1 && s.doorTop < 0.7 && s.doorTop > 0.3) { s.barrierTop = true; n = 2; } // Tür geht zu: Lichtschranke
      if (n === 2 && s.doorTop > 0.9) { reopened = true; s.barrierTop = false; n = 3; }
    });
    assert.ok(reopened, 'Tür öffnet nach Lichtschranke erneut');
    assert.ok(s.doorTopClosedSensor, 'schließlich ist die Tür wieder zu');
  });
});
