/** Aufzug-1 (Lastenaufzug) und Aufzug-2 (Personenaufzug, 3 Stockwerke) nach Handbuch (reine Logik, kein DOM). */
import { bit, clamp, highIf, type PortLogic } from './b1-common.ts';

/** Motor aus zwei Anschlüssen: 10 = aufwärts, 01 = abwärts, 00/11 = aus. */
export const motorDir = (m1: boolean, m2: boolean): -1 | 0 | 1 => (m1 === m2 ? 0 : m1 ? 1 : -1);

/**
 * Aufzug-1: D0/D1 Motor (10 aufwärts, 01 abwärts), D2 Positionssensor unten, D3 Positionssensor oben,
 * D4 Bedientaste aufwärts, D5 Bedientaste abwärts (Eingänge: 1 = aktiv/gedrückt).
 */
export class Aufzug1Logic implements PortLogic {
  /** 0 = unten, 1 = oben */
  pos = 0;
  /** Fahrzeit über die ganze Strecke in s */
  readonly travel = 5;
  /** Fensterbreite der Positionssensoren */
  readonly window = 0.03;
  m1 = false;
  m2 = false;
  keyUp = false;
  keyDown = false;
  get dir() { return motorDir(this.m1, this.m2); }
  get atBottom() { return this.pos <= this.window; }
  get atTop() { return this.pos >= 1 - this.window; }
  setPins([p = 0xff]: readonly number[]) { this.m1 = bit(p, 0); this.m2 = bit(p, 1); }
  drive() { return highIf([2, this.atBottom], [3, this.atTop], [4, this.keyUp], [5, this.keyDown]); }
  step(dt: number) { this.pos = clamp(this.pos + (this.dir * dt) / this.travel, 0, 1); }
}

/**
 * Aufzug-2: D0–D2 Meldelampen A–C (1 = an), D3/D4 Motor (10 aufwärts, 01 abwärts), D5–D7 Istwertgeber
 * der Stockwerke A (oben), B, C (unten): 1 = Kabine steht am Stockwerk.
 */
export class Aufzug2Logic implements PortLogic {
  /** Kabinenhöhe in Stockwerken: 0 = C (unten), 1 = B, 2 = A (oben) */
  pos = 0;
  /** Sekunden je Stockwerk */
  readonly floorTime = 2;
  readonly window = 0.06;
  readonly lamps = [false, false, false];
  m1 = false;
  m2 = false;
  get dir() { return motorDir(this.m1, this.m2); }
  /** Sensor eines Stockwerks: 0 = A (oben), 1 = B, 2 = C (unten) */
  atFloor(i: number) { return Math.abs(this.pos - (2 - i)) <= this.window; }
  /** Stockwerk A/B/C als Index 0–2, an dem die Kabine steht; sonst undefined */
  get floor(): number | undefined {
    for (let i = 0; i < 3; i++) if (this.atFloor(i)) return i;
    return undefined;
  }
  setPins([p = 0xff]: readonly number[]) {
    this.lamps[0] = bit(p, 0); this.lamps[1] = bit(p, 1); this.lamps[2] = bit(p, 2);
    this.m1 = bit(p, 3); this.m2 = bit(p, 4);
  }
  drive() { return highIf([5, this.atFloor(0)], [6, this.atFloor(1)], [7, this.atFloor(2)]); }
  step(dt: number) { this.pos = clamp(this.pos + (this.dir * dt) / this.floorTime, 0, 2); }
}
