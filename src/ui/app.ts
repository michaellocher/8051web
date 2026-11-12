import '../styles/global.css';
/**
 * Steuerung der Oberfläche: verbindet CPU, Speicheransichten, Code-Fenster, Ports und Dialoge.
 */
import { assemble, type AsmResult } from '../core/asm.ts';
import { Cpu8051, IRQ_NAMES, isError, type Access, type StepTrace } from '../core/cpu.ts';
import { buildListing, decodeAt } from '../core/disasm.ts';
import { parseIntelHex, toIntelHex } from '../core/hex.ts';
import { parseMeta, type SimMode } from '../core/meta.ts';
import { encryptHex, generatePassword, openPwFile, parsePwFile, WrongPassword, type PwFile, type SourceAttachment } from '../core/pwhex.ts';
import { OPCODES } from '../core/opcodes.ts';
import { SFR, SFR_NAMES, hex2, hex4 } from '../core/sfr.ts';
import { DEVICES, DEVICE_BY_ID } from '../io/registry.ts';
import { CodeView } from './codeview.ts';
import { openExternalWindows } from '../io/external/frame.ts';
import { $, $$, download, h, inlineEdit, isVisible, parseHexInput } from './dom.ts';
import { Editor } from './editor.ts';
import { sendHex, serialSupported } from './target.ts';
import { AsmView } from './asmview.ts';
import { autoloadEnabled, beep, checkForUpdate, hasWatchedFile, pickFile, pickerSupported, setAutoload } from './autoload.ts';
import { MemoryWindows } from './memwin.ts';
import { copyScreenRegion } from './screenshot.ts';
import { arrangeWindows } from './winutil.ts';
import { cancelFlows, currentGeneration, flash, initFlow, isCurrent, packet, setStopAfterAnimation } from './flow.ts';
import { HexView } from './hexview.ts';
import { PORT_LAYOUT, PortManager, type DeviceConfig } from './ports.ts';

// ───────────────────────── Zustand ─────────────────────────
const STORE_KEY = '8051web:v1';
const SPEEDS = [0.5, 1, 2, 3, 5, 10, 25, 50, 100, 250, 1000] as const;
const CLOCKS = [12e6, 11.0592e6, 24e6, 1e6] as const;

interface Program {
  name: string;
  bytes: Map<number, number>;
  labels: Map<number, string>;
  data: Set<number>;
}

interface Saved {
  mode?: SimMode;
  devices?: DeviceConfig;
  source?: string;
  sourceName?: string;
  hex?: string;
  hexName?: string;
  speed?: number;
  clock?: number;
  theme?: 'light' | 'dark';
  asmcol?: boolean;
  loaded?: 'asm' | 'hex' | 'pw';
  /** verschlüsselte Datei (nie den Klartext speichern) */
  pw?: string;
  /** Optionen wie im Original-Optionendialog */
  options?: { chead: boolean; stopAnim: boolean };
  /** Gerätebelegung je Programm (entspricht „HEXname.INI" des Originals) */
  devicesByProgram?: Record<string, { mode: SimMode; config: Record<string, string> }>;
}

const examples = Object.entries(
  import.meta.glob<string>('../examples/*.asm', { query: '?raw', import: 'default', eager: true }),
).toSorted(([a], [b]) => a.localeCompare(b)).map(([path, src]) => ({ file: path.split('/').at(-1)!, src, meta: parseMeta(src) }));

const cpu = new Cpu8051();
const ports = new PortManager(cpu);
const app = $('[data-app]');
let mode: SimMode = 'int';
let running: 'stop' | 'run' | 'turbo' = 'stop';
let speedIdx = 4;
let clockIdx = 0;
let program: Program = { name: '–', bytes: new Map(), labels: new Map(), data: new Set() };
let source = '';
let sourceName = 'programm.asm';
let loadedKind: 'asm' | 'hex' | 'pw' = 'asm';
/** Passwortschutz des geladenen Programms */
let lock: 'none' | 'locked' | 'unlocked' = 'none';
let pendingPw: { file: PwFile; text: string } | undefined;
let lastTrace: StepTrace | undefined;
/** Quelltext zum aktuellen Programm (für „ASM-Datei anzeigen") */
let progSource: SourceAttachment | undefined;
let progLineOf: ReadonlyMap<number, number> = new Map();
/** Codepasswort der aktuellen Datei (nur in dieser Sitzung bekannt) */
let currentPw: string | undefined;
let titleOverrideUntil = 0;
const options = { chead: false, stopAnim: false };
/** Ergebnis des letzten „Sprung über C-Head" (für die Statusmeldung nach dem Laden) */
let cheadNote = '';
let message = 'Bereit.';
let messageIsError = false;
const starts = new Set<number>([0]);
let listingEnd = 0x7f;
let highlightChanges = true;

/** Zustand der zyklusweisen Bearbeitung ("Befehl holen") */
let phase: 0 | 1 | 2 | 3 = 0;
let phaseView: { ir?: number; busaddr?: number; decoded?: string } = {};

// ───────────────────────── Ansichten ─────────────────────────
const ramView = new HexView($('[data-hexview="ram"]'), {
  mem: () => (mode === 'ext' ? cpu.xram : cpu.iram),
  size: () => (mode === 'ext' ? 0x10000 : mode === 'model' ? 0x80 : 0x100),
  onEdit: (a, v) => { (mode === 'ext' ? cpu.xram : cpu.iram)[a] = v; scheduleRender(); },
});
const romView = new HexView($('[data-hexview="rom"]'), {
  mem: () => cpu.code,
  size: () => 0x10000,
  onEdit: (a, v) => {
    cpu.code[a] = v;
    program.bytes.set(a, v);
    listingEnd = Math.max(listingEnd, a + 16);
    rebuildListing();
    scheduleRender();
  },
});
const codeView = new CodeView($('[data-codeview]'));
codeView.onToggleBreakpoint = (a) => {
  if (!codeView.breakpoints.has(a) && codeView.breakpoints.size >= 50) {
    setMessage('Es sind höchstens 50 Haltepunkte möglich.', true);
    return;
  }
  if (codeView.breakpoints.has(a)) codeView.breakpoints.delete(a); else codeView.breakpoints.add(a);
  setMessage(codeView.breakpoints.has(a) ? `Haltepunkt bei ${hex4(a)}h gesetzt.` : `Haltepunkt bei ${hex4(a)}h entfernt.`);
  codeView.render();
};
const editor = new Editor($<HTMLDialogElement>('[data-dialog="editor"]'));
const asmView = new AsmView();

// Rechtsklick im Code-Fenster: „alle Breakpoints löschen" (wie im Original)
const ctxMenu = h('div', { class: 'menu ctx-menu', popover: '' },
  h('button', { class: 'menu-item', 'data-ctx': 'clear-bp' }, h('b', { text: 'alle Breakpoints löschen' })));
document.body.append(ctxMenu);
$('[data-codeview]').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  ctxMenu.style.left = `${e.clientX}px`;
  ctxMenu.style.top = `${e.clientY}px`;
  ctxMenu.showPopover();
});
ctxMenu.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('[data-ctx="clear-bp"]')) {
    const n = codeView.breakpoints.size;
    codeView.breakpoints.clear();
    codeView.render();
    setMessage(`${n} Haltepunkt${n === 1 ? '' : 'e'} gelöscht.`);
  }
  ctxMenu.hidePopover();
});
const memWins = new MemoryWindows(cpu);
initFlow($('[data-flow-layer]'));

// ───────────────────────── Bindungen ─────────────────────────
let bindCache: Map<string, HTMLElement[]> = new Map();
let sfrCache: { el: HTMLElement; addr: number }[] = [];
let bitCache: { el: HTMLButtonElement; addr: number; bit: number }[] = [];
const baseline = new Map<Element, string>();

function refreshBindings() {
  bindCache = Map.groupBy($$('[data-bind]'), (e) => e.dataset['bind']!);
  sfrCache = $$('[data-sfr]').map((el) => ({ el, addr: parseInt(el.dataset['sfr']!, 16) }));
  bitCache = $$<HTMLButtonElement>('button.bit').map((el) => ({ el, addr: Number(el.dataset['addr']), bit: Number(el.dataset['bit']) }));
}

