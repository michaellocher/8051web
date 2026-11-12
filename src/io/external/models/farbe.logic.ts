/**
 * Farbrührwerk (Modellvariante A, Schließer): Eine Pumpe füllt Farbe aus einem Vorratsbehälter in den Rührbehälter bis
 * „voll" (S3). Das Rührwerk muss die Farbe vor dem Ablassen mindestens 4 s durchmischen. Danach läuft sie über das
 * Ventil V1 ab (bis S4 „leer"). Die Motorschutzschalter F1 (Pumpe) und F2 (Rührwerk) lösen bei Störung aus.
 *
 * Ax.0 K1  Pumpe (Motorschütz)                    Ex.0 S1  Taster EIN
 * Ax.1 K2  Rührwerk (Motorschütz)                 Ex.1 S2  Taster AUS (1 = gedrückt)
 * Ax.2 V1  Ablassventil                           Ex.2 S3  Füllstand max. (voll)
 * Ax.3 H1  Meldeleuchte Störung                   Ex.3 S4  Füllstand min. (Behälter nicht leer)
 * Ax.4 H2  Meldeleuchte Automatik                 Ex.4 F1  Motorschutz Pumpe ausgelöst (1 = Störung)
 *                                                 Ex.5 F2  Motorschutz Rührwerk ausgelöst (1 = Störung)
 *                                                 Ex.6 S5  Schalter MANU (Handbetrieb)
 */
import { Motor, bit, clamp01, pack, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

const PUMP = 0.1, DRAIN = 0.12, MAX = 0.9, MIN = 0.04;

export class FarbeLogic implements ModelLogic {
  level = 0;
  /** Durchmischung 0..1 */
  mix = 0;
  s1 = false; s2 = false; s5 = false;
  f1 = false; f2 = false;
  readonly pump = new Motor(0.4);
  readonly stir = new Motor(0.5);
  v1 = false;
  h1 = false; h2 = false;
  good = 0;
  bad = 0;
  overflows = 0;
  dryStir = 0;
  peakLevel = 0;
  readonly note = new Notice();
  #judged = false;
  #dryT = 0;

  get ex() { return pack([this.s1, this.s2, this.level >= MAX, this.level > MIN, this.f1, this.f2, this.s5]); }
  get status() {
    const f = [this.f1 ? 'F1 (Pumpe)' : '', this.f2 ? 'F2 (Rührwerk)' : ''].filter(Boolean).join(' und ');
    return f ? `Störung: Motorschutz ${f} ausgelöst` : this.note.text;
  }

  step(ax: number, dt: number) {
    this.note.tick(dt);
    this.v1 = bit(ax, 2); this.h1 = bit(ax, 3); this.h2 = bit(ax, 4);
    this.pump.step(bit(ax, 0) && !this.f1, dt);
    this.stir.step(bit(ax, 1) && !this.f2, dt);
    const inflow = this.pump.speed > 0.05 ? PUMP * this.pump.speed : 0;
    if (inflow > 0) this.mix = Math.max(0, this.mix - 0.5 * dt);
    if (this.v1 && this.level > 0 && !this.#judged && this.level > 0.5) {
      this.#judged = true;
      if (this.mix >= 0.9) this.good++;
      else { this.bad++; this.note.say('Farbe ungemischt abgelassen – Charge unbrauchbar!', 5); }
    }
    const out = this.v1 && this.level > 0 ? DRAIN : 0;
    const l = this.level + (inflow - out) * dt;
    if (l > 1) { this.overflows++; this.note.say('Störung: Rührbehälter läuft über!', 4); }
    this.level = clamp01(l);
    this.peakLevel = Math.max(this.peakLevel, this.level);
    if (this.level < 0.01 && !this.v1) this.#judged = false;
    // Rührwerk: Flügel liegen bei ca. 12 % Füllhöhe, darunter läuft es trocken
    if (this.stir.running && this.level < 0.12) {
      this.#dryT += dt;
      if (this.#dryT > 1) { this.dryStir++; this.#dryT = 0; this.note.say('Rührwerk läuft ohne Farbe (trocken)!', 3); }
    } else this.#dryT = 0;
    if (this.stir.running && this.level > 0.15) this.mix = Math.min(1, this.mix + 0.25 * dt);
    if (this.level <= 0 && this.v1) this.note.say('V1 offen, Behälter leer.', 1);
  }

  input(name: string, down: boolean) {
    if (name === 's1') this.s1 = down;
    if (name === 's2') this.s2 = down;
    if (name === 's5') this.s5 = down;
    if (name === 'f1') this.f1 = down;
    if (name === 'f2') this.f2 = down;
  }

  reset() {
    this.level = 0; this.mix = 0; this.pump.speed = 0; this.stir.speed = 0; this.good = 0; this.bad = 0; this.overflows = 0;
    this.dryStir = 0; this.peakLevel = 0; this.#judged = false; this.#dryT = 0; this.f1 = false; this.f2 = false; this.note.clear();
  }
}
