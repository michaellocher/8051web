/**
 * Vollständige 8051-Befehlstabelle (256 Opcodes) mit Mnemonic-Schablonen,
 * Byte-/Zykluszahlen und deutschen Beschreibungen im Stil von 8051winXL.
 */

export type OperandKind =
  | 'A' | 'AB' | 'C' | 'DPTR' | '@DPTR' | '@A+DPTR' | '@A+PC'
  | 'Rn' | '@Ri'
  | 'dadr' | 'badr' | '/badr' | '#const8' | '#const16' | 'adr16' | 'adr11' | 'rel';

export interface Operand {
  readonly kind: OperandKind;
  /** Registernummer bei Rn (0–7) bzw. @Ri (0–1) */
  readonly reg?: number;
}

export interface OpInfo {
  readonly opcode: number;
  readonly mnemonic: string;
  readonly operands: readonly Operand[];
  /** Schablone wie im Original, z. B. "MOV R2,#const8" */
  readonly template: string;
  readonly bytes: number;
  readonly cycles: number;
  readonly desc: string;
  /** Operand-Indizes in der Reihenfolge ihrer Kodierung im Befehlsstrom */
  readonly encodeOrder: readonly number[];
  /** Gehört zum reduzierten Befehlssatz des Modell-Rechners */
  readonly model: boolean;
  readonly valid: boolean;
}

const BYTE_SIZE: Partial<Record<OperandKind, number>> = {
  dadr: 1, badr: 1, '/badr': 1, '#const8': 1, rel: 1, adr11: 1, '#const16': 2, adr16: 2,
};

