/**
 * Zwei-Pass-Assembler für den 8051 (Syntax angelehnt an Intel ASM51 / Keil A51).
 *
 * Unterstützt: Labels, ORG, DB, DW, DS, EQU, SET, BIT, DATA, IDATA, XDATA, CODE, END,
 * Ausdrücke mit + - * / MOD AND OR XOR NOT SHL SHR HIGH LOW << >> & | ^ ~ ( ), $,
 * Bitadressierung "P1.0", Zahlen 12, 0Ch, 0x0C, 1010b, 0b1010, 17o/17q, Zeichen 'A'.
 * Generische Sprünge JMP/CALL werden als LJMP/LCALL übersetzt.
 */
import { BY_MNEMONIC, type OpInfo, type OperandKind } from './opcodes.ts';
import { BIT_SYMBOLS, SFR } from './sfr.ts';

export interface AsmDiagnostic {
  readonly line: number;
  readonly message: string;
}

export interface ListingLine {
  readonly line: number;
  readonly addr: number | undefined;
  readonly bytes: readonly number[];
  readonly source: string;
}

export interface AsmResult {
  readonly bytes: Map<number, number>;
  readonly errors: AsmDiagnostic[];
  readonly listing: ListingLine[];
  readonly symbols: Map<string, number>;
  /** Code-Labels: Adresse → Name (für die Disassembler-Anzeige) */
  readonly labels: Map<number, string>;
  /** Adresse → Quellzeile */
  readonly lineOf: Map<number, number>;
  /** Adressen, die Daten (DB/DW) statt Befehlen enthalten */
  readonly data: Set<number>;
}

class AsmError extends Error {}

// ───────────────────────── Operanden-Klassifizierung ─────────────────────────
type OperandClass =
  | { cls: 'A' | 'AB' | 'C' | 'DPTR' | '@DPTR' | '@A+DPTR' | '@A+PC' }
  | { cls: 'Rn' | '@Ri'; reg: number }
  | { cls: 'imm' | 'nbit' | 'expr'; expr: string };

function classify(text: string): OperandClass {
  const s = text.trim();
  const u = s.toUpperCase().replace(/\s+/g, '');
  switch (u) {
    case 'A': case 'AB': case 'C': case 'DPTR': case '@DPTR': case '@A+DPTR': case '@A+PC':
      return { cls: u };
  }
  let m = /^R([0-7])$/.exec(u);
  if (m) return { cls: 'Rn', reg: Number(m[1]) };
  m = /^@R([01])$/.exec(u);
  if (m) return { cls: '@Ri', reg: Number(m[1]) };
  if (s.startsWith('#')) return { cls: 'imm', expr: s.slice(1) };
  if (s.startsWith('/')) return { cls: 'nbit', expr: s.slice(1) };
  return { cls: 'expr', expr: s };
}

function matches(kind: OperandKind, reg: number | undefined, op: OperandClass): boolean {
  switch (kind) {
    case 'Rn': case '@Ri': return op.cls === kind && 'reg' in op && op.reg === reg;
    case '#const8': case '#const16': return op.cls === 'imm';
    case '/badr': return op.cls === 'nbit';
    case 'dadr': case 'badr': case 'rel': case 'adr11': case 'adr16': return op.cls === 'expr';
    default: return op.cls === kind;
  }
}

function splitOperands(s: string): string[] {
  const out: string[] = [];
  let depth = 0, quote = '', cur = '';
  for (const ch of s) {
    if (quote) { cur += ch; if (ch === quote) quote = ''; continue; }
    if (ch === "'" || ch === '"') { quote = ch; cur += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim() || out.length) out.push(cur.trim());
  return out;
}

function stripComment(s: string): string {
  let quote = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (quote) { if (ch === quote) quote = ''; continue; }
    if (ch === "'" || ch === '"') quote = ch;
    else if (ch === ';') return s.slice(0, i);
  }
  return s;
}

// ───────────────────────── Ausdrücke ─────────────────────────
type Tok = { t: 'num' | 'id' | 'op' | 'str'; v: string };

function tokenize(s: string): Tok[] {
  const toks: Tok[] = [];
  const re = /\s*(?:(<<|>>|[-+*/%&|^~().$])|([0-9][0-9A-Za-z]*)|([A-Za-z_?][\w?]*)|'([^']*)'|"([^"]*)")/y;
  let i = 0;
  while (i < s.length) {
    if (/^\s*$/.test(s.slice(i))) break;
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m) throw new AsmError(`Unerwartetes Zeichen "${s.slice(i).trim()[0]}"`);
    if (m[1]) toks.push({ t: m[1] === '$' ? 'id' : 'op', v: m[1] });
    else if (m[2]) toks.push({ t: 'num', v: m[2] });
    else if (m[3]) toks.push({ t: 'id', v: m[3].toUpperCase() });
    else toks.push({ t: 'str', v: m[4] ?? m[5] ?? '' });
    i = re.lastIndex;
  }
  return toks;
}