function buildBits() {
  for (const box of $$('[data-bits]')) {
    const addr = parseInt(box.dataset['bits']!, 16);
    const names = box.dataset['names']!.split(',');
    const titles = (box.dataset['titles'] ?? '').split(',');
    const readonly = new Set((box.dataset['readonly'] ?? '').split(','));
    const hidden = new Set((box.dataset['hide'] ?? '').split(',').filter(Boolean).map(Number));
    const groups = box.dataset['groups']?.split(',');
    if (groups) for (const g of groups) box.append(h('span', { class: 'bit-group-label', text: g }));
    names.forEach((name, i) => {
      const bit = 7 - i;
      const btn = h('button', {
        class: 'bit', 'data-addr': String(addr), 'data-bit': String(bit),
        title: `${titles[i] || name} (Bit ${hex2(addr)}h.${bit})`, 'aria-label': name,
      }, '0');
      if (readonly.has(name)) btn.disabled = true;
      const cell = h('div', { class: `bit-cell${hidden.has(i) ? ' hide' : ''}${name.startsWith('RS') ? ' rs' : ''}` },
        h('span', { class: 'bit-name', text: name }), btn);
      box.append(cell);
    });
  }
}

function setBind(key: string, text: string, html = false) {
  const els = bindCache.get(key);
  if (!els) return;
  for (const el of els) {
    if (html) { if (el.innerHTML !== text) el.innerHTML = text; }
    else if (el.textContent !== text) el.textContent = text;
    markChange(el, text);
  }
}

function markChange(el: Element, text: string) {
  if (!el.classList.contains('reg') && !el.classList.contains('bit')) return;
  const base = baseline.get(el);
  el.classList.toggle('chg', highlightChanges && base !== undefined && base !== text);
}

function markBaseline() {
  baseline.clear();
  for (const els of bindCache.values()) for (const el of els) baseline.set(el, el.textContent ?? '');
  for (const { el } of sfrCache) baseline.set(el, el.textContent ?? '');
  for (const { el } of bitCache) baseline.set(el, el.textContent ?? '');
  ramView.markBaseline();
  romView.markBaseline();
}

// ───────────────────────── Rendern ─────────────────────────
let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; if (running === 'stop') render(); });
}

const timerModeText = (t: 0 | 1) => {
  const tmod = cpu.getSfr(SFR.TMOD) >> (t * 4);
  const m = tmod & 3;
  const tr = (cpu.getSfr(SFR.TCON) >> (4 + t * 2)) & 1;
  const names = ['13 Bit', '16 Bit', '8 Bit Reload', t === 0 ? '2 × 8 Bit' : 'Stopp'];
  return { text: `Mode ${m} · ${names[m]} · ${tmod & 4 ? 'Counter' : 'Timer'}${tmod & 8 ? ' · Gate' : ''}`, run: tr === 1 };
};

function lastData(t: StepTrace | undefined): number {
  if (!t) return 0;
  const a = t.accesses.findLast((x) => x.space !== 'code') ?? t.accesses.at(-1);
  return a?.value ?? 0;
}

function render() {
  const pc = cpu.pc;
  // Register / SFR
  for (const { el, addr } of sfrCache) {
    const t = hex2(cpu.getSfr(addr));
    if (el.textContent !== t) el.textContent = t;
    markChange(el, t);
  }
  for (const { el, addr, bit } of bitCache) {
    const v = (cpu.getSfr(addr) >> bit) & 1;
    const t = String(v);
    if (el.textContent !== t) el.textContent = t;
    el.classList.toggle('one', v === 1);
    markChange(el, t);
  }
  const bank = cpu.bank;
  setBind('pc', hex4(pc));
  setBind('dptr', hex4(cpu.dptr));
  setBind('bank', String(bank));
  setBind('bankaddr', hex2(bank * 8));
  for (let n = 0; n < 8; n++) {
    setBind(`r${n}`, hex2(cpu.iram[bank * 8 + n]!));
    setBind(`r${n}addr`, hex2(bank * 8 + n));
  }
  const t0 = timerModeText(0), t1 = timerModeText(1);
  setBind('t0mode', t0.text); setBind('t1mode', t1.text);
  bindCache.get('t0mode')?.forEach((e) => e.classList.toggle('run', t0.run));
  bindCache.get('t1mode')?.forEach((e) => e.classList.toggle('run', t1.run));
  setBind('sbuf', hex2(cpu.readSfrQuiet(SFR.SBUF)));
  setBind('p3pin', hex2(cpu.pin(3)));
  for (const b of $$('[data-p3]')) b.classList.toggle('low', ((ports.p3ext >> Number(b.dataset['p3'])) & 1) === 0);

  const bus = phaseView.busaddr ?? cpu.busAddr;
  setBind('busaddr', hex4(bus));
  setBind('ale', cpu.signals.ale ? '1' : '0');
  setBind('buslo', hex2(bus & 0xff));
  setBind('buslo2', hex2(bus & 0xff));
  setBind('bushi', hex2(bus >> 8));
  setBind('databuf', hex2(phaseView.ir ?? lastData(lastTrace)));

  // int. RAM / SFR Nachschlagen
  const lkAddr = parseHexInput($<HTMLInputElement>('[data-lookup="iram"]').value, 0xff) ?? 0;
  setBind('lk-iram', hex2(cpu.iram[lkAddr]!));
  const sfrSel = Number($<HTMLSelectElement>('[data-lookup="sfr"]').value || SFR.ACC);
  setBind('lk-sfr', hex2(cpu.readSfrQuiet(sfrSel)));
  renderStack();

  // ALU / Decoder
  setBind('alu', lastTrace?.alu ?? '–');
  const ir = phaseView.ir ?? lastTrace?.opcode;
  setBind('ir', ir === undefined ? '--' : hex2(ir));
  setBind('decoded', lock === 'locked' ? 'verschlüsselt' : phaseView.decoded ?? (lastTrace
    ? lastTrace.interrupt !== undefined ? `Interrupt ${IRQ_NAMES.get(lastTrace.interrupt)} → ${hex4(lastTrace.interrupt)}h` : decodeAt(cpu.code, lastTrace.pc, program.labels).asm
    : ' '));
  for (const s of $$('[data-sig]')) s.classList.toggle('on', cpu.signals[s.dataset['sig'] as 'ale' | 'psen' | 'rd' | 'wr']);
  // Busleitungen (Modell-Rechner)
  if (mode === 'model' && lastTrace && running !== 'turbo') {
    for (const b of $$('[data-bus]')) { b.classList.remove('active'); void b.offsetWidth; b.classList.add('active'); }
  }

  // Speicher
  const instr = OPCODES[cpu.code[pc]!]!;
  romView.pc = { start: pc, len: instr.bytes };
  const acc = lastTrace?.accesses ?? [];
  const memSpace = mode === 'ext' ? 'xram' : 'iram';
  ramView.reads = new Set(acc.filter((a) => a.space === memSpace && a.rw === 'r').map((a) => a.addr));
  ramView.writes = new Set(acc.filter((a) => a.space === memSpace && a.rw === 'w').map((a) => a.addr));
  romView.reads = new Set(acc.filter((a) => a.space === 'code' && a.rw === 'r').map((a) => a.addr));
  ramView.highlightChanges = romView.highlightChanges = highlightChanges;
  // Datenspeicher folgt dem letzten Schreibzugriff (nicht bei Registern R0–R7)
  const lastWrite = acc.findLast((a) => a.space === memSpace && a.rw === 'w' && (mode === 'ext' || a.addr >= 0x08));
  if (lastWrite && followMem) ramView.ensureVisible(lastWrite.addr);
  ramView.render();
  romView.render();
  if (running !== 'stop') romView.ensureVisible(pc);

  // Code-Fenster
  if (!codeView.isHead(pc) && pc <= listingEnd + 0x100) { starts.add(pc); listingEnd = Math.max(listingEnd, pc + 16); rebuildListing(); }
  codeView.pc = pc;
  if (follow) codeView.scrollToAddr(pc);
  else codeView.render();

  ports.render();
  asmView.show(pc);
  memWins.render();

  // Status
  const st = bindCache.get('message');
  st?.forEach((e) => e.classList.toggle('err', messageIsError));
  setBind('message', message);
  const modeName = { int: 'int. ROM/RAM', ext: 'ext. ROM/RAM', model: 'Modell-Rechner' }[mode];
  const title = `8051webXL [${modeName}] – ${program.name}`;
  if (document.title !== title && Date.now() > titleOverrideUntil) document.title = title;
  const fileLabel = `${program.name}${lock === 'locked' ? '  [ verschlüsselt ]' : lock === 'unlocked' ? '  [ entschlüsselt ]' : ''}`;
  setBind('file', fileLabel);
  setBind('file2', fileLabel);
  setBind('bytes', `B=${program.bytes.size}`);
  const secs = (cpu.cycles * 12) / CLOCKS[clockIdx]!;
  setBind('cycles', `${cpu.cycles.toLocaleString('de-DE')} Zyklen · ${formatTime(secs)}`);
  setBind('clock', `${(CLOCKS[clockIdx]! / 1e6).toLocaleString('de-DE')} MHz`);
  setBind('speed', running === 'turbo' ? 'Echtzeit' : `${SPEEDS[speedIdx]!.toLocaleString('de-DE')} Bef./s`);
  setBind('runlabel', running === 'run' ? 'STOP' : 'RUN');
  setBind('turbolabel', running === 'turbo' ? 'STOP' : 'Turbo-Run');
  $('[data-action="run"]').classList.toggle('active', running === 'run');
  $('[data-action="turbo"]').classList.toggle('active', running === 'turbo');
  setBind('phaselabel', ['Befehl holen', 'Befehl decodieren', 'Operanden holen', 'Befehl ausführen'][phaseNextLabel()]!);
  setBind('ramtitle', mode === 'ext' ? 'ext. RAM <small>(MOVX)</small>' : 'int. RAM <small>(EEPROM)</small>', true);
  setBind('romtitle', mode === 'ext' ? 'ext. ROM <small>(EPROM)</small>' : 'int. ROM <small>(FLASH)</small>', true);
}

