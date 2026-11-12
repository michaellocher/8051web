/** XY-Plotter: 4 Farben, 80 × 80 Pixel, ein Port. */
import { board, el, type DeviceDef } from '../kit.ts';
import { PlotterLogic, COLORS, SIZE } from './plotter.logic.ts';
import { bindLogic, label, pinRows } from './b1-view.ts';

const FILL: Record<(typeof COLORS)[number], string> = { black: '#111', red: '#e3262b', blue: '#2457d6', green: '#12a85a' };

export const plotter: DeviceDef = {
  id: 'plotter', name: 'xy-Plotter', group: 'Antriebe', ports: 1, width: 210,
  desc: '4-Farben-Plotter mit 80×80 Pixel Zeichenfläche; je ein Schrittmotor bewegt den Stift in x- und y-Richtung. Alle Pins sind Ausgänge (high-aktiv): '
    + 'D0 = x+1, D1 = x−1, D2 = y+1, D3 = y−1 (je ein Pixel Bewegung bei jeder steigenden Flanke 0→1), D4 = Stiftlage (0 = up, 1 = down), '
    + 'D5 und D6 = Stiftfarbe (00 = schwarz, 10 = rot, 01 = blau, 11 = grün), D7 = Reset auf Position 0,0 (löscht außerdem die Arbeitsfläche und die Warnlampe). '
    + 'Verlässt der Stift den zulässigen Plottbereich, leuchtet die Warnlampe oben links rot. Der Nullpunkt liegt links unten.',
  create() {
    const logic = new PlotterLogic();
    const svg = board(210, 1);
    pinRows(svg, Array.from({ length: 8 }, (_, i): [number, string] => [i, `D${i}`]), 40);
    el('rect', { x: 46, y: 4, width: 160, height: 152, rx: 4, class: 'dm-panel-grey' }, svg);
    const k = 1.55; // Pixel → SVG
    const ox = 62, oy = 142; // Nullpunkt links unten (SVG-Koordinaten)
    el('rect', { x: ox, y: oy - SIZE * k, width: SIZE * k, height: SIZE * k, class: 'b1-paper' }, svg);
    // Zeichnung: ein Pfad je Farbe
    const paths = COLORS.map((c) => el('path', { d: '', fill: FILL[c] }, svg));
    // Führungsschienen
    const lineH = el('line', { x1: ox - 8, y1: 0, x2: ox + SIZE * k + 10, y2: 0, class: 'dm-guide' }, svg);
    const lineV = el('line', { x1: 0, y1: oy - SIZE * k - 8, x2: 0, y2: oy + 8, class: 'dm-guide' }, svg);
    el('rect', { x: 52, y: oy + 4, width: 12, height: 12, class: 'dm-axis' }, svg);
    label(svg, 58, oy + 13.5, 'X', 'dm-axis-txt', 'middle');
    el('rect', { x: ox + SIZE * k + 6, y: oy - SIZE * k - 14, width: 12, height: 12, class: 'dm-axis' }, svg);
    label(svg, ox + SIZE * k + 12, oy - SIZE * k - 4.5, 'Y', 'dm-axis-txt', 'middle');
    const lamp = el('circle', { cx: 56, cy: 14, r: 6, class: 'dev-led red' }, svg);
    const pen = el('circle', { cx: 0, cy: 0, r: 3.4, class: 'dm-pen' }, svg);
    const pos = label(svg, 204, 152, '', 'dm-tag', 'end');
    let drawn = -1;
    return bindLogic(svg, logic, () => {
      const px = ox + (logic.x + 0.5) * k, py = oy - (logic.y + 0.5) * k;
      lineH.setAttribute('y1', String(py)); lineH.setAttribute('y2', String(py));
      lineV.setAttribute('x1', String(px)); lineV.setAttribute('x2', String(px));
      pen.setAttribute('cx', String(px)); pen.setAttribute('cy', String(py));
      pen.setAttribute('fill', logic.penDown ? FILL[COLORS[logic.color]!] : '#fff');
      pen.setAttribute('stroke', FILL[COLORS[logic.color]!]);
      lamp.style.setProperty('--lit', logic.warning ? '1' : '0');
      lamp.classList.toggle('on', logic.warning);
      pos.textContent = `x ${logic.x}  y ${logic.y}`;
      if (drawn !== logic.rev) {
        drawn = logic.rev;
        const d: string[] = ['', '', '', ''];
        for (let y = 0; y < SIZE; y++) {
          let x = 0;
          while (x < SIZE) {
            const v = logic.grid[y * SIZE + x]!;
            if (!v) { x++; continue; }
            let x2 = x + 1;
            while (x2 < SIZE && logic.grid[y * SIZE + x2] === v) x2++;
            d[v - 1] += `M${(ox + x * k).toFixed(2)} ${(oy - (y + 1) * k).toFixed(2)}h${((x2 - x) * k).toFixed(2)}v${k}h${(-(x2 - x) * k).toFixed(2)}z`;
            x = x2;
          }
        }
        paths.forEach((p, i) => p.setAttribute('d', d[i]!));
      }
    });
  },
};
