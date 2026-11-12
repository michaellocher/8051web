/** Farbsensor mit Drehscheibe und Farbtasten-Feld (reine Logik, kein DOM). */

/** Farbcodes des Sensors an Px.0–Px.1 */
export const COLOR_NONE = 0, COLOR_RED = 1, COLOR_BLUE = 2, COLOR_BLACK = 3;
export const COLOR_NAMES = ['grau', 'rot', 'blau', 'schwarz'] as const;

const norm = (a: number) => ((a % 360) + 360) % 360;

/**
 * Drehscheibe mit vier Farbfeldern (je 80° breit, 10° Lücken), davor der feststehende Sensor (oben).
 * Pins: Px.0–1 Farbcode (Eingang), Px.2 = 1 wenn ein Feld mittig vor dem Sensor steht,
 * Px.4 = Motor links, Px.5 = Motor rechts (nur eine Richtung aktiv → Drehung, beide gleich → Stillstand),
 * Px.6 = Sensorlampe (ohne Licht liefert der Sensor Code 0).
 */
export class ColorDisc {
  /** Farbe je Feld, Feld i liegt bei angle + i·90° */
  fields: number[] = [COLOR_RED, COLOR_BLUE, COLOR_BLACK, COLOR_NONE];
  angle = 0;
  /** Drehgeschwindigkeit in Grad/s */
  speed = 120;
  motorLeft = true;
  motorRight = true;
  light = true;

  setPins(p: number) {
    this.motorLeft = ((p >> 4) & 1) === 1;
    this.motorRight = ((p >> 5) & 1) === 1;
    this.light = ((p >> 6) & 1) === 1;
  }
  get direction(): -1 | 0 | 1 {
    if (this.motorRight && !this.motorLeft) return 1;
    if (this.motorLeft && !this.motorRight) return -1;
    return 0;
  }
  step(dt: number) { this.angle = norm(this.angle + this.direction * this.speed * dt); }
  /** Feld unter dem Sensor und Ablage zur Feldmitte in Grad */
  get under(): { index: number; offset: number } {
    const a = norm(-this.angle);
    const index = Math.round(a / 90) % 4;
    let offset = a - Math.round(a / 90) * 90;
    if (offset > 45) offset -= 90;
    return { index, offset };
  }
  get color(): number {
    const { index, offset } = this.under;
    return Math.abs(offset) <= 40 ? this.fields[index]! : COLOR_NONE;
  }
  get centered(): boolean { return Math.abs(this.under.offset) <= 5; }
  /** Pegel der Eingänge */
  inputs(): number {
    const code = this.light ? this.color : 0;
    return 0xf8 | (this.light && this.centered ? 4 : 0) | code;
  }
  cycleField(i: number) { this.fields[i] = ((this.fields[i] ?? 0) + 1) & 3; }
}

/**
 * Farben-Tasten: Lampen D0 = rot, D1 = grün, D2 = gelb, D3 = blau (1 = an);
 * Tasten D4 = rot, D5 = grün, D6 = gelb, D7 = blau (gedrückt = 0).
 */
export class ColorKeys {
  /** gedrückte Tasten als Maske (Bit 0 = rot, 1 = grün, 2 = gelb, 3 = blau) */
  keys = 0;
  /** Lampenmaske aus dem Pinzustand */
  lamps = 0;
  setPins(p: number) { this.lamps = p & 0x0f; }
  press(k: number, down: boolean) { this.keys = down ? this.keys | (1 << k) : this.keys & ~(1 << k); }
  inputs(): number { return 0x0f | ((~this.keys & 0x0f) << 4); }
}

export const KEY_NAMES = ['rot', 'grün', 'gelb', 'blau'] as const;
