/**
 * Rahmen für externe Modelle: 2-Port-Gerät mit Anschlussplatine im Port-Bereich
 * und eigenem, verschiebbarem Modellfenster (wie das Modellfenster im Original).
 */
import { ROW, board, el, rowY, type Device, type DeviceDef } from '../kit.ts';
import { bit, type ModelLogic } from './logic.ts';

export interface ModelView {
  /** zeichnet das Modell in `svg` (viewBox ist bereits gesetzt) */
  mount(svg: SVGSVGElement, logic: ModelLogic): void;
  /** aktualisiert die Darstellung aus logic/ax */
  render(logic: ModelLogic, ax: number): void;
}

export interface ExternalModelDef {
  readonly id: string;
  readonly name: string;
  readonly group: 'Modellpaket 1' | 'Modellpaket 2';
  readonly desc: string;
  /** Bezeichnungen Ax.0–7 (leer = unbenutzt), z. B. "Y1 Zylinder A ausfahren" */
  readonly ax: readonly string[];
  /** Bezeichnungen Ex.0–7 */
  readonly ex: readonly string[];
  /** Größe der Modellzeichnung (viewBox) */
  readonly width: number;
  readonly height: number;
  createLogic(): ModelLogic;
  createView(): ModelView;
}

const SVGNS = 'http://www.w3.org/2000/svg';
/** Simulierte Zeit pro Maschinenzyklus (12 MHz → 1 µs) */
const CYCLE_S = 1e-6;
const live = new Set<{ open(): void; connected(): boolean }>();

/** Öffnet die Fenster aller angeschlossenen externen Modelle */
export function openExternalWindows() {
  for (const m of live) if (m.connected()) m.open();
}

let zTop = 100;

