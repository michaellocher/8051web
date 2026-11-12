/**
 * Blindleistungskompensation: Die induktive Last benötigt Blindleistung, die zugeschaltete
 * Kondensatorstufen (je 5 kvar) ausgleichen sollen. Mit S1 (+) / S2 (−) wird die Last erhöht/verringert
 * (je 5 kvar). Ein entladener Kondensator muss mindestens 2 s abgeschaltet gewesen sein,
 * sonst entsteht beim Wiedereinschalten ein Schaltstoß.
 *
 * Ax.0 K1  Schütz Kondensatorstufe C1           Ex.0 S1  Taster „+" (mehr Last)
 * Ax.1 K2  Schütz Kondensatorstufe C2           Ex.1 S2  Taster „−" (weniger Last)
 * Ax.2 K3  Schütz Kondensatorstufe C3           Ex.2 L   Blindleistungsmesser: induktiv (Netto ≥ +2,5 kvar)
 * Ax.3 K4  Schütz Kondensatorstufe C4           Ex.3 C   Blindleistungsmesser: kapazitiv (Netto ≤ −2,5 kvar)
 */
import { bit, pack, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

export const STAGE_KVAR = 5;
export const MAX_LOAD_STEPS = 4;
const DISCHARGE = 2;
const P_KW = 20;

export class KompensationLogic implements ModelLogic {
  loadStep = 1;
  plus = false;
  minus = false;
  stages = [false, false, false, false];
  surges = 0;
  clock = 0;
  readonly offAt = [-99, -99, -99, -99];
  readonly note = new Notice();
  #plusPrev = false;
  #minusPrev = false;

  get load() { return this.loadStep * STAGE_KVAR; }
  get compensation() { return this.stages.filter(Boolean).length * STAGE_KVAR; }
  /** Netto-Blindleistung in kvar (positiv = induktiv) */
  get net() { return this.load - this.compensation; }
  get cosPhi() { return P_KW / Math.hypot(P_KW, this.net); }
  get ex() { return pack([this.plus, this.minus, this.net >= 2.5, this.net <= -2.5]); }
  get status() {
    if (this.note.text) return this.note.text;
    if (this.net <= -2.5) return 'Überkompensation: Anlage wirkt kapazitiv.';
    return '';
  }

  step(ax: number, dt: number) {
    this.clock += dt;
    this.note.tick(dt);
    if (this.plus && !this.#plusPrev && this.loadStep < MAX_LOAD_STEPS) this.loadStep++;
    if (this.minus && !this.#minusPrev && this.loadStep > 0) this.loadStep--;
    this.#plusPrev = this.plus; this.#minusPrev = this.minus;
    for (let i = 0; i < 4; i++) {
      const on = bit(ax, i);
      const was = this.stages[i]!;
      if (on && !was && this.clock - this.offAt[i]! < DISCHARGE) {
        this.surges++;
        this.note.say(`Schaltstoß an C${i + 1}: Kondensator war noch nicht entladen (mind. ${DISCHARGE} s warten)!`, 6);
      }
      if (!on && was) this.offAt[i] = this.clock;
      this.stages[i] = on;
    }
  }

  input(name: string, down: boolean) {
    if (name === 'plus') this.plus = down;
    if (name === 'minus') this.minus = down;
  }

  reset() {
    this.loadStep = 1; this.stages = [false, false, false, false]; this.surges = 0; this.offAt.fill(-99); this.note.clear();
  }
}
