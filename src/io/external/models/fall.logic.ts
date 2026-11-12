/**
 * Fallmagazin: Aus einem Schacht fällt jeweils das unterste Werkstück vor einen Zylinder. Der Zylinder
 * schiebt es über die Tischkante, es fällt durch eine Lichtschranke in einen Behälter. Das Steuerprogramm
 * soll so viele Teile ausschieben, wie an der Ziffer S0 vorgewählt ist.
 *
 * Ax.0 Y1  Zylinder ausfahren (Feder-Rückstellung)   Ex.0–3 S0  Vorwahl-Ziffer 0–9 (BCD, Ex.0 = Wert 1)
 *                                                    Ex.4 S1  Taster START
 *                                                    Ex.5 S2  Taster RESET (Magazin neu füllen, Behälter leeren)
 *                                                    Ex.6 S3  Taster STOP
 *                                                    Ex.7 B1  Lichtschranke (1 = Teil unterbricht den Strahl)
 *
 * Der Zylinder hat keine Endlagensensoren: Rückmeldung nur über B1. Ein Teil, das nicht ganz über die
 * Kante geschoben wird, bleibt liegen und blockiert den Schacht.
 */
import { Cylinder, bit, pack, springValve, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

export const CAPACITY = 9;
/** Fallhöhe in Zeichenpixeln: y(t) = 292 + 280 t² */
export const fallY = (t: number) => 292 + 280 * t * t;

export class FallLogic implements ModelLogic {
  readonly cyl = new Cylinder(1.6);
  magazine = CAPACITY;
  /** Vorwahl 0..9 */
  preset = 5;
  /** Lage des Teils auf dem Tisch 0 (vor dem Schacht) … 1 (Kante), null = kein Teil */
  px: number | null = null;
  /** Fallzeiten der Teile hinter der Kante */
  falling: number[] = [];
  binCount = 0;
  start = false;
  stopBtn = false;
  resetBtn = false;
  readonly note = new Notice();
  #load = 0;

  get ex() {
    const p = this.preset;
    return pack([bit(p, 0), bit(p, 1), bit(p, 2), bit(p, 3), this.start, this.resetBtn, this.stopBtn, this.barrier]);
  }
  /** Lichtschranke B1 */
  get barrier() { return this.falling.some((t) => fallY(t) > 322 && fallY(t) < 350); }
  get status() {
    if (this.note.text) return this.note.text;
    if (this.magazine === 0 && this.px === null && this.falling.length === 0) return 'Magazin leer – RESET füllt es wieder auf.';
    return '';
  }

  step(ax: number, dt: number) {
    this.note.tick(dt);
    const before = this.cyl.pos;
    this.cyl.move(springValve(bit(ax, 0)), dt);
    if (this.px === null) {
      if (this.cyl.pos <= 0.02 && this.magazine > 0) {
        this.#load += dt;
        if (this.#load >= 0.25) { this.magazine--; this.px = 0; this.#load = 0; }
      } else this.#load = 0;
    } else {
      this.px = Math.max(this.px, this.cyl.pos);
      if (this.px >= 1) { this.falling.push(0); this.px = null; this.#load = 0; }
      else if (this.cyl.pos < before && this.cyl.retracted && this.px > 0.05) {
        this.note.say('Teil nicht ganz ausgeschoben – es bleibt auf dem Tisch liegen und blockiert den Schacht!', 6);
      }
    }
    this.falling = this.falling.map((t) => t + dt).filter((t) => {
      if (t >= 0.52) { this.binCount++; return false; }
      return true;
    });
  }

  input(name: string, down: boolean) {
    if (name === 'start') this.start = down;
    if (name === 'stop') this.stopBtn = down;
    if (name === 'reset') {
      this.resetBtn = down;
      if (down) { this.magazine = CAPACITY; this.binCount = 0; this.px = null; this.falling = []; this.note.say('Magazin gefüllt, Behälter geleert.', 3); }
    }
    if (down && name === 'up') this.preset = Math.min(9, this.preset + 1);
    if (down && name === 'down') this.preset = Math.max(0, this.preset - 1);
  }

  reset() {
    this.cyl.pos = 0; this.magazine = CAPACITY; this.px = null; this.falling = []; this.binCount = 0; this.#load = 0; this.note.clear();
  }
}
