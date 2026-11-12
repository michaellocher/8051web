import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadExample } from './helpers.ts';
import type { Cpu8051 } from '../src/core/cpu.ts';
import { HEX7, SevenSegment, SwitchBank, decodeSegments } from '../src/io/lib/basic.logic.ts';
import { HEX_KEYS, HexKeypad, MATRIX_LABELS, MatrixKeypad, hexKeyFromPc } from '../src/io/lib/keypad.logic.ts';
import { Hd44780 } from '../src/io/lib/lcd.logic.ts';
import { GrayActuator, GraySensor, STEP_DEG, fromGray, toGray } from '../src/io/lib/gray.logic.ts';
import { ColorKeys } from '../src/io/lib/color.logic.ts';
import {
  Icm7212, MUX_BIT_OF_SEG, NSOW_NAMES16, muxLit, muxMask, nsowChars, nsowCode, nsowLeft, nsowMiddle, nsowRight,
} from '../src/io/lib/display1.logic.ts';
import { INPUT_DISPLAY_DEVICES } from '../src/io/lib/group-input.ts';

interface Io {
  /** externer Pegel eines Ports (0xFF = zieht nicht) */
  drive?: (port: number, latch: number) => number;
  /** nach jedem Befehl: Zyklen seit dem letzten Aufruf */
  sample?: (cpu: Cpu8051, cycles: number) => void;
  write?: (port: number, value: number) => void;
  /** wird etwa alle ms simulierter Zeit aufgerufen (t in Sekunden) */
  tick?: (t: number, cpu: Cpu8051) => void;
}

/** Programm `seconds` simulierte Sekunden laufen lassen (1 µs je Zyklus) */
async function run(asm: string, seconds: number, io: Io = {}, cpuIn?: Cpu8051) {
  const cpu = cpuIn ?? await loadExample(asm);
  cpu.portInput = (p) => io.drive?.(p, cpu.latch(p)) ?? 0xff;
  cpu.onPortWrite = (p, v) => io.write?.(p, v);
  let acc = 0;
  while (cpu.cycles < seconds * 1e6) {
    const t = cpu.step();
    if ('kind' in t) assert.fail('ungültiger Befehl');
    io.sample?.(cpu, t.cycles);
    acc += t.cycles;
    if (acc >= 1000) { acc = 0; io.tick?.(cpu.cycles / 1e6, cpu); }
  }
  return cpu;
}

describe('Geräteregistrierung (Gruppen Schalter/Tasten und LED/Anzeigen)', () => {
  it('enthält alle Geräte mit eindeutigen IDs und unveränderten Kennungen', () => {
    const ids = INPUT_DISPLAY_DEVICES.map((d) => d.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ['switches', 'swled', 'hexkeys', 'matrix', 'farbtasten', 'graysensor', 'leds', '7seg', 'bcd7seg', '2x7mux', '2x7bcd', 'icm7212', 'nsow', 'lcd', 'grayakt']) {
      const d = INPUT_DISPLAY_DEVICES.find((x) => x.id === id);
      assert.ok(d, id);
      assert.equal(d.ports, 1);
      assert.ok(d.desc.length > 30, `${id}: Beschreibung`);
    }
    assert.equal(INPUT_DISPLAY_DEVICES.find((d) => d.id === '2x7mux')!.usesP3, true);
  });
});

