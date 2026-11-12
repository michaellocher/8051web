import { OPCODES, type OpInfo, type Operand } from './opcodes.ts';
import { asmHex, bin8, bitDescName, bitName, directName, hex2, hex4 } from './sfr.ts';

/** Eine Zeile im Code-Fenster (wie im Original: eine Zeile pro Byte) */
export interface CodeRow {
  readonly addr: number;
  readonly byte: number;
  /** Adresse des zugehörigen Befehls */
  readonly instrAddr: number;
  /** true für die erste (Opcode-)Zeile eines Befehls */
  readonly head: boolean;
  readonly template: string;
  readonly asm: string;
  readonly bytes: number;
  readonly cycles: number;
  readonly desc: string;
}

export interface Instruction {
  readonly addr: number;
  readonly info: OpInfo;
  readonly raw: readonly number[];
  readonly asm: string;
  readonly rows: readonly CodeRow[];
  /** Sprungziel, falls vorhanden */
  readonly target?: number;
}

const s8 = (v: number) => (v & 0x80 ? v - 0x100 : v);
type Labels = ReadonlyMap<number, string> | undefined;
const lbl = (addr: number, labels: Labels) => labels?.get(addr) ?? asmHex(addr, 4);

export function decodeAt(code: Uint8Array, addr: number, labels?: Labels): Instruction {
  const opcode = code[addr & 0xffff]!;
  const info = OPCODES[opcode]!;
  const raw = Array.from({ length: info.bytes }, (_, i) => code[(addr + i) & 0xffff]!);
  const next = (addr + info.bytes) & 0xffff;

  // Operandenbytes in Kodierreihenfolge zuordnen
  const values: number[][] = info.operands.map(() => []);
  let p = 1;
  for (const idx of info.encodeOrder) {
    const kind = info.operands[idx]!.kind;
    const n = kind === '#const16' || kind === 'adr16' ? 2 : ['dadr', 'badr', '/badr', '#const8', 'rel', 'adr11'].includes(kind) ? 1 : 0;
    for (let i = 0; i < n; i++) values[idx]!.push(raw[p++]!);
  }

  let target: number | undefined;
  const fmt = (o: Operand, v: number[]): string => {
    switch (o.kind) {
      case 'Rn': return `R${o.reg}`;
      case '@Ri': return `@R${o.reg}`;
      case 'dadr': return directName(v[0]!);
      case 'badr': return bitName(v[0]!);
      case '/badr': return `/${bitName(v[0]!)}`;
      case '#const8': return `#${asmHex(v[0]!)}`;
      case '#const16': return `#${asmHex((v[0]! << 8) | v[1]!, 4)}`;
      case 'adr16': target = (v[0]! << 8) | v[1]!; return lbl(target, labels);
      case 'adr11': target = (next & 0xf800) | ((opcode >> 5) << 8) | v[0]!; return lbl(target, labels);
      case 'rel': target = (next + s8(v[0]!)) & 0xffff; return lbl(target, labels);
      default: return o.kind;
    }
  };
  const ops = info.operands.map((o, i) => fmt(o, values[i]!));
  const asm = info.valid ? (ops.length ? `${info.mnemonic} ${ops.join(',')}` : info.mnemonic) : `DB ${asmHex(opcode)}`;

  // Beschreibungen der Operandenbytes
  const byteDesc: string[] = [];
  for (const idx of info.encodeOrder) {
    const o = info.operands[idx]!;
    const v = values[idx]!;
    switch (o.kind) {
      case 'adr16': case '#const16': {
        const name = o.kind === 'adr16' ? 'adr16' : 'const16';
        byteDesc.push(`Highbyte von ${name}`, `Lowbyte von ${name}${o.kind === 'adr16' ? ` ( → ${hex4(target ?? 0)}h )` : ` ( = ${hex4((v[0]! << 8) | v[1]!)}h )`}`);
        break;
      }
      case 'dadr': {
        const prefix = opcode === 0x85 ? (idx === 1 ? 'Quell-' : 'Ziel-') : '';
        byteDesc.push(`${prefix}${prefix ? 'a' : 'A'}dresse im int. RAM ( ${directName(v[0]!)} )`);
        break;
      }
      case 'badr': case '/badr':
        byteDesc.push(`Bit-Adresse im int. RAM ( ${bitDescName(v[0]!)} )`);
        break;
      case '#const8':
        byteDesc.push(`8-Bit-Konstante ( = ${hex2(v[0]!)}h = ${v[0]}d = ${bin8(v[0]!)}b )`);
        break;
      case 'rel':
        byteDesc.push(`relative Sprungentfernung ( ${s8(v[0]!) >= 0 ? '+' : ''}${s8(v[0]!)} → ${hex4(target ?? 0)}h )`);
        break;
      case 'adr11':
        byteDesc.push(`Low-Byte von adr11 ( → ${hex4(target ?? 0)}h )`);
        break;
      default: break;
    }
  }

  const rows: CodeRow[] = raw.map((byte, i) => ({
    addr: (addr + i) & 0xffff,
    byte,
    instrAddr: addr,
    head: i === 0,
    template: i === 0 ? info.template : '',
    asm: i === 0 ? asm : '',
    bytes: i === 0 ? info.bytes : 0,
    cycles: i === 0 ? info.cycles : 0,
    desc: i === 0 ? info.desc : byteDesc[i - 1] ?? '',
  }));

  return { addr, info, raw, asm, rows, ...(target === undefined ? {} : { target }) };
}

/** Disassembliert linear von `start` bis einschließlich `end`. */
export function disassemble(code: Uint8Array, start: number, end: number, labels?: Labels): Instruction[] {
  const out: Instruction[] = [];
  let a = start;
  while (a <= end) {
    const ins = decodeAt(code, a, labels);
    out.push(ins);
    a += ins.info.bytes;
  }
  return out;
}

export interface ListingOptions {
  readonly labels?: ReadonlyMap<number, string>;
  /** Adressen mit Daten (DB/DW) */
  readonly data?: ReadonlySet<number>;
  /** Adressen, an denen sicher ein Befehl beginnt (z. B. bereits ausgeführte PCs) */
  readonly starts?: ReadonlySet<number>;
}

function dataRow(addr: number, byte: number): CodeRow {
  const ch = byte >= 0x20 && byte < 0x7f ? ` = '${String.fromCharCode(byte)}'` : '';
  return {
    addr, byte, instrAddr: addr, head: true, template: 'DB', asm: `DB ${asmHex(byte)}`, bytes: 1, cycles: 0,
    desc: `Datenbyte ( = ${hex2(byte)}h = ${byte}d${ch} )`,
  };
}

/** Code-Fenster-Zeilen von 0 bis `end` (eine Zeile pro Byte). */
export function buildListing(code: Uint8Array, end: number, opts: ListingOptions = {}): CodeRow[] {
  const rows: CodeRow[] = [];
  let a = 0;
  while (a <= end) {
    if (opts.data?.has(a)) { rows.push(dataRow(a, code[a]!)); a++; continue; }
    const ins = decodeAt(code, a, opts.labels);
    const len = ins.info.bytes;
    // Überlappt der Befehl einen bekannten Befehlsanfang oder Daten? Dann als Daten zeigen.
    let cut = 0;
    for (let i = 1; i < len; i++) {
      if (opts.starts?.has(a + i) || opts.data?.has(a + i)) { cut = i; break; }
    }
    if (cut) {
      for (let i = 0; i < cut; i++) rows.push(dataRow(a + i, code[a + i]!));
      a += cut;
      continue;
    }
    rows.push(...ins.rows);
    a += len;
  }
  return rows;
}