function phaseNextLabel(): number {
  if (phase === 0) return 0;
  if (phase === 1) return 1;
  if (phase === 2) return OPCODES[cpu.code[cpu.pc]!]!.bytes > 1 ? 2 : 3;
  return 3;
}

function formatTime(s: number): string {
  if (s < 1e-3) return `${(s * 1e6).toFixed(0)} µs`;
  if (s < 1) return `${(s * 1e3).toFixed(1)} ms`;
  return `${s.toFixed(2)} s`;
}

function renderStack() {
  const list = $('[data-stack]');
  const sp = cpu.sp;
  const items: HTMLElement[] = [];
  for (let a = sp; a > sp - 5 && a >= 0; a--) {
    if (a < 0x08 && sp >= 0x08) break;
    items.push(h('span', { class: `stack-item${a === sp ? ' top' : ''}`, title: a === sp ? 'Stackpointer zeigt hierher' : '' },
      h('small', { text: hex2(a) }), h('span', { class: 'reg', text: hex2(cpu.iram[a]!) })));
  }
  list.replaceChildren(...items);
}

// ───────────────────────── Programm laden ─────────────────────────
function rebuildListing() {
  codeView.setRows(buildListing(cpu.code, Math.min(0xffff, listingEnd), { labels: program.labels, data: program.data, starts }), program.labels);
}

function applyLock(l: typeof lock) {
  lock = l;
  codeView.masked = romView.masked = l === 'locked';
  app.classList.toggle('locked', l === 'locked');
}

function loadProgram(p: Program, l: typeof lock = 'none') {
  stop();
  applyLock(l);
  if (p.name !== program.name) currentPw = undefined;
  program = p;
  cpu.loadCode(p.bytes);
  const max = p.bytes.size ? Math.max(...p.bytes.keys()) : 0;
  listingEnd = Math.max(0x7f, max + 16);
  starts.clear();
  starts.add(0);
  resetCpu(false);
  rebuildListing();
  codeView.scrollToAddr(0, true);
  asmView.set(progSource?.name ?? p.name, l === 'locked' ? undefined : progSource?.text, progLineOf);
}

/** Gerätebelegung des Programms wiederherstellen (wie „HEXname.INI" im Original) */
function restoreProgramDevices(name: string) {
  const saved = store.devicesByProgram?.[name];
  if (!saved) return;
  if (saved.mode !== mode) setMode(saved.mode);
  ports.config[mode] = { ...saved.config };
  ports.setMode(mode);
  ports.mount(portsContainer());
  refreshBindings();
}

function rememberProgramDevices() {
  if (!program.bytes.size || program.name === '–') return;
  store.devicesByProgram = { ...store.devicesByProgram, [program.name]: { mode, config: { ...ports.config[mode] } } };
}

/**
 * „Sprung über C-Head": Der Startcode von C-Programmen (z. B. Keil STARTUP.A51) löscht den RAM und
 * springt dann über ?C_START nach main. Er wird hier ohne Anzeige ausgeführt, bis das Programm
 * unterhalb des Startcodes weiterläuft.
 */
function skipCHead() {
  if (cpu.code[0] !== 0x02) { setMessage('Sprung über C-Head: kein C-Startcode erkannt (kein LJMP an Adresse 0000h).'); return; }
  const entry = (cpu.code[1]! << 8) | cpu.code[2]!;
  if (entry < 0x30) { setMessage('Sprung über C-Head: kein C-Startcode erkannt.'); return; }
  cpu.trace = false;
  let steps = 0;
  for (; steps < 2_000_000; steps++) {
    const r = cpu.step();
    if (isError(r)) break;
    ports.sample(r.cycles);
    if (cpu.pc >= 0x30 && cpu.pc < entry && r.info.mnemonic.endsWith('JMP')) {
      lastTrace = undefined;
      cheadNote = ` C-Head übersprungen (${steps + 1} Befehle) – Start bei ${hex4(cpu.pc)}h.`;
      setMessage(`C-Head übersprungen (${steps + 1} Befehle) – Programm steht am Anfang von main (${hex4(cpu.pc)}h).`);
      markBaseline();
      return;
    }
  }
  cpu.reset();
  setMessage('Sprung über C-Head: Programmstart nicht gefunden – RESET ohne Sprung.', true);
}

function resetCpu(msg = true) {
  stop();
  cancelFlows();
  cpu.reset();
  cpu.modelOnly = mode === 'model';
  ports.sample(0);
  lastTrace = undefined;
  phase = 0;
  phaseView = {};
  codeView.phaseAddrs.clear();
  markBaseline();
  if (msg) setMessage('RESET – Starten Sie die Ausführung!');
  cheadNote = '';
  if (options.chead && program.bytes.size) skipCHead();
  romView.element.scrollTop = 0;
  followMem = true;
  follow = true;
  scheduleRender();
}

function assembleSource(open = false): AsmResult {
  const r = assemble(source);
  const summary = `Fehlerfrei assembliert: ${r.bytes.size} Byte, ${r.symbols.size} Symbole.`;
  editor.showDiagnostics(r.errors, summary);
  if (r.errors.length) {
    setMessage(`${r.errors.length} Fehler beim Assemblieren – siehe Editor.`, true);
    if (open) editor.open();
    return r;
  }
  loadedKind = 'asm';
  progSource = { text: source, name: sourceName, kind: /\.c$/i.test(sourceName) ? 'c' : 'asm' };
  progLineOf = r.lineOf;
  loadProgram({ name: sourceName, bytes: r.bytes, labels: r.labels, data: r.data });
  setMessage(`${summary}${cheadNote} Starten Sie die Ausführung!`);
  save();
  return r;
}

function loadHexText(text: string, name: string, l: typeof lock = 'none', pwText?: string, src?: SourceAttachment) {
  try {
    const img = parseIntelHex(text);
    loadedKind = pwText ? 'pw' : 'hex';
    progSource = src;
    progLineOf = src ? assemble(src.text).lineOf : new Map();
    loadProgram({ name, bytes: img.data, labels: new Map(), data: new Set() }, l);
    setMessage(`${name} geladen (${img.data.size} Byte)${l === 'locked' ? ' – verschlüsselt, Code verborgen' : ''}.${cheadNote} Starten Sie die Ausführung!`);
    if (pwText) { store.pw = pwText; delete store.hex; } else { store.hex = text; delete store.pw; }
    store.hexName = name;
    save();
  } catch (e) {
    setMessage(`HEX-Datei fehlerhaft: ${(e as Error).message}`, true);
  }
}

