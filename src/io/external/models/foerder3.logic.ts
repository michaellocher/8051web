/**
 * Förderanlage III (Modellvariante A, Schließer): Ein Wagen pendelt auf einer Schiene zwischen dem linken
 * Entladepunkt (Endschalter S1) und dem rechten Beladepunkt unter dem Trichter (Endschalter S2).
 * Der Trichter füllt den stehenden Wagon am rechten Ende automatisch in 5 s; am linken Ende entleert er sich in 3 s.
 * Die Steuerung muss also die Zeiten abwarten: zu früh losfahren = Wagen nur teilweise beladen / nicht entleert,
 * zu lange stehen = Material läuft über. Dauerbetrieb, solange der Schalter Start (S0) an ist.
 *
 * Ax.0 K1  Motor Rechtslauf (→)                    Ex.0 S0  Schalter Start
 * Ax.1 K2  Motor Linkslauf (←)                     Ex.1 S1  Endschalter links
 *                                                  Ex.2 S2  Endschalter rechts
 */
import { bit, clamp01, pack, type ModelLogic } from '../logic.ts';

const SPEED = 0.25, FILL = 0.2, UNLOAD = 0.33;

export class Foerder3Logic implements ModelLogic {
  /** 0 = links (Entladung), 1 = rechts (Beladung) */
  pos = 0;
  dir = 0;
  load = 0;
  s0 = false;
  cycles = 0;
  underfilled = 0;
  notEmptied = 0;
  overflows = 0;
  crashes = 0;
  /** Material wird gerade eingefüllt / entleert */
  filling = false;
  unloading = false;
  k1 = false; k2 = false;
  readonly errors: string[] = [];
  #spill = 0;
  #block = 0;
  #wasFull = false;
  #latched = new Set<string>();

  get ex() { return pack([this.s0, this.pos <= 0.02, this.pos >= 0.98]); }
  get status() { return this.errors.at(-1) ?? ''; }

  #err(key: string, text: string, active: boolean) {
    if (active && !this.#latched.has(key)) { this.#latched.add(key); this.errors.push(text); if (this.errors.length > 8) this.errors.shift(); }
    if (!active) this.#latched.delete(key);
  }

  step(ax: number, dt: number) {
    this.k1 = bit(ax, 0); this.k2 = bit(ax, 1);
    this.dir = this.k1 && this.k2 ? 0 : this.k1 ? 1 : this.k2 ? -1 : 0;
    this.#err('short', 'Kurzschluss: K1 und K2 gleichzeitig angezogen!', this.k1 && this.k2);
    const prev = this.pos;
    this.pos = clamp01(this.pos + this.dir * SPEED * dt);
    const atEnd = (this.dir > 0 && this.pos >= 1) || (this.dir < 0 && this.pos <= 0);
    this.#block = atEnd ? this.#block + dt : 0;
    if (this.#block > 0.5 && !this.#latched.has('crash')) this.crashes++;
    this.#err('crash', 'Endlage überfahren: Motor läuft gegen den Anschlag!', this.#block > 0.5);
    // Beladen am rechten Ende
    this.filling = this.pos >= 0.98 && this.dir === 0;
    if (this.filling) {
      if (this.load < 1) this.load = Math.min(1, this.load + FILL * dt);
      else {
        this.#spill += dt;
        if (this.#spill > 1 && !this.#latched.has('over')) this.overflows++;
        this.#err('over', 'Wagon läuft über: Trichter füllt weiter, obwohl der Wagen voll ist!', this.#spill > 1);
      }
      if (this.load >= 0.99) this.#wasFull = true;
    } else this.#spill = 0;
    if (this.#spill === 0) this.#latched.delete('over');
    // Entladen am linken Ende
    this.unloading = this.pos <= 0.02 && this.dir === 0 && this.load > 0;
    if (this.unloading) {
      this.load = Math.max(0, this.load - UNLOAD * dt);
      if (this.load === 0 && this.#wasFull) { this.cycles++; this.#wasFull = false; }
    }
    // Abfahrt mit falscher Beladung
    if (prev >= 0.98 && this.pos < 0.98 && this.load < 0.9) {
      this.underfilled++;
      this.errors.push('Wagon fährt nur teilweise beladen vom Trichter weg!');
    }
    if (prev <= 0.02 && this.pos > 0.02 && this.load > 0.05 && !this.filling) {
      this.notEmptied++;
      this.errors.push('Wagon fährt los, ohne vollständig entleert zu sein!');
    }
    if (this.errors.length > 8) this.errors.shift();
  }

  input(name: string, down: boolean) {
    if (name === 's0') this.s0 = down;
    if (name === 'clear' && down) { this.errors.length = 0; this.#latched.clear(); }
  }

  reset() {
    this.pos = 0; this.dir = 0; this.load = 0; this.cycles = 0; this.underfilled = 0; this.notEmptied = 0; this.overflows = 0;
    this.crashes = 0; this.#spill = 0; this.#block = 0; this.#wasFull = false; this.errors.length = 0; this.#latched.clear();
  }
}
