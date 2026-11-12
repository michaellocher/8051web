/** Tongeber (Digital-Tonwandler) und Keyboard (eine Oktave) nach dem Handbuch. */
import { board, el, rowY, wire, type DeviceDef } from '../kit.ts';
import { label } from './b2util.ts';
import { KEYBOARD_KEYS, Keyboard, LENGTH_NAMES, ToneGenerator, noteFreq, noteName } from './tongeber.logic.ts';

let audioCtx: AudioContext | undefined;

const tongeber: DeviceDef = {
  id: 'tongeber', name: 'Tongeber', group: '2-Port-Modelle', ports: 1, width: 190,
  desc: 'Digital-Tonwandler (Ton nur, solange die Simulation läuft). D0–D3 = Note: 0 = kein Ton (Pause), 1 = C1, 2 = CIS, 3 = D1, 4 = DIS, 5 = E1 … 13 = C2, 14 = CIS, 15 = D2. '
    + 'D4–D6 = Länge: 1 = 1/16, 2 = 1/8, 3 = 1/4, 4 = 1/2, 5 = ganze Note oder Pause (eine ganze Note dauert 2 s). Beispiele: 31h = C1 als Viertelnote, 40h = halbe Pause. '
    + 'Jeder Schreibzugriff auf den Port startet den Ton; das Datenformat passt zum Modell „Keyboard“.',
  create() {
    const svg = board(190, 1);
    for (let i = 0; i < 8; i++) { wire(svg, i, 30, false); label(svg, 3, rowY(i) - 3, `D${i}`, 'dev-text'); }
    el('rect', { x: 30, y: 4, width: 64, height: 152, class: 'dev-chip' }, svg);
    el('line', { x1: 86, y1: 12, x2: 38, y2: 148, class: 'dev-chip-line' }, svg);
    label(svg, 48, 42, '#', 'dev-text'); label(svg, 76, 128, 'f', 'dev-text');
    el('line', { x1: 94, y1: 80, x2: 102, y2: 80, class: 'dev-wire' }, svg);
    el('rect', { x: 102, y: 62, width: 28, height: 36, class: 'dev-chip' }, svg);
    el('path', { d: 'M110 70 v20 l12 -10 z', class: 'dev-chip-line dev-nofill' }, svg);
    el('line', { x1: 130, y1: 80, x2: 136, y2: 80, class: 'dev-wire' }, svg);
    el('path', { d: 'M136 70 h10 l12 -12 v44 l-12 -12 h-10 z', class: 'speaker' }, svg);
    const waves = el('path', { d: 'M164 66 q8 14 0 28 M170 58 q12 22 0 44', class: 'speaker-waves' }, svg);
    const noteText = label(svg, 148, 128, '–', 'ton-big', 'middle');
    const lenText = label(svg, 148, 144, '', 'dev-tiny', 'middle');
    const gen = new ToneGenerator();
    let running = false, serial = -1, osc: OscillatorNode | undefined, gain: GainNode | undefined;
    const apply = () => {
      const cur = gen.current;
      const audible = running && gen.sounding;
      waves.classList.toggle('on', gen.sounding);
      noteText.textContent = cur ? (cur.note ? noteName(cur.note) : 'Pause') : '–';
      lenText.textContent = cur ? `${LENGTH_NAMES[cur.length]}${cur.note ? '-Note' : '-Pause'}` : '';
      if (!audible || !cur) { if (gain && audioCtx) gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.01); serial = gen.serial; return; }
      audioCtx ??= new AudioContext();
      if (!osc) {
        osc = audioCtx.createOscillator(); gain = audioCtx.createGain();
        osc.type = 'triangle'; gain.gain.value = 0;
        osc.connect(gain).connect(audioCtx.destination); osc.start();
      }
      const t = audioCtx.currentTime;
      osc.frequency.setTargetAtTime(noteFreq(cur.note), t, 0.003);
      // kurze Absenkung zwischen gleichen Tönen hintereinander
      if (serial !== gen.serial) { gain!.gain.cancelScheduledValues(t); gain!.gain.setValueAtTime(0.02, t); }
      gain!.gain.setTargetAtTime(0.16, t, 0.01);
      serial = gen.serial;
    };
    return {
      svg,
      drive: () => 0xff,
      write(_i, latch) { gen.write(latch); },
      sample(_p, c) { gen.advance(c); },
      render: apply,
      setRunning(r) { running = r; if (!r) gen.reset(); apply(); },
      destroy() { osc?.stop(); osc?.disconnect(); osc = undefined; },
    };
  },
};