async function openPwText(text: string, f: PwFile) {
  try {
    const r = await openPwFile(f);
    loadHexText(r.hex, f.name, 'locked', text);
  } catch (e) {
    if (!(e instanceof WrongPassword)) throw e;
    pendingPw = { file: f, text };
    setMessage(`${f.name} ist verschlüsselt – bitte Passwort eingeben.`);
    openPasswordDialog();
  }
}

async function openFile(file: File) {
  const text = await file.text();
  const pw = parsePwFile(text);
  if (pw) { await openPwText(text, pw); return; }
  if (/\.(hex|ihx|ihex)$/i.test(file.name) || /^:[0-9A-F]{10}/im.test(text.trimStart())) {
    loadHexText(text, file.name);
    restoreProgramDevices(file.name);
  } else if (/\.c$/i.test(file.name)) {
    // C-Quelltext: nur anzeigen (das Programm selbst kommt als HEX-Datei aus dem C-Compiler)
    progSource = { text, name: file.name, kind: 'c' };
    asmView.set(file.name, text, new Map());
    if (!asmView.open) asmView.toggle();
  } else {
    source = text;
    sourceName = file.name;
    editor.value = text;
    setBind('editorfile', sourceName);
    applyMeta(text);
    assembleSource(true);
    if (!parseMeta(text).io.length) restoreProgramDevices(file.name);
  }
}

function applyMeta(src: string) {
  const meta = parseMeta(src);
  if (meta.mode && meta.mode !== mode) setMode(meta.mode);
  if (meta.io.length) {
    ports.clear(mode);
    for (const { port, device } of meta.io) {
      if (DEVICE_BY_ID.has(device) && PORT_LAYOUT[mode].some((c) => c.includes(port))) ports.config[mode][`P${port}`] = device;
    }
    ports.setMode(mode);
    ports.mount(portsContainer());
    refreshBindings();
  }
  if (meta.terminal) openDialog('terminal');
  if (meta.io.some((x) => x.device.startsWith('ext-'))) requestAnimationFrame(() => openExternalWindows());
}

function loadExample(i: number) {
  const ex = examples[i];
  if (!ex) return;
  source = ex.src;
  sourceName = ex.file;
  editor.value = ex.src;
  setBind('editorfile', sourceName);
  applyMeta(ex.src);
  assembleSource();
  if (ex.meta.desc) setMessage(`${ex.meta.title}: ${ex.meta.desc}`);
}

// ───────────────────────── Ausführung ─────────────────────────
let follow = true;
/** Datenspeicher-Ansicht folgt Schreibzugriffen, bis der Nutzer selbst scrollt */
let followMem = true;

function setMessage(m: string, err = false) {
  message = m;
  messageIsError = err;
  scheduleRender();
}

/** Führt einen Befehl aus; liefert false bei Fehler/Haltepunkt */
function doStep(trace: boolean): StepTrace | undefined {
  cpu.trace = trace;
  const r = cpu.step();
  if (isError(r)) {
    stop();
    const info = OPCODES[r.opcode]!;
    setMessage(cpu.modelOnly && info.valid
      ? `${info.template} gehört nicht zum Befehlssatz des Modell-Rechners (Adresse ${hex4(r.pc)}h).`
      : `Ungültiger Opcode ${hex2(r.opcode)}h bei Adresse ${hex4(r.pc)}h – Ausführung angehalten.`, true);
    return undefined;
  }
  ports.sample(r.cycles);
  lastTrace = r;
  return r;
}

let lastFrame = 0;
let budget = 0;

function frame(now: number) {
  if (running === 'stop') return;
  const dt = Math.min(now - lastFrame, 100);
  lastFrame = now;
  if (running === 'turbo') {
    budget += (dt / 1000) * (CLOCKS[clockIdx]! / 12);
    const deadline = performance.now() + 14;
    let n = 0;
    while (budget > 0 && running === 'turbo') {
      const r = doStep(false);
      if (!r) break;
      budget -= r.cycles;
      if (codeView.breakpoints.has(cpu.pc)) { hitBreakpoint(); break; }
      if ((++n & 511) === 0 && performance.now() > deadline) { budget = 0; break; }
    }
  } else {
    budget += (dt / 1000) * SPEEDS[speedIdx]!;
    if (budget >= 1) markBaseline();
    while (budget >= 1 && running === 'run') {
      budget -= 1;
      if (!doStep(true)) break;
      if (codeView.breakpoints.has(cpu.pc)) { hitBreakpoint(); break; }
    }
  }
  render();
  if (isRunning()) requestAnimationFrame(frame);
}

const isRunning = () => running !== 'stop';

function hitBreakpoint() {
  stop();
  setMessage(`Haltepunkt bei ${hex4(cpu.pc)}h erreicht.`);
}

function start(kind: 'run' | 'turbo') {
  if (running === kind) { stop(); setMessage('Angehalten.'); return; }
  cancelFlows();
  phase = 0;
  phaseView = {};
  codeView.phaseAddrs.clear();
  running = kind;
  highlightChanges = kind === 'run' && SPEEDS[speedIdx]! <= 10;
  ports.setRunning(true);
  budget = kind === 'run' ? 1 : 0;
  lastFrame = performance.now();
  // aus einem Haltepunkt heraus erst einen Schritt machen
  if (codeView.breakpoints.has(cpu.pc)) doStep(kind === 'run');
  setMessage(kind === 'turbo' ? 'Turbo-Run – Echtzeit-Simulation läuft …' : 'RUN – Simulation läuft …');
  requestAnimationFrame(frame);
}

function stop() {
  if (running === 'stop') return;
  running = 'stop';
  highlightChanges = true;
  ports.setRunning(false);
  markBaseline();
  scheduleRender();
}

function step() {
  stop();
  cancelFlows();
  markBaseline();
  phase = 0;
  phaseView = {};
  codeView.phaseAddrs.clear();
  const r = doStep(true);
  if (r) {
    setMessage(describeStep(r));
    animateExecute(r, true);
  }
  render();
  codeView.scrollToAddr(cpu.pc);
}

function describeStep(r: StepTrace): string {
  if (r.interrupt !== undefined) return `Interrupt ${IRQ_NAMES.get(r.interrupt)}: Rücksprungadresse auf den Stack, Sprung zum Vektor ${hex4(r.interrupt)}h.`;
  const ins = decodeAt(cpu.code, r.pc, program.labels);
  return `${hex4(r.pc)}h  ${ins.asm}  –  ${r.info.desc}`;
}

// ── zyklusweise Bearbeitung mit Datentransport-Animation ──
const flowEl = (key: string): HTMLElement | undefined => $$(`[data-flow="${key}"]`).find(isVisible) ?? $$(`[data-bind="${key}"]`).find(isVisible);

function sfrEl(addr: number): HTMLElement | undefined {
  return $$(`[data-sfr="${hex2(addr)}"]`).find(isVisible);
}

function accessEl(a: Access): HTMLElement | undefined {
  switch (a.space) {
    case 'code': return romView.cell(a.addr);
    case 'xram': return mode === 'ext' ? ramView.cell(a.addr) : undefined;
    case 'sfr': {
      if (a.addr === SFR.DPL || a.addr === SFR.DPH) return flowEl('dptr');
      return sfrEl(a.addr) ?? lookupSfr(a.addr);
    }
    case 'iram': {
      const bank = cpu.bank;
      if (a.addr >= bank * 8 && a.addr < bank * 8 + 8) {
        const r = flowEl(`r${a.addr - bank * 8}`);
        if (r) return r;
      }
      if (mode !== 'ext') return ramView.cell(a.addr);
      const input = $<HTMLInputElement>('[data-lookup="iram"]');
      input.value = hex2(a.addr);
      return flowEl('lk-iram');
    }
  }
}

function lookupSfr(addr: number): HTMLElement | undefined {
  const sel = $<HTMLSelectElement>('[data-lookup="sfr"]');
  if (!isVisible(sel)) return undefined;
  sel.value = String(addr);
  return flowEl('lk-sfr');
}

