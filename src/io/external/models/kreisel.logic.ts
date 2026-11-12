/**
 * Kreiselpumpe mit Durchflusswächter: Der Sensor S2 liefert nur dann Impulse, wenn die Pumpe fördert.
 * Läuft die Pumpe trocken (kein Zulauf), muss die Steuerung abschalten und Alarm geben.
 *
 * Ax.0 M1  Pumpenmotor                          Ex.0 S0  Taster AUS (rot)
 * Ax.1 H1  Meldelampe „Alarm"                   Ex.1 S1  Taster EIN (grün)
 *                                               Ex.2 S2  Durchflusssensor (Impulse ca. 8 Hz bei Förderung)
 */
import { Motor, bit, pack, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

export class KreiselLogic implements ModelLogic {
  readonly motor = new Motor(0.3);
  /** Zulauf unterbrochen (Fehlerinjektion) */
  dry = false;
  damaged = false;
  alarm = false;
  aus = false;
  ein = false;
  phase = 0;
  dryTime = 0;
  delivered = 0;
  readonly note = new Notice();

  get flowing() { return this.motor.speed > 0.5 && !this.dry && !this.damaged; }
  get ex() { return pack([this.aus, this.ein, this.flowing && this.phase % 1 < 0.5]); }
  get status() {
    if (this.damaged) return 'Pumpe beschädigt: zu lange trocken gelaufen. Modell zurücksetzen (↺).';
    if (this.motor.running && this.dry) return 'Trockenlauf! Pumpe fördert nichts.';
    return this.note.text;
  }

  step(ax: number, dt: number) {
    this.note.tick(dt);
    this.alarm = bit(ax, 1);
    this.motor.step(bit(ax, 0) && !this.damaged, dt);
    if (this.flowing) { this.phase += 8 * this.motor.speed * dt; this.delivered += 3 * this.motor.speed * dt; }
    if (this.motor.running && this.dry) {
      this.dryTime += dt;
      if (this.dryTime > 4) { this.damaged = true; this.motor.speed = 0; }
    } else this.dryTime = Math.max(0, this.dryTime - dt * 0.2);
  }

  input(name: string, down: boolean) {
    if (name === 'aus') this.aus = down;
    if (name === 'ein') this.ein = down;
    if (name === 'dry') { this.dry = down; this.note.say(down ? 'Zulauf unterbrochen.' : 'Zulauf wieder frei.', 3); }
  }

  reset() {
    this.motor.speed = 0; this.dry = false; this.damaged = false; this.dryTime = 0; this.phase = 0; this.delivered = 0; this.note.clear();
  }
}