function makeWindow(def: ExternalModelDef, logic: ModelLogic, view: ModelView) {
  const win = document.createElement('section');
  win.className = 'ext-window';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', `Externes Modell: ${def.name}`);
  win.hidden = true;
  win.innerHTML = `
    <header class="ext-head"><span class="ext-title"></span>
      <button class="ext-btn" data-x="help" title="Belegung Ax/Ex">?</button>
      <button class="ext-btn" data-x="reset" title="Modell in Grundstellung">↺</button>
      <button class="ext-btn" data-x="close" aria-label="Schließen">✕</button></header>
    <div class="ext-stage"></div>
    <div class="ext-help" hidden></div>
    <footer class="ext-foot">
      <div class="ext-io"><span>Ex</span><span class="ext-leds" data-ex></span></div>
      <div class="ext-io"><span>Ax</span><span class="ext-leds" data-ax></span></div>
      <span class="ext-status"></span>
    </footer>`;
  win.querySelector('.ext-title')!.textContent = def.name;
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${def.width} ${def.height}`);
  svg.classList.add('ext-svg');
  win.querySelector('.ext-stage')!.append(svg);
  view.mount(svg, logic);

  const mkLeds = (sel: string, names: readonly string[]) =>
    Array.from({ length: 8 }, (_, i) => {
      const s = document.createElement('i');
      s.title = `${sel === '[data-ex]' ? 'Ex' : 'Ax'}.${7 - i}${names[7 - i] ? ` – ${names[7 - i]}` : ''}`;
      s.dataset['n'] = String(7 - i);
      win.querySelector(sel)!.append(s);
      return s;
    }).toReversed();
  const exLeds = mkLeds('[data-ex]', def.ex);
  const axLeds = mkLeds('[data-ax]', def.ax);

  const help = win.querySelector<HTMLElement>('.ext-help')!;
  const rows = (p: string, names: readonly string[]) =>
    names.map((n, i) => (n ? `<tr><th>${p}.${i}</th><td>${n}</td></tr>` : '')).join('');
  help.innerHTML = `<p>${def.desc}</p><table><tr><th colspan="2">Ausgänge (P0 → Ax)</th></tr>${rows('Ax', def.ax)}
    <tr><th colspan="2">Eingänge (Ex → P1)</th></tr>${rows('Ex', def.ex)}</table>`;

  win.addEventListener('click', (e) => {
    const x = (e.target as HTMLElement).closest<HTMLElement>('[data-x]')?.dataset['x'];
    if (x === 'close') win.hidden = true;
    if (x === 'reset') logic.reset();
    if (x === 'help') help.hidden = !help.hidden;
  });
  win.addEventListener('pointerdown', () => { win.style.zIndex = String(++zTop); });

  // Verschieben am Kopf
  const head = win.querySelector<HTMLElement>('.ext-head')!;
  head.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    head.setPointerCapture(e.pointerId);
    const r = win.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const move = (ev: PointerEvent) => {
      win.style.left = `${Math.max(0, Math.min(innerWidth - 80, ev.clientX - dx))}px`;
      win.style.top = `${Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy))}px`;
    };
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', () => head.removeEventListener('pointermove', move), { once: true });
  });

  document.body.append(win);
  return {
    win,
    render(ax: number) {
      view.render(logic, ax);
      exLeds.forEach((l, i) => l.classList.toggle('on', bit(logic.ex, i)));
      axLeds.forEach((l, i) => l.classList.toggle('on', bit(ax, i)));
      win.querySelector('.ext-status')!.textContent = logic.status ?? '';
    },
  };
}

/** Macht aus einer Modelldefinition ein 2-Port-Gerät der Bauteilebibliothek. */
export function externalDevice(def: ExternalModelDef): DeviceDef {
  return {
    id: def.id,
    name: def.name,
    group: `Externe Modelle – ${def.group}`,
    ports: 2,
    width: 170,
    desc: `${def.desc} Ax.0–7 an Port A (P0), Ex.0–7 an Port B (P1).`,
    create(onInput): Device {
      const svg = board(170, 2);
      svg.classList.add('ext-board');
      for (let i = 0; i < 8; i++) {
        const y = rowY(i);
        el('line', { x1: 0, y1: y, x2: 36, y2: y, class: 'dev-wire' }, svg);
        el('path', { d: `M30 ${y - 3.5} L35 ${y} L30 ${y + 3.5}`, class: 'dev-arrow' }, svg);
        el('text', { x: 40, y: y + 3.5, class: 'dev-text' }, svg).textContent = `Ax.${i}`;
        const y2 = rowY(i + 9);
        el('line', { x1: 0, y1: y2, x2: 36, y2: y2, class: 'dev-wire' }, svg);
        el('path', { d: `M5 ${y2 - 3.5} L0 ${y2} L5 ${y2 + 3.5}`, class: 'dev-arrow' }, svg);
        el('text', { x: 40, y: y2 + 3.5, class: 'dev-text' }, svg).textContent = `Ex.${i}`;
      }
      el('rect', { x: 84, y: 30, width: 80, height: 120, rx: 6, class: 'ext-plate' }, svg);
      const title = el('text', { x: 124, y: 70, class: 'ext-plate-text', 'text-anchor': 'middle' }, svg);
      for (const [i, w] of ['Externes', 'Modell'].entries()) {
        const t = el('tspan', { x: 124, dy: i ? 16 : 0 }, title); t.textContent = w;
      }
      const name = el('text', { x: 124, y: 132, class: 'dev-tiny', 'text-anchor': 'middle' }, svg);
      name.textContent = def.name.length > 18 ? `${def.name.slice(0, 17)}…` : def.name;
      const btn = el('g', { class: 'dev-btn ext-open', transform: `translate(84 ${8 * ROW + 26})`, tabindex: 0, role: 'button' }, svg);
      el('rect', { x: 0, y: 0, width: 80, height: 24, rx: 4 }, btn);
      el('text', { x: 40, y: 16, 'text-anchor': 'middle' }, btn).textContent = 'Modell öffnen';

      const logic = def.createLogic();
      let win: ReturnType<typeof makeWindow> | undefined;
      let ax = 0, acc = 0, lastEx = logic.ex;
      const open = () => {
        win ??= makeWindow(def, logic, def.createView());
        win.win.hidden = false;
        win.win.style.zIndex = String(++zTop);
        win.render(ax);
      };
      btn.addEventListener('click', open);
      btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      const handle = { open, connected: () => svg.isConnected };
      live.add(handle);
      return {
        svg,
        drive: (i) => (i === 1 ? logic.ex : 0xff),
        sample([a = 0], cycles) {
          ax = a;
          acc += cycles * CYCLE_S;
          if (acc >= 0.001) { logic.step(ax, acc); acc = 0; }
          if (logic.ex !== lastEx) { lastEx = logic.ex; onInput(); }
        },
        render() { if (win && !win.win.hidden) win.render(ax); },
        destroy() { live.delete(handle); win?.win.remove(); },
      };
    },
  };
}
