import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadExample } from './helpers.ts';
import { Ticker, type PortLogic } from '../src/io/lib/b1-common.ts';
import { Aufzug1Logic, Aufzug2Logic, motorDir } from '../src/io/lib/lift.logic.ts';
import { GarageLogic } from '../src/io/lib/garage.logic.ts';
import { ParkhausLogic } from '../src/io/lib/parkhaus.logic.ts';
import { TankLogic } from '../src/io/lib/tank.logic.ts';
import { ProzessLogic } from '../src/io/lib/prozess.logic.ts';
import { CodelinealLogic, fromGray, toGray } from '../src/io/lib/codelineal.logic.ts';
import { PlotterLogic, SIZE } from '../src/io/lib/plotter.logic.ts';

/** Koppelt eine Logik an Port `port` (bei `p3` zusätzlich P3 als letzter Pin-Array-Eintrag) und lässt das Programm laufen. */
async function run(asm: string, logic: PortLogic, port: number, seconds: number, onTick?: (t: number) => void, p3 = false) {
  const cpu = await loadExample(asm);
  cpu.portInput = (p) => (p === port ? logic.drive(0, cpu.latch(port)) : p === 3 && p3 && logic.driveP3 ? logic.driveP3() : 0xff);
  const ticker = new Ticker();
  while (cpu.cycles < seconds * 1e6) {
    const t = cpu.step();
    if ('kind' in t) assert.fail('ungültiger Befehl');
    const now = ticker.advance(t.cycles);
    logic.setPins(p3 ? [cpu.pin(port), cpu.pin(3)] : [cpu.pin(port)], now);
    if (ticker.flush((dt) => logic.step(dt))) onTick?.(now);
  }
  return cpu;
}
/** Logik ohne Programm vorwärts rechnen */
const advance = (l: PortLogic, seconds: number, dt = 0.001) => { for (let t = 0; t < seconds; t += dt) l.step(dt); };

describe('Motor-Anschlüsse', () => {
  it('10 = aufwärts, 01 = abwärts, 00 und 11 = aus', () => {
    assert.equal(motorDir(true, false), 1);
    assert.equal(motorDir(false, true), -1);
    assert.equal(motorDir(false, false), 0);
    assert.equal(motorDir(true, true), 0);
  });
});

describe('Aufzug-1', () => {
  it('Motor D0/D1, Sensoren D2 (unten) und D3 (oben), Tasten D4 (up) und D5 (dn) – alle Eingänge high-aktiv', () => {
    const l = new Aufzug1Logic();
    assert.equal(l.drive() & 0x3c, 0x04, 'unten: nur D2 frei (1)');
    l.keyUp = true; l.keyDown = true;
    assert.equal(l.drive() & 0x3c, 0x34);
    assert.equal(l.drive() & 0xc3, 0xc3, 'Ausgangsbits und D6/D7 werden nicht gezogen');
    l.setPins([0x01]);
    advance(l, 2.5);
    assert.ok(Math.abs(l.pos - 0.5) < 0.01);
    assert.equal(l.drive() & 0x0c, 0x00, 'zwischen den Sensoren beide 0');
    advance(l, 3);
    assert.equal(l.pos, 1);
    assert.equal(l.drive() & 0x0c, 0x08, 'oben: D3');
    l.setPins([0x02]); // abwärts
    advance(l, 6);
    assert.equal(l.pos, 0);
    l.setPins([0x03]); // beide 1: aus
    advance(l, 5);
    assert.equal(l.pos, 0);
  });
  it('Beispiel: up fährt zum oberen Sensor, dn zum unteren; Motor aus am Anschlag', async () => {
    const l = new Aufzug1Logic();
    const marks: number[] = [];
    await run('61-aufzug1.asm', l, 1, 16, (t) => {
      l.keyUp = t > 1 && t < 1.2;
      l.keyDown = t > 9 && t < 9.2;
      if ((t >= 8 && marks.length === 0) || (t >= 15.5 && marks.length === 1)) marks.push(l.pos);
    });
    assert.ok(marks[0]! > 0.96, `oben angekommen ${marks[0]}`);
    assert.ok(marks[1]! < 0.04, `unten angekommen ${marks[1]}`);
    assert.ok(l.dir === 0);
  });
});

