/**
 * Externe Modelle (Anlagen aus der Steuerungstechnik) – reine Logik ohne DOM, in Node testbar.
 *
 * Anschluss wie im Original: Port A (P0) → Ausgänge Ax.0–Ax.7 zu den Aktoren,
 * Port B (P1) ← Eingänge Ex.0–Ex.7 von Sensoren und Tastern.
 * Konvention: Ax-Bit = 1 → Aktor an. Ex-Bit = 1 → Sensor/Taster betätigt
 * (bei Öffnern wie NOT-AUS steht das in der Beschreibung des Modells).
 */

export interface ModelLogic {
  /** aktuelle Eingänge Ex.0–7 */
  readonly ex: number;
  /** Simulationsschritt; ax = Ausgänge Ax.0–7, dt in Sekunden (simulierte Zeit) */
  step(ax: number, dt: number): void;
  reset(): void;
  /** Bedienung von außen (Taster, Werkstück einlegen …): Name → gedrückt/losgelassen */
  input?(name: string, down: boolean): void;
  /** Statusmeldung für die Fußleiste des Modellfensters (z. B. Störung) */
  readonly status?: string;
}

export const bit = (v: number, i: number) => ((v >> i) & 1) === 1;
export const setBit = (v: number, i: number, on: boolean) => (on ? v | (1 << i) : v & ~(1 << i));
/** Baut ein Ex-Byte aus Booleschen Werten (Index = Bitnummer) */
export const pack = (bits: readonly boolean[]) => bits.reduce((v, b, i) => (b ? v | (1 << i) : v), 0);
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Pneumatikzylinder: Position 0 (eingefahren) … 1 (ausgefahren) */
export class Cylinder {
  pos = 0;
  /** Hub pro Sekunde */
  readonly speed: number;
  constructor(speed = 0.8) { this.speed = speed; }
  /** dir: +1 ausfahren, −1 einfahren, 0 halten */
  move(dir: number, dt: number) { this.pos = clamp01(this.pos + dir * this.speed * dt); }
  get retracted() { return this.pos <= 0.02; }
  get extended() { return this.pos >= 0.98; }
}

/**
 * Impulsventil (5/2-Wege, zwei Magnetspulen): Die zuletzt bestromte Spule bestimmt die Richtung,
 * sind beide aus, bleibt die Stellung erhalten. Beide an → keine Umschaltung.
 */
export class MemoryValve {
  dir: -1 | 1 = -1;
  update(extendCoil: boolean, retractCoil: boolean) {
    if (extendCoil && !retractCoil) this.dir = 1;
    else if (retractCoil && !extendCoil) this.dir = -1;
    return this.dir;
  }
}

/** Monostabiles Ventil mit Federrückstellung: Spule an → ausfahren, aus → einfahren */
export const springValve = (coil: boolean): -1 | 1 => (coil ? 1 : -1);

/** Motor mit Hochlauf: Drehzahl 0..1 folgt dem Sollwert mit Zeitkonstante tau */
export class Motor {
  speed = 0;
  angle = 0;
  readonly tau: number;
  constructor(tau = 0.3) { this.tau = tau; }
  step(on: boolean, dt: number, dir = 1) {
    const target = on ? 1 : 0;
    this.speed += (target - this.speed) * Math.min(1, dt / this.tau);
    this.angle = (this.angle + dir * this.speed * dt * 720) % 360;
  }
  get running() { return this.speed > 0.5; }
}

/** Flankenerkennung für Taster/Sensoren */
export class Edge {
  #prev = false;
  rising(v: boolean) { const r = v && !this.#prev; this.#prev = v; return r; }
}

/** Einfacher Füllstand 0..1 */
export class Tank {
  level: number;
  constructor(level = 0) { this.level = level; }
  step(inflow: number, outflow: number, dt: number) { this.level = clamp01(this.level + (inflow - outflow) * dt); }
}
