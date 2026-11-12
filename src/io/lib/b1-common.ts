/** Gemeinsame, DOM-freie Bausteine der Bauteilebibliothek (Erweiterung 1). */

/** Schnittstelle einer Port-Logik: Pins rein, Pegel raus, Physik pro Zeitschritt. */
export interface PortLogic {
  /** Aktuelle Pinpegel der angeschlossenen Ports (Index 0 = Port A, 1 = Port B) und simulierte Zeit in s */
  setPins(pins: readonly number[], t?: number): void;
  /** Externer Pegel für Port i (0xFF = zieht nichts nach Masse); `latch` = aktuelles Port-Latch */
  drive(i: number, latch?: number): number;
  /** Nur Geräte mit P3-Anschluss: Pegel, den das Gerät an P3 anlegt (INT0/INT1 auf Low ziehen) */
  driveP3?(): number;
  /** Physik: dt Sekunden simulierte Zeit */
  step(dt: number): void;
}

/** Wandelt Zyklen (12 MHz → 1 µs) in Physik-Zeitschritte von höchstens `maxStep` Sekunden. */
export class Ticker {
  now = 0;
  #acc = 0;
  readonly stepUs: number;
  readonly maxStep: number;
  constructor(stepUs = 1000, maxStep = 0.01) { this.stepUs = stepUs; this.maxStep = maxStep; }
  /** Zeit fortschreiben; liefert die simulierte Zeit in Sekunden */
  advance(cycles: number): number {
    this.now += cycles * 1e-6;
    this.#acc += cycles * 1e-6;
    return this.now;
  }
  /** Ruft `fn(dt)` auf, sobald mindestens `stepUs` Mikrosekunden angelaufen sind */
  flush(fn: (dt: number) => void): boolean {
    if (this.#acc * 1e6 < this.stepUs) return false;
    let rest = this.#acc;
    this.#acc = 0;
    while (rest > 1e-12) { const dt = Math.min(rest, this.maxStep); fn(dt); rest -= dt; }
    return true;
  }
}

export const bit = (v: number, i: number) => ((v >> i) & 1) === 1;
/** Pegelbyte: Bit i = 0, wenn `active`, sonst 1 */
export const lowIf = (...flags: [bit: number, active: boolean][]) => {
  let v = 0xff;
  for (const [b, a] of flags) if (a) v &= ~(1 << b);
  return v & 0xff;
};
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Bewegt `v` mit Rate `rate` (Einheiten/s) in Richtung `dir` (-1/0/1), begrenzt auf [lo, hi]. */
export function move(v: number, dir: number, rate: number, dt: number, lo: number, hi: number): { v: number; blocked: boolean } {
  const n = v + dir * rate * dt;
  if (n > hi && dir > 0) return { v: hi, blocked: true };
  if (n < lo && dir < 0) return { v: lo, blocked: true };
  return { v: n, blocked: false };
}

/**
 * Eingangs-Pegelbyte eines Geräts mit high-aktiven Meldern: Das Gerät zieht jedes angegebene Bit nach
 * Masse, solange es NICHT aktiv ist (aktiv = 1, Port-Bit muss vorher auf 1 geschrieben sein).
 */
export const highIf = (...flags: [bit: number, active: boolean][]) => {
  let v = 0xff;
  for (const [b, a] of flags) if (!a) v &= ~(1 << b);
  return v & 0xff;
};
