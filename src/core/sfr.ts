/** Special-Function-Register des 8051 (plus P4/P5 wie beim SAB 80C515/535). */

export const SFR = {
  P0: 0x80, SP: 0x81, DPL: 0x82, DPH: 0x83, PCON: 0x87,
  TCON: 0x88, TMOD: 0x89, TL0: 0x8a, TL1: 0x8b, TH0: 0x8c, TH1: 0x8d,
  P1: 0x90, SCON: 0x98, SBUF: 0x99, P2: 0xa0, IE: 0xa8, P3: 0xb0, IP: 0xb8,
  PSW: 0xd0, ACC: 0xe0, P4: 0xe8, B: 0xf0, P5: 0xf8,
} as const;

export type SfrName = keyof typeof SFR;

export const SFR_NAMES: ReadonlyMap<number, SfrName> = new Map(
  Object.entries(SFR).map(([k, v]) => [v, k as SfrName]),
);

/** SFR-Adressen der Ports P0..P5 */
export const PORT_ADDR = [SFR.P0, SFR.P1, SFR.P2, SFR.P3, SFR.P4, SFR.P5] as const;

/** Benannte Bits (Bit-Adresse → Name), höchstwertiges Bit zuerst je Register. */
export const BIT_NAMES_BY_REG: Readonly<Partial<Record<SfrName, readonly string[]>>> = {
  TCON: ['TF1', 'TR1', 'TF0', 'TR0', 'IE1', 'IT1', 'IE0', 'IT0'],
  SCON: ['SM0', 'SM1', 'SM2', 'REN', 'TB8', 'RB8', 'TI', 'RI'],
  IE: ['EA', '', '', 'ES', 'ET1', 'EX1', 'ET0', 'EX0'],
  IP: ['', '', '', 'PS', 'PT1', 'PX1', 'PT0', 'PX0'],
  P3: ['RD', 'WR', 'T1', 'T0', 'INT1', 'INT0', 'TXD', 'RXD'],
  PSW: ['CY', 'AC', 'F0', 'RS1', 'RS0', 'OV', 'F1', 'P'],
};

export const BIT_SYMBOLS: ReadonlyMap<string, number> = new Map(
  Object.entries(BIT_NAMES_BY_REG).flatMap(([reg, names]) =>
    (names ?? []).flatMap((n, i) => (n ? [[n, SFR[reg as SfrName] + 7 - i] as const] : [])),
  ),
);

const BIT_BY_ADDR: ReadonlyMap<number, string> = new Map(
  [...BIT_SYMBOLS].map(([n, a]) => [a, n]),
);

/** Bit-Adresse → Byte-Adresse und Bitnummer */
export function bitLocation(bit: number): { byte: number; bit: number } {
  return bit < 0x80
    ? { byte: 0x20 + (bit >> 3), bit: bit & 7 }
    : { byte: bit & 0xf8, bit: bit & 7 };
}

export const hex2 = (v: number) => (v & 0xff).toString(16).toUpperCase().padStart(2, '0');
export const hex4 = (v: number) => (v & 0xffff).toString(16).toUpperCase().padStart(4, '0');
export const bin8 = (v: number) => (v & 0xff).toString(2).padStart(8, '0');

/** Assembler-Hexschreibweise mit führender Null, z. B. 0E0h */
export function asmHex(v: number, digits = 2): string {
  const s = v.toString(16).toUpperCase().padStart(digits, '0');
  return /^[A-F]/.test(s) ? `0${s}h` : `${s}h`;
}

export function directName(addr: number): string {
  if (addr >= 0x80) return SFR_NAMES.get(addr) ?? asmHex(addr);
  return asmHex(addr);
}

export function bitName(bit: number): string {
  const named = BIT_BY_ADDR.get(bit);
  if (named) return named;
  const { byte, bit: n } = bitLocation(bit);
  const reg = SFR_NAMES.get(byte);
  return reg ? `${reg}.${n}` : `${asmHex(byte)}.${n}`;
}

/** Name für die Beschreibungsspalte: Ports wie im Original als "P0.7" */
export function bitDescName(bit: number): string {
  const { byte, bit: n } = bitLocation(bit);
  const reg = SFR_NAMES.get(byte);
  if (reg && /^P\d$/.test(reg)) return `${reg}.${n}`;
  return bitName(bit);
}