function parseNumber(s: string): number {
  const u = s.toUpperCase();
  let m: RegExpExecArray | null;
  if ((m = /^0X([0-9A-F]+)$/.exec(u))) return parseInt(m[1]!, 16);
  if ((m = /^0B([01]+)$/.exec(u))) return parseInt(m[1]!, 2);
  if ((m = /^([0-9][0-9A-F]*)H$/.exec(u))) return parseInt(m[1]!, 16);
  if ((m = /^([01]+)B$/.exec(u))) return parseInt(m[1]!, 2);
  if ((m = /^([0-7]+)[OQ]$/.exec(u))) return parseInt(m[1]!, 8);
  if ((m = /^([0-9]+)D?$/.exec(u))) return parseInt(m[1]!, 10);
  throw new AsmError(`Ungültige Zahl "${s}"`);
}

interface EvalCtx {
  readonly pc: number;
  lookup(name: string): number | undefined;
  /** im 1. Pass dürfen Symbole fehlen */
  readonly lenient: boolean;
}

const WORD_OPS: Record<string, string> = { MOD: '%', AND: '&', OR: '|', XOR: '^', SHL: '<<', SHR: '>>', NOT: '~' };

export function evaluate(expr: string, ctx: EvalCtx): { value: number; undefinedSym?: string } {
  const toks = tokenize(expr).map((t) => (t.t === 'id' && WORD_OPS[t.v] ? { t: 'op' as const, v: WORD_OPS[t.v]! } : t));
  let pos = 0;
  let undefinedSym: string | undefined;
  const peek = () => toks[pos];
  const next = () => toks[pos++];
  const expectOp = (v: string) => {
    const t = next();
    if (!t || t.t !== 'op' || t.v !== v) throw new AsmError(`"${v}" erwartet`);
  };

  const levels: string[][] = [['|'], ['^'], ['&'], ['<<', '>>'], ['+', '-'], ['*', '/', '%']];
  const binary = (lvl: number): number => {
    if (lvl >= levels.length) return unary();
    let left = binary(lvl + 1);
    for (;;) {
      const t = peek();
      if (!t || t.t !== 'op' || !levels[lvl]!.includes(t.v)) return left;
      pos++;
      const right = binary(lvl + 1);
      switch (t.v) {
        case '|': left |= right; break;
        case '^': left ^= right; break;
        case '&': left &= right; break;
        case '<<': left <<= right; break;
        case '>>': left >>= right; break;
        case '+': left += right; break;
        case '-': left -= right; break;
        case '*': left *= right; break;
        case '/': if (!right) { if (!ctx.lenient) throw new AsmError('Division durch 0'); left = 0; } else left = Math.trunc(left / right); break;
        case '%': if (!right) { if (!ctx.lenient) throw new AsmError('Division durch 0'); left = 0; } else left %= right; break;
      }
    }
  };
  const unary = (): number => {
    const t = peek();
    if (t?.t === 'op' && (t.v === '-' || t.v === '~' || t.v === '+')) {
      pos++;
      const v = unary();
      return t.v === '-' ? -v : t.v === '~' ? ~v & 0xffff : v;
    }
    if (t?.t === 'id' && (t.v === 'HIGH' || t.v === 'LOW')) {
      pos++;
      const v = unary();
      return t.v === 'HIGH' ? (v >> 8) & 0xff : v & 0xff;
    }
    return bitSelect();
  };
  const bitSelect = (): number => {
    let v = primary();
    while (peek()?.t === 'op' && peek()!.v === '.') {
      pos++;
      const bit = primary();
      if (bit < 0 || bit > 7) throw new AsmError('Bitnummer muss 0–7 sein');
      if (v >= 0x20 && v <= 0x2f) v = (v - 0x20) * 8 + bit;
      else if (v >= 0x80 && v <= 0xff && v % 8 === 0) v = v + bit;
      else if (!undefinedSym) throw new AsmError(`Adresse ${v.toString(16)}h ist nicht bitadressierbar`);
    }
    return v;
  };
  const primary = (): number => {
    const t = next();
    if (!t) throw new AsmError('Ausdruck unvollständig');
    if (t.t === 'num') return parseNumber(t.v);
    if (t.t === 'str') {
      if (t.v.length !== 1) throw new AsmError('Zeichenkonstante muss genau ein Zeichen enthalten');
      return t.v.charCodeAt(0);
    }
    if (t.t === 'op' && t.v === '(') { const v = binary(0); expectOp(')'); return v; }
    if (t.t === 'id') {
      if (t.v === '$') return ctx.pc;
      const v = ctx.lookup(t.v);
      if (v !== undefined) return v;
      undefinedSym ??= t.v;
      if (ctx.lenient) return 0;
      throw new AsmError(`Symbol "${t.v}" ist nicht definiert`);
    }
    throw new AsmError(`Unerwartetes "${t.v}"`);
  };

  if (!toks.length) throw new AsmError('Ausdruck fehlt');
  const value = binary(0);
  if (pos < toks.length) throw new AsmError(`Unerwartetes "${toks[pos]!.v}"`);
  return undefinedSym === undefined ? { value } : { value, undefinedSym };
}

