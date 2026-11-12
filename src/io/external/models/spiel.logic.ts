/**
 * Spielwiese: freies Experimentierfeld mit Schaltern, Tastern, Lampen, Motoren und Ventilen.
 *
 * Ax.0 H01 Lampe        Ex.0 S01 Schalter (rastend)
 * Ax.1 H02 Lampe        Ex.1 S02 Schalter
 * Ax.2 H03 Lampe        Ex.2 S03 Schalter
 * Ax.3 H04 Lampe        Ex.3 S04 Schalter
 * Ax.4 M01 Motor        Ex.4 T01 Taster (Schließer)
 * Ax.5 M02 Motor        Ex.5 T02 Taster
 * Ax.6 V01 Ventil       Ex.6 T03 Taster
 * Ax.7 V02 Ventil       Ex.7 T04 Taster
 */
import { Motor, bit, pack, type ModelLogic } from '../logic.ts';
import { approach } from './p1.util.ts';

export class SpielLogic implements ModelLogic {
  readonly switches = [false, false, false, false];
  readonly buttons = [false, false, false, false];
  readonly motors = [new Motor(0.5), new Motor(0.7)];
  /** Ventilöffnung 0..1 */
  readonly valves = [0, 0];
  ax = 0;

  get ex() { return pack([...this.switches, ...this.buttons]); }

  lamp(i: number) { return bit(this.ax, i); }

  step(ax: number, dt: number) {
    this.ax = ax;
    this.motors.forEach((m, i) => m.step(bit(ax, 4 + i), dt));
    this.valves.forEach((v, i) => { this.valves[i] = approach(v, bit(ax, 6 + i) ? 1 : 0, 2.5, dt); });
  }

  /** s1…s4: Schalter (down = Stellung ein), t1…t4: Taster */
  input(name: string, down: boolean) {
    const m = /^([st])([1-4])$/.exec(name);
    if (!m) return;
    const i = Number(m[2]) - 1;
    (m[1] === 's' ? this.switches : this.buttons)[i] = down;
  }

  get status() {
    const parts = [
      ...this.motors.flatMap((m, i) => (m.running ? [`M0${i + 1} läuft`] : [])),
      ...this.valves.flatMap((v, i) => (v > 0.5 ? [`V0${i + 1} offen`] : [])),
    ];
    return parts.join(' · ');
  }

  reset() {
    this.switches.fill(false); this.buttons.fill(false);
    this.motors.forEach((m) => { m.speed = 0; });
    this.valves.fill(0); this.ax = 0;
  }
}
