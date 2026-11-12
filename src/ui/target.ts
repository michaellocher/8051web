/** Übertragung ins Zielsystem über Web Serial (Chrome/Edge). */

interface SerialPortLike {
  open(o: { baudRate: number; dataBits?: number; stopBits?: number; parity?: string; flowControl?: string }): Promise<void>;
  close(): Promise<void>;
  readonly writable: WritableStream<Uint8Array> | null;
  readonly readable: ReadableStream<Uint8Array> | null;
}
interface SerialLike { requestPort(): Promise<SerialPortLike> }

export const serialSupported = () => 'serial' in navigator;

export interface SendOptions {
  baud: number;
  delayMs: number;
  waitEcho: boolean;
  dataBits?: 7 | 8;
  parity?: 'none' | 'even' | 'odd';
  stopBits?: 1 | 2;
  flowControl?: 'none' | 'hardware';
  /** wird vor den HEX-Daten gesendet (z. B. Befehl, der den Bootloader startet) */
  startCommand?: string;
  onProgress(done: number, total: number): void;
  onLog(line: string): void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendHex(hexText: string, o: SendOptions): Promise<void> {
  const serial = (navigator as Navigator & { serial?: SerialLike }).serial;
  if (!serial) throw new Error('Dieser Browser unterstützt Web Serial nicht (Chrome oder Edge verwenden).');
  const port = await serial.requestPort();
  const dataBits = o.dataBits ?? 8, stopBits = o.stopBits ?? 1, parity = o.parity ?? 'none';
  await port.open({ baudRate: o.baud, dataBits, stopBits, parity, flowControl: o.flowControl ?? 'none' });
  o.onLog(`Port geöffnet (${o.baud} Baud, ${dataBits}${parity[0]!.toUpperCase()}${stopBits}${o.flowControl === 'hardware' ? ', RTS/CTS' : ''}).`);
  const writer = port.writable!.getWriter();
  const reader = o.waitEcho ? port.readable!.getReader() : undefined;
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  const lines = hexText.trim().split(/\r?\n/);
  try {
    if (o.startCommand) {
      await writer.write(enc.encode(`${o.startCommand}\r\n`));
      o.onLog(`→ Startbefehl: ${o.startCommand}`);
      await sleep(Math.max(100, o.delayMs));
    }
    for (const [i, line] of lines.entries()) {
      await writer.write(enc.encode(`${line}\r\n`));
      if (reader) {
        const answer = await Promise.race([reader.read(), sleep(1500).then(() => undefined)]);
        if (!answer) throw new Error(`Keine Antwort des Zielsystems nach Zeile ${i + 1}.`);
        if (answer.value) o.onLog(`← ${dec.decode(answer.value).trim()}`);
      }
      if (o.delayMs) await sleep(o.delayMs);
      o.onProgress(i + 1, lines.length);
    }
    o.onLog(`${lines.length} Datensätze übertragen.`);
  } finally {
    writer.releaseLock();
    if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    await port.close().catch(() => {});
    o.onLog('Port geschlossen.');
  }
}