describe('Aufzug-2', () => {
  it('Lampen D0–D2, Motor D3/D4, Istwertgeber D5–D7 für A (oben), B, C (unten)', () => {
    const l = new Aufzug2Logic();
    assert.equal(l.floor, 2, 'startet in C');
    assert.equal(l.drive() & 0xe0, 0x80);
    l.setPins([0b00001_101]); // Lampen A und C an, D3 = 1 (aufwärts)
    assert.deepEqual([...l.lamps], [true, false, true]);
    assert.equal(l.dir, 1);
    advance(l, 2);
    assert.equal(l.floor, 1);
    assert.equal(l.drive() & 0xe0, 0x40);
    advance(l, 2);
    assert.equal(l.floor, 0);
    assert.equal(l.drive() & 0xe0, 0x20);
    advance(l, 5); // gegen den Anschlag
    assert.equal(l.pos, 2);
    l.setPins([0b00010_000]); // D4 = 1: abwärts
    advance(l, 1);
    assert.equal(l.floor, undefined);
    assert.equal(l.drive() & 0xe0, 0);
    l.setPins([0b00011_000]); // beide: Motor aus
    const p = l.pos;
    advance(l, 1);
    assert.equal(l.pos, p);
  });
  it('Beispiel: A, B, C reihum mit Meldelampe am Stockwerk', async () => {
    const l = new Aufzug2Logic();
    const stops: string[] = [];
    await run('62-aufzug2.asm', l, 1, 30, () => {
      const f = l.floor;
      if (f !== undefined && l.dir === 0) {
        const tag = `${'ABC'[f]}${l.lamps[f] ? '*' : ''}`;
        if (stops[stops.length - 1] !== tag) stops.push(tag);
      }
    });
    assert.deepEqual(stops.slice(0, 6), ['C*', 'B*', 'A*', 'B*', 'C*', 'B*']);
  });
});

describe('Garage', () => {
  it('Fernbedienung D0, Endschalter D1 (unten) / D2 (oben), Motor D3/D4; Fahrzeit 5 s', () => {
    const g = new GarageLogic();
    assert.equal(g.drive() & 0x07, 0x02, 'zu: nur D1');
    g.key = true;
    assert.equal(g.drive() & 0x07, 0x03);
    g.setPins([0x08]); // D3 = 1 → hoch
    advance(g, 2.5);
    assert.ok(Math.abs(g.door - 0.5) < 0.01);
    assert.equal(g.drive() & 0x06, 0);
    advance(g, 3);
    assert.equal(g.door, 1);
    assert.equal(g.drive() & 0x06, 0x04);
    g.setPins([0x10]); // runter
    advance(g, 5.1);
    assert.equal(g.door, 0);
    g.setPins([0x18]); // beide: aus
    g.door = 0.5;
    advance(g, 1);
    assert.equal(g.door, 0.5);
  });
  it('Warnton nur beim Überfahren eines Endschalters', () => {
    const g = new GarageLogic();
    g.setPins([0x08]);
    advance(g, 4.85);
    assert.ok(g.endTop && !g.beep, 'Endschalter gerade erreicht');
    advance(g, 0.2);
    assert.ok(g.beep, 'Motor läuft über den Endschalter');
    g.setPins([0x00]);
    advance(g, 0.01);
    assert.ok(!g.beep);
    g.setPins([0x10]);
    advance(g, 5.3);
    assert.equal(g.door, 0);
    assert.ok(g.beep, 'unten überfahren');
    g.setPins([0x08]);
    advance(g, 0.01);
    assert.ok(!g.beep);
  });
  it('Beispiel: ein Tastendruck öffnet, der nächste schließt, ein Druck während der Fahrt hält an', async () => {
    const g = new GarageLogic();
    let beeped = false, topDoor = 0, stopped = -1;
    await run('63-garage.asm', g, 1, 32, (t) => {
      g.key = (t > 1 && t < 1.2) || (t > 8 && t < 8.2) || (t > 16 && t < 16.2) || (t > 18 && t < 18.2) || (t > 20 && t < 20.2);
      if (g.beep) beeped = true;
      if (Math.abs(t - 7) < 0.001) topDoor = g.door;
      if (Math.abs(t - 17.9) < 0.001) stopped = g.door;
    });
    assert.ok(topDoor > 0.96, `offen ${topDoor}`);
    assert.ok(!beeped, 'kein Überfahren');
    // t = 16: Schließen gestartet (8 → Tor zu bei 13), 16: öffnen, 18: halten, 20: wieder öffnen (mitten → öffnen)
    assert.ok(stopped > 0.2 && stopped < 0.8, String(stopped));
    assert.ok(g.endTop);
  });
});

