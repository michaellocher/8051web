/** Intel-HEX lesen und schreiben (Record-Typen 00, 01, 02, 04). */

export interface HexImage {
  /** Adresse → Byte */
  readonly data: Map<number, number>;
  readonly start: number;
  readonly end: number;
}

export class HexError extends Error {
  readonly line: number;
  constructor(message: string, line: number) {
    super(`Zeile ${line}: ${message}`);
    this.line = line;
  }
}

export function parseIntelHex(text: string): HexImage {
  const data = new Map<number, number>();
  let base = 0;
  let lineNo = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    lineNo++;
    const line = rawLine.trim();
    if (!line) continue;
    if (!line.startsWith(':')) throw new HexError('Datensatz beginnt nicht mit ":"', lineNo);
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.fromHex(line.slice(1));
    } catch {
      throw new HexError('ungültige Hex-Ziffern', lineNo);
    }
    if (bytes.length < 5) throw new HexError('Datensatz zu kurz', lineNo);
    const len = bytes[0]!;
    if (bytes.length !== len + 5) throw new HexError('Längenangabe stimmt nicht', lineNo);
    const sum = bytes.reduce((s, b) => s + b, 0) & 0xff;
    if (sum !== 0) throw new HexError('Prüfsummenfehler', lineNo);
    const addr = (bytes[1]! << 8) | bytes[2]!;
    const type = bytes[3]!;
    const payload = bytes.subarray(4, 4 + len);
    switch (type) {
      case 0x00:
        payload.forEach((b, i) => data.set((base + addr + i) & 0xffff, b));
        break;
      case 0x01:
        return finish(data);
      case 0x02:
        base = ((payload[0]! << 8) | payload[1]!) << 4;
        break;
      case 0x04:
        base = ((payload[0]! << 8) | payload[1]!) << 16;
        break;
      default:
        break; // 03/05: Startadresse – für den 8051 ohne Bedeutung
    }
  }
  return finish(data);
}

function finish(data: Map<number, number>): HexImage {
  const keys = [...data.keys()];
  return {
    data,
    start: keys.length ? Math.min(...keys) : 0,
    end: keys.length ? Math.max(...keys) : -1,
  };
}

/** Erzeugt Intel-HEX mit 16 Byte pro Datensatz; Lücken werden übersprungen. */
export function toIntelHex(data: ReadonlyMap<number, number>): string {
  const addrs = [...data.keys()].toSorted((a, b) => a - b);
  const lines: string[] = [];
  let i = 0;
  while (i < addrs.length) {
    const start = addrs[i]!;
    const chunk: number[] = [];
    while (i < addrs.length && addrs[i] === start + chunk.length && chunk.length < 16) {
      chunk.push(data.get(addrs[i]!)!);
      i++;
    }
    lines.push(record(start, 0, chunk));
  }
  lines.push(':00000001FF');
  return `${lines.join('\n')}\n`;
}

function record(addr: number, type: number, payload: readonly number[]): string {
  const bytes = Uint8Array.from([payload.length, addr >> 8, addr & 0xff, type, ...payload, 0]);
  const sum = bytes.reduce((s, b) => s + b, 0);
  bytes[bytes.length - 1] = (0x100 - (sum & 0xff)) & 0xff;
  return `:${bytes.toHex().toUpperCase()}`;
}
