/**
 * Mischanlage: Aus zwei Silos A (rot) und B (blau) werden über die Ventile Y1/Y2 zwei Komponenten
 * in den Mischbehälter dosiert. Der Schalter S2 wählt, welche Komponente zuerst eingefüllt wird.
 * Ist der Behälter bis zur Mitte gefüllt, folgt die zweite Komponente bis zur Marke „voll“.
 *
 * Ax.0 H1 Meldelampe Silo A leer       Ex.0 S1 Taster START
 * Ax.1 H2 Meldelampe Silo B leer       Ex.1 S2 Schalter Silo: 0 = A zuerst, 1 = B zuerst
 * Ax.2 Y1 Ventil Silo A                Ex.2 B1 Silo A leer
 * Ax.3 Y2 Ventil Silo B                Ex.3 B2 Silo B leer
 *                                       Ex.4 B3 Mischbehälter mindestens halb voll
 *                                       Ex.5 B4 Mischbehälter voll
 */
import { bit, pack, type ModelLogic } from '../logic.ts';

export const MISCH_FLOW = 0.1;

export class MischLogic implements ModelLogic {
  /** Füllstand der Silos 0..1 */
  silo = [1, 1];
  /** Menge im Mischbehälter je Komponente (Summe ≤ 1) */
  mix = [0, 0];
  startBtn = false;
  selB = false;
  draining = false;
  overflow = false;
  ax = 0;
  /** Meldung „Mischung fertig“ mit Anteilen */
  #done = '';
  #dry = '';

  get total() { return this.mix[0]! + this.mix[1]!; }
  get ex() {
    return pack([this.startBtn, this.selB, this.silo[0]! < 0.03, this.silo[1]! < 0.03, this.total >= 0.5, this.total >= 0.95]);
  }

  step(ax: number, dt: number) {
    this.ax = ax;
    this.#dry = '';
    for (const i of [0, 1]) {
      if (!bit(ax, 2 + i)) continue;
      const q = Math.min(MISCH_FLOW * dt, this.silo[i]!);
      if (q <= 0) { this.#dry = `Ventil Y${i + 1} offen, aber Silo ${'AB'[i]} ist leer!`; continue; }
      this.silo[i]! -= q;
      const room = 1 - this.total;
      if (q > room) { this.overflow = true; this.mix[i]! += room; } else this.mix[i]! += q;
    }
    if (this.draining && this.total > 0) {
      const k = Math.max(0, 1 - (0.3 * dt) / this.total);
      this.mix[0]! *= k; this.mix[1]! *= k;
      if (this.total < 0.005) { this.mix.fill(0); this.draining = false; }
    }
    if (this.total >= 0.95 && !this.draining) {
      const pa = Math.round((this.mix[0]! / this.total) * 100);
      this.#done = `Behälter voll: ${pa} % A / ${100 - pa} % B`;
    } else if (this.total < 0.05) { this.#done = ''; this.overflow = false; }
  }

  /** start (Taster), sel (Schalter, down = B zuerst), drain (Behälter entleeren), refill (Silos füllen) */
  input(name: string, down: boolean) {
    if (name === 'start') this.startBtn = down;
    if (name === 'sel') this.selB = down;
    if (name === 'drain' && down) this.draining = true;
    if (name === 'refill' && down) this.silo = [1, 1];
  }

  get status() {
    if (this.overflow) return 'Störung: Mischbehälter läuft über!';
    if (this.#dry) return this.#dry;
    return this.#done || (this.total > 0 ? `Füllstand ${Math.round(this.total * 100)} %` : '');
  }

  reset() {
    this.silo = [1, 1]; this.mix = [0, 0]; this.startBtn = false; this.draining = false;
    this.overflow = false; this.ax = 0; this.#done = ''; this.#dry = '';
  }
}