describe('Schalter, Schalter+LEDs, LEDs', () => {
  it('SwitchBank: Schalter ziehen nur nach Masse, nicht belegte Bits bleiben 1', () => {
    const b = new SwitchBank(0x0f);
    assert.equal(b.pins(), 0xff);
    b.toggle(2);
    assert.equal(b.pins(), 0xfb);
    b.set(6, false); // kein Schalter → ignoriert
    assert.equal(b.pins(), 0xfb);
    b.toggle(2);
    assert.equal(b.pins(), 0xff);
  });
  it('01-Lauflicht, 05-Timer-Interrupt und 09-ext-RAM geben an P1 aus', async () => {
    const seen = new Set<number>();
    await run('01-lauflicht.asm', 1.5, { write: (p, v) => { if (p === 1) seen.add(v); } });
    for (let i = 0; i < 8; i++) assert.ok(seen.has(1 << i), `LED ${i}`);
    const cpu = await run('05-timer-interrupt.asm', 2.6);
    assert.equal(cpu.latch(1), 5); // alle 0,5 s +1
    const squares = new Set<number>();
    await run('09-ext-ram.asm', 9, { write: (p, v) => { if (p === 1) squares.add(v); } });
    for (let i = 0; i < 16; i++) assert.ok(squares.has((i * i) & 0xff), `${i}²`);
  });
  it('02-Zähler (Modell-Rechner) zählt mit S0 = 0 aufwärts und mit S2 = 0 auf Null zurück', async () => {
    const sw = new SwitchBank(0xe0);
    sw.set(5, false); // S0 = P0.5 = 0 → aufwärts
    const values: number[] = [];
    const cpu = await loadExample('02-zaehler.asm');
    await run('', 1.3, {
      drive: (p) => (p === 0 ? sw.pins() : 0xff),
      write: (p, v) => { if (p === 0) values.push(v & 0x0f); },
    }, cpu);
    assert.ok(values.includes(3), 'zählt bis mindestens 3');
    sw.set(5, true); sw.set(7, false); // S2 = 0 → löschen
    await run('', cpu.cycles / 1e6 + 0.6, { drive: (p) => (p === 0 ? sw.pins() : 0xff) }, cpu);
    assert.equal(cpu.latch(0) & 0x0f, 0);
  });
});

describe('7-Segment-Anzeigen', () => {
  it('7seg: aktiver Pegel umschaltbar, Voreinstellung 0 aktiv, D0–D6 = a–g, D7 = DP', () => {
    const s = new SevenSegment();
    assert.equal(s.activeLevel, 0);
    assert.equal(s.lit(0xff), 0x00);
    assert.equal(s.lit(0xfe), 0x01); // D0 = 0 → a leuchtet
    assert.equal(s.lit(0x7f), 0x80); // D7 = 0 → DP
    s.toggleLevel();
    assert.equal(s.lit(0x06), 0x06);
  });
  it('Dekoder: 0–9 als Ziffern, 10–15 als A–F', () => {
    assert.equal(decodeSegments(0), 0x3f);
    assert.equal(decodeSegments(8), 0x7f);
    assert.equal(decodeSegments(0x1b), HEX7[0x0b]); // nur 4 Bit
    assert.equal(decodeSegments(15), 0x71);
  });
});

describe('HEX-Tastatur', () => {
  it('hat 22 Tasten mit Codes 00h–15h', () => {
    assert.equal(HEX_KEYS.length, 22);
    assert.deepEqual(HEX_KEYS.map((k) => k.code).sort((a, b) => a - b), Array.from({ length: 22 }, (_, i) => i));
    const by = (l: string) => HEX_KEYS.find((k) => k.label === l)!.code;
    assert.deepEqual(['/', '*', '-', '+', 'C', '='].map((l) => HEX_KEYS.find((k) => k.label === l && k.code >= 0x10)!.code), [0x10, 0x11, 0x12, 0x13, 0x14, 0x15]);
    assert.equal(by('F'), 0x0f);
  });
  it('speichert die Taste, nur eine zugleich, FFh ohne Taste', () => {
    const p = new HexKeypad();
    assert.equal(p.drive(), 0xff);
    p.press(0x0a);
    assert.equal(p.drive(), 0x0a);
    p.press(0x13); // ersetzt die vorige
    assert.equal(p.drive(), 0x13);
    p.press(0x13); // erneut betätigt → gelöst
    assert.equal(p.drive(), 0xff);
    assert.equal(hexKeyFromPc('b'), 0x0b);
    assert.equal(hexKeyFromPc('+'), 0x13);
    assert.equal(hexKeyFromPc('x'), undefined);
  });
  it('07-Hextastatur zeigt die Taste auf der 7-Segment-Anzeige (0 aktiv)', async () => {
    const pad = new HexKeypad();
    const cpu = await loadExample('07-hextastatur.asm');
    const io: Io = { drive: (p) => (p === 1 ? pad.drive() : 0xff) };
    await run('', 0.01, io, cpu);
    assert.equal(cpu.latch(2), 0xbf); // Strich
    pad.press(0x0a);
    await run('', 0.02, io, cpu);
    assert.equal(cpu.latch(2), ~0x77 & 0xff);
    pad.press(0x00);
    await run('', 0.03, io, cpu);
    assert.equal(cpu.latch(2), ~0x3f & 0xff);
    pad.press(0x14); // C-Taste → Strich
    await run('', 0.04, io, cpu);
    assert.equal(cpu.latch(2), 0xbf);
  });
});

