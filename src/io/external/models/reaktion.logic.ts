/**
 * Reaktionstest: Ein Fahrzeug nähert sich einem Hindernis. Das Steuerprogramm startet nach der
 * Zeit-Freigabe die Zeitmessung ("Achtung") und gibt nach einer Zufallszeit das Signal "Bremsen!".
 * Das Modell misst selbst die Zeit zwischen Signal und Bremspedal und bewertet sie.
 *
 * Ax.0 P1  Lampe "Achtung – Zeit läuft!"        Ex.0 S0  Taster Reset (Schließer)
 * Ax.1 P2  Lampe "Bremsen!"                     Ex.1 S1  Taster Zeit-Freigabe
 *                                               Ex.2 S2  Bremspedal
 *                                               Ex.3 S3  Schwierigkeitsgrad (0 = leicht, 1 = schwer)
 *
 * Leicht: Bremsen bis 1,0 s nach dem Signal möglich, schwer: nur bis 0,6 s, sonst Aufprall.
 * Bremst man, solange nur P1 leuchtet, ist das ein Fehlstart.
 */
import { bit, pack, type ModelLogic } from '../logic.ts';

export type ReaktionResult = 'none' | 'good' | 'slow' | 'crash' | 'false';

export const rating = (ms: number) => (ms < 250 ? 'sehr gut' : ms < 400 ? 'gut' : ms < 600 ? 'durchschnittlich' : 'langsam');

export class ReaktionLogic implements ModelLogic {
  s0 = false;
  s1 = false;
  s2 = false;
  hard = false;
  p1 = false;
  p2 = false;
  clock = 0;
  reactionMs: number | null = null;
  result: ReaktionResult = 'none';
  falseStarts = 0;
  crashes = 0;
  tests = 0;
  /** Annäherung des Fahrzeugs an das Hindernis 0..1 (1 = Aufprall) */
  approach = 0;
  status = '';
  #armed = false;
  #goT = 0;
  #prevS0 = false;

  get limit() { return this.hard ? 0.6 : 1.0; }
  get ex() { return pack([this.s0, this.s1, this.s2, this.hard]); }

  step(ax: number, dt: number) {
    this.clock += dt;
    this.p1 = bit(ax, 0);
    const p2 = bit(ax, 1);
    if (p2 && !this.p2) {
      this.#armed = true; this.#goT = this.clock; this.result = 'none'; this.reactionMs = null; this.approach = 0;
      this.status = 'Bremsen!';
    }
    if (!p2 && this.p2 && this.#armed) { this.#armed = false; this.status = 'Signal "Bremsen!" ohne Reaktion zurückgenommen.'; }
    this.p2 = p2;
    if (this.s0 && !this.#prevS0) this.#clearResult();
    this.#prevS0 = this.s0;
    if (this.#armed) {
      const t = this.clock - this.#goT;
      this.approach = Math.min(1, t / this.limit);
      if (t >= this.limit) {
        this.#armed = false; this.crashes++; this.tests++;
        this.result = 'crash';
        this.status = 'Aufprall! Nicht rechtzeitig gebremst.';
      }
    }
  }

  /** Bremspedal getreten: sofort auswerten (das Programm kann P1/P2 schon im nächsten Zyklus löschen) */
  #brake() {
    if (this.#armed) {
      const t = this.clock - this.#goT;
      this.#armed = false;
      this.tests++;
      this.reactionMs = Math.round(t * 1000);
      this.result = 'good';
      this.status = `Reaktionszeit: ${this.reactionMs} ms – ${rating(this.reactionMs)}`;
    } else if (this.p1 && !this.p2) {
      this.falseStarts++;
      this.result = 'false';
      this.reactionMs = null;
      this.status = 'Fehlstart! Gebremst, bevor das Signal kam.';
    }
  }

  #clearResult() {
    this.result = 'none'; this.reactionMs = null; this.approach = 0; this.status = ''; this.#armed = false;
  }

  input(name: string, down: boolean) {
    if (name === 's0') this.s0 = down;
    if (name === 's1') this.s1 = down;
    if (name === 's2') { if (down && !this.s2) this.#brake(); this.s2 = down; }
    if (name === 'hard') this.hard = down;
  }

  reset() {
    this.#clearResult(); this.falseStarts = 0; this.crashes = 0; this.tests = 0; this.p1 = false; this.p2 = false;
  }
}
