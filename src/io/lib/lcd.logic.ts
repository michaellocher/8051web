/**
 * LCD 2×16 mit HD44780-Controller im 4-Bit-Interface (reine Logik, kein DOM).
 * Pins: Px.0–Px.3 = D4–D7, Px.4 = R/W, Px.6 = E, Px.7 = RS (Px.5 unbenutzt).
 * Übernahme mit fallender Flanke an E. Eigene Zeichen (CGRAM) werden nicht unterstützt.
 */
export class Hd44780 {
  readonly ddram = new Uint8Array(0x68).fill(0x20);
  ac = 0;
  inc = 1;
  shiftDisplay = false;
  displayOn = false;
  cursorOn = false;
  blinkOn = false;
  /** Anzeigeverschiebung (Zeichenpositionen) */
  offset = 0;
  /** Interface-Breite: nach dem Einschalten 8 Bit, per Function Set auf 4 Bit */
  fourBit = false;
  /** wird bei jeder Änderung des Anzeigeinhalts gesetzt */
  dirty = true;
  #hi: number | undefined;
  #readPhase = 0;
  #lastE = 0;
  #cgram = false;
  #latch = 0xff;

  static #clamp(a: number): number { return a < 0x28 ? a : a < 0x40 ? 0x40 : a < 0x68 ? a : 0; }

  command(c: number) {
    if (c & 0x80) { this.ac = Hd44780.#clamp(c & 0x7f); this.#cgram = false; }
    else if (c & 0x40) this.#cgram = true; // CGRAM wird nicht unterstützt: folgende Daten werden verworfen
    else if (c & 0x20) this.fourBit = (c & 0x10) === 0;
    else if (c & 0x10) {
      const right = (c & 0x04) !== 0;
      if (c & 0x08) this.offset += right ? -1 : 1; else this.ac = Hd44780.#clamp(this.ac + (right ? 1 : -1));
    } else if (c & 0x08) { this.displayOn = (c & 4) !== 0; this.cursorOn = (c & 2) !== 0; this.blinkOn = (c & 1) !== 0; }
    else if (c & 0x04) { this.inc = c & 2 ? 1 : -1; this.shiftDisplay = (c & 1) !== 0; }
    else if (c & 0x02) { this.ac = 0; this.offset = 0; this.#cgram = false; }
    else if (c & 0x01) { this.ddram.fill(0x20); this.ac = 0; this.offset = 0; this.inc = 1; this.#cgram = false; }
    this.dirty = true;
  }

  data(d: number) {
    if (this.#cgram) return;
    this.ddram[this.ac] = d;
    this.ac = Hd44780.#clamp(this.ac + this.inc);
    if (this.ac === 0x28 && this.inc > 0) this.ac = 0x40;
    if (this.shiftDisplay) this.offset += this.inc;
    this.dirty = true;
  }

  /** Port-Latch geschrieben (Px.0–Px.7) */
  write(latch: number) {
    this.#latch = latch;
    const e = (latch >> 6) & 1;
    if (this.#lastE && !e) {
      const rs = (latch >> 7) & 1, rw = (latch >> 4) & 1;
      if (rw) {
        this.#readPhase ^= 1;
        if (this.#readPhase === 0 && rs) { this.ac = Hd44780.#clamp(this.ac + this.inc); this.dirty = true; }
      } else {
        const nib = latch & 0x0f;
        if (!this.fourBit) { if (rs) this.data(nib << 4); else this.command(nib << 4); }
        else if (this.#hi === undefined) this.#hi = nib;
        else { const b = (this.#hi << 4) | nib; this.#hi = undefined; if (rs) this.data(b); else this.command(b); }
      }
    }
    this.#lastE = e;
  }

  /** Pegel am Port beim Lesen (R/W = 1 und E = 1): Busy-Flag immer 0, Adresszähler bzw. Daten */
  drive(latch: number = this.#latch): number {
    const rw = (latch >> 4) & 1, e = (latch >> 6) & 1;
    if (!rw || !e) return 0xff;
    const rs = (latch >> 7) & 1;
    const byte = rs ? this.ddram[this.ac]! : this.ac & 0x7f;
    return 0xf0 | (this.#readPhase === 0 ? byte >> 4 : byte & 0x0f);
  }

  /** Zeichencode in Anzeigespalte c (0–15) der Zeile r (0–1) */
  charAt(r: number, c: number): number {
    return this.ddram[(((c + this.offset) % 40) + 40) % 40 + r * 0x40]!;
  }
  /** DDRAM-Adresse in Anzeigespalte c der Zeile r */
  addrAt(r: number, c: number): number { return (((c + this.offset) % 40) + 40) % 40 + r * 0x40; }

  static glyph(ch: number): string {
    return ch >= 0x20 && ch < 0x7f ? String.fromCharCode(ch) : ch === 0xdf ? '°' : ch >= 0xa0 ? '·' : ' ';
  }
  /** Sichtbarer Text der Zeile (16 Zeichen); leer bei ausgeschalteter Anzeige */
  text(r: number): string {
    let s = '';
    for (let c = 0; c < 16; c++) s += this.displayOn ? Hd44780.glyph(this.charAt(r, c)) : ' ';
    return s;
  }
}