describe('Matrix-Tastatur', () => {
  it('Spalten werden nur bei auf 0 getriebener Zeile gezogen (Y1–Y4 = D3–D6)', () => {
    const m = new MatrixKeypad();
    assert.equal(m.drive(0x00), 0xff);
    m.toggle(1, 2); // Taste 6: Zeile Y2, Spalte X3
    assert.equal(m.drive(0xff), 0xff);
    assert.equal(m.drive(0xf7), 0xff); // Y1 = 0
    assert.equal(m.drive(0xef), 0xfb); // Y2 = D4 = 0 → X3 = D2 = 0
    assert.equal(m.drive(0x00), 0xfb);
    m.toggle(3, 0); // *
    assert.equal(m.drive(0xbf), 0xfe); // Y4 = D6 = 0
    m.toggle(1, 2); // erneut betätigt → gelöst
    assert.equal(m.drive(0xef), 0xff);
    assert.equal(MATRIX_LABELS.flat().join(''), '123456789*0#');
  });
  it('7N-Matrix findet die Tasten durch zyklisches Abfragen', async () => {
    const m = new MatrixKeypad();
    const cpu = await loadExample('7N-matrix.asm');
    const io: Io = { drive: (p, latch) => (p === 1 ? m.drive(latch) : 0xff) };
    await run('', 0.01, io, cpu);
    assert.equal(cpu.latch(0), 0);
    const expect: [number, number, number][] = [[0, 0, 1], [1, 1, 5], [2, 2, 9], [3, 0, 0x0a], [3, 1, 0], [3, 2, 0x0b], [0, 2, 3]];
    let t = 0.01;
    for (const [r, c, v] of expect) {
      m.toggle(r, c);
      t += 0.01;
      await run('', t, io, cpu);
      assert.equal(cpu.latch(0), v, `Taste ${MATRIX_LABELS[r]![c]}`);
      m.toggle(r, c);
    }
  });
});