/** Generische Beschreibungen; "Rn"/"Ri" werden später konkretisiert. */
const DESC: Record<string, string> = {
  'NOP': 'Keine Operation',
  'AJMP adr11': 'Springe zur 11-Bit-Adresse adr11 im aktuellen 2-KByte-Block',
  'LJMP adr16': 'Setze das Programm bei der 16-Bit-Adresse adr16 fort',
  'RR A': 'Rotiere den Akku um ein Bit nach rechts',
  'INC A': 'Erhöhe den Akku um 1',
  'INC dadr': 'Erhöhe den Inhalt von dadr um 1',
  'INC @Ri': 'Erhöhe den Inhalt der Adresse in Ri um 1',
  'INC Rn': 'Erhöhe Rn um 1',
  'JBC badr,rel': 'Springe relativ, wenn der Inhalt von badr=1, und lösche badr',
  'ACALL adr11': 'Rufe das Unterprogramm an der 11-Bit-Adresse adr11 auf',
  'LCALL adr16': 'Rufe das Unterprogramm an der 16-Bit-Adresse adr16 auf',
  'RRC A': 'Rotiere den Akku mit Carry um ein Bit nach rechts',
  'DEC A': 'Vermindere den Akku um 1',
  'DEC dadr': 'Vermindere den Inhalt von dadr um 1',
  'DEC @Ri': 'Vermindere den Inhalt der Adresse in Ri um 1',
  'DEC Rn': 'Vermindere Rn um 1',
  'JB badr,rel': 'Springe relativ zum Programmzähler, wenn der Inhalt von badr=1',
  'RET': 'Rücksprung vom Unterprogramm',
  'RL A': 'Rotiere den Akku um ein Bit nach links',
  'ADD A,#const8': 'Addiere 8-Bit-Konstante zum Akku',
  'ADD A,dadr': 'Addiere den Inhalt von dadr zum Akku',
  'ADD A,@Ri': 'Addiere den Inhalt der Adresse in Ri zum Akku',
  'ADD A,Rn': 'Addiere Rn zum Akku',
  'JNB badr,rel': 'Springe relativ zum Programmzähler, wenn der Inhalt von badr=0',
  'RETI': 'Rücksprung vom Interrupt-Programm',
  'RLC A': 'Rotiere den Akku mit Carry um ein Bit nach links',
  'ADDC A,#const8': 'Addiere 8-Bit-Konstante und Carry zum Akku',
  'ADDC A,dadr': 'Addiere den Inhalt von dadr und Carry zum Akku',
  'ADDC A,@Ri': 'Addiere den Inhalt der Adresse in Ri und Carry zum Akku',
  'ADDC A,Rn': 'Addiere Rn und Carry zum Akku',
  'JC rel': 'Springe relativ zum Programmzähler, wenn Carry=1',
  'ORL dadr,A': 'ODER-Verknüpfung von dadr mit dem Akku, Ergebnis in dadr',
  'ORL dadr,#const8': 'ODER-Verknüpfung von dadr mit 8-Bit-Konstante, Ergebnis in dadr',
  'ORL A,#const8': 'ODER-Verknüpfung des Akkus mit 8-Bit-Konstante',
  'ORL A,dadr': 'ODER-Verknüpfung des Akkus mit dem Inhalt von dadr',
  'ORL A,@Ri': 'ODER-Verknüpfung des Akkus mit dem Inhalt der Adresse in Ri',
  'ORL A,Rn': 'ODER-Verknüpfung des Akkus mit Rn',
  'JNC rel': 'Springe relativ zum Programmzähler, wenn Carry=0',
  'ANL dadr,A': 'UND-Verknüpfung von dadr mit dem Akku, Ergebnis in dadr',
  'ANL dadr,#const8': 'UND-Verknüpfung von dadr mit 8-Bit-Konstante, Ergebnis in dadr',
  'ANL A,#const8': 'UND-Verknüpfung des Akkus mit 8-Bit-Konstante',
  'ANL A,dadr': 'UND-Verknüpfung des Akkus mit dem Inhalt von dadr',
  'ANL A,@Ri': 'UND-Verknüpfung des Akkus mit dem Inhalt der Adresse in Ri',
  'ANL A,Rn': 'UND-Verknüpfung des Akkus mit Rn',
  'JZ rel': 'Springe relativ zum Programmzähler, wenn Akku=0',
  'XRL dadr,A': 'EXKLUSIV-ODER von dadr mit dem Akku, Ergebnis in dadr',
  'XRL dadr,#const8': 'EXKLUSIV-ODER von dadr mit 8-Bit-Konstante, Ergebnis in dadr',
  'XRL A,#const8': 'EXKLUSIV-ODER des Akkus mit 8-Bit-Konstante',
  'XRL A,dadr': 'EXKLUSIV-ODER des Akkus mit dem Inhalt von dadr',
  'XRL A,@Ri': 'EXKLUSIV-ODER des Akkus mit dem Inhalt der Adresse in Ri',
  'XRL A,Rn': 'EXKLUSIV-ODER des Akkus mit Rn',
  'JNZ rel': 'Springe relativ zum Programmzähler, wenn Akku≠0',
  'ORL C,badr': 'ODER-Verknüpfung von Carry mit dem Inhalt von badr',
  'JMP @A+DPTR': 'Springe zur Adresse Akku + Datenzeiger',
  'MOV A,#const8': 'Lade den Akku mit 8-Bit-Konstante',
  'MOV dadr,#const8': 'Lade dadr mit 8-Bit-Konstante',
  'MOV @Ri,#const8': 'Lade die Adresse in Ri mit 8-Bit-Konstante',
  'MOV Rn,#const8': 'Lade Rn mit 8-Bit-Konstante',
  'SJMP rel': 'Springe relativ zum Programmzähler',
  'ANL C,badr': 'UND-Verknüpfung von Carry mit dem Inhalt von badr',
  'MOVC A,@A+PC': 'Lade den Akku aus dem Programmspeicher von Adresse Akku + PC',
  'DIV AB': 'Dividiere Akku durch B (Quotient → A, Rest → B)',
  'MOV dadr,dadr': 'Lade dadr (Ziel) mit dem Inhalt von dadr (Quelle)',
  'MOV dadr,@Ri': 'Lade dadr mit dem Inhalt der Adresse in Ri',
  'MOV dadr,Rn': 'Lade dadr mit Rn',
  'MOV DPTR,#const16': 'Lade den Datenzeiger mit 16-Bit-Konstante',
  'MOV badr,C': 'Lade badr mit Carry',
  'MOVC A,@A+DPTR': 'Lade den Akku aus dem Programmspeicher von Adresse Akku + DPTR',
  'SUBB A,#const8': 'Subtrahiere 8-Bit-Konstante und Carry vom Akku',
  'SUBB A,dadr': 'Subtrahiere den Inhalt von dadr und Carry vom Akku',
  'SUBB A,@Ri': 'Subtrahiere den Inhalt der Adresse in Ri und Carry vom Akku',
  'SUBB A,Rn': 'Subtrahiere Rn und Carry vom Akku',
  'ORL C,/badr': 'ODER-Verknüpfung von Carry mit dem negierten Inhalt von badr',
  'MOV C,badr': 'Lade Carry mit dem Inhalt von badr',
  'INC DPTR': 'Erhöhe den Datenzeiger um 1',
  'MUL AB': 'Multipliziere Akku mit B (Low-Byte → A, High-Byte → B)',
  '???': 'Ungültiger Befehl (reserviert)',
  'MOV @Ri,dadr': 'Lade die Adresse in Ri mit dem Inhalt von dadr',
  'MOV Rn,dadr': 'Lade Rn mit dem Inhalt von dadr',
  'ANL C,/badr': 'UND-Verknüpfung von Carry mit dem negierten Inhalt von badr',
  'CPL badr': 'Invertiere den Inhalt von badr',
  'CPL C': 'Invertiere Carry',
  'CJNE A,#const8,rel': 'Vergleiche Akku mit 8-Bit-Konstante, springe relativ wenn ungleich',
  'CJNE A,dadr,rel': 'Vergleiche Akku mit dem Inhalt von dadr, springe relativ wenn ungleich',
  'CJNE @Ri,#const8,rel': 'Vergleiche Inhalt der Adresse in Ri mit 8-Bit-Konstante, springe relativ wenn ungleich',
  'CJNE Rn,#const8,rel': 'Vergleiche Rn mit 8-Bit-Konstante, springe relativ wenn ungleich',
  'PUSH dadr': 'Lege den Inhalt von dadr auf den Stack',
  'CLR badr': 'Lösche den Inhalt von badr',
  'CLR C': 'Lösche Carry',
  'SWAP A': 'Vertausche High- und Low-Nibble des Akkus',
  'XCH A,dadr': 'Tausche den Akku mit dem Inhalt von dadr',
  'XCH A,@Ri': 'Tausche den Akku mit dem Inhalt der Adresse in Ri',
  'XCH A,Rn': 'Tausche den Akku mit Rn',
  'POP dadr': 'Hole dadr vom Stack',
  'SETB badr': 'Setze Inhalt von badr',
  'SETB C': 'Setze Carry',
  'DA A': 'Dezimalkorrektur des Akkus (BCD)',
  'DJNZ dadr,rel': 'Vermindere dadr um 1, springe relativ wenn ungleich 0',
  'XCHD A,@Ri': 'Tausche Low-Nibble von Akku und Inhalt der Adresse in Ri',
  'DJNZ Rn,rel': 'Vermindere Rn um 1, springe relativ wenn ungleich 0',
  'MOVX A,@DPTR': 'Lade den Akku aus dem ext. RAM von Adresse DPTR',
  'MOVX A,@Ri': 'Lade den Akku aus dem ext. RAM von Adresse in Ri',
  'CLR A': 'Lösche den Akku',
  'MOV A,dadr': 'Lade den Akku mit dem Inhalt von dadr',
  'MOV A,@Ri': 'Lade den Akku mit dem Inhalt der Adresse in Ri',
  'MOV A,Rn': 'Lade den Akku mit Rn',
  'MOVX @DPTR,A': 'Speichere den Akku im ext. RAM an Adresse DPTR',
  'MOVX @Ri,A': 'Speichere den Akku im ext. RAM an Adresse in Ri',
  'CPL A': 'Invertiere den Akku',
  'MOV dadr,A': 'Lade dadr mit dem Akku',
  'MOV @Ri,A': 'Lade die Adresse in Ri mit dem Akku',
  'MOV Rn,A': 'Lade Rn mit dem Akku',
};

