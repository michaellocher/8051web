/** Parkhaus (31 Plätze) nach Handbuch (reine Logik, kein DOM). */
import { bit, clamp, type PortLogic } from './b1-common.ts';

/**
 * Alle Datenpins sind Ausgänge des Ports: D0–D4 = freie Plätze (binär, 0–31, Dezimalanzeige unter dem P-Schild),
 * D5 Einfahrt-Schranke auf/zu (1 = auf), D6 Ausfahrt-Schranke auf/zu (1 = auf), D7 Ampel grün/rot (1 = grün).
 * Die Einfahrt-Taste (+) zieht INT0 (P3.2), die Ausfahrt-Taste (−) INT1 (P3.3) auf Low, solange sie gedrückt ist.
 */
export class ParkhausLogic implements PortLogic {
  free = 0;
  entryOpen = false;
  exitOpen = false;
  green = false;
  keyIn = false;
  keyOut = false;
  /** Schrankenöffnung 0 = zu, 1 = auf (Animation, 0,5 s Laufzeit) */
  entryBar = 0;
  exitBar = 0;
  readonly barTravel = 0.5;
  setPins([p = 0xff]: readonly number[]) {
    this.free = p & 0x1f;
    this.entryOpen = bit(p, 5); this.exitOpen = bit(p, 6); this.green = bit(p, 7);
  }
  drive() { return 0xff; }
  driveP3() { return 0xff & ~(this.keyIn ? 0x04 : 0) & ~(this.keyOut ? 0x08 : 0); }
  step(dt: number) {
    const d = dt / this.barTravel;
    this.entryBar = clamp(this.entryBar + (this.entryOpen ? d : -d), 0, 1);
    this.exitBar = clamp(this.exitBar + (this.exitOpen ? d : -d), 0, 1);
  }
}