describe('Parkhaus', () => {
  it('D0–D4 freie Plätze, D5/D6 Schranken, D7 Ampel; Tasten ziehen INT0/INT1 (P3.2/P3.3) auf Low', () => {
    const p = new ParkhausLogic();
    p.setPins([0x9f, 0xff]);
    assert.equal(p.free, 31);
    assert.ok(p.green && !p.entryOpen && !p.exitOpen);
    p.setPins([0x60 | 17, 0xff]);
    assert.equal(p.free, 17);
    assert.ok(p.entryOpen && p.exitOpen && !p.green);
    assert.equal(p.driveP3(), 0xff);
    p.keyIn = true;
    assert.equal(p.driveP3(), 0xfb);
    p.keyOut = true;
    assert.equal(p.driveP3(), 0xf3);
    p.keyIn = false;
    assert.equal(p.driveP3(), 0xf7);
    assert.equal(p.drive(), 0xff, 'P1 wird nicht gezogen');
  });
  it('Schranken öffnen und schließen in 0,5 s', () => {
    const p = new ParkhausLogic();
    p.setPins([0x20, 0xff]);
    advance(p, 0.25);
    assert.ok(Math.abs(p.entryBar - 0.5) < 0.01);
    assert.equal(p.exitBar, 0);
    advance(p, 0.5);
    assert.equal(p.entryBar, 1);
    p.setPins([0x00, 0xff]);
    advance(p, 1);
    assert.equal(p.entryBar, 0);
  });
  it('Beispiel: INT0/INT1 zählen die Plätze, Schranke und Ampel folgen', async () => {
    const p = new ParkhausLogic();
    const sample: Record<string, number> = {};
    let barrierSeen = false, exitSeen = false, redWhenFull = false;
    await run('64-parkhaus.asm', p, 1, 20, (t) => {
      const slot = Math.floor(t * 10);
      // 4 Einfahrten (t = 1…), dann 1 Ausfahrt
      p.keyIn = [10, 20, 30, 40].some((s) => slot >= s && slot < s + 2);
      p.keyOut = slot >= 90 && slot < 92;
      if (p.entryOpen) barrierSeen = true;
      if (p.exitOpen) exitSeen = true;
      if (Math.abs(t - 0.5) < 0.001) sample.start = p.free;
      if (Math.abs(t - 8) < 0.001) sample.afterIn = p.free;
      if (Math.abs(t - 15) < 0.001) sample.afterOut = p.free;
      if (p.free === 0 && !p.green) redWhenFull = true;
    }, true);
    assert.equal(sample.start, 31);
    assert.equal(sample.afterIn, 27);
    assert.equal(sample.afterOut, 28);
    assert.ok(barrierSeen && exitSeen);
    assert.ok(!redWhenFull);
  });
  it('Beispiel: bei vollem Haus bleibt die Schranke zu, Ampel rot; leeres Haus zählt nicht weiter', async () => {
    const p = new ParkhausLogic();
    let redAtFull = false, entryWhenFull = false, free = 31;
    await run('64-parkhaus.asm', p, 1, 40, (t) => {
      // 33 Einfahrten im 1-s-Takt (2 mehr als Plätze), danach 3 Ausfahrten, dann Taste bei leerem Haus
      const sec = Math.floor(t);
      const frac = t - sec;
      p.keyIn = sec >= 1 && sec <= 33 && frac < 0.05;
      free = p.free;
      if (sec >= 33 && sec < 34 && p.free === 0 && !p.green) redAtFull = true;
      if (sec >= 33 && p.free === 0 && p.entryOpen && frac > 0.5) entryWhenFull = true;
    }, true);
    assert.ok(redAtFull);
    assert.ok(!entryWhenFull);
    assert.ok(free === 0, String(free));
  });
});

