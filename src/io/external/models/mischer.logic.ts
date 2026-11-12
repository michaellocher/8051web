/**
 * Mischbehälter (Modellvariante A, Schließer): Zwei Komponenten werden über je ein Ventilpaar
 * (V·.1 grob + V·.2 fein, parallele Leitungen) zudosiert; die Durchflusszähler QI1/QI2 liefern
 * pro 0,01 Behältervolumen einen Impuls. Danach wird gerührt und auf Solltemperatur geheizt,
 * anschließend über V3 entleert.
 *
 * Ax.0 V1.1 Komponente 1 grob (0,06/s)           Ex.0 QI1 Impulse Durchfluss Komponente 1
 * Ax.1 V1.2 Komponente 1 fein (0,02/s)           Ex.1 QI2 Impulse Durchfluss Komponente 2
 * Ax.2 V2.1 Komponente 2 grob (0,06/s)           Ex.2 TIS max. Temperatur erreicht (≥ 60 °C)
 * Ax.3 V2.2 Komponente 2 fein (0,02/s)           Ex.3 LIS1 Behälter nicht leer
 * Ax.4 V3   Ablassventil                          Ex.4 LIS2 Behälter voll (≥ 90 %)
 * Ax.5 H    Heizung                               Ex.5 S1  Taster START
 * Ax.6 M    Rührwerk                              Ex.6 S2  Taster Hand (z. B. Entleeren)
 * Ax.7 H1   Meldeleuchte ALARM
 */
import { Motor, bit, pack, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

export const PULSE = 0.01;
const COARSE = 0.06, FINE = 0.02, DRAIN = 0.1, HEAT = 6, TMAX = 60;

export class MischerLogic implements ModelLogic {
  vol1 = 0;
  vol2 = 0;
  temp = 20;
  /** Durchmischung 0..1 */
  mix = 0;
  v = [false, false, false, false];
  v3 = false;
  heater = false;
  alarm = false;
  s1 = false;
  s2 = false;
  readonly motor = new Motor(0.4);
  good = 0;
  bad = 0;
  overflows = 0;
  scorched = false;
  readonly note = new Notice();
  #judged = false;
  #peak = 20;
  #noMix = 0;

  get level() { return this.vol1 + this.vol2; }
  get ex() {
    return pack([this.#pulse(this.vol1), this.#pulse(this.vol2), this.temp >= TMAX, this.level > 0.03, this.level >= 0.9, this.s1, this.s2]);
  }
  get status() { return this.note.text; }
  #pulse(v: number) { return (v / PULSE) % 1 >= 0.5; }

  step(ax: number, dt: number) {
    this.note.tick(dt);
    this.v = [bit(ax, 0), bit(ax, 1), bit(ax, 2), bit(ax, 3)];
    this.v3 = bit(ax, 4); this.heater = bit(ax, 5); this.alarm = bit(ax, 7);
    this.motor.step(bit(ax, 6), dt);
    const f1 = (this.v[0] ? COARSE : 0) + (this.v[1] ? FINE : 0);
    const f2 = (this.v[2] ? COARSE : 0) + (this.v[3] ? FINE : 0);
    if (f1 + f2 > 0 && this.mix > 0) this.mix = Math.max(0, this.mix - 2 * dt);
    this.vol1 += f1 * dt;
    this.vol2 += f2 * dt;
    // Entleeren: beide Komponenten anteilig
    if (this.v3 && this.level > 0) {
      const d = Math.min(this.level, DRAIN * dt), tot = this.level;
      if (!this.#judged && tot > 0.2) this.#judge();
      this.vol1 -= d * (this.vol1 / tot);
      this.vol2 -= d * (this.vol2 / tot);
      if (this.level < 1e-6) { this.vol1 = 0; this.vol2 = 0; }
    }
    if (this.level < 0.02 && !this.v3) { this.#judged = false; this.#peak = 20; }
    if (this.level > 1) {
      this.overflows++;
      const k = 1 / this.level; this.vol1 *= k; this.vol2 *= k;
      this.note.say('Störung: Mischbehälter läuft über!', 4);
    }
    // Rühren und Heizen
    if (this.motor.running && this.level > 0.1) this.mix = Math.min(1, this.mix + 0.25 * dt);
    const covered = this.level >= 0.1;
    if (this.heater) {
      if (covered) {
        this.temp += HEAT * dt;
        this.#noMix = this.motor.running ? 0 : this.#noMix + dt;
        if (this.#noMix > 3) { this.scorched = true; this.note.say('Heizen ohne Rühren: Mischgut setzt sich an!', 4); }
      } else {
        this.temp += 15 * dt;
        this.note.say('Heizung läuft ohne Füllung (Trockenheizung)!', 3);
      }
    } else this.#noMix = 0;
    this.temp -= (this.temp - 20) * 0.01 * dt;
    this.#peak = Math.max(this.#peak, this.temp);
    if (this.temp > 90) this.note.say('Übertemperatur!', 3);
    if (this.alarm) this.note.say('ALARM', 1);
  }

  #judge() {
    this.#judged = true;
    const ok = Math.abs(this.vol1 - 0.2) <= 0.02 && Math.abs(this.vol2 - 0.3) <= 0.02 && this.#peak >= TMAX && this.mix >= 0.9 && !this.scorched;
    if (ok) this.good++;
    else {
      this.bad++;
      this.note.say('Charge fehlerhaft: Mengenverhältnis, Temperatur oder Durchmischung falsch.', 5);
    }
    this.scorched = false;
  }

  input(name: string, down: boolean) {
    if (name === 's1') this.s1 = down;
    if (name === 's2') this.s2 = down;
  }

  reset() {
    this.vol1 = 0; this.vol2 = 0; this.temp = 20; this.mix = 0; this.good = 0; this.bad = 0; this.overflows = 0;
    this.scorched = false; this.motor.speed = 0; this.#judged = false; this.#peak = 20; this.#noMix = 0; this.note.clear();
  }
}