const op = (kind: OperandKind, reg?: number): Operand => (reg === undefined ? { kind } : { kind, reg });

/** Spalten 4–F jeder Zeile folgen einem festen Muster: A/#/dadr/@R0/@R1/R0..R7 */
function rowOperands(col: number): Operand {
  if (col === 4) return op('#const8');
  if (col === 5) return op('dadr');
  if (col <= 7) return op('@Ri', col - 6);
  return op('Rn', col - 8);
}

function decodeOpcode(o: number): { mn: string; ops: Operand[] } {
  const hi = o >> 4;
  const lo = o & 0x0f;
  // Spalte 1: AJMP/ACALL in allen Zeilen
  if (lo === 1) return { mn: hi & 1 ? 'ACALL' : 'AJMP', ops: [op('adr11')] };

  if (lo >= 4) {
    const src = rowOperands(lo);
    const A = op('A');
    switch (hi) {
      case 0x0: return lo === 4 ? { mn: 'INC', ops: [A] } : { mn: 'INC', ops: [src] };
      case 0x1: return lo === 4 ? { mn: 'DEC', ops: [A] } : { mn: 'DEC', ops: [src] };
      case 0x2: return { mn: 'ADD', ops: [A, src] };
      case 0x3: return { mn: 'ADDC', ops: [A, src] };
      case 0x4: return { mn: 'ORL', ops: [A, src] };
      case 0x5: return { mn: 'ANL', ops: [A, src] };
      case 0x6: return { mn: 'XRL', ops: [A, src] };
      case 0x7: return lo === 4 ? { mn: 'MOV', ops: [A, op('#const8')] }
        : lo === 5 ? { mn: 'MOV', ops: [op('dadr'), op('#const8')] }
        : { mn: 'MOV', ops: [src, op('#const8')] };
      case 0x8: return lo === 4 ? { mn: 'DIV', ops: [op('AB')] }
        : lo === 5 ? { mn: 'MOV', ops: [op('dadr'), op('dadr')] }
        : { mn: 'MOV', ops: [op('dadr'), src] };
      case 0x9: return { mn: 'SUBB', ops: [A, src] };
      case 0xa: return lo === 4 ? { mn: 'MUL', ops: [op('AB')] }
        : lo === 5 ? { mn: '???', ops: [] }
        : { mn: 'MOV', ops: [src, op('dadr')] };
      case 0xb: return lo === 4 ? { mn: 'CJNE', ops: [A, op('#const8'), op('rel')] }
        : lo === 5 ? { mn: 'CJNE', ops: [A, op('dadr'), op('rel')] }
        : { mn: 'CJNE', ops: [src, op('#const8'), op('rel')] };
      case 0xc: return lo === 4 ? { mn: 'SWAP', ops: [A] } : { mn: 'XCH', ops: [A, src] };
      case 0xd: return lo === 4 ? { mn: 'DA', ops: [A] }
        : lo === 5 ? { mn: 'DJNZ', ops: [op('dadr'), op('rel')] }
        : lo <= 7 ? { mn: 'XCHD', ops: [A, src] }
        : { mn: 'DJNZ', ops: [src, op('rel')] };
      case 0xe: return lo === 4 ? { mn: 'CLR', ops: [A] } : { mn: 'MOV', ops: [A, src] };
      case 0xf: return lo === 4 ? { mn: 'CPL', ops: [A] } : { mn: 'MOV', ops: [src, A] };
    }
  }

  // Spalten 0, 2, 3
  const table: Record<number, { mn: string; ops: Operand[] }> = {
    0x00: { mn: 'NOP', ops: [] },
    0x02: { mn: 'LJMP', ops: [op('adr16')] },
    0x03: { mn: 'RR', ops: [op('A')] },
    0x10: { mn: 'JBC', ops: [op('badr'), op('rel')] },
    0x12: { mn: 'LCALL', ops: [op('adr16')] },
    0x13: { mn: 'RRC', ops: [op('A')] },
    0x20: { mn: 'JB', ops: [op('badr'), op('rel')] },
    0x22: { mn: 'RET', ops: [] },
    0x23: { mn: 'RL', ops: [op('A')] },
    0x30: { mn: 'JNB', ops: [op('badr'), op('rel')] },
    0x32: { mn: 'RETI', ops: [] },
    0x33: { mn: 'RLC', ops: [op('A')] },
    0x40: { mn: 'JC', ops: [op('rel')] },
    0x42: { mn: 'ORL', ops: [op('dadr'), op('A')] },
    0x43: { mn: 'ORL', ops: [op('dadr'), op('#const8')] },
    0x50: { mn: 'JNC', ops: [op('rel')] },
    0x52: { mn: 'ANL', ops: [op('dadr'), op('A')] },
    0x53: { mn: 'ANL', ops: [op('dadr'), op('#const8')] },
    0x60: { mn: 'JZ', ops: [op('rel')] },
    0x62: { mn: 'XRL', ops: [op('dadr'), op('A')] },
    0x63: { mn: 'XRL', ops: [op('dadr'), op('#const8')] },
    0x70: { mn: 'JNZ', ops: [op('rel')] },
    0x72: { mn: 'ORL', ops: [op('C'), op('badr')] },
    0x73: { mn: 'JMP', ops: [op('@A+DPTR')] },
    0x80: { mn: 'SJMP', ops: [op('rel')] },
    0x82: { mn: 'ANL', ops: [op('C'), op('badr')] },
    0x83: { mn: 'MOVC', ops: [op('A'), op('@A+PC')] },
    0x90: { mn: 'MOV', ops: [op('DPTR'), op('#const16')] },
    0x92: { mn: 'MOV', ops: [op('badr'), op('C')] },
    0x93: { mn: 'MOVC', ops: [op('A'), op('@A+DPTR')] },
    0xa0: { mn: 'ORL', ops: [op('C'), op('/badr')] },
    0xa2: { mn: 'MOV', ops: [op('C'), op('badr')] },
    0xa3: { mn: 'INC', ops: [op('DPTR')] },
    0xb0: { mn: 'ANL', ops: [op('C'), op('/badr')] },
    0xb2: { mn: 'CPL', ops: [op('badr')] },
    0xb3: { mn: 'CPL', ops: [op('C')] },
    0xc0: { mn: 'PUSH', ops: [op('dadr')] },
    0xc2: { mn: 'CLR', ops: [op('badr')] },
    0xc3: { mn: 'CLR', ops: [op('C')] },
    0xd0: { mn: 'POP', ops: [op('dadr')] },
    0xd2: { mn: 'SETB', ops: [op('badr')] },
    0xd3: { mn: 'SETB', ops: [op('C')] },
    0xe0: { mn: 'MOVX', ops: [op('A'), op('@DPTR')] },
    0xe2: { mn: 'MOVX', ops: [op('A'), op('@Ri', 0)] },
    0xe3: { mn: 'MOVX', ops: [op('A'), op('@Ri', 1)] },
    0xf0: { mn: 'MOVX', ops: [op('@DPTR'), op('A')] },
    0xf2: { mn: 'MOVX', ops: [op('@Ri', 0), op('A')] },
    0xf3: { mn: 'MOVX', ops: [op('@Ri', 1), op('A')] },
  };
  const entry = table[o];
  if (!entry) throw new Error(`Opcode ${o.toString(16)} nicht abgedeckt`);
  return entry;
}

