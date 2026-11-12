/** Speiseaufzug (2-Port-Modell): reine Logik, kein DOM. */

/**
 * Anschlüsse (nach der Bildvorlage des Handbuchs):
 * Port oben (Ausgänge des Modells, Eingänge des Programms; 0 = aktiv):
 *   D0 Taste aufwärts oben, D1 Taste abwärts oben, D2 A = Tor oben auf, D3 B = Tor oben zu,
 *   D4 C = Tor unten auf, D5 D = Tor unten zu, D6 E = Aufzug oben, D7 F = Aufzug unten.
 * Port unten (Eingänge des Modells = Ausgänge des Programms):
 *   D0 H = Aufzug abwärts, D1 I = Aufzug aufwärts, D2 J = Tür oben schließen, D3 K = Tür oben öffnen,
 *   D4 L = Tür unten schließen, D5 M = Tür unten öffnen.
 *   D6 Taste aufwärts unten, D7 Taste abwärts unten (Ausgänge des Modells, 0 = gedrückt).
 * Lichtschranken an den Türen lösen INT0 (oben, G) bzw. INT1 (unten, N) aus (P3.2 / P3.3 auf Low).
 */
export const SA_BITS = { A: 2, B: 3, C: 4, D: 5, E: 6, F: 7 } as const;

/** Fahrzeiten in Sekunden für den vollen Weg */
export const ELEVATOR_TIME = 4;
export const DOOR_TIME = 2;

export class Speiseaufzug {
  /** Aufzugposition: 0 = unten, 1 = oben */
  pos = 0;
  /** Türöffnung oben/unten: 0 = zu, 1 = auf */
  doorTop = 0;
  doorBottom = 0;
  /** Lichtschranken (true = unterbrochen): oben (G, INT0), unten (N, INT1) */
  barrierTop = false;
  barrierBottom = false;
  /** Tasten (gedrückt = true) */
  keyTopUp = false;
  keyTopDown = false;
  keyBottomUp = false;
  keyBottomDown = false;
  /** Motoreingänge H…M zuletzt vom Port gelesen (Bit 0 = H … Bit 5 = M) */
  motors = 0;

  setMotors(portB: number) { this.motors = portB & 0x3f; }
  get h() { return (this.motors & 1) === 1; }
  get i() { return (this.motors & 2) === 2; }
  get j() { return (this.motors & 4) === 4; }
  get k() { return (this.motors & 8) === 8; }
  get l() { return (this.motors & 16) === 16; }
  get m() { return (this.motors & 32) === 32; }

  /** Richtung eines Motors aus zwei Eingängen: +1 = a allein, −1 = b allein, 0 = steht */
  static dir(a: boolean, b: boolean): number { return a === b ? 0 : a ? 1 : -1; }

  step(dt: number) {
    // H = abwärts, I = aufwärts
    this.pos = clamp01(this.pos - Speiseaufzug.dir(this.h, this.i) * dt / ELEVATOR_TIME);
    // J = schließen, K = öffnen
    this.doorTop = clamp01(this.doorTop - Speiseaufzug.dir(this.j, this.k) * dt / DOOR_TIME);
    this.doorBottom = clamp01(this.doorBottom - Speiseaufzug.dir(this.l, this.m) * dt / DOOR_TIME);
  }

  get doorTopOpenSensor() { return this.doorTop >= 0.99; }
  get doorTopClosedSensor() { return this.doorTop <= 0.01; }
  get doorBottomOpenSensor() { return this.doorBottom >= 0.99; }
  get doorBottomClosedSensor() { return this.doorBottom <= 0.01; }
  get elevatorTop() { return this.pos >= 0.99; }
  get elevatorBottom() { return this.pos <= 0.01; }

  /** Externer Pegel für Port oben (0 = aktiv) */
  drivePortA(): number {
    let v = 0xff;
    const low = (cond: boolean, bit: number) => { if (cond) v &= ~(1 << bit); };
    low(this.keyTopUp, 0); low(this.keyTopDown, 1);
    low(this.doorTopOpenSensor, SA_BITS.A); low(this.doorTopClosedSensor, SA_BITS.B);
    low(this.doorBottomOpenSensor, SA_BITS.C); low(this.doorBottomClosedSensor, SA_BITS.D);
    low(this.elevatorTop, SA_BITS.E); low(this.elevatorBottom, SA_BITS.F);
    return v;
  }
  /** Externer Pegel für Port unten: nur die Tasten D6/D7 */
  drivePortB(): number {
    let v = 0xff;
    if (this.keyBottomUp) v &= ~0x40;
    if (this.keyBottomDown) v &= ~0x80;
    return v;
  }
  drive(i: number): number { return i === 0 ? this.drivePortA() : this.drivePortB(); }

  /** Pegel an P3: INT0 (P3.2) bzw. INT1 (P3.3) auf Low, solange die Lichtschranke unterbrochen ist */
  driveP3(): number {
    let v = 0xff;
    if (this.barrierTop) v &= ~0x04;
    if (this.barrierBottom) v &= ~0x08;
    return v;
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
