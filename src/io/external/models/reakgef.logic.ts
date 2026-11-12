/**
 * Reaktionsgefäß (Modellvariante A, ohne Drahtbruchsicherheit): Ein beheizter, gerührter Reaktor mit
 * Dampfdruck p und Temperatur T. Das Programm fährt den Reaktor an (Heizen bis 100 °C), hält ihn im
 * Normalbetrieb zwischen den Grenzen und alarmiert bei Grenzwertverletzung.
 *
 * Ax.0 P1  Meldelampe Normalbetrieb              Ex.0 S1  Druck p zu hoch   (> 75 bar)
 * Ax.1 P2  Meldelampe Anfahren                   Ex.1 S2  Druck p zu niedrig (< 25 bar)
 * Ax.2 P3  Alarm (Hupe)                          Ex.2 S3  Temperatur T zu hoch   (> 150 °C)
 * Ax.3 V1  Ventil Kühlzulauf (kalter Zulauf)     Ex.3 S4  Temperatur T zu niedrig (< 100 °C)
 * Ax.4 V2  Ventil Druckablass (oben)
 * Ax.5 Q   Heizung
 * Ax.6 M   Rührwerk
 *
 * Alle Grenzwertgeber sind Schließer (1 = Grenzwert verletzt). Die Störungstasten im Bild (p↑, T↑, p↓T↑)
 * wirken, solange sie gedrückt sind. Bei p ≥ 100 bar platzt der Behälter, bei T ≥ 200 °C geht die
 * Reaktion durch; „Behälter erneuern“ stellt den Anfangszustand wieder her.
 */
import { bit, pack, type ModelLogic } from '../logic.ts';

export const P_HIGH = 75, P_LOW = 25, T_HIGH = 150, T_LOW = 100, P_BURST = 100, T_RUNAWAY = 200;
export type Damage = '' | 'burst' | 'overheat';

export class ReakgefLogic implements ModelLogic {
  T = 20;
  p = 10;
  damage: Damage = '';
  /** Rührwerk-Winkel für die Anzeige */
  stir = 0;
  injP = false;
  injT = false;
  injPT = false;
  ax = 0;
  #noStir = 0;

  get ex() {
    return pack([this.p > P_HIGH, this.p < P_LOW, this.T > T_HIGH, this.T < T_LOW]);
  }
  get status() {
    if (this.damage === 'burst') return 'Störung: Überdruck – Behälter geborsten! „Behälter erneuern“ drücken.';
    if (this.damage === 'overheat') return 'Störung: Übertemperatur – Reaktion außer Kontrolle! „Behälter erneuern“ drücken.';
    if (bit(this.ax, 5) && !bit(this.ax, 6) && this.#noStir > 2) return 'Warnung: Heizung ohne Rührwerk – Wärme wird schlecht verteilt!';
    return '';
  }

  step(ax: number, dt: number) {
    this.ax = ax;
    const q = bit(ax, 5) && !this.damage, m = bit(ax, 6), v1 = bit(ax, 3), v2 = bit(ax, 4);
    this.#noStir = q && !m ? this.#noStir + dt : 0;
    const heat = q ? (m ? 7 : 3.5) : 0;
    let dT = heat - 0.035 * (this.T - 20) - (v1 ? 0.12 * (this.T - 20) : 0);
    let dp = (10 + 0.45 * (this.T - 20) - this.p) * 0.8 - (v2 ? (this.p - 1) * 1.0 : 0);
    if (this.injP) dp += 60;
    if (this.injT) dT += 10;
    if (this.injPT) { dp -= 20; dT += 12; }
    this.T = Math.max(20, this.T + dT * dt);
    this.p = Math.max(1, this.p + dp * dt);
    if (m) this.stir = (this.stir + dt * 360) % 360;
    if (!this.damage) {
      if (this.p >= P_BURST) this.damage = 'burst';
      else if (this.T >= T_RUNAWAY) this.damage = 'overheat';
    }
  }

  input(name: string, down: boolean) {
    if (name === 'pup') this.injP = down;
    if (name === 'tup') this.injT = down;
    if (name === 'ptup') this.injPT = down;
    if (name === 'repair' && down) { this.damage = ''; this.T = 20; this.p = 10; this.#noStir = 0; }
  }

  reset() {
    this.T = 20; this.p = 10; this.damage = ''; this.injP = this.injT = this.injPT = false; this.ax = 0; this.#noStir = 0;
  }
}