async function animateExecute(r: StepTrace, quick: boolean) {
  const gen = currentGeneration();
  const reads = r.accesses.filter((a) => a.rw === 'r' && a.space !== 'code');
  // Schreibzugriffe je Ziel nur einmal (letzter Wert)
  const writes = [...new Map(r.accesses.filter((a) => a.rw === 'w').map((a) => [`${a.space}:${a.addr}`, a])).values()];
  const ms = quick ? 380 : 620;
  const alu = r.alu ? flowEl('alu') : undefined;
  if (r.interrupt !== undefined) {
    for (const w of writes) await packet(flowEl('pc'), accessEl(w), hex2(w.value), 'w', ms);
    return;
  }
  const src = reads.length ? accessEl(reads[0]!) : flowEl('ir');
  if (alu) {
    await Promise.all(reads.map((a) => packet(accessEl(a), alu, hex2(a.value), '', ms)));
    if (!reads.length) await packet(flowEl('ir'), alu, hex2(r.opcode), 'code', ms);
  }
  for (const w of writes) {
    if (!isCurrent(gen)) return;
    await packet(alu ?? src, accessEl(w), hex2(w.value), 'w', ms);
  }
  if (!writes.length && alu) flash(alu);
  scheduleRender();
}

async function phaseStep() {
  stop();
  const pc = cpu.pc;
  const info = OPCODES[cpu.code[pc]!]!;
  cancelFlows();
  const gen = currentGeneration();
  if (phase === 0) {
    markBaseline();
    if (cpu.pendingIrq()) {
      const r = doStep(true);
      if (r) { setMessage(describeStep(r)); render(); await animateExecute(r, false); }
      return;
    }
    phase = 1;
    phaseView = { busaddr: pc, ir: cpu.code[pc]!, decoded: ' ' };
    cpu.signals = { ale: true, psen: true, rd: false, wr: false };
    codeView.phaseAddrs = new Set([pc]);
    setMessage(`Befehl holen: Der PC (${hex4(pc)}h) gelangt in den Adress-Puffer, der Opcode ${hex2(cpu.code[pc]!)}h wird aus dem Programmspeicher ins Befehlsregister (IR) geladen.`);
    render();
    codeView.scrollToAddr(pc);
    await packet(flowEl('pc'), flowEl('adr'), hex4(pc), '', 520);
    if (!isCurrent(gen)) return;
    await packet(romView.cell(pc), flowEl('ir'), hex2(cpu.code[pc]!), 'code', 520);
  } else if (phase === 1) {
    phase = 2;
    phaseView = { ...phaseView, decoded: info.template };
    setMessage(`Befehl decodieren: ${hex2(info.opcode)}h = ${info.template} – ${info.desc} (${info.bytes} Byte, ${info.cycles} Zyklus${info.cycles > 1 ? 'en' : ''}).`);
    render();
    flash(flowEl('ir')!);
    if (info.bytes === 1) phase = 3;
  } else if (phase === 2) {
    phase = 3;
    const ins = decodeAt(cpu.code, pc, program.labels);
    const opBytes = ins.raw.slice(1);
    phaseView = { ...phaseView, busaddr: (pc + info.bytes - 1) & 0xffff, decoded: ins.asm };
    codeView.phaseAddrs = new Set(ins.rows.map((r) => r.addr));
    setMessage(`Operanden holen: ${opBytes.map((b) => `${hex2(b)}h`).join(', ')} – ${ins.rows.slice(1).map((r) => r.desc).join('; ')}.`);
    render();
    for (let i = 0; i < opBytes.length; i++) {
      if (!isCurrent(gen)) return;
      await packet(romView.cell((pc + 1 + i) & 0xffff), flowEl('ir'), hex2(opBytes[i]!), 'code', 460);
    }
  } else {
    const ins = decodeAt(cpu.code, pc, program.labels);
    phase = 0;
    phaseView = {};
    codeView.phaseAddrs.clear();
    const r = doStep(true);
    if (!r) return;
    setMessage(`Befehl ausführen: ${ins.asm}${r.alu ? `  (ALU: ${r.alu})` : ''}`);
    render();
    await animateExecute(r, false);
    codeView.scrollToAddr(cpu.pc);
  }
}

// ───────────────────────── Modus ─────────────────────────
function portsContainer(): HTMLElement {
  return mode === 'model' ? $('[data-ports-model]') : $('[data-ports]');
}

function setMode(m: SimMode, animate = false) {
  const apply = () => {
    mode = m;
    app.dataset['mode'] = m;
    cpu.modelOnly = m === 'model';
    for (const b of $$('[data-mode-btn]')) b.setAttribute('aria-checked', String(b.dataset['modeBtn'] === m));
    ports.setMode(m);
    $('[data-ports]').replaceChildren();
    $('[data-ports-model]').replaceChildren();
    ports.mount(portsContainer());
    refreshBindings();
    ramView.element.scrollTop = 0;
    markBaseline();
    render();
  };
  if (animate && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches && mode !== m) {
    document.startViewTransition(apply);
  } else apply();
  save();
}

// ───────────────────────── Dialoge ─────────────────────────
function openDialog(name: string) {
  const d = $<HTMLDialogElement>(`[data-dialog="${name}"]`);
  if (name === 'terminal') { if (!d.open) d.show(); $('[data-term]', d).focus(); return; }
  if (!d.open) d.showModal();
}

function pickDevice(port: number, col: readonly (number | null)[]) {
  const d = $<HTMLDialogElement>('[data-dialog="devices"]');
  const grid = $('[data-device-grid]', d);
  const twoOk = col.every((p) => p !== null);
  const current = ports.deviceAt(port);
  setBind('devport', twoOk ? `P${port} (Spalte P${col.join(' / P')})` : `P${port}`);
  const none = h('button', { class: 'device-card none' }, h('b', { text: 'Kein Gerät' }), h('span', { text: 'Port freigeben' }));
  none.addEventListener('click', () => { ports.assign(port, undefined); afterAssign(d); });
  const cards: HTMLElement[] = [none];
  for (const [group, defs] of Map.groupBy(DEVICES, (x) => x.group)) {
    const usable = defs.filter((x) => x.ports === 1 || twoOk);
    if (!usable.length) continue;
    cards.push(h('div', { class: 'device-group', text: group }));
    for (const def of usable) {
      const preview = def.create(() => {}).svg;
      const card = h('button', { class: `device-card${current?.id === def.id ? ' current' : ''}` },
        h('div', { class: 'preview' }, preview),
        h('b', { text: def.name }),
        h('span', { class: 'ports-tag', text: def.ports === 2 ? `2-Port-Modell (P${col[0]} + P${col[1]})` : '1 Port' }),
        h('span', { text: def.desc }));
      card.addEventListener('click', () => { ports.assign(port, def.id); afterAssign(d); });
      cards.push(card);
    }
  }
  grid.replaceChildren(...cards);
  d.showModal();
}

function afterAssign(d: HTMLDialogElement) {
  d.close();
  ports.mount(portsContainer());
  refreshBindings();
  render();
  save();
}

function showHexFile() {
  const text = toIntelHex(program.bytes);
  const pre = $('[data-hexfile]');
  pre.replaceChildren(...text.trim().split('\n').flatMap((line) => {
    const m = /^:(..)(....)(..)(.*)(..)$/.exec(line);
    if (!m) return [line, '\n'];
    return [':', h('span', { class: 'rc-len', text: m[1]! }), h('span', { class: 'rc-adr', text: m[2]! }), h('span', { class: 'rc-type', text: m[3]! }), m[4]!, h('span', { class: 'rc-sum', text: m[5]! }), '\n'];
  }));
  openDialog('hexview');
}

const toast = $('[data-toast]');
let toastTimer = 0;
function showToast(text: string) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2600);
}

// ───────────────────────── Passwortschutz ─────────────────────────
function openPasswordDialog(section?: 'lock' | 'unlock') {
  const d = $<HTMLDialogElement>('[data-dialog="password"]');
  const needUnlock = section ? section === 'unlock' : lock === 'locked' || pendingPw !== undefined;
  $('[data-pw-unlock]').hidden = !needUnlock;
  $('[data-pw-lock]').hidden = needUnlock || !program.bytes.size;
  $('[data-pw-msg]').textContent = '';
  $('[data-pw-shown]').textContent = '';
  for (const f of $$<HTMLFormElement>('form', d)) f.reset();
  if (!d.open) d.showModal();
  $<HTMLInputElement>(needUnlock ? '#pw-unlock' : '#pw-new').focus();
}

