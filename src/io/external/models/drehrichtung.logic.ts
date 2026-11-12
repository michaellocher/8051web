/**
 * Drehrichtungserkennung (Modellvariante A): Eine Scheibe mit rotem Segment (Fahne, 50° lang) läuft an
 * zwei Gabelsensoren B1 und B2 vorbei, die 25° versetzt sitzen. Aus der Reihenfolge der Signale
 * erkennt die Steuerung die Drehrichtung. Im Uhrzeigersinn (Rechtslauf) trifft die Fahne zuerst B1,
 * im Gegenuhrzeigersinn (Linkslauf) zuerst B2. Die Fahne ist länger als der Sensorabstand,
 * bei der steigenden Flanke von B1 ist B2 also bereits aktiv (Linkslauf) oder noch inaktiv (Rechtslauf).
 *
 * Ax.0 H1  Meldeleuchte Drehrichtung rechts (↻)    Ex.0 S0  Schalter Antrieb EIN
 * Ax.1 H2  Meldeleuchte Drehrichtung links (↺)     Ex.1 B1  Sensor 1 (Fahne vor Sensor)
 *                                                  Ex.2 B2  Sensor 2
 * Die Drehrichtung wird im Modellfenster gewählt (Rechtslauf/Linkslauf, auch während des Laufs).
 * Störungen (Blitz): Sensor B1 bzw. B2 defekt (Signal bleibt 0).
 */
import { bit, pack, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

export const ARC = 50;
export const SENSOR_GAP = 25;
/** Winkel von B1 (Uhrzeigersinn, 0° = rechts, 90° = unten); B2 liegt SENSOR_GAP weiter */
export const ANG_B1 = -20;
const SPEED = 240;

const norm = (a: number) => ((a % 360) + 360) % 360;

export class DrehrichtungLogic implements ModelLogic {
  /** Scheibenwinkel in Grad (Uhrzeigersinn) */
  phi = 0;
  /** Winkelgeschwindigkeit in °/s (positiv = Uhrzeigersinn) */
  omega = 0;
  s0 = false;
  /** gewählte Richtung: 1 = rechts (Uhrzeigersinn), −1 = links */
  dirSel: 1 | -1 = 1;
  b1Fault = false;
  b2Fault = false;
  h1 = false;
  h2 = false;
  readonly note = new Notice();

  /** Fahne beginnt bei Scheibenwinkel 0° */
  #covered(angle: number) { return norm(angle - this.phi) <= ARC; }
  get b1() { return !this.b1Fault && this.#covered(ANG_B1); }
  get b2() { return !this.b2Fault && this.#covered(ANG_B1 + SENSOR_GAP); }
  get ex() { return pack([this.s0, this.b1, this.b2]); }
  get status() {
    const f = [this.b1Fault ? 'Sensor B1 defekt' : '', this.b2Fault ? 'Sensor B2 defekt' : ''].filter(Boolean).join(', ');
    return f ? `Störung: ${f}` : this.note.text;
  }

  step(ax: number, dt: number) {
    this.note.tick(dt);
    this.h1 = bit(ax, 0); this.h2 = bit(ax, 1);
    const target = this.s0 ? this.dirSel * SPEED : 0;
    this.omega += (target - this.omega) * Math.min(1, dt / 0.4);
    this.phi = norm(this.phi + this.omega * dt);
    if (this.h1 && this.h2) this.note.say('Beide Richtungsleuchten gleichzeitig an!', 2);
  }

  input(name: string, down: boolean) {
    if (name === 's0') this.s0 = down;
    if (name === 'rechts' && down) this.dirSel = 1;
    if (name === 'links' && down) this.dirSel = -1;
    if (name === 'b1') this.b1Fault = down;
    if (name === 'b2') this.b2Fault = down;
  }

  reset() { this.phi = 0; this.omega = 0; this.s0 = false; this.b1Fault = false; this.b2Fault = false; this.note.clear(); }
}