describe('Behälter', () => {
  it('Füllen, Sensoren und Ablassen (D2–D4 high-aktiv)', () => {
    const t = new TankLogic();
    assert.equal(t.drive() & 0x1c, 0x00);
    t.setPins([0x01]);
    advance(t, 1.6); // 16 l
    assert.equal(t.drive() & 0x1c, 0x04);
    advance(t, 3.5); // 51 l
    assert.equal(t.drive() & 0x1c, 0x0c);
    advance(t, 3.5); // 86 l
    assert.equal(t.drive() & 0x1c, 0x1c);
    assert.equal(t.drive() & 0xe3, 0xe3, 'andere Bits werden nicht gezogen');
    t.setPins([0x02]);
    advance(t, 5); // 86-50 = 36
    assert.ok(Math.abs(t.level - 36) < 0.1, String(t.level));
    assert.equal(t.drive() & 0x1c, 0x04, 'nur A');
  });
  it('beide Ventile: Pegel bleibt; läuft nie über 100 l und nie unter 0', () => {
    const t = new TankLogic(40);
    t.setPins([0x03]);
    advance(t, 3);
    assert.ok(Math.abs(t.level - 40) < 0.1);
    t.setPins([0x01]);
    advance(t, 20);
    assert.equal(t.level, 100);
    t.setPins([0x02]);
    advance(t, 20);
    assert.equal(t.level, 0);
  });
  it('Beispiel hält den Pegel zwischen A und C', async () => {
    const t = new TankLogic();
    let min = 100, max = 0;
    await run('65-behaelter.asm', t, 1, 60, (s) => {
      max = Math.max(max, t.level);
      if (s > 20) min = Math.min(min, t.level);
    });
    assert.ok(max >= 85 && max < 88, String(max));
    assert.ok(min <= 15 && min > 12, String(min));
  });
});