$('[data-form="unlock"]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = $<HTMLInputElement>('#pw-unlock').value;
  const msg = $('[data-pw-msg]');
  const text = pendingPw?.text ?? store.pw;
  const f = pendingPw?.file ?? (text ? parsePwFile(text) : undefined);
  if (!f || !text) { msg.textContent = 'Keine verschlüsselte Datei geladen.'; return; }
  msg.textContent = 'Prüfe Passwort …';
  try {
    const r = await openPwFile(f, pw);
    pendingPw = undefined;
    currentPw = pw;
    const pc = cpu.pc;
    if (r.source) { progSource = r.source; progLineOf = assemble(r.source.text).lineOf; }
    if (lock === 'locked') {
      applyLock('unlocked');
      rebuildListing();
      codeView.scrollToAddr(pc, true);
      asmView.set(progSource?.name ?? f.name, progSource?.text, progLineOf);
      setMessage(`${f.name} entschlüsselt${r.source ? ` – ${r.source.name} mit „ASM“ anzeigen` : ''}.`);
    } else loadHexText(r.hex, f.name, 'unlocked', text, r.source);
    if ($<HTMLInputElement>('#pw-savedec').checked) {
      download(f.name.replace(/\.\w+$/, '') + '.hex', r.hex);
      if (r.source) download(r.source.name.replace(/\.\w+$/, '') + (r.source.kind === 'c' ? '.c' : '.a51'), r.source.text);
    }
    $<HTMLDialogElement>('[data-dialog="password"]').close();
    scheduleRender();
  } catch (err) {
    msg.textContent = err instanceof WrongPassword ? 'Falsches Passwort.' : `Fehler: ${(err as Error).message}`;
  }
});

$('[data-form="lock"]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = $<HTMLInputElement>('#pw-new').value;
  const msg = $('[data-pw-msg]');
  if (pw !== $<HTMLInputElement>('#pw-repeat').value) { msg.textContent = 'Die Passwörter stimmen nicht überein.'; return; }
  const runOnly = $<HTMLInputElement>('#pw-runonly').checked;
  const type = $<HTMLInputElement>('[name="pw-type"]:checked').value as 'asm' | 'c' | 'hex';
  let src: SourceAttachment | undefined;
  if (type !== 'hex') {
    src = progSource?.kind === type ? progSource : await pickSourceFile(type);
    if (!src) { msg.textContent = `Keine ${type === 'c' ? 'C' : 'ASM'}-Datei gewählt.`; return; }
  }
  const base = program.name.replace(/\.\w+$/, '');
  const text = await encryptHex(toIntelHex(program.bytes), pw, runOnly, `${base}.hex`, src);
  download(`${base}.hexpw`, text, 'application/json');
  currentPw = pw;
  msg.textContent = `${base}.hexpw gespeichert${src ? ` (mit ${src.name})` : ''}${runOnly ? ' – Schüler können ohne Passwort simulieren' : ''}.`;
});

/** Quelltext-Datei für die Verschlüsselung wählen */
function pickSourceFile(kind: 'asm' | 'c'): Promise<SourceAttachment | undefined> {
  const { promise, resolve } = Promise.withResolvers<SourceAttachment | undefined>();
  const input = h('input', { type: 'file', accept: kind === 'c' ? '.c,.h' : '.asm,.a51,.s,.txt' });
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    resolve(f ? { text: await f.text(), name: f.name, kind } : undefined);
  });
  input.addEventListener('cancel', () => resolve(undefined));
  input.click();
  return promise;
}

/** „Passwort für Datei anzeigen": zeigt das Codepasswort einige Sekunden in der Titelleiste */
function showCodePassword() {
  if (lock === 'locked' || pendingPw) { openPasswordDialog('unlock'); return; }
  if (!currentPw) {
    setMessage('Für diese Datei ist kein Codepasswort bekannt – mit „+“ verschlüsseln, ein Passwort wird dabei vorgeschlagen.');
    openPasswordDialog('lock');
    $('[data-pw-generate]').click();
    return;
  }
  titleOverrideUntil = Date.now() + 5000;
  document.title = `${program.name} – Codepasswort: ${currentPw}`;
  setMessage(`Codepasswort für ${program.name}: ${currentPw}`);
  setTimeout(() => render(), 5100);
}

$('[data-pw-generate]').addEventListener('click', () => {
  const pw = generatePassword();
  $<HTMLInputElement>('#pw-new').value = pw;
  $<HTMLInputElement>('#pw-repeat').value = pw;
  $('[data-pw-shown]').textContent = pw;
});

// ───────────────────────── Zielsystem ─────────────────────────
$('[data-form="target"]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const log = $('[data-target-log]');
  const prog = $<HTMLProgressElement>('[data-target-progress]');
  const btn = $<HTMLButtonElement>('[data-target-send]');
  const add = (l: string) => { log.textContent += `${l}\n`; log.scrollTop = log.scrollHeight; };
  btn.disabled = true;
  try {
    await sendHex(toIntelHex(program.bytes), {
      baud: Number($<HTMLSelectElement>('#target-baud').value),
      delayMs: Number($<HTMLInputElement>('#target-delay').value),
      waitEcho: $<HTMLInputElement>('#target-echo').checked,
      dataBits: Number($<HTMLSelectElement>('#target-databits').value) as 7 | 8,
      parity: $<HTMLSelectElement>('#target-parity').value as 'none' | 'even' | 'odd',
      stopBits: Number($<HTMLSelectElement>('#target-stopbits').value) as 1 | 2,
      flowControl: $<HTMLSelectElement>('#target-flow').value as 'none' | 'hardware',
      startCommand: $<HTMLInputElement>('#target-startcmd').value,
      onProgress: (d, t) => { prog.max = t; prog.value = d; },
      onLog: add,
    });
    setMessage(`${program.name} ins Zielsystem übertragen.`);
  } catch (err) {
    add(`Fehler: ${(err as Error).message}`);
  } finally {
    btn.disabled = false;
  }
});

// ───────────────────────── Speichern ─────────────────────────
let store: Saved = {};
try { store = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Saved; } catch { store = {}; }
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const theme = document.documentElement.dataset['theme'] as Saved['theme'];
    const s: Saved = {
      ...store, mode, devices: ports.config, source, sourceName, speed: speedIdx, clock: clockIdx,
      asmcol: app.classList.contains('asmcol'), loaded: loadedKind, options: { ...options },
      ...(theme ? { theme } : {}),
    };
    store = s;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* Speicher voll/gesperrt */ }
  }, 300);
}

// ───────────────────────── Ereignisse ─────────────────────────
const lockedGuard = (fn: () => void) => () => {
  if (lock === 'locked') { setMessage('Das Programm ist verschlüsselt – erst mit PW entschlüsseln.', true); openPasswordDialog(); return; }
  fn();
};

function openOptions() {
  const d = $<HTMLDialogElement>('[data-dialog="options"]');
  for (const r of $$<HTMLInputElement>('[name="opt-mode"]', d)) r.checked = r.value === mode;
  $<HTMLInputElement>('#opt-chead').checked = options.chead;
  $<HTMLInputElement>('#opt-stopanim').checked = options.stopAnim;
  $<HTMLInputElement>('#opt-speed').value = String(speedIdx);
  setBind('speed2', `${SPEEDS[speedIdx]!.toLocaleString('de-DE')} Befehle/s im RUN-Modus`);
  d.showModal();
}
$('#opt-speed').addEventListener('input', (e) => {
  setBind('speed2', `${SPEEDS[Number((e.target as HTMLInputElement).value)]!.toLocaleString('de-DE')} Befehle/s im RUN-Modus`);
});
$('[data-form="options"]').addEventListener('submit', (e) => {
  e.preventDefault();
  const m = $<HTMLInputElement>('[name="opt-mode"]:checked').value as SimMode;
  options.chead = $<HTMLInputElement>('#opt-chead').checked;
  options.stopAnim = $<HTMLInputElement>('#opt-stopanim').checked;
  setStopAfterAnimation(options.stopAnim);
  speedIdx = Number($<HTMLInputElement>('#opt-speed').value);
  highlightChanges = running !== 'turbo' && SPEEDS[speedIdx]! <= 10;
  $<HTMLDialogElement>('[data-dialog="options"]').close();
  if (m !== mode) setMode(m, true);
  save();
  render();
});

