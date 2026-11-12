/**
 * Absauganlage (Modellvariante A, Schließer): Eine Werkzeugmaschine (S0 = Maschine EIN) erzeugt Staub, der
 * über eine Haube und ein Rohr vom Ventilator M1 in einen Abscheider (Trichter) gesaugt wird. Die
 * Zellenradschleuse M2 am Trichterausgang leert den Abscheider in einen Behälter.
 * Der Ventilator braucht zwei Sekunden Hochlauf; läuft die Maschine ohne Absaugung, gelangt Staub in
 * die Halle. Läuft M2 nicht, füllt sich der Abscheider und verstopft die Absaugung.
 *
 * Ax.0 M1  Ventilator (Absaugung)               Ex.0 S0  Schalter Maschine EIN
 * Ax.1 M2  Zellenradschleuse (Austrag)          Ex.1 S1  Taster EIN (Absauganlage)
 * Ax.2 H1  Meldeleuchte M1 läuft                Ex.2 S2  Taster AUS
 * Ax.3 H2  Meldeleuchte M2 läuft                Ex.3 S3  Taster Check (Leuchtentest)
 * Ax.4 H3  Meldeleuchte Störung                 Ex.4 Q1  Motorschutz M1 ausgelöst (1 = Störung)
 *                                               Ex.5 Q2  Motorschutz M2 ausgelöst (1 = Störung)
 */
import { Motor, bit, clamp01, pack, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

const DUST = 0.06, DRAIN = 0.5;

export class AbsaugLogic implements ModelLogic {
  machine = false;
  s1 = false;
  s2 = false;
  check = false;
  q1 = false;
  q2 = false;
  readonly m1 = new Motor(0.8);
  readonly m2 = new Motor(0.3);
  /** Füllstand Abscheider / Behälter 0..1 */
  sep = 0;
  bin = 0;
  /** in die Halle entwichener Staub (Summe) */
  leak = 0;
  peakSep = 0;
  lamps = [false, false, false];
  readonly note = new Notice();

  get ex() { return pack([this.machine, this.s1, this.s2, this.check, this.q1, this.q2]); }
  get status() {
    const f = [this.q1 ? 'Motorschutz Q1 (M1)' : '', this.q2 ? 'Motorschutz Q2 (M2)' : ''].filter(Boolean).join(' und ');
    return f ? `Störung: ${f} ausgelöst` : this.note.text;
  }
  /** Absaugleistung 0..1 */
  /** Staub entweicht gerade in die Halle */
  get leaking() { return this.machine && this.capture < 0.5; }
  get capture() { return this.sep >= 1 ? 0 : clamp01(this.m1.speed / 0.9); }

  step(ax: number, dt: number) {
    this.note.tick(dt);
    this.lamps = [bit(ax, 2), bit(ax, 3), bit(ax, 4)];
    this.m1.step(bit(ax, 0) && !this.q1, dt);
    this.m2.step(bit(ax, 1) && !this.q2, dt);
    const cap = this.capture;
    if (this.machine) {
      this.sep += DUST * cap * dt;
      const lost = DUST * (1 - cap) * dt;
      this.leak += lost;
      if (cap < 0.5) this.note.say(this.sep >= 1 ? 'Abscheider voll: Absaugung verstopft, Staub in der Halle!' : 'Staubbelastung: Maschine läuft ohne ausreichende Absaugung!', 3);
    }
    if (this.m2.speed > 0.05 && this.sep > 0) {
      const d = Math.min(this.sep, (this.sep * DRAIN + 0.03) * this.m2.speed * dt);
      this.sep -= d; this.bin = clamp01(this.bin + d * 0.5);
    }
    this.sep = Math.min(1, this.sep);
    this.peakSep = Math.max(this.peakSep, this.sep);
    if (this.m1.running && !this.m2.running && this.sep > 0.6) this.note.say('Zellenradschleuse M2 steht: Abscheider füllt sich!', 2);
  }

  input(name: string, down: boolean) {
    if (name === 'machine') this.machine = down;
    if (name === 's1') this.s1 = down;
    if (name === 's2') this.s2 = down;
    if (name === 'check') this.check = down;
    if (name === 'q1') this.q1 = down;
    if (name === 'q2') this.q2 = down;
  }

  reset() {
    this.machine = false; this.q1 = false; this.q2 = false; this.m1.speed = 0; this.m2.speed = 0;
    this.sep = 0; this.bin = 0; this.leak = 0; this.peakSep = 0; this.note.clear();
  }
}