describe('LCD HD44780 (4-Bit)', () => {
  const nib = (l: Hd44780, rs: number, n: number) => { l.write((rs << 7) | 0x40 | n); l.write((rs << 7) | n); };
  const byte = (l: Hd44780, rs: number, b: number) => { nib(l, rs, b >> 4); nib(l, rs, b & 15); };
  const init = (l: Hd44780) => { nib(l, 0, 3); nib(l, 0, 3); nib(l, 0, 3); nib(l, 0, 2); byte(l, 0, 0x28); byte(l, 0, 0x0c); byte(l, 0, 0x06); byte(l, 0, 0x01); };
  it('übernimmt Befehle und Daten mit fallender Flanke an E', () => {
    const l = new Hd44780();
    init(l);
    assert.equal(l.fourBit, true);
    assert.equal(l.displayOn, true);
    for (const ch of 'ABC') byte(l, 1, ch.charCodeAt(0));
    byte(l, 0, 0xc0);
    for (const ch of 'xyz') byte(l, 1, ch.charCodeAt(0));
    assert.equal(l.text(0), 'ABC             ');
    assert.equal(l.text(1), 'xyz             ');
    // Pegel E = 1 allein übernimmt nichts
    l.write(0x40 | 0x04);
    assert.equal(l.text(0), 'ABC             ');
  });
  it('Lesen liefert Busy = 0 und den Adresszähler', () => {
    const l = new Hd44780();
    init(l);
    byte(l, 0, 0x80 | 0x45);
    const latch = 0x10 | 0x40 | 0x0f; // R/W = 1, E = 1, Datenleitungen als Eingang
    assert.equal(l.drive(latch), 0xf0 | 0x04);
    l.write(latch); // E steigt …
    l.write(0x10 | 0x0f); // … und fällt: nächstes Nibble
    l.write(latch);
    assert.equal(l.drive(latch), 0xf0 | 0x05);
    assert.equal(l.drive(0x0f), 0xff, 'ohne R/W und E zieht das LCD nichts');
  });
  it('eigene Zeichen (CGRAM) werden nicht unterstützt: Daten werden verworfen', () => {
    const l = new Hd44780();
    init(l);
    byte(l, 0, 0x40); // CGRAM-Adresse
    for (let i = 0; i < 8; i++) byte(l, 1, 0x1f);
    assert.equal(l.text(0).trim(), '');
    byte(l, 0, 0x80);
    byte(l, 1, 0x41);
    assert.equal(l.text(0).charAt(0), 'A');
  });
  it('06-LCD schreibt beide Zeilen', async () => {
    const l = new Hd44780();
    await run('06-lcd.asm', 0.4, { drive: (p, latch) => (p === 2 ? l.drive(latch) : 0xff), write: (p, v) => { if (p === 2) l.write(v); } });
    assert.equal(l.text(0), 'Hallo 8051!     ');
    assert.equal(l.text(1), 'Web-Edition 2027');
  });
});

describe('GRAY-Code, GRAY-Geber und GRAY-Aktor', () => {
  it('Gray-Code ist ein Einschrittcode und umkehrbar', () => {
    for (let n = 0; n < 16; n++) {
      assert.equal(fromGray(toGray(n)), n);
      const d = toGray(n) ^ toGray((n + 1) % 16);
      assert.ok(d !== 0 && (d & (d - 1)) === 0, `Schritt ${n}→${n + 1} ändert genau ein Bit`);
    }
    assert.deepEqual([0, 1, 2, 3, 4, 8, 15].map(toGray), [0, 1, 3, 2, 6, 12, 8]);
  });
  it('Geber: Position 3 entspricht 11110010b, D4–D7 sind 1, Rädchen/Einrasten', () => {
    const s = new GraySensor();
    assert.equal(s.pins(), 0xf0);
    s.setAngle(3 * STEP_DEG + 5);
    assert.equal(s.position, 3);
    assert.equal(s.pins(), 0b11110010);
    s.rotate(1);
    assert.equal(s.position, 4);
    assert.equal(s.angle, 4 * STEP_DEG);
    s.setAngle(-1);
    assert.equal(s.position, 0);
    s.rotate(-1);
    assert.equal(s.position, 15);
    assert.equal(s.pins() & 0x0f, 8);
  });
  it('7N-GRAY-Sensor: Gray-Code auf P0, Hex-Ziffer (0 aktiv) auf P2', async () => {
    const s = new GraySensor();
    const cpu = await loadExample('7N-graysensor.asm');
    const io: Io = { drive: (p) => (p === 1 ? s.pins() : 0xff) };
    let t = 0;
    for (let pos = 0; pos < 16; pos++) {
      s.setAngle(pos * STEP_DEG);
      t += 0.01;
      await run('', t, io, cpu);
      assert.equal(cpu.latch(0), toGray(pos), `Gray an P0 (Pos ${pos})`);
      assert.equal(cpu.latch(2), ~HEX7[pos]! & 0xff, `Anzeige (Pos ${pos})`);
    }
  });
  it('Aktor: Rechts-/Linkslauf, Stopp bei 00 und 11, simulierte Zeit aus Zyklen', () => {
    const a = new GrayActuator();
    a.advance(0x1f, 1_000_000); // D4 = 1, D5 = 0 → rechts, 1 s
    assert.equal(a.angle, 90);
    assert.equal(a.position, 4);
    assert.equal(a.inputs(), 0xf0 | toGray(4));
    a.advance(0x0f, 1_000_000); // 00 → aus
    assert.equal(a.angle, 90);
    a.advance(0x3f, 1_000_000); // 11 → aus
    assert.equal(a.angle, 90);
    a.advance(0x2f, 500_000); // D4 = 0, D5 = 1 → links, 0,5 s
    assert.equal(a.angle, 45);
    a.advance(0x2f, 1_000_000);
    assert.equal(a.angle, 315);
    assert.equal(a.position, 14);
  });
  it('7N-GRAY-Aktor fährt alle Stellungen nacheinander an', async () => {
    const a = new GrayActuator();
    const stops: number[] = [];
    await run('7N-grayakt.asm', 10, {
      drive: (p) => (p === 1 ? a.inputs() : 0xff),
      sample: (cpu, c) => a.advance(cpu.pin(1), c),
      write: (p, v) => { if (p === 1 && v === 0xcf) stops.push(a.position); },
    });
    assert.deepEqual(stops.slice(1, 17), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]);
  });
});