async function openViaPicker() {
  try {
    const f = await pickFile();
    if (f) await openFile(f);
  } catch (err) {
    if ((err as Error).name !== 'AbortError') setMessage(`Datei konnte nicht geöffnet werden: ${(err as Error).message}`, true);
  }
}

async function autoloadCheck() {
  const f = await checkForUpdate();
  if (!f) return;
  await openFile(f);
  beep();
  setMessage(`AutoLade: ${f.name} wurde geändert und neu geladen.`);
}
addEventListener('focus', () => void autoloadCheck());
document.addEventListener('visibilitychange', () => { if (!document.hidden) void autoloadCheck(); });

function printWith(cls: string) {
  document.body.classList.add(cls);
  addEventListener('afterprint', () => document.body.classList.remove(cls), { once: true });
  window.print();
}

const actions: Record<string, () => void> = {
  open: () => (pickerSupported() ? void openViaPicker() : $<HTMLInputElement>('[data-file]').click()),
  autoload: () => {
    if (!pickerSupported()) { setMessage('AutoLade benötigt einen Browser mit Dateizugriff (Chrome oder Edge).', true); return; }
    if (!hasWatchedFile()) {
      setAutoload(true);
      setMessage('AutoLade aktiv – bitte die zu beobachtende HEX- oder ASM-Datei wählen.');
      void openViaPicker();
    } else {
      setAutoload(!autoloadEnabled());
      setMessage(autoloadEnabled()
        ? 'AutoLade aktiv: Wird die Datei neu erzeugt, lädt 8051webXL sie beim Zurückkehren automatisch (mit Piep).'
        : 'AutoLade ausgeschaltet.');
    }
    $('[data-action="autoload"]').classList.toggle('active', autoloadEnabled());
  },
  options: openOptions,
  encrypt: lockedGuard(() => {
    if (!program.bytes.size) return setMessage('Kein Programm geladen.', true);
    openPasswordDialog('lock');
  }),
  decrypt: () => {
    if (lock !== 'locked' && !pendingPw) return setMessage('Das aktuelle Programm ist nicht verschlüsselt.');
    openPasswordDialog('unlock');
  },
  password: showCodePassword,
  asmview: () => {
    if (lock === 'locked') { setMessage('Die ASM-Datei ist verschlüsselt – erst mit „−“ entschlüsseln.', true); openPasswordDialog('unlock'); return; }
    asmView.set(progSource?.name ?? program.name, progSource?.text, progLineOf);
    asmView.toggle();
    asmView.show(cpu.pc);
  },
  copyshot: () => {
    copyScreenRegion().then((m) => setMessage(m)).catch((err: Error) => setMessage(
      err.name === 'NotAllowedError' ? 'Bildschirm kopieren: Aufnahme wurde nicht erlaubt.' : `Bildschirm kopieren fehlgeschlagen: ${err.message}`, true));
  },
  arrange: () => { arrangeWindows(); follow = true; codeView.scrollToAddr(cpu.pc, true); setMessage('Fenster geordnet.'); },
  'memwin-iram': () => memWins.open('iram'),
  'memwin-sfr': () => memWins.open('sfr'),
  'irq-reset': () => {
    quiet(() => {
      for (const a of [SFR.TMOD, SFR.TCON, SFR.TH0, SFR.TL0, SFR.TH1, SFR.TL1, SFR.IE, SFR.IP, SFR.SCON]) cpu.writeSfr(a, 0);
    });
    ports.p3ext = 0xff;
    ports.sample(0);
    setMessage('Interrupt- und Timer-Register auf Defaultwerte zurückgesetzt.');
    render();
  },
  printlisting: lockedGuard(() => printWith('print-listing-mode')),
  target: lockedGuard(() => {
    if (!program.bytes.size) return setMessage('Kein Programm geladen.', true);
    $('[data-target-log]').textContent = serialSupported() ? '' : 'Hinweis: Dieser Browser unterstützt Web Serial nicht. Bitte Chrome oder Edge verwenden.';
    $<HTMLProgressElement>('[data-target-progress]').value = 0;
    openDialog('target');
  }),
  www: () => window.open('http://www.simsoft.de/8051win.htm', '_blank', 'noopener'),
  bye: () => {
    stop();
    save();
    $('[data-bye]').hidden = false;
  },
  restart: () => location.reload(),
  save: lockedGuard(() => {
    if (!program.bytes.size) return setMessage('Kein Programm geladen.', true);
    download(program.name.replace(/\.\w+$/, '') + '.hex', toIntelHex(program.bytes));
  }),
  editor: lockedGuard(() => { editor.value = source; setBind('editorfile', sourceName); editor.open(); }),
  assemble: () => { source = editor.value || source; assembleSource(true); },
  hexview: lockedGuard(showHexFile),
  slower: () => { speedIdx = Math.max(0, speedIdx - 1); highlightChanges = running !== 'turbo' && SPEEDS[speedIdx]! <= 10; save(); scheduleRender(); render(); },
  faster: () => { speedIdx = Math.min(SPEEDS.length - 1, speedIdx + 1); highlightChanges = running !== 'turbo' && SPEEDS[speedIdx]! <= 10; save(); scheduleRender(); render(); },
  terminal: () => openDialog('terminal'),
  print: () => printWith('print-ui'),
  theme: () => {
    const root = document.documentElement;
    const dark = root.dataset['theme'] ? root.dataset['theme'] === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset['theme'] = dark ? 'light' : 'dark';
    save();
  },
  help: () => openDialog('help'),
  about: () => openDialog('about'),
  phase: () => void phaseStep(),
  reset: () => resetCpu(),
  run: () => start('run'),
  turbo: () => start('turbo'),
  step,
  follow: () => { follow = true; codeView.scrollToAddr(cpu.pc, true); },
  'ed-new': () => {
    editor.value = '; Neues Programm\n\n        ORG   0000h\nstart:  \n        SJMP  start\n        END\n';
    source = editor.value;
    sourceName = 'programm.asm';
    setBind('editorfile', sourceName);
  },
  'ed-save': () => download(sourceName.endsWith('.asm') ? sourceName : `${sourceName}.asm`, editor.value),
  'ed-assemble': () => {
    source = editor.value;
    const r = assembleSource();
    if (!r.errors.length) { editor.dialog.close(); showToast('Assembliert und geladen.'); }
  },
  'term-clear': () => { $('[data-term]').textContent = ''; },
};

document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const act = t.closest<HTMLElement>('[data-action]');
  if (act) { actions[act.dataset['action']!]?.(); return; }
  if (t.closest('[data-close]')) { t.closest('dialog')?.close(); return; }
  const modeBtn = t.closest<HTMLElement>('[data-mode-btn]');
  if (modeBtn) { setMode(modeBtn.dataset['modeBtn'] as SimMode, true); return; }
  const bit = t.closest<HTMLButtonElement>('button.bit');
  if (bit && !bit.disabled) { toggleBit(Number(bit.dataset['addr']), Number(bit.dataset['bit'])); return; }
  const editable = t.closest<HTMLElement>('[data-edit]');
  if (editable) void editValue(editable);
});

function quiet<T>(fn: () => T): T {
  const tr = cpu.trace;
  cpu.trace = false;
  try { return fn(); } finally { cpu.trace = tr; }
}

function toggleBit(addr: number, bit: number) {
  quiet(() => {
    const v = cpu.getSfr(addr) ^ (1 << bit);
    cpu.writeSfr(addr, v);
  });
  ports.sample(0);
  scheduleRender();
}