const TWO_CYCLE = new Set([
  'AJMP', 'LJMP', 'ACALL', 'LCALL', 'RET', 'RETI', 'JBC', 'JB', 'JNB', 'JC', 'JNC', 'JZ', 'JNZ',
  'SJMP', 'JMP', 'MOVC', 'MOVX', 'CJNE', 'PUSH', 'POP', 'DJNZ',
]);

function cyclesFor(mn: string, ops: readonly Operand[]): number {
  if (mn === 'MUL' || mn === 'DIV') return 4;
  if (TWO_CYCLE.has(mn)) return 2;
  const kinds = ops.map((o) => o.kind).join(',');
  if (mn === 'ORL' || mn === 'ANL') {
    if (ops[0]?.kind === 'C') return 2;
    if (kinds === 'dadr,#const8') return 2;
  }
  if (mn === 'XRL' && kinds === 'dadr,#const8') return 2;
  if (mn === 'INC' && kinds === 'DPTR') return 2;
  if (mn === 'MOV') {
    if (kinds === 'dadr,#const8' || kinds === 'dadr,dadr' || kinds === 'dadr,@Ri' || kinds === 'dadr,Rn'
      || kinds === 'DPTR,#const16' || kinds === 'badr,C' || kinds === '@Ri,dadr' || kinds === 'Rn,dadr') return 2;
  }
  return 1;
}

