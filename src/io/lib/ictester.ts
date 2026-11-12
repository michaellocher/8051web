/** IC-Tester als 2-Port-Modell (Ansicht). */
import { el, led, pushButton, rowY, wire, type DeviceDef } from '../kit.ts';
import { LampBank, label, selectButton } from './b2util.ts';
import { IC_FUNCTION, IC_TYPES, IcTester } from './ictester.logic.ts';

const ictester: DeviceDef = {
  id: 'ictester', name: 'IC-Tester', group: '2-Port-Modelle', ports: 2, width: 270,
  desc: 'Testadapter für 4 Gatter-ICs. PORT-oben: D0 = A, D1 = B (Ausgänge), D2–D5 = Y1–Y4 (Eingänge), D6 = Er1, D7 = Er2. '
    + 'PORT-unten: D0 = Er3, D1 = Er4, D2 = OK, D3 = IC1 (NAND 7400), D4 = IC2 (AND 7408), D5 = IC3 (OR 7432), D6 = IC4 (EXOR 7486) – gewählte Taste = 0 –, '
    + 'D7 = Start (gedrückt = 0). Die Wechsel-Taste („Error“) tauscht das IC gegen eines mit mehr oder weniger defekten Gattern (rot markiert).',
  create(onInput) {
    const t = new IcTester();
    const svg = el('svg', { viewBox: '0 0 270 340', class: 'device-svg' });
    svg.style.aspectRatio = '270 / 340';
    el('rect', { x: 0.5, y: 0.5, width: 269, height: 339, rx: 6, class: 'dev-board' }, svg);
    const names = ['A', 'B', 'Y1', 'Y2', 'Y3', 'Y4', 'Er1', 'Er2', 'Er3', 'Er4', 'OK', 'NAND', 'AND', 'OR', 'EXOR', 'Start'];
    // Pfeilrichtung: true = Eingang des Programms (Gerät → Port)
    const input = [false, false, true, true, true, true, false, false, false, false, false, true, true, true, true, true];
    const rows = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16];
    rows.forEach((row, k) => { wire(svg, row, 30, input[k]!); label(svg, 36, rowY(row) + 4, names[k]!, 'dev-text'); });

    // Wechsel-Taste
    const ex = selectButton(svg, 98, 6, 70, 26, 'Error', () => { t.nextIc(); onInput(); });
    ex.g.setAttribute('aria-label', 'IC wechseln');
    label(svg, 178, 24, 'IC wechseln', 'dev-tiny');

    // IC (DIP14, Gatter 4 3 oben, 1 2 unten wie im Handbuch)
    const x0 = 72, y0 = 128, w = 190, h = 78;
    const gx = [x0 + 6, x0 + w / 2 + 3];
    const gates = [
      { g: 0, x: gx[0]!, y: y0 + h / 2 + 2 }, { g: 1, x: gx[1]!, y: y0 + h / 2 + 2 },
      { g: 2, x: gx[1]!, y: y0 + 2 }, { g: 3, x: gx[0]!, y: y0 + 2 },
    ];
    for (let k = 0; k < 7; k++) {
      el('rect', { x: x0 + 8 + k * 26, y: y0 - 8, width: 10, height: 9, class: 'ict-pin' }, svg);
      el('rect', { x: x0 + 8 + k * 26, y: y0 + h - 1, width: 10, height: 9, class: 'ict-pin' }, svg);
    }
    el('rect', { x: x0, y: y0, width: w, height: h, rx: 3, class: 'ict-ic' }, svg);
    el('path', { d: `M${x0} ${y0 + h / 2 - 7} a7 7 0 0 1 0 14`, class: 'ict-notch' }, svg);
    const bodies = gates.map(({ g, x, y }) => {
      const body = el('rect', { x, y, width: w / 2 - 9, height: h / 2 - 4, rx: 3, class: 'ict-gate' }, svg);
      label(svg, x + (w / 2 - 9) / 2, y + 19, `G${g + 1}`, 'dev-tiny', 'middle');
      return body;
    });
    const typeText = label(svg, x0 + w / 2, y0 - 16, '', 'ict-type', 'middle');
    // Er-Markierungen (Programm-Ausgänge): Er4 oben links, Er3 oben rechts, Er1 unten links, Er2 unten rechts
    const erPos: [number, number, number][] = [[0, gx[0]! + 40, y0 + h + 12], [1, gx[1]! + 40, y0 + h + 12], [2, gx[1]! + 40, y0 - 14], [3, gx[0]! + 40, y0 - 14]];
    const erLamps = erPos.map(([g, x, y]) => {
      const d = g >= 2 ? `M${x - 8} ${y - 6} h16 l-8 12 z` : `M${x - 8} ${y + 6} h16 l-8 -12 z`;
      label(svg, x, g >= 2 ? y - 9 : y + 17, `Er${g + 1}`, 'dev-tiny', 'middle');
      return el('path', { d, class: 'ict-er' }, svg);
    });
    const erBank = new LampBank(erLamps, (i, p) => ((i < 2 ? (p[0] ?? 0) >> (6 + i) : (p[1] ?? 0) >> (i - 2)) & 1) === 1);
    // Ausgangslampen Y1…Y4 (Pegel, den das IC an den Port legt)
    const yLamps = gates.map(({ x, y }) => led(svg, x + w / 2 - 22, y + 28, 6, 'green'));
    gates.forEach(({ g, x, y }) => label(svg, x + 12, y + 31, `Y${g + 1}`, 'dev-tiny'));
    const yBank = new LampBank(yLamps, (i, p) => t.gateOut(gates[i]!.g, (p[0] ?? 0) & 1, ((p[0] ?? 0) >> 1) & 1) === 1);
    const okLed = led(svg, 150, rowY(11), 8, 'green');
    label(svg, 164, rowY(11) + 4, 'OK', 'dev-text');
    const okBank = new LampBank([okLed], (_i, p) => (((p[1] ?? 0) >> 2) & 1) === 1);
    // Tasten (Auswahl bleibt stehen)
    const keyBtns = IC_TYPES.map((ty, k) => selectButton(svg, 80, rowY(12 + k) - 9, 64, 18, `${ty}`, () => { t.type = ty; onInput(); }));
    IC_TYPES.forEach((ty, k) => label(svg, 152, rowY(12 + k) + 4, `${IC_FUNCTION[ty]}`, 'dev-tiny'));
    // Start
    pushButton(svg, 80, rowY(16) - 9, 64, 18, 'Start', (d) => { t.start = d; onInput(); });
    const info = label(svg, 180, 300, '', 'dev-tiny');

    return {
      svg,
      drive: (i, latch) => t.drive(i, latch),
      sample(p, c) { erBank.sample(p, c); okBank.sample(p, c); yBank.sample(p, c); },
      render() {
        IC_TYPES.forEach((ty, k) => keyBtns[k]!.setActive(ty === t.type));
        typeText.textContent = `SN${t.type} ${IC_FUNCTION[t.type]}`;
        bodies.forEach((b, k) => b.classList.toggle('bad', t.isDefective(gates[k]!.g)));
        const n = t.defects.length;
        info.textContent = n === 0 ? 'IC in Ordnung' : `${n} defekt${n === 1 ? 'es Gatter' : 'e Gatter'}`;
        erBank.render(); okBank.render(); yBank.render();
      },
    };
  },
};

export const IC_DEVICES: readonly DeviceDef[] = [ictester];