describe('Prozess', () => {
  const addr = (a: number, en = true) => (en ? 0x08 : 0) | a | 0x80;
  it('Demultiplexer: nur der adressierte Ausgang wird mit EN aktiv, Trägheit 20 ms', () => {
    const p = new ProzessLogic();
    p.setPins([addr(2)]);
    assert.equal(p.y, 1 << 2);
    p.step(0.001);
    assert.ok(p.active(2) && !p.active(0) && !p.active(1));
    p.setPins([addr(2, false)]);
    assert.equal(p.y, 0);
    advance(p, 0.03);
    assert.ok(!p.active(2));
  });
  it('Multiplexer: D7 liefert den adressierten Sensor, Adresse aus D4–D6 des Latches', () => {
    const p = new ProzessLogic();
    p.left = 80; p.right = 30; p.mix1 = 5; // A, B, C nass; D nicht; E nicht
    const read = (a: number) => (p.drive(0, 0x80 | (a << 4)) & 0x80) !== 0;
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(read), [true, true, true, false, false, false, false, false]);
    p.mix1 = 15; p.mix2 = 60; // E (≥ 10) und F (≥ 70) nass
    assert.deepEqual([4, 5].map(read), [true, true]);
    assert.equal(p.drive(0, 0xff) & 0x7f, 0x7f, 'nur D7 wird gezogen');
  });
  it('Füllen, Umfüllen, Rühren, Ablassen', () => {
    const p = new ProzessLogic();
    const pulse = (a: number, s: number) => { for (let t = 0; t < s; t += 0.001) { p.setPins([addr(a)]); p.step(0.001); } };
    pulse(0, 5); pulse(1, 3);
    assert.ok(Math.abs(p.left - 50) < 0.5 && Math.abs(p.right - 30) < 0.5);
    pulse(2, 3); pulse(3, 3);
    assert.ok(Math.abs(p.mix1 - 30) < 0.5 && Math.abs(p.mix2 - 30) < 0.5);
    assert.ok(p.mixing < 0.5, `geschichtet ${p.mixing}`);
    pulse(4, 3);
    assert.equal(p.mixing, 1);
    pulse(5, 7);
    assert.ok(p.mixLevel < 1);
    assert.equal(p.spilled, 0);
  });
  it('Läuft ein Behälter über, geht der Überschuss verloren', () => {
    const p = new ProzessLogic();
    for (let t = 0; t < 12; t += 0.001) { p.setPins([addr(0)]); p.step(0.001); }
    assert.equal(p.left, 100);
    assert.ok(p.spilled > 15);
  });
  it('Beispiel: Ansatz mit Mehrfach-Ansteuerung über den Demultiplexer', async () => {
    const p = new ProzessLogic();
    const ev: string[] = [];
    let maxMix = 0, rest: number | undefined;
    await run('66-prozess.asm', p, 1, 45, () => {
      maxMix = Math.max(maxMix, p.mixLevel);
      if (p.active(4) && ev[ev.length - 1] !== 'rühren') ev.push('rühren');
      if (p.active(5) && ev[ev.length - 1] !== 'ablassen') ev.push('ablassen');
      if (ev.length === 2 && !p.active(5) && p.mixLevel < 0.01 && rest === undefined) rest = p.mixing;
    });
    assert.deepEqual(ev.slice(0, 2), ['rühren', 'ablassen']);
    assert.ok(maxMix >= 70 && maxMix <= 78, String(maxMix));
    assert.equal(p.spilled, 0);
  });
});

