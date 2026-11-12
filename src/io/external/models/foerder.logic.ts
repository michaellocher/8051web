/**
 * Förderanlage (Modellvariante B, mit Drahtbruchsicherheit): Aus einem Trichter wird Schüttgut über
 * drei hintereinander laufende Förderbänder transportiert. Stoppt ein Band, während das davor
 * noch Material liefert, entsteht ein Materialstau. Alle Aus-Taster und NOT-AUS sind Öffner
 * (Ex = 0, wenn betätigt; Ex = 1 in Ruhe). Starttaster sind Schließer (Ex = 1, wenn gedrückt).
 *
 * Ax.0 M1 Band 1 (unter dem Trichter)    Ex.0 S1 Start Band 1 (Schließer)
 * Ax.1 M2 Band 2                          Ex.1 S2 Aus Band 1 (Öffner)
 * Ax.2 M3 Band 3 (Abgabe)                 Ex.2 S3 Start Band 2
 * Ax.3 H1 Alarmleuchte                    Ex.3 S4 Aus Band 2 (Öffner)
 *                                          Ex.4 S5 Start Band 3
 *                                          Ex.5 S6 Aus Band 3 (Öffner)
 *                                          Ex.6 S7 NOT-AUS (Öffner, rastend)
 */
import { bit, pack, type ModelLogic } from '../logic.ts';
import { hold } from './p1.util.ts';

/** Laufzeit über ein Band in Sekunden */
export const BELT_T = 3;
export const FEED_EVERY = 1.2;

export interface Item { belt: number; x: number }

export class FoerderLogic implements ModelLogic {
  items: Item[] = [];
  delivered = 0;
  readonly start = [false, false, false];
  readonly stop = [false, false, false];
  estop = false;
  ax = 0;
  /** wie lange schon Material am Bandende wartet (je Band) */
  readonly jam = [0, 0, 0];
  #feed = 0;

  get ex() {
    return pack([this.start[0]!, !this.stop[0], this.start[1]!, !this.stop[1], this.start[2]!, !this.stop[2], !this.estop]);
  }
  runs(i: number) { return bit(this.ax, i); }
  get jammed() { return this.jam.findIndex((j) => j > 2); }

  step(ax: number, dt: number) {
    this.ax = ax;
    // Trichter gibt nur Material ab, wenn Band 1 läuft
    this.#feed += dt;
    if (this.runs(0) && this.#feed >= FEED_EVERY && !this.items.some((it) => it.belt === 0 && it.x < 0.12)) {
      this.items.push({ belt: 0, x: 0 }); this.#feed = 0;
    }
    const waiting = [false, false, false];
    const keep: Item[] = [];
    // vorderste Teile zuerst bewegen
    for (const it of this.items.toSorted((a, b) => b.belt - a.belt || b.x - a.x)) {
      if (this.runs(it.belt)) it.x += dt / BELT_T;
      if (it.x >= 1) {
        if (it.belt === 2) { if (this.runs(2)) { this.delivered++; continue; } it.x = 1; }
        else if (this.runs(it.belt + 1)) { it.belt++; it.x = 0; }
        else { it.x = 1; waiting[it.belt] = true; }
      }
      keep.push(it);
    }
    this.items = keep;
    waiting.forEach((w, i) => { this.jam[i] = hold(this.jam[i]!, w, dt); });
  }

  /** start1…3 / stop1…3 (Taster gedrückt = down), estop (rastender Schalter) */
  input(name: string, down: boolean) {
    const m = /^(start|stop)([1-3])$/.exec(name);
    if (m) (m[1] === 'start' ? this.start : this.stop)[Number(m[2]) - 1] = down;
    if (name === 'estop') this.estop = down;
  }

  get status() {
    if (this.estop) return 'NOT-AUS betätigt';
    const j = this.jammed;
    if (j >= 0) return `Materialstau am Ende von Band ${j + 1} – Band ${j + 2} steht!`;
    return `Gefördert: ${this.delivered}`;
  }

  reset() {
    this.items = []; this.delivered = 0; this.start.fill(false); this.stop.fill(false);
    this.estop = false; this.ax = 0; this.jam.fill(0); this.#feed = 0;
  }
}
