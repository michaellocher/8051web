/**
 * Rolltreppe (Modellvariante A, Schließer): Eine Rolltreppe fährt nach oben. Sie läuft nach EIN dauerhaft oder
 * automatisch, wenn die Lichtschranke S4 am Einstieg einen Fahrgast erkennt (mit Nachlaufzeit, bis der Fahrgast
 * oben ist). Die STOP-Taster S2 (unten) und S3 (oben) und AUS müssen sofort abschalten.
 *
 * Ax.0 K1  Motorschütz Rolltreppe                Ex.0 S0  Taster EIN
 * Ax.1 H1  Meldeleuchte Betrieb                  Ex.1 S1  Taster AUS
 * Ax.2 H2  Meldeleuchte Stop/Störung             Ex.2 S2  Taster STOP unten
 *                                                Ex.3 S3  Taster STOP oben
 *                                                Ex.4 S4  Lichtschranke Einstieg (Fahrgast erkannt)
 *                                                Ex.5 Q1  Motorschutz ausgelöst (1 = Störung)
 * Fahrgäste werden im Modellfenster mit „Person kommt" erzeugt. Fahrtzeit nach oben bei vollem Tempo: 9 s.
 */
import { bit, pack, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

/** Position 0 = unten (Flur), 0,1 = Treppenanfang, 0,9 = Treppenende, 1 = oben angekommen */
export interface Passenger { pos: number }
const RIDE = 0.1, WALK = 0.2;

export class RolltreppeLogic implements ModelLogic {
  s0 = false; s1 = false; s2 = false; s3 = false; q1 = false;
  /** Taster „Person kommt" gehalten (sperrt Lichtschranke) */
  beamBtn = false;
  /** Bandgeschwindigkeit 0..1 */
  speed = 0;
  /** Wegstrecke der Stufen (für die Animation) */
  travel = 0;
  readonly people: Passenger[] = [];
  arrived = 0;
  stranded = 0;
  hazards = 0;
  h1 = false; h2 = false;
  readonly note = new Notice();
  #cmd = false;
  #stopT = 0;
  #hazard = false;

  get beam() { return this.beamBtn || this.people.some((p) => p.pos < 0.12); }
  get ex() { return pack([this.s0, this.s1, this.s2, this.s3, this.beam, this.q1]); }
  get running() { return this.speed > 0.3; }
  get status() { return this.q1 ? 'Störung: Motorschutz Q1 ausgelöst' : this.note.text; }

  step(ax: number, dt: number) {
    this.note.tick(dt);
    const cmd = bit(ax, 0) && !this.q1;
    this.h1 = bit(ax, 1); this.h2 = bit(ax, 2);
    const onStairs = this.people.some((p) => p.pos >= 0.1 && p.pos < 0.9);
    const manualStop = this.s1 || this.s2 || this.s3 || this.q1;
    if (this.#cmd && !cmd && onStairs && !manualStop) {
      this.stranded++;
      this.note.say('Rolltreppe schaltet zu früh ab: Fahrgäste stehen auf der Treppe!', 5);
    }
    this.#cmd = cmd;
    // Not-Halt ohne Wirkung?
    if ((this.s2 || this.s3) && cmd) {
      this.#stopT += dt;
      if (this.#stopT > 0.5 && !this.#hazard) { this.#hazard = true; this.hazards++; this.note.say('GEFAHR: STOP gedrückt, aber der Antrieb läuft weiter!', 6); }
    } else { this.#stopT = 0; if (!this.s2 && !this.s3) this.#hazard = false; }
    const tau = cmd ? 1.2 : 0.5;
    this.speed += ((cmd ? 1 : 0) - this.speed) * Math.min(1, dt / tau);
    this.travel += this.speed * dt * 60;
    const v = RIDE * this.speed * dt;
    for (const p of this.people) {
      if (p.pos < 0.1) p.pos = Math.min(0.1, p.pos + WALK * dt);
      else if (p.pos < 0.9) p.pos += v;
      else p.pos += Math.max(v, 0) + (this.speed < 0.3 ? 0.08 * dt : 0);
    }
    for (let i = this.people.length - 1; i >= 0; i--) {
      if (this.people[i]!.pos >= 1) { this.people.splice(i, 1); this.arrived++; }
    }
  }

  input(name: string, down: boolean) {
    if (name === 's0') this.s0 = down;
    if (name === 's1') this.s1 = down;
    if (name === 's2') this.s2 = down;
    if (name === 's3') this.s3 = down;
    if (name === 'q1') this.q1 = down;
    if (name === 'person') {
      if (down && !this.beamBtn && this.people.length < 6) this.people.push({ pos: 0 });
      this.beamBtn = down;
    }
  }

  reset() {
    this.speed = 0; this.people.length = 0; this.arrived = 0; this.stranded = 0; this.hazards = 0; this.q1 = false;
    this.#cmd = false; this.#stopT = 0; this.#hazard = false; this.note.clear();
  }
}