describe('Codelineal', () => {
  it('Gray-Code: aufeinanderfolgende Felder unterscheiden sich in genau einem Bit', () => {
    for (let n = 0; n < 15; n++) {
      const x = toGray(n) ^ toGray(n + 1);
      assert.ok(x !== 0 && (x & (x - 1)) === 0, `${n}`);
      assert.equal(fromGray(toGray(n)), n);
    }
  });
  it('ideal: an jeder Position der richtige Code auf D0–D3 (Gray und Dual)', () => {
    const c = new CodelinealLogic();
    for (const gray of [true, false]) {
      c.gray = gray;
      for (let n = 0; n < 16; n++) {
        c.setPos(n + 0.5);
        assert.equal(c.decoded, n);
        assert.equal(c.code, gray ? toGray(n) : n);
        assert.equal(c.drive(), 0xf0 | c.code, 'D4–D7 nicht gezogen');
      }
    }
  });
  it('real: Dual liefert Abtastfehler an den Feldgrenzen, Gray höchstens den Nachbarn', () => {
    const c = new CodelinealLogic();
    c.real = true;
    let dualMax = 0, grayMax = 0;
    for (let p = 0; p < 16; p += 0.01) {
      c.setPos(p);
      c.gray = false; dualMax = Math.max(dualMax, Math.abs(c.decoded - c.cell));
      c.gray = true; grayMax = Math.max(grayMax, Math.abs(c.decoded - c.cell));
    }
    assert.ok(dualMax >= 4, `dual ${dualMax}`);
    assert.equal(grayMax, 1);
    // Mitten in einem Feld ist auch „real“ fehlerfrei
    c.gray = false; c.setPos(5.5);
    assert.equal(c.decoded, 5);
    // Genau an der Grenze 7|8 (0111 → 1000) liest der schräge Schlitten Mischwerte
    c.setPos(7.95);
    assert.notEqual(c.decoded, 7);
    assert.notEqual(c.decoded, 8);
  });
  it('Motor D4 = 1/D5 = 0 → rechts, D4 = 0/D5 = 1 → links, gleiche Pegel Halt', () => {
    const c = new CodelinealLogic();
    c.setPos(8);
    c.setPins([0x10]);
    advance(c, 1);
    assert.ok(Math.abs(c.pos - 10.5) < 0.01);
    c.setPins([0x20]);
    advance(c, 2);
    assert.ok(Math.abs(c.pos - 5.5) < 0.01);
    for (const v of [0x00, 0x30]) { c.setPins([v]); const p = c.pos; advance(c, 1); assert.equal(c.pos, p); }
    c.setPins([0x10]);
    advance(c, 20);
    assert.ok(c.pos > 15.99 && c.pos < 16);
    c.setPins([0x20]);
    advance(c, 20);
    assert.equal(c.pos, 0);
  });
  it('Beispiel fährt die Zielpositionen 12, 3, 15, 0 an', async () => {
    const c = new CodelinealLogic();
    const stops: number[] = [];
    let wasMoving = true;
    await run('67-codelineal.asm', c, 1, 30, () => {
      const moving = c.m4 !== c.m5;
      if (wasMoving && !moving) stops.push(c.cell);
      wasMoving = moving;
    });
    assert.deepEqual(stops.slice(0, 4), [12, 3, 15, 0]);
  });
  it('Beispiel mit Dual-Lineal und realer Abtastung stoppt an falschen Stellen', async () => {
    const c = new CodelinealLogic();
    c.gray = false; c.real = true;
    const stops: number[] = [];
    let wasMoving = true;
    await run('67-codelineal.asm', c, 1, 12, () => {
      const moving = c.m4 !== c.m5;
      if (wasMoving && !moving) stops.push(c.cell);
      wasMoving = moving;
    });
    // Das Programm wandelt Gray → Binär, auf dem Dual-Lineal ist das Ergebnis falsch
    assert.notDeepEqual(stops.slice(0, 2), [12, 3]);
  });
});

