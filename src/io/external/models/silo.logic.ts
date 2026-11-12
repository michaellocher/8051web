/**
 * Siloentleerung (Modellvariante A, ohne Drahtbruchsicherheit): Ein Silo wird über das Ventil V1
 * (von Hand am Modell geöffnet) befüllt und von zwei Pumpen entleert. Drei Füllstandssensoren:
 * S1 (oben, 80 %), S2 (Mitte, 50 %), S3 (unten, 15 %). Der Schalter S0 gibt die Anlage frei.
 * Bei Drahtbruch (Blitz-Symbol) meldet ein Sensor dauerhaft 0.
 *
 * Ax.0 H1 Störlampe                 Ex.0 S0 Schalter EIN (1 = ein)
 * Ax.1 P1 Pumpe 1                   Ex.1 S1 Füllstand oben (1 = Medium erreicht)
 * Ax.2 P2 Pumpe 2                   Ex.2 S2 Füllstand Mitte
 *                                    Ex.3 S3 Füllstand unten
 */
import { bit, pack, type ModelLogic } from '../logic.ts';

export const SILO_LEVELS = [0.8, 0.5, 0.15] as const;
export const SILO_INFLOW = 0.1;
export const SILO_PUMP = 0.07;

export class SiloLogic implements ModelLogic {
  level = 0;
  inletOpen = false;
  on = false;
  readonly broken = [false, false, false];
  ax = 0;
  maxLevel = 0;
  overflow = false;
  dryRun = [false, false];

  /** Sensor i (0 = S1 oben) meldet Medium */
  sensor(i: number) { return !this.broken[i] && this.level >= SILO_LEVELS[i]!; }
  get ex() { return pack([this.on, this.sensor(0), this.sensor(1), this.sensor(2)]); }

  step(ax: number, dt: number) {
    this.ax = ax;
    let out = 0;
    this.dryRun = [false, false];
    for (const i of [0, 1]) {
      if (!bit(ax, 1 + i)) continue;
      if (this.level <= 0.01) this.dryRun[i] = true; else out += SILO_PUMP;
    }
    const inflow = this.inletOpen ? SILO_INFLOW : 0;
    this.level = Math.min(1, Math.max(0, this.level + (inflow - out) * dt));
    this.overflow = this.level >= 1 && this.inletOpen;
    this.maxLevel = Math.max(this.maxLevel, this.level);
  }

  /** s0 (Schalter), v1 (Handventil, bei down umschalten), f1…f3 (Drahtbruch Sensor, bei down umschalten) */
  input(name: string, down: boolean) {
    if (name === 's0') this.on = down;
    if (name === 'v1' && down) this.inletOpen = !this.inletOpen;
    const m = /^f([1-3])$/.exec(name);
    if (m && down) this.broken[Number(m[1]) - 1] = !this.broken[Number(m[1]) - 1];
  }

  get status() {
    if (this.overflow) return 'Störung: Silo läuft über!';
    if (this.dryRun[0] || this.dryRun[1]) return `Pumpe ${this.dryRun[0] ? 'P1' : 'P2'} läuft trocken!`;
    return `Füllstand ${Math.round(this.level * 100)} %${bit(this.ax, 0) ? ' – Störung' : ''}`;
  }

  reset() { this.level = 0; this.inletOpen = false; this.on = false; this.broken.fill(false); this.ax = 0; this.maxLevel = 0; this.overflow = false; this.dryRun = [false, false]; }
}
