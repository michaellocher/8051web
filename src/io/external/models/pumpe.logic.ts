/**
 * Pumpensteuerung (Modellvariante A, Schließer): Ein Auffangbecken wird über das Handventil V1 gefüllt
 * und mit der Pumpe P1 leergepumpt. Die Pumpe darf nur laufen, solange Wasser im Becken ist
 * (Trockenlaufschutz). Der Motorschutzschalter Q1 löst bei Störung aus.
 *
 * Ax.0 P1  Pumpe (Motorschütz)                   Ex.0 S0  Schalter EIN
 * Ax.1 H1  Meldeleuchte Betrieb/Störung          Ex.1 S1  Füllstand oben (Wasser erreicht Fühler)
 *                                                Ex.2 S2  Füllstand unten (Wasser über Mindeststand)
 *                                                Ex.3 S3  Taster Check (Leuchtentest)
 *                                                Ex.4 Q1  Motorschutz ausgelöst (1 = Störung)
 * V1 (Zulauf) ist ein Handventil, wird im Modellfenster per Klick bedient.
 */
import { Motor, bit, clamp01, pack, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

const HIGH = 0.75, LOW = 0.2, INFLOW = 0.1, OUTFLOW = 0.18, DRY = 0.03;

export class PumpeLogic implements ModelLogic {
  level = 0.3;
  v1Open = false;
  s0 = false;
  check = false;
  /** Motorschutz ausgelöst (Störung eingestellt oder Trockenlauf) */
  tripped = false;
  h1 = false;
  readonly motor = new Motor(0.4);
  /** Anzahl Pumpenstarts, Sekunden Trockenlauf, Überläufe */
  starts = 0;
  dryTime = 0;
  overflows = 0;
  readonly note = new Notice();
  #wasRunning = false;
  #dryHold = 0;

  get ex() { return pack([this.s0, this.level >= HIGH, this.level >= LOW, this.check, this.tripped]); }
  get status() { return this.tripped ? 'Störung: Motorschutz Q1 ausgelöst' : this.note.text; }
  get running() { return this.motor.running; }

  step(ax: number, dt: number) {
    this.note.tick(dt);
    this.h1 = bit(ax, 1);
    this.motor.step(bit(ax, 0) && !this.tripped, dt);
    const running = this.motor.running;
    if (running && !this.#wasRunning) this.starts++;
    this.#wasRunning = running;
    let out = 0;
    if (this.motor.speed > 0.05 && this.level > 0) out = OUTFLOW * this.motor.speed;
    // Trockenlauf: Pumpe läuft ohne Wasser → Motorschutz löst nach 2 s aus
    if (running && this.level < DRY) {
      this.dryTime += dt; this.#dryHold += dt;
      this.note.say('Pumpe läuft trocken!', 2);
      if (this.#dryHold > 2) this.tripped = true;
    } else this.#dryHold = 0;
    const l = this.level + ((this.v1Open ? INFLOW : 0) - out) * dt;
    if (l > 1) { this.overflows++; this.note.say('Störung: Becken läuft über!', 3); }
    this.level = clamp01(l);
  }

  input(name: string, down: boolean) {
    if (name === 's0') this.s0 = down;
    if (name === 'check') this.check = down;
    if (name === 'v1') this.v1Open = down;
    if (name === 'q1') this.tripped = down;
  }

  reset() {
    this.level = 0.3; this.v1Open = false; this.tripped = false; this.starts = 0; this.dryTime = 0; this.overflows = 0;
    this.motor.speed = 0; this.#wasRunning = false; this.#dryHold = 0; this.note.clear();
  }
}