describe('Farben-Tasten', () => {
  it('Lampen D0 rot, D1 grün, D2 gelb, D3 blau; Tasten D4 rot, D5 grün, D6 gelb, D7 blau (0 = gedrückt)', () => {
    const k = new ColorKeys();
    assert.equal(k.inputs(), 0xff);
    k.press(0, true);
    assert.equal(k.inputs(), 0xef);
    k.press(1, true);
    assert.equal(k.inputs(), 0xcf);
    k.press(2, true); k.press(3, true);
    assert.equal(k.inputs(), 0x0f);
    k.press(0, false);
    assert.equal(k.inputs(), 0x1f);
    k.setPins(0xa5);
    assert.equal(k.lamps, 5);
  });

  it('Simon: Folge wird wiederholt und wächst; Falscheingabe lässt alle Lampen blinken', async () => {
    const k = new ColorKeys();
    interface Pulse { t: number; lamp: number }
    let pulses: Pulse[] = [];
    let lastLamp = 0, lastChange = 0, mode: 'show' | 'input' = 'show';
    let queue: { t: number; key: number; down: boolean }[] = [];
    const rounds: number[][] = [];
    let wrong = false, allBlink = 0, wrongKey = -1;
    const cpu = await loadExample('7N-farbtasten.asm');
    // Start: Taste rot für 0,3 s
    queue.push({ t: 0.05, key: 0, down: true }, { t: 0.35, key: 0, down: false });
    const log: string[] = [];
    await run('', 80, {
      drive: (p) => (p === 1 ? k.inputs() : 0xff),
      sample: (c) => { void c; },
      tick: (t, c) => {
        const p1 = c.latch(1) & 0x0f;
        if (p1 !== lastLamp) {
          if (p1 === 0x0f) allBlink++;
          else if (p1 !== 0 && (p1 & (p1 - 1)) === 0 && k.keys === 0) pulses.push({ t, lamp: Math.log2(p1) });
          lastLamp = p1; lastChange = t;
        }
        // Eingabephase beginnt, wenn 0,6 s lang keine Lampe mehr leuchtet
        if (mode === 'show' && pulses.length > 0 && p1 === 0 && t - lastChange > 0.6 && queue.length === 0) {
          const seq = pulses.map((x) => x.lamp);
          rounds.push(seq);
          pulses = [];
          mode = 'input';
          let tt = t + 0.1;
          seq.forEach((key, i) => {
            const kk = wrong && i === seq.length - 1 ? (key + 1) % 4 : key;
            if (wrong && i === seq.length - 1) wrongKey = kk;
            queue.push({ t: tt, key: kk, down: true }, { t: tt + 0.15, key: kk, down: false });
            tt += 0.5;
          });
        }
        for (const e of queue) if (!('done' in e) && t >= e.t) { k.press(e.key, e.down); (e as { done?: boolean }).done = true; }
        if (queue.length > 0 && queue.every((e) => 'done' in e)) { queue = []; if (mode === 'input') mode = 'show'; }
        if (rounds.length === 5 && !wrong) wrong = true;
        log.length = 0;
      },
    }, cpu);
    assert.ok(rounds.length >= 6, `Runden: ${rounds.length}`);
    for (let i = 1; i < 5; i++) {
      assert.equal(rounds[i]!.length, i + 1, `Runde ${i + 1} hat ${i + 1} Farben`);
      assert.deepEqual(rounds[i]!.slice(0, i), rounds[i - 1], `Runde ${i + 1} wiederholt die Folge`);
    }
    for (const r of rounds) for (const c of r) assert.ok(c >= 0 && c < 4);
    assert.ok(wrongKey >= 0, 'Falscheingabe wurde gesendet');
    assert.ok(allBlink > 0, 'alle Lampen blinken nach einem Fehler');
  });
});