const keyboard: DeviceDef = {
  id: 'keyboard-ton', name: 'Keyboard', group: '2-Port-Modelle', ports: 1, width: 230,
  desc: 'Keyboard-Tastatur für eine Oktave (C … C), bedient über die PC-Tastatur: weiße Tasten A S D F G H J K, schwarze Tasten W E T Z U (die Tasten stehen auf dem Modell). '
    + 'Zusammen mit dem Tongeber zu verwenden: D0–D3 = Note (C = 1, CIS = 2 … C2 = 13), D4–D6 = 011 (Viertelnote), D7 = 0. Ohne gedrückte Taste liegt 00h an (kein Ton).',
  create(onInput) {
    const svg = board(230, 1);
    for (let i = 0; i < 8; i++) { wire(svg, i, 20, true); label(svg, 3, rowY(i) - 3, `D${i}`, 'dev-text'); }
    const kb = new Keyboard();
    const x0 = 28, ww = 24, y0 = 30, wh = 100;
    const rects = new Map<number, SVGElement>();
    const press = (note: number, down: boolean) => { if (down) kb.press(note); else kb.release(note); rects.get(note)?.classList.toggle('down', down); onInput(); };
    const bind = (g: SVGElement, note: number) => {
      g.addEventListener('pointerdown', (e) => { try { (g as unknown as Element).setPointerCapture((e as PointerEvent).pointerId); } catch { /* synthetisch */ } press(note, true); });
      g.addEventListener('pointerup', () => press(note, false));
      g.addEventListener('pointercancel', () => press(note, false));
    };
    // weiße Tasten zuerst, schwarze darüber
    let wi = 0;
    const whitePos = new Map<number, number>();
    for (const k of KEYBOARD_KEYS) if (k.white) {
      const x = x0 + wi * ww;
      const g = el('g', { class: 'kb-key white' }, svg);
      el('rect', { x, y: y0, width: ww - 1, height: wh, rx: 2 }, g);
      label(g, x + ww / 2 - 0.5, y0 + wh - 24, k.label, 'kb-name', 'middle');
      label(g, x + ww / 2 - 0.5, y0 + wh + 14, k.key.toUpperCase(), 'kb-pc', 'middle');
      rects.set(k.note, g); bind(g, k.note); whitePos.set(k.note, wi); wi++;
    }
    for (const k of KEYBOARD_KEYS) if (!k.white) {
      const left = whitePos.get(k.note - 1)!;
      const x = x0 + (left + 1) * ww - 8;
      const g = el('g', { class: 'kb-key black' }, svg);
      el('rect', { x, y: y0, width: 15, height: 60, rx: 2 }, g);
      label(g, x + 7.5, y0 - 5, k.key.toUpperCase(), 'kb-pc', 'middle');
      rects.set(k.note, g); bind(g, k.note);
    }
    const noteText = label(svg, 118, 8 + 0, '', 'dev-tiny', 'middle');
    noteText.setAttribute('y', '16');
    const byKey = new Map<string, number>(KEYBOARD_KEYS.map((k) => [k.key, k.note]));
    svg.setAttribute('tabindex', '0');
    const kd = (e: KeyboardEvent) => { const n = byKey.get(e.key.toLowerCase()); if (n !== undefined && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); press(n, true); } };
    const ku = (e: KeyboardEvent) => { const n = byKey.get(e.key.toLowerCase()); if (n !== undefined) press(n, false); };
    svg.addEventListener('keydown', kd); svg.addEventListener('keyup', ku);
    // Auch ohne Fokus auf dem Modell: PC-Tasten gelten, solange kein Eingabefeld aktiv ist
    const gk = (e: KeyboardEvent, down: boolean) => {
      const t = e.target instanceof Element ? (e.target as HTMLElement) : null;
      if (!svg.isConnected || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable || t.closest('[data-term]')))) return;
      if (svg.contains(t)) return; // schon behandelt
      const n = byKey.get(e.key.toLowerCase());
      if (n === undefined || e.ctrlKey || e.metaKey || e.altKey || (down && e.repeat)) return;
      press(n, down);
    };
    const gd = (e: KeyboardEvent) => gk(e, true), gu = (e: KeyboardEvent) => gk(e, false);
    let attached = false;
    const attach = () => { if (!attached) { attached = true; document.addEventListener('keydown', gd); document.addEventListener('keyup', gu); } };
    return {
      svg,
      drive: () => kb.drive(),
      sample() { attach(); },
      render() { attach(); noteText.textContent = kb.note ? `Code ${kb.drive().toString(16).toUpperCase().padStart(2, '0')}h · ${noteName(kb.note)}` : 'Code 00h'; },
      destroy() { attached = false; document.removeEventListener('keydown', gd); document.removeEventListener('keyup', gu); },
    };
  },
};

export const TONE_DEVICES: readonly DeviceDef[] = [tongeber, keyboard];