export function operandTemplate(o: Operand): string {
  if (o.kind === 'Rn') return `R${o.reg}`;
  if (o.kind === '@Ri') return `@R${o.reg}`;
  return o.kind;
}

function genericKey(mn: string, ops: readonly Operand[]): string {
  return ops.length ? `${mn} ${ops.map((o) => o.kind).join(',')}` : mn;
}

/**
 * Befehlssatz des Modell-Rechners laut „Modell-Rechner-Befehlssatz.doc" des Originals (62 Befehlsformen):
 * kein SUBB/MUL/DIV/SWAP, keine Unterprogramme (LCALL/RET), kein Stack, keine @Ri-Adressierung,
 * Bitbefehle nur über das Carry-Flag (plus JB/JNB).
 */
const MODEL_OPCODES: ReadonlySet<number> = new Set([
  0x74, 0x75, 0xe5, 0xf5, 0x85, 0x00, 0x90, 0xe0, 0xf0, // MOV …, NOP, MOV DPTR, MOVX @DPTR
  0xe4, 0xf4, 0x04, 0x05, 0xa3, 0x14, 0x15, // CLR/CPL A, INC/DEC
  0x24, 0x34, 0x25, 0x35, 0xd4, 0x23, 0x33, 0x03, 0x13, // ADD/ADDC, DA, Rotationen
  0xd3, 0xc3, 0xb3, // SETB/CLR/CPL C
  0x54, 0x55, 0x53, 0x52, 0x44, 0x43, 0x45, 0x42, 0x64, 0x63, 0x65, 0x62, // ANL/ORL/XRL
  0x02, 0x80, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0xd5, 0xb4, // Sprünge
  ...[0x78, 0xe8, 0xf8, 0xa8, 0x88, 0x08, 0x18, 0x28, 0x38, 0x58, 0xd8, 0xb8] // Rn-Spalten (R0–R7)
    .flatMap((base) => Array.from({ length: 8 }, (_, n) => base + n)),
]);

