/** PC-Tastatur mit ASCII-Ausgabe und Strobe (reine Logik, kein DOM). */

/** ASCII-Code zu einem KeyboardEvent.key (nur 7-Bit-ASCII), sonst undefined */
export function asciiFromKey(key: string): number | undefined {
  if (key.length === 1) { const c = key.charCodeAt(0); return c < 128 ? c : undefined; }
  switch (key) {
    case 'Enter': return 13;
    case 'Backspace': return 8;
    case 'Tab': return 9;
    case 'Escape': return 27;
    case 'Delete': return 127;
    default: return undefined;
  }
}

/**
 * Tastatur-Controller: Px.0–Px.6 = ASCII-Code, Px.7 = Strobe. Solange ein Zeichen im Puffer liegt,
 * zeigt die Tastatur den Code und zieht Px.7 auf 0 ("Zeichen bereit"). Das Programm liest das Zeichen
 * und quittiert, indem es Px.7 kurz auf 0 schreibt (fallende Flanke am Latch, z. B. CLR P1.7 / SETB P1.7);
 * dann wird das nächste Zeichen des Puffers (max. 16) bereitgestellt.
 */
export class AsciiKeyboard {
  static readonly CAPACITY = 16;
  readonly queue: number[] = [];
  #ackLatch = true;
  /** zuletzt gedrückte Taste (für die Anzeige) */
  last: number | undefined;
  dropped = 0;

  press(code: number): boolean {
    if (code < 0 || code > 127) return false;
    this.last = code;
    if (this.queue.length >= AsciiKeyboard.CAPACITY) { this.dropped++; return false; }
    this.queue.push(code);
    return true;
  }
  get ready(): boolean { return this.queue.length > 0; }
  drive(): number { return this.queue.length > 0 ? this.queue[0]! & 0x7f : 0xff; }
  /** Port-Latch geschrieben: fallende Flanke an Bit 7 quittiert das Zeichen */
  write(latch: number): void {
    const bit = ((latch >> 7) & 1) === 1;
    if (this.#ackLatch && !bit) this.queue.shift();
    this.#ackLatch = bit;
  }
}