describe('Plotter', () => {
  /** Ein Schritt als Impuls: Bits setzen, zurücknehmen */
  const pulse = (p: PlotterLogic, bits: number, base = 0) => { p.setPins([base | bits]); p.setPins([base]); };
  it('Schritt bei steigender Flanke, nicht bei Pegel', () => {
    const p = new PlotterLogic();
    p.setPins([0x00]);
    p.setPins([0x01]); p.setPins([0x01]); p.setPins([0x01]);
    assert.equal(p.x, 1, 'nur eine Flanke');
    p.setPins([0x00]);
    pulse(p, 0x04);
    assert.equal(p.y, 1);
    pulse(p, 0x02);
    assert.equal(p.x, 0);
    pulse(p, 0x08);
    assert.equal(p.y, 0);
    p.setPins([0x05]); // x+1 und y+1 gleichzeitig
    assert.deepEqual([p.x, p.y], [1, 1]);
    p.setPins([0x00]);
    p.setPins([0x03]); // x+1 und x-1 heben sich auf
    assert.equal(p.x, 1);
  });
  it('Stift unten zeichnet Pixel, oben nicht; Farben 00 schwarz, 10 rot, 01 blau, 11 grün', () => {
    const p = new PlotterLogic();
    p.setPins([0x00]);
    pulse(p, 0x01);
    assert.equal(p.grid.some((v) => v), false);
    const base = (c: number) => 0x10 | (c << 5);
    const at = (x: number, y: number) => p.grid[y * SIZE + x];
    p.setPins([base(0)]); // Stift senken: Pixel an der aktuellen Position (1,0), schwarz
    assert.equal(at(1, 0), 1);
    pulse(p, 0x04, base(1)); // rot, y+1
    assert.equal(at(1, 1), 2);
    pulse(p, 0x01, base(2)); // D5 = 0, D6 = 1: blau
    assert.equal(p.color, 2);
    assert.equal(at(2, 1), 3);
    pulse(p, 0x01, base(3)); // grün
    assert.equal(at(3, 1), 4);
    assert.equal(p.color, 3);
    p.setPins([0x00]); // Stift hoch
    pulse(p, 0x01);
    assert.equal(at(4, 1), 0);
    // D5 = 1, D6 = 0 → rot, D5 = 0, D6 = 1 → blau
    p.setPins([0x20]); assert.equal(p.color, 1);
    p.setPins([0x40]); assert.equal(p.color, 2);
    p.setPins([0x60]); assert.equal(p.color, 3);
  });
  it('Reset D7: Position 0,0, Fläche und Warnlampe gelöscht', () => {
    const p = new PlotterLogic();
    p.setPins([0x00]);
    pulse(p, 0x01, 0x10);
    pulse(p, 0x04, 0x10);
    assert.ok(p.grid.some((v) => v));
    pulse(p, 0x02, 0x10); pulse(p, 0x02, 0x10); // x = -1: außerhalb
    assert.ok(p.warning);
    p.setPins([0x80]);
    assert.deepEqual([p.x, p.y], [0, 0]);
    assert.ok(!p.warning);
    assert.ok(!p.grid.some((v) => v));
    p.setPins([0x00]);
    assert.ok(!p.warning);
  });
  it('Verlassen der 80×80-Fläche schaltet die Warnlampe ein (bis Reset); dort wird nicht gezeichnet', () => {
    const p = new PlotterLogic();
    p.setPins([0x00]);
    for (let i = 0; i < 79; i++) pulse(p, 0x01, 0x10);
    assert.equal(p.x, 79);
    assert.ok(!p.warning);
    pulse(p, 0x01, 0x10);
    assert.equal(p.x, 80);
    assert.ok(p.warning);
    assert.equal(p.grid.filter(Boolean).length, 79, 'Pixel 1…79 gezeichnet, Pixel x = 80 nicht');
    pulse(p, 0x02, 0x10); // zurück in die Fläche: Lampe bleibt an
    assert.ok(p.warning);
    p.setPins([0x80]);
    assert.ok(!p.warning);
    pulse(p, 0x02);
    assert.ok(p.warning, 'x = -1');
    assert.equal(p.drive(), 0xff);
  });
  it('Beispiel: schwarzes Quadrat, rote und blaue Diagonale, grünes Quadrat', async () => {
    const p = new PlotterLogic();
    await run('68-plotter.asm', p, 1, 3, undefined);
    assert.ok(!p.warning);
    assert.equal(p.penDown, false);
    const at = (x: number, y: number) => p.grid[y * SIZE + x]!;
    // Quadrat (10,10)–(70,70) schwarz
    for (let i = 10; i <= 70; i++) {
      assert.equal(at(i, 10) !== 0, true, `unten ${i}`);
      assert.equal(at(10, i) !== 0, true, `links ${i}`);
    }
    assert.equal(at(40, 10), 1);
    assert.equal(at(70, 40), 1);
    assert.equal(at(40, 70), 1);
    // Diagonalen: rot (10,10)→(70,70), blau (70,10)→(10,70)
    assert.equal(at(40, 40) === 2 || at(40, 40) === 3, true);
    assert.equal(at(25, 25), 2);
    assert.equal(at(60, 60), 2);
    assert.equal(at(65, 15), 3);
    assert.equal(at(20, 60), 3);
    // grünes Quadrat (30,30)–(50,50)
    assert.equal(at(40, 30), 4);
    assert.equal(at(30, 40), 4);
    assert.equal(at(50, 40), 4);
    assert.equal(at(40, 50), 4);
    assert.equal(at(5, 5), 0);
    assert.deepEqual([p.x, p.y], [30, 30]);
  });
});