function build(o: number): OpInfo {
  const { mn, ops } = decodeOpcode(o);
  const key = genericKey(mn, ops);
  const descRaw = DESC[key] ?? DESC[mn] ?? '';
  const regOp = ops.find((x) => x.kind === 'Rn' || x.kind === '@Ri');
  const desc = regOp?.kind === 'Rn'
    ? descRaw.replaceAll('Rn', `R${regOp.reg}`)
    : regOp?.kind === '@Ri' ? descRaw.replaceAll('Ri', `R${regOp.reg}`) : descRaw;
  const template = ops.length ? `${mn} ${ops.map(operandTemplate).join(',')}` : mn;
  const bytes = 1 + ops.reduce((n, x) => n + (BYTE_SIZE[x.kind] ?? 0), 0);
  const encodeOrder = o === 0x85 ? [1, 0] : ops.map((_, i) => i);
  return {
    opcode: o,
    mnemonic: mn,
    operands: ops,
    template,
    bytes,
    cycles: mn === '???' ? 1 : cyclesFor(mn, ops),
    desc,
    encodeOrder,
    model: MODEL_OPCODES.has(o),
    valid: mn !== '???',
  };
}

export const OPCODES: readonly OpInfo[] = Array.from({ length: 256 }, (_, o) => build(o));

/** Alle Opcodes je Mnemonic – vom Assembler für die Operandensuche genutzt. */
export const BY_MNEMONIC: ReadonlyMap<string, readonly OpInfo[]> = Map.groupBy(
  OPCODES.filter((x) => x.valid),
  (x) => x.mnemonic,
);