// ───────────────────────── Anweisungen ─────────────────────────
type Stmt =
  | { kind: 'none' }
  | { kind: 'instr'; info: OpInfo; ops: OperandClass[] }
  | { kind: 'org'; expr: string }
  | { kind: 'db' | 'dw'; items: string[] }
  | { kind: 'ds'; expr: string }
  | { kind: 'def'; name: string; expr: string; directive: string }
  | { kind: 'end' };

interface Parsed { line: number; source: string; label?: string; stmt: Stmt }

const DEF_DIRECTIVES = new Set(['EQU', 'SET', 'BIT', 'DATA', 'IDATA', 'XDATA', 'CODE']);
const IGNORED = new Set(['USING', 'NAME', 'CSEG', 'DSEG', 'BSEG', 'XSEG', 'RSEG', 'PUBLIC', 'EXTRN']);

function sizeOf(stmt: Stmt, ctx: EvalCtx): number {
  switch (stmt.kind) {
    case 'instr': return stmt.info.bytes;
    case 'db': return stmt.items.reduce((n, it) => n + (/^(['"]).*\1$/s.test(it) && it.length !== 3 ? it.length - 2 : 1), 0);
    case 'dw': return stmt.items.length * 2;
    case 'ds': return evaluate(stmt.expr, ctx).value;
    default: return 0;
  }
}

function findInstr(mn: string, ops: OperandClass[]): OpInfo {
  if (mn === 'JMP' && ops[0]?.cls === 'expr') mn = 'LJMP';
  if (mn === 'CALL') mn = 'LCALL';
  const cands = BY_MNEMONIC.get(mn);
  if (!cands) throw new AsmError(`Unbekannter Befehl "${mn}"`);
  const hit = cands.find((c) => c.operands.length === ops.length
    && c.operands.every((o, i) => matches(o.kind, o.reg, ops[i]!)));
  if (!hit) {
    const forms = [...new Set(cands.map((c) => c.template.replace(/R[0-7]\b/g, 'Rn').replace(/@R[01]/g, '@Ri')))];
    throw new AsmError(`Ungültige Operanden für ${mn}. Möglich: ${forms.join(' | ')}`);
  }
  return hit;
}

function parseLine(source: string, line: number): Parsed {
  let s = stripComment(source).trim();
  const p: Parsed = { line, source, stmt: { kind: 'none' } };
  if (!s || s.startsWith('$')) return p;

  const lm = /^([A-Za-z_?][\w?]*)\s*:/.exec(s);
  if (lm) { p.label = lm[1]!.toUpperCase(); s = s.slice(lm[0].length).trim(); }
  if (!s) return p;

  const m = /^([A-Za-z_?][\w?]*)(?:\s+(.*))?$/s.exec(s);
  if (!m) throw new AsmError('Befehl erwartet');
  const word = m[1]!.toUpperCase();
  const rest = (m[2] ?? '').trim();

  // "NAME EQU wert" (ohne Doppelpunkt)
  const dm = /^([A-Za-z_?][\w?]*)\s*(.*)$/s.exec(rest);
  if (dm && DEF_DIRECTIVES.has(dm[1]!.toUpperCase()) && !p.label) {
    p.stmt = { kind: 'def', name: word, directive: dm[1]!.toUpperCase(), expr: dm[2]!.trim() };
    return p;
  }
  if (DEF_DIRECTIVES.has(word) && p.label) {
    p.stmt = { kind: 'def', name: p.label, directive: word, expr: rest };
    delete p.label;
    return p;
  }

  switch (word) {
    case 'ORG': p.stmt = { kind: 'org', expr: rest }; return p;
    case 'DB': case 'DEFB': case 'BYTE': p.stmt = { kind: 'db', items: splitOperands(rest) }; return p;
    case 'DW': case 'DEFW': case 'WORD': p.stmt = { kind: 'dw', items: splitOperands(rest) }; return p;
    case 'DS': case 'DEFS': p.stmt = { kind: 'ds', expr: rest }; return p;
    case 'END': p.stmt = { kind: 'end' }; return p;
  }
  if (IGNORED.has(word)) {
    const at = /\bAT\s+(.+)$/i.exec(rest);
    if (word === 'CSEG' && at) p.stmt = { kind: 'org', expr: at[1]! };
    return p;
  }
  const ops = rest ? splitOperands(rest).map(classify) : [];
  p.stmt = { kind: 'instr', info: findInstr(word, ops), ops };
  return p;
}

const PREDEF: ReadonlyMap<string, number> = new Map<string, number>([
  ...Object.entries(SFR),
  ...BIT_SYMBOLS,
]);

export function assemble(source: string): AsmResult {
  const errors: AsmDiagnostic[] = [];
  const symbols = new Map<string, number>();
  const labelNames = new Set<string>();
  const lines = source.split(/\r?\n/);
  const parsed: Parsed[] = [];

  lines.forEach((src, i) => {
    try {
      parsed.push(parseLine(src, i + 1));
    } catch (e) {
      errors.push({ line: i + 1, message: (e as Error).message });
      parsed.push({ line: i + 1, source: src, stmt: { kind: 'none' } });
    }
  });

  const lookup = (name: string) => symbols.get(name) ?? PREDEF.get(name);
  const RESERVED = new Set(['A', 'AB', 'C', 'DPTR', 'PC', 'R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', '$']);
  const define = (name: string, value: number, line: number, redefinable = false) => {
    // F1 (PSW.1) ist in A51 nicht vordefiniert und darf als Label dienen
    if ((PREDEF.has(name) && name !== 'F1') || RESERVED.has(name)) {
      errors.push({ line, message: `"${name}" ist ein reservierter Name (Register/SFR/Bit) und kann nicht neu definiert werden` });
      return;
    }
    if (symbols.has(name) && !redefinable && symbols.get(name) !== value) {
      errors.push({ line, message: `Symbol "${name}" ist mehrfach definiert` });
    }
    symbols.set(name, value);
  };

  // Pass 1: Adressen vergeben
  const addrOf = new Map<Parsed, number>();
  const pendingDefs: Parsed[] = [];
  let pc = 0;
  for (const p of parsed) {
    if (p.stmt.kind === 'end') { addrOf.set(p, pc); break; }
    const ctx: EvalCtx = { pc, lookup, lenient: true };
    try {
      if (p.label) { define(p.label, pc, p.line); labelNames.add(p.label); }
      addrOf.set(p, pc);
      switch (p.stmt.kind) {
        case 'org': {
          const r = evaluate(p.stmt.expr, ctx);
          if (r.undefinedSym) throw new AsmError(`ORG: Symbol "${r.undefinedSym}" muss vorher definiert sein`);
          pc = r.value & 0xffff;
          addrOf.set(p, pc);
          break;
        }
        case 'def': {
          const r = evaluate(p.stmt.expr, ctx);
          if (r.undefinedSym) pendingDefs.push(p);
          else define(p.stmt.name, r.value, p.line, p.stmt.directive === 'SET');
          break;
        }
        default:
          pc += sizeOf(p.stmt, ctx);
      }
    } catch (e) {
      errors.push({ line: p.line, message: (e as Error).message });
    }
  }
  // Vorwärtsreferenzen in EQU auflösen
  for (let round = 0; round < 8 && pendingDefs.length; round++) {
    for (const p of [...pendingDefs]) {
      if (p.stmt.kind !== 'def') continue;
      const r = evaluate(p.stmt.expr, { pc: addrOf.get(p) ?? 0, lookup, lenient: true });
      if (!r.undefinedSym) { define(p.stmt.name, r.value, p.line); pendingDefs.splice(pendingDefs.indexOf(p), 1); }
    }
  }
  for (const p of pendingDefs) {
    try {
      if (p.stmt.kind === 'def') evaluate(p.stmt.expr, { pc: 0, lookup, lenient: false });
    } catch (e) {
      errors.push({ line: p.line, message: (e as Error).message });
    }
  }

  // Pass 2: Code erzeugen
  const bytes = new Map<number, number>();
  const listing: ListingLine[] = [];
  const lineOf = new Map<number, number>();
  const data = new Set<number>();
  for (const p of parsed) {
    const addr = addrOf.get(p);
    const out: number[] = [];
    if (addr !== undefined) {
      const ctx: EvalCtx = { pc: addr, lookup, lenient: false };
      try {
        if (p.stmt.kind === 'def' && p.stmt.directive === 'SET') {
          define(p.stmt.name, evaluate(p.stmt.expr, ctx).value, p.line, true);
        }
        emit(p.stmt, addr, ctx, out);
      } catch (e) {
        errors.push({ line: p.line, message: (e as Error).message });
      }
      out.forEach((b, i) => {
        const a = (addr + i) & 0xffff;
        if (bytes.has(a)) errors.push({ line: p.line, message: `Adresse ${a.toString(16).toUpperCase()}h wird überschrieben` });
        bytes.set(a, b & 0xff);
        lineOf.set(a, p.line);
        if (p.stmt.kind === 'db' || p.stmt.kind === 'dw') data.add(a);
      });
    }
    const showAddr = p.stmt.kind !== 'none' && p.stmt.kind !== 'def' && p.stmt.kind !== 'end' ? addr : p.label ? addr : undefined;
    listing.push({ line: p.line, addr: showAddr, bytes: out, source: p.source });
    if (p.stmt.kind === 'end') break;
  }

  const labels = new Map<number, string>();
  for (const name of labelNames) {
    const v = symbols.get(name)!;
    if (!labels.has(v)) labels.set(v, name);
  }
  errors.sort((a, b) => a.line - b.line);
  return { bytes, errors, listing, symbols, labels, lineOf, data };
}

function emit(stmt: Stmt, addr: number, ctx: EvalCtx, out: number[]): void {
  switch (stmt.kind) {
    case 'db':
      for (const item of stmt.items) {
        const sm = /^(['"])(.*)\1$/s.exec(item);
        if (sm && sm[2]!.length !== 1) for (const ch of sm[2]!) out.push(ch.charCodeAt(0) & 0xff);
        else {
          const v = evaluate(item, ctx).value;
          if (v < -128 || v > 255) throw new AsmError(`DB-Wert ${v} passt nicht in ein Byte`);
          out.push(v & 0xff);
        }
      }
      return;
    case 'dw':
      for (const item of stmt.items) {
        const v = evaluate(item, ctx).value;
        out.push((v >> 8) & 0xff, v & 0xff);
      }
      return;
    case 'instr':
      encode(stmt.info, stmt.ops, addr, ctx, out);
      return;
    default:
      return;
  }
}

function encode(info: OpInfo, ops: OperandClass[], addr: number, ctx: EvalCtx, out: number[]): void {
  const next = (addr + info.bytes) & 0xffff;
  let opcode = info.opcode;
  const operandBytes: number[] = [];
  for (const idx of info.encodeOrder) {
    const o = info.operands[idx]!;
    const cls = ops[idx]!;
    if (!('expr' in cls)) continue;
    const v = evaluate(cls.expr, ctx).value;
    switch (o.kind) {
      case 'dadr':
        if (v < 0 || v > 0xff) throw new AsmError(`Direkte Adresse ${v} außerhalb 0–FFh`);
        operandBytes.push(v);
        break;
      case 'badr': case '/badr':
        if (v < 0 || v > 0xff) throw new AsmError(`Bitadresse ${v} außerhalb 0–FFh`);
        operandBytes.push(v);
        break;
      case '#const8':
        if (v < -128 || v > 0xff) throw new AsmError(`Konstante ${v} passt nicht in 8 Bit`);
        operandBytes.push(v & 0xff);
        break;
      case '#const16': case 'adr16':
        if (v < -0x8000 || v > 0xffff) throw new AsmError(`Wert ${v} passt nicht in 16 Bit`);
        operandBytes.push((v >> 8) & 0xff, v & 0xff);
        break;
      case 'rel': {
        const d = v - next;
        if (d < -128 || d > 127) throw new AsmError(`Sprungziel zu weit entfernt (${d} Byte, erlaubt −128…+127)`);
        operandBytes.push(d & 0xff);
        break;
      }
      case 'adr11':
        if ((v & 0xf800) !== (next & 0xf800)) throw new AsmError('Sprungziel liegt nicht im selben 2-KByte-Block');
        opcode = (opcode & 0x1f) | (((v >> 8) & 7) << 5);
        operandBytes.push(v & 0xff);
        break;
      default:
        break;
    }
  }
  out.push(opcode, ...operandBytes);
}