describe('2×7-Segment mit Decoder', () => {
  it('rechte Ziffer D0–D3, linke D4–D7 (Dekoder wie 7-Segment+Decoder)', () => {
    const dev = INPUT_DISPLAY_DEVICES.find((d) => d.id === '2x7bcd')!;
    assert.match(dev.desc, /D0–D3.*rechte/);
    assert.equal(decodeSegments(0x42 & 0x0f), HEX7[2]);
    assert.equal(decodeSegments(0x42 >> 4), HEX7[4]);
  });
});

describe('2×7-Segment-MUX', () => {
  it('Segmentzuordnung D0 = DP, D1 = c, D2 = d, D3 = e, D4 = b, D5 = a, D6 = f, D7 = g', () => {
    // Segmentindex a..g, dp → Datenbit
    assert.deepEqual([...MUX_BIT_OF_SEG], [5, 4, 1, 2, 3, 6, 7, 0]);
    assert.equal(muxMask(0x20, 0x40, 1), 0x01); // D5 = a, rechte Ziffer an (P3.6)
    assert.equal(muxMask(0x01, 0x40, 1), 0x80); // D0 = DP
    assert.equal(muxMask(0x80, 0x40, 1), 0x40); // D7 = g
  });
  it('P3.7 aktiviert die linke, P3.6 die rechte Ziffer; ohne Freigabe dunkel', () => {
    assert.equal(muxLit(0xff, 0x80, 0, 0), true);
    assert.equal(muxLit(0xff, 0x80, 1, 0), false);
    assert.equal(muxLit(0xff, 0x40, 1, 0), true);
    assert.equal(muxLit(0xff, 0x40, 0, 0), false);
    assert.equal(muxLit(0xff, 0xc0, 0, 3), true);
    assert.equal(muxMask(0xff, 0x3f, 0), 0);
  });
  it('7N-2x7mux zählt 00–99 im Multiplex', async () => {
    const decode = (mask: number) => HEX7.findIndex((v) => v === (mask & 0x7f));
    let left = -1, right = -1;
    const at: Record<number, string> = {};
    let both = 0;
    await run('7N-2x7mux.asm', 2.3, {
      sample: (cpu) => {
        const data = cpu.pin(1), p3 = cpu.pin(3);
        if (((p3 >> 7) & 1) && ((p3 >> 6) & 1)) both++;
        if ((p3 >> 7) & 1) left = decode(muxMask(data, p3, 0));
        if ((p3 >> 6) & 1) right = decode(muxMask(data, p3, 1));
        const sec = Math.floor(cpu.cycles / 1e5);
        at[sec] = `${left}${right}`;
      },
    });
    assert.equal(both, 0, 'nie beide Ziffern zugleich');
    assert.equal(at[1], '00');
    assert.equal(at[5], '02'); // 0,2 s je Zählschritt
    assert.equal(at[15], '07');
    assert.equal(at[21], '10');
  });
});

