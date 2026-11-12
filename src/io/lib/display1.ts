/** 1-Port-Anzeigen: 2×7-Segment-MUX, ICM7212, NSOW-Display. */
import { board, digit, el, rowY, wire, type DeviceDef } from '../kit.ts';
import { LampBank, label } from './b2util.ts';
import { ICM_DIGITS, Icm7212, muxLit, nsowChars } from './display1.logic.ts';

// ───────────── 2×7-Segment-MUX ─────────────
const mux2: DeviceDef = {
  id: '2x7mux', name: '2 × 7-Segment MUX', group: 'Anzeigen', ports: 1, usesP3: true, width: 200,
  desc: '2-stellige 7-Segment-Anzeige für Multiplexbetrieb mit Freigabe über Port 3. Segmentdaten an D0–D7: D0 = DP, D1 = c, D2 = d, D3 = e, D4 = b, D5 = a, D6 = f, D7 = g (1 = leuchtet). Die linke Ziffer wird mit P3.7, die rechte mit P3.6 aktiviert (SETB P3.6 = Display an, CLR P3.6 = Display aus). Zum Multiplexen abwechselnd Daten ausgeben und die Ziffern freigeben.',
  create() {
    const svg = board(200, 1, 'MUX');
    const segNames = ['DP', 'c', 'd', 'e', 'b', 'a', 'f', 'g'];
    segNames.forEach((n, i) => { wire(svg, i, 40); label(svg, 9, rowY(i) - 3, `D${i}=${n}`); });
    const left = digit(svg, 60, 30, 1.2);
    const right = digit(svg, 128, 30, 1.2);
    label(svg, 60 + 30, 140, 'P3.7', 'dev-tiny', 'middle');
    label(svg, 128 + 30, 140, 'P3.6', 'dev-tiny', 'middle');
    const segs = [...left, ...right];
    const bank = new LampBank(segs, (i, [p = 0, p3 = 0xff]) => muxLit(p, p3, i >= 8 ? 1 : 0, i & 7));
    return { svg, drive: () => 0xff, sample(p, c) { bank.sample(p, c); }, render() { bank.render(); } };
  },
};

// ───────────── ICM7212 ─────────────
let audio: AudioContext | undefined;
/** Kurzer Warnton (Web Audio); ohne Audiounterstützung oder Nutzerinteraktion bleibt er stumm */
function beep() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.06, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.18);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.2);
  } catch { /* kein Ton möglich */ }
}

const icm7212: DeviceDef = {
  id: 'icm7212', name: 'ICM7212 (4 Stellen)', group: 'Anzeigen', ports: 1, width: 250,
  desc: '4-stellige 7-Segment-Anzeige mit ICM7212-Decoder. D0–D3 (Px.0–Px.3) = Daten, die Stelle wählen D4–D7: D4 = Einer, D5 = Zehner, D6 = Hunderter, D7 = Tausender (je 1 speichert die Daten in dieser Stelle; 1111 = alle Stellen, 0000 = keine Änderung). Die Daten bleiben gespeichert, bis sie überschrieben werden; es gibt keinen Schreibimpuls – jedes Beschreiben des Ports übernimmt. Ungültige Daten (über 9) lösen bei laufender Simulation einen Warnton und einen Hinweis aus.',
  create() {
    const svg = board(250, 1, 'ICM7212');
    const names = ['D0', 'D1', 'D2', 'D3', 'D4 E', 'D5 Z', 'D6 H', 'D7 T'];
    names.forEach((n, i) => { wire(svg, i, 44); label(svg, 9, rowY(i) - 3, n); });
    el('rect', { x: 44, y: 6, width: 200, height: 26, rx: 3, class: 'dev-chip' }, svg);
    const title = label(svg, 144, 23, 'ICM7212 – Decoder + Speicher', 'b2-chip-txt', 'middle');
    const chip = new Icm7212();
    const digits = [3, 2, 1, 0].map((_, k) => digit(svg, 58 + k * 46, 56, 0.86));
    const segs = digits.flat();
    [3, 2, 1, 0].forEach((pos, k) => label(svg, 58 + k * 46 + 18, 136, ICM_DIGITS[pos]!.slice(0, 3) + '.', 'dev-tiny', 'middle'));
    const bank = new LampBank(segs, (i) => ((chip.segments(3 - (i >> 3)) >> (i & 7)) & 1) === 1);
    let running = false, first = true, lastBeep = -1e9, warnUntil = 0;
    return {
      svg, drive: () => 0xff,
      sample(p, c) { bank.sample(p, c); },
      setRunning(r) { running = r; },
      write(_i, latch) {
        const invalid = chip.write(latch);
        if (first) { first = false; return; } // Anfangsstand beim Anschließen
        if (invalid) {
          warnUntil = performance.now() + 1500;
          if (running && performance.now() - lastBeep > 150) { lastBeep = performance.now(); beep(); }
        }
      },
      render() {
        bank.render();
        const warn = performance.now() < warnUntil;
        title.textContent = warn ? 'Ungültige Daten!' : 'ICM7212 – Decoder + Speicher';
        title.classList.toggle('b2-warn', warn);
      },
    };
  },
};

// ───────────── NSOW-Display ─────────────
const nsow: DeviceDef = {
  id: 'nsow', name: 'NSOW-Display', group: 'Anzeigen', ports: 1, width: 190,
  desc: 'Display für 16 Himmelsrichtungen aus bis zu 3 Zeichen. Mittleres Zeichen D0–D2 (RB0–RB2): 001 = N, 010 = S, 011 = O, 100 = W, sonst leer. Linkes Zeichen D3–D5 (RB3–RB5): ebenso. Rechtes Zeichen D6–D7 (RB6–RB7): 01 = O, 10 = W, sonst leer. Beispiele: N = 01h, NO = 41h (Mitte N, rechts O), NNO = 49h (links N, Mitte N, rechts O), WSW = A2h (links W, Mitte S, rechts W).',
  create() {
    const svg = board(190, 1, 'NSOW');
    for (let i = 0; i < 8; i++) { wire(svg, i, 40, false); label(svg, 9, rowY(i) - 3, `D${i}`); }
    el('rect', { x: 50, y: 40, width: 134, height: 80, rx: 6, class: 'b2-compass' }, svg);
    const cells = [0, 1, 2].map((k) => label(svg, 50 + 22 + k * 45, 96, '', 'b2-nsow-ch', 'middle'));
    ['links', 'Mitte', 'rechts'].forEach((n, k) => label(svg, 50 + 22 + k * 45, 134, n, 'dev-tiny', 'middle'));
    let pins = 0;
    return {
      svg, drive: () => 0xff,
      sample(p) { pins = p[0] ?? 0; },
      render() { nsowChars(pins).forEach((ch, k) => { cells[k]!.textContent = ch; }); },
    };
  },
};

export const DISPLAY1_DEVICES: readonly DeviceDef[] = [nsow, icm7212, mux2];