async function editValue(el: HTMLElement) {
  const key = el.dataset['edit'] ?? '';
  const wide = key === 'pc' || key === 'dptr';
  el.classList.add('editing');
  const v = await inlineEdit(el, el.textContent ?? '', wide ? 4 : 2);
  el.classList.remove('editing');
  if (v === undefined) return;
  const n = parseHexInput(v, wide ? 0xffff : 0xff);
  if (n === undefined) return setMessage(`Ungültiger Hex-Wert "${v}".`, true);
  quiet(() => {
    if (key === 'pc') { cpu.pc = n; phase = 0; phaseView = {}; }
    else if (key === 'dptr') cpu.dptr = n;
    else if (/^r[0-7]$/.test(key)) cpu.iram[cpu.bank * 8 + Number(key[1])] = n;
    else if (key === 'lk-iram') cpu.iram[parseHexInput($<HTMLInputElement>('[data-lookup="iram"]').value, 0xff) ?? 0] = n;
    else if (key === 'lk-sfr') cpu.writeSfr(Number($<HTMLSelectElement>('[data-lookup="sfr"]').value), n);
    else if (el.dataset['sfr']) cpu.writeSfr(parseInt(el.dataset['sfr'], 16), n);
  });
  ports.sample(0);
  render();
}

// P3-Eingänge (T0/T1 umschalten, INT0/INT1 tasten)
for (const b of $$<HTMLButtonElement>('[data-p3]')) {
  const bit = 1 << Number(b.dataset['p3']);
  const changed = () => { ports.sample(0); scheduleRender(); };
  if (b.classList.contains('toggle')) {
    b.addEventListener('click', () => { ports.p3ext ^= bit; changed(); });
  } else {
    let latched = false;
    b.addEventListener('pointerdown', (e) => {
      if (e.shiftKey) { latched = !latched; ports.p3ext = latched ? ports.p3ext & ~bit : ports.p3ext | bit; }
      else { latched = false; ports.p3ext &= ~bit; }
      changed();
    });
    const release = () => { if (!latched) { ports.p3ext |= bit; changed(); } };
    b.addEventListener('pointerup', release);
    b.addEventListener('pointerleave', release);
  }
}

// Nachschlagefelder
const sfrSelect = $<HTMLSelectElement>('[data-lookup="sfr"]');
sfrSelect.append(...[...SFR_NAMES].toSorted(([a], [b]) => a - b).map(([addr, name]) => h('option', { value: String(addr), text: `${name} (${hex2(addr)}h)` })));
sfrSelect.value = String(SFR.ACC);
sfrSelect.addEventListener('change', () => { markBaseline(); render(); });
$('[data-lookup="iram"]').addEventListener('input', () => { markBaseline(); render(); });


// Dateien
const fileInput = $<HTMLInputElement>('[data-file]');
fileInput.addEventListener('change', () => {
  const f = fileInput.files?.[0];
  if (f) void openFile(f);
  fileInput.value = '';
});
addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('drop-hint'); });
addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('drop-hint'); });
addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('drop-hint');
  const f = e.dataTransfer?.files[0];
  if (f) void openFile(f);
});

// Beispiele
const exList = $('[data-examples]');
exList.replaceChildren(...[...Map.groupBy(examples.map((ex, i) => ({ ex, i })), ({ ex }) => ex.meta.group ?? 'Grundlagen')].flatMap(([group, list]) => [
  h('div', { class: 'menu-group', text: group }),
  ...list.map(({ ex, i }) => {
    const b = h('button', { class: 'menu-item' },
      h('em', { text: { int: 'int. ROM/RAM', ext: 'ext. ROM/RAM', model: 'Modell-Rechner' }[ex.meta.mode ?? 'int'] }),
      h('b', { text: ex.meta.title ?? ex.file }), h('span', { text: ex.meta.desc ?? '' }));
    b.addEventListener('click', () => { $('#examples-menu').hidePopover(); loadExample(i); });
    return b;
  }),
]));

// Editor
editor.onChange = (src) => { source = src; save(); };
editor.onAssemble = () => actions['ed-assemble']!();

// Terminal
const term = $('[data-term]');
cpu.onSerialTx = (b) => {
  if (b === 13) return;
  term.append(b === 10 ? '\n' : String.fromCharCode(b));
  term.scrollTop = term.scrollHeight;
};
term.addEventListener('keydown', (e) => {
  if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace') {
    e.preventDefault();
    cpu.rxQueue.push(e.key === 'Enter' ? 13 : e.key === 'Backspace' ? 8 : e.key.charCodeAt(0) & 0xff);
  }
});

// Code-Fenster: Mitlaufen abschalten, wenn der Nutzer scrollt
$('[data-codeview]').addEventListener('wheel', () => { follow = false; }, { passive: true });
ramView.element.addEventListener('wheel', () => { followMem = false; }, { passive: true });
$('[data-opt="asmcol"]').addEventListener('change', (e) => {
  app.classList.toggle('asmcol', (e.target as HTMLInputElement).checked);
  save();
});

// Taktfrequenz per Klick in der Statusleiste
$('[data-bind="clock"]').addEventListener('click', () => {
  clockIdx = (clockIdx + 1) % CLOCKS.length;
  save();
  render();
});

// Tastatur
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
    if (!(e.ctrlKey || e.metaKey)) return;
  }
  if ((e.target as Element).closest?.('[data-term]')) return;
  const mod = e.ctrlKey || e.metaKey;
  const map: Record<string, (() => void) | undefined> = {
    F1: actions['help'], F2: actions['reset'], F5: actions['run'], F6: actions['turbo'], F7: actions['phase'], F8: actions['step'],
    Escape: running !== 'stop' ? () => { stop(); setMessage('Angehalten.'); } : undefined,
  };
  const modMap: Record<string, (() => void) | undefined> = {
    o: actions['open'], s: actions['save'], e: actions['editor'], b: actions['assemble'],
  };
  const fn = mod ? modMap[e.key.toLowerCase()] : map[e.key];
  if (fn) { e.preventDefault(); fn(); }
});

// Druckansicht: vollständiges Listing erzeugen
const printEl = h('div', { class: 'print-listing' });
document.body.append(printEl);
addEventListener('beforeprint', () => {
  const head = h('tr', {}, ...['Adr', 'HEX', 'Mnemonic', 'Assembler', 'B', 'Z', 'Beschreibung'].map((t) => h('th', { text: t })));
  const rows = codeView.rows.map((r) => h('tr', {},
    ...[hex4(r.addr), hex2(r.byte), r.template, r.asm, r.bytes ? String(r.bytes) : '', r.cycles ? String(r.cycles) : '', r.desc].map((t) => h('td', { text: t }))));
  printEl.replaceChildren(h('h1', { text: `8051webXL – ${program.name}` }), h('table', {}, head, ...rows));
});

// ───────────────────────── Start ─────────────────────────
ports.onChange = () => { rememberProgramDevices(); save(); if (running === 'stop') scheduleRender(); };
ports.onPick = pickDevice;
buildBits();
if (store.devices) ports.config = { int: {}, ext: {}, model: {}, ...(store.devices as Partial<DeviceConfig>) };
speedIdx = store.speed ?? speedIdx;
Object.assign(options, store.options ?? {});
setStopAfterAnimation(options.stopAnim);
clockIdx = store.clock ?? clockIdx;
app.classList.toggle('asmcol', store.asmcol ?? true);
$<HTMLInputElement>('[data-opt="asmcol"]').checked = store.asmcol ?? true;
setMode(store.mode ?? 'int');

const hasExampleParam = new URLSearchParams(location.search).has('example');
if (hasExampleParam) {
  // Direktlink lädt unten das Beispiel
} else if (store.loaded === 'pw' && store.pw && parsePwFile(store.pw)) {
  source = store.source ?? '';
  sourceName = store.sourceName ?? 'programm.asm';
  editor.value = source;
  void openPwText(store.pw, parsePwFile(store.pw)!);
} else if (store.loaded === 'hex' && store.hex) {
  source = store.source ?? '';
  sourceName = store.sourceName ?? 'programm.asm';
  editor.value = source;
  loadHexText(store.hex, store.hexName ?? 'programm.hex');
} else if (store.source) {
  source = store.source;
  sourceName = store.sourceName ?? 'programm.asm';
  editor.value = source;
  assembleSource();
} else {
  loadExample(0);
}
// Direktlink: ?example=01-lauflicht.asm
const exParam = new URLSearchParams(location.search).get('example');
if (exParam) {
  const idx = examples.findIndex((e) => e.file === exParam || e.file.replace(/\.asm$/, '') === exParam);
  if (idx >= 0) loadExample(idx); else setMessage(`Beispiel "${exParam}" nicht gefunden.`, true);
} else setMessage('Starten Sie die Ausführung!');
render();