describe('ICM7212', () => {
  it('Ziffernwahl D4 Einer, D5 Zehner, D6 Hunderter, D7 Tausender, 1111 alle, 0000 keine Änderung', () => {
    const c = new Icm7212();
    assert.deepEqual(c.data, [15, 15, 15, 15]);
    assert.equal(c.write(0x13), false);
    assert.deepEqual(c.data, [3, 15, 15, 15]);
    c.write(0x25);
    assert.deepEqual(c.data, [3, 5, 15, 15]);
    c.write(0x47);
    c.write(0x89);
    assert.deepEqual(c.data, [3, 5, 7, 9]);
    c.write(0x01); // keine Stelle gewählt
    assert.deepEqual(c.data, [3, 5, 7, 9]);
    c.write(0xf0);
    assert.deepEqual(c.data, [0, 0, 0, 0]);
    c.write(0xf8);
    assert.deepEqual(c.data, [8, 8, 8, 8]);
  });
  it('ungültige Daten (über 9) werden gemeldet', () => {
    const c = new Icm7212();
    assert.equal(c.write(0x1a), true);
    assert.equal(c.write(0x1f), true);
    assert.equal(c.write(0x09), false); // keine Stelle gewählt → keine Aktion
    assert.equal(c.write(0x19), false);
    assert.equal(c.invalid, 2);
    assert.equal(c.segments(0), HEX7[9]);
  });
  it('7N-ICM7212 zeigt 1234 und zählt danach ohne Warnton', async () => {
    const c = new Icm7212();
    let t1234 = '';
    const cpu = await run('7N-icm7212.asm', 4, {
      write: (p, v) => { if (p === 1) c.write(v); },
      tick: (t) => { if (t > 1.9 && t < 2.0) t1234 = [...c.data].reverse().join(''); },
    });
    assert.equal(t1234, '1234');
    assert.equal(c.invalid, 0);
    const n = c.data[3]! * 1000 + c.data[2]! * 100 + c.data[1]! * 10 + c.data[0]!;
    assert.ok(n > 10 && n < 25, `Zähler ${n}`);
    void cpu;
  });
});

describe('NSOW-Display', () => {
  it('mittleres Zeichen D0–D2, linkes D3–D5, rechtes D6–D7', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(nsowMiddle), ['', 'N', 'S', 'O', 'W', '', '', '']);
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map((v) => nsowLeft(v << 3)), ['', 'N', 'S', 'O', 'W', '', '', '']);
    assert.deepEqual([0, 1, 2, 3].map((v) => nsowRight(v << 6)), ['', 'O', 'W', '']);
    assert.deepEqual(nsowChars(0), ['', '', '']);
    assert.deepEqual(nsowChars(0x49), ['N', 'N', 'O']);
    assert.deepEqual(nsowChars(0xa2), ['W', 'S', 'W']);
  });
  it('alle 16 Himmelsrichtungen sind darstellbar', () => {
    const texts = NSOW_NAMES16.map((n) => nsowChars(nsowCode(n)).join(''));
    assert.deepEqual(texts, [...NSOW_NAMES16]);
    assert.equal(new Set(NSOW_NAMES16.map(nsowCode)).size, 16);
  });
  it('7N-NSOW läuft durch alle Richtungen', async () => {
    const seen: string[] = [];
    await run('7N-nsow.asm', 8.3, { write: (p, v) => { if (p === 1) seen.push(nsowChars(v).join('')); } });
    assert.deepEqual(seen.slice(0, 17), [...NSOW_NAMES16, 'N']);
  });
});
