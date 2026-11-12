/**
 * Prozess-Modell nach Handbuch (reine Logik, kein DOM): Mischen zweier Flüssigkeiten.
 *
 * Ansteuerung über einen Demultiplexer DX, Abfrage der Sensoren über einen Multiplexer MUX (alles an einem Port):
 *   D0–D2 = Adresse des Demultiplexers (G0–G2), D3 = EN (Freigabe, 1 = freigegeben)
 *   D4–D6 = Adresse des Multiplexers, D7 = Ausgang des Multiplexers (Eingang des Ports)
 * Demultiplexer: Ausgang Y[adresse] = EN, alle anderen Ausgänge 0.
 *   Y0 Ventil 0 (Zulauf Flüssigkeit 1 in Behälter links), Y1 Ventil 1 (Zulauf Flüssigkeit 2 in Behälter rechts),
 *   Y2 Ventil 2 (Behälter links → Mischbehälter), Y3 Ventil 3 (Behälter rechts → Mischbehälter),
 *   Y4 Rührmotor, Y5 Ventil 5 (Ablauf Mischbehälter); Y6/Y7 unbelegt.
 * Multiplexer: Eingang X[adresse] → D7:
 *   X0 = Sensor A (links unten), X1 = B (links oben), X2 = C (rechts unten), X3 = D (rechts oben),
 *   X4 = E (Mischbehälter unten), X5 = F (Mischbehälter oben); X6/X7 unbelegt (0).
 *
 * Da ein Demultiplexer nur einen Ausgang gleichzeitig aktiv hat, mehrere Aktoren aber gleichzeitig laufen
 * sollen, werden die Ausgänge im Zeitmultiplex bedient; Ventile und Motor haben dafür eine Trägheit (`hold`).
 */
import { bit, clamp, type PortLogic } from './b1-common.ts';

export const SENSOR_NAMES = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export class ProzessLogic implements PortLogic {
  readonly capacity = 100; // l je Behälter
  readonly flow = 10; // l/s je offenem Ventil
  readonly low = 10; // l: untere Sensoren A, C, E
  readonly high = 70; // l: obere Sensoren B, D, F
  /** Nachlaufzeit der Aktoren in s (Trägheit von Ventil bzw. Motor) */
  readonly hold = 0.02;
  /** Restzeit je Ausgang des Demultiplexers (0–7), > 0 = Aktor aktiv */
  readonly timers = new Array<number>(8).fill(0);
  /** Füllstand links (Flüssigkeit 1), rechts (Flüssigkeit 2) */
  left = 0;
  right = 0;
  /** Mischbehälter: Anteile der Flüssigkeiten */
  mix1 = 0;
  mix2 = 0;
  /** Durchmischung 0 = geschichtet, 1 = homogen */
  mixing = 1;
  /** Insgesamt übergelaufene Menge in l */
  spilled = 0;
  /** Adresse und Freigabe des Demultiplexers (zuletzt gesehen) */
  addr = 0;
  en = false;
  /** Zeigt, welche Ausgänge Y0–Y7 des Demultiplexers aktuell High sind */
  get y() { return this.en ? 1 << this.addr : 0; }
  active(i: number) { return this.timers[i]! > 0; }
  get mixLevel() { return this.mix1 + this.mix2; }
  sensors(): boolean[] {
    const m = this.mixLevel;
    return [this.left >= this.low, this.left >= this.high, this.right >= this.low, this.right >= this.high, m >= this.low, m >= this.high];
  }
  setPins([p = 0xff]: readonly number[]) {
    this.addr = p & 7;
    this.en = bit(p, 3);
    if (this.en) this.timers[this.addr] = this.hold;
  }
  /** D7 = gewählter Multiplexer-Eingang (Adresse aus D4–D6 des Port-Latches); alle anderen Bits werden nicht gezogen */
  drive(_i: number, latch = 0xff) {
    const sel = (latch >> 4) & 7;
    const v = this.sensors()[sel] ?? false;
    return v ? 0xff : 0x7f;
  }
  step(dt: number) {
    const on = (i: number) => this.timers[i]! > 0;
    const space = (cur: number) => this.capacity - cur;
    if (on(0)) { const a = Math.min(this.flow * dt, space(this.left)); this.left += a; this.spilled += this.flow * dt - a; }
    if (on(1)) { const a = Math.min(this.flow * dt, space(this.right)); this.right += a; this.spilled += this.flow * dt - a; }
    const before = this.mixLevel;
    if (on(2)) { const a = Math.min(this.flow * dt, this.left, space(this.mixLevel)); this.left -= a; this.mix1 += a; }
    if (on(3)) { const a = Math.min(this.flow * dt, this.right, space(this.mixLevel)); this.right -= a; this.mix2 += a; }
    const added = this.mixLevel - before;
    if (added > 0) this.mixing *= before / (before + added);
    if (on(5) && this.mixLevel > 0) {
      const out = Math.min(this.mixLevel, this.flow * dt);
      const f = (this.mixLevel - out) / this.mixLevel;
      this.mix1 *= f; this.mix2 *= f;
    }
    if (on(4) && this.mix1 > 0 && this.mix2 > 0) this.mixing = clamp(this.mixing + 0.4 * dt, 0, 1);
    if (this.mixLevel < 1e-6) { this.mix1 = this.mix2 = 0; this.mixing = 1; }
    for (let i = 0; i < 8; i++) this.timers[i] = Math.max(0, this.timers[i]! - dt);
  }
}
