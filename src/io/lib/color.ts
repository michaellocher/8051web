/** Farbsensor und Farbtasten. */
import { board, el, led, pushButton, rowY, setLit, wire, type DeviceDef } from '../kit.ts';
import { LampBank, annulusSector, label } from './b2util.ts';
import { COLOR_NAMES, ColorDisc, ColorKeys, KEY_NAMES } from './color.logic.ts';

const FIELD_FILL = ['b2-fld-none', 'b2-fld-red', 'b2-fld-blue', 'b2-fld-black'];

const farbsensor: DeviceDef = {
  id: 'farbsensor', name: 'Farbsensor (Drehscheibe)', group: 'Erweiterungen (nicht im Original)', ports: 1, width: 230,
  desc: 'Scheibe mit vier Farbfeldern (rot, blau, schwarz, grau) vor einem Farbsensor. Px.0–Px.1 = Farbcode (0 grau/Lücke, 1 rot, 2 blau, 3 schwarz), Px.2 = 1 wenn ein Feld mittig steht (Eingänge). Px.4 = Motor links, Px.5 = Motor rechts (nur einer an = Drehung), Px.6 = Sensorlampe (Ausgänge). Klick auf ein Feld ändert dessen Farbe.',
  create(onInput) {
    const svg = board(230, 1);
    const d = new ColorDisc();
    const cx = 150, cy = 80, R = 58;
    for (const [i, n] of ['C0', 'C1', 'Mitte'].entries()) { wire(svg, i, 40, true); label(svg, 9, rowY(i) - 3, n); }
    wire(svg, 3, 40, true); label(svg, 9, rowY(3) - 3, '(frei)');
    for (const [i, n] of ['M links', 'M rechts', 'Lampe'].entries()) { wire(svg, 4 + i, 40); label(svg, 9, rowY(4 + i) - 3, n); }
    // Sensor
    el('line', { x1: 40, y1: rowY(0), x2: cx - 26, y2: 10, class: 'dev-wire' }, svg);
    el('rect', { x: cx - 26, y: 3, width: 52, height: 15, rx: 3, class: 'b2-sensor' }, svg);
    label(svg, cx, 13.5, 'SENSOR', 'dev-tiny', 'middle').setAttribute('style', 'fill:#222');
    const sens = led(svg, cx, 22, 3.5, 'white');
    // Scheibe
    el('circle', { cx, cy: cy + 4, r: R + 3, class: 'b2-disc-bg' }, svg);
    const rot = el('g', {}, svg);
    const cyd = cy + 4;
    const fieldEls = [0, 1, 2, 3].map((i) => {
      const p = el('path', { d: annulusSector(cx, cyd, 8, R, i * 90 - 40, i * 90 + 40), class: 'b2-fld' }, rot);
      p.addEventListener('click', () => { d.cycleField(i); onInput(); });
      return p;
    });
    el('circle', { cx, cy: cyd, r: 5, class: 'b2-needle-hub' }, rot);
    const arrowL = label(svg, 14, rowY(7) + 4, '', 'dev-tiny');
    const info = label(svg, cx, 156, '', 'dev-tiny', 'middle');
    return {
      svg,
      drive: () => d.inputs(),
      sample([p = 0xff], cycles) { d.setPins(p); d.step(cycles * 1e-6); },
      render() {
        rot.setAttribute('transform', `rotate(${d.angle.toFixed(2)} ${cx} ${cyd})`);
        fieldEls.forEach((f, i) => f.setAttribute('class', `b2-fld ${FIELD_FILL[d.fields[i]!]}`));
        setLit(sens, d.light ? 1 : 0);
        arrowL.textContent = d.direction === 0 ? 'Stillstand' : d.direction > 0 ? 'dreht rechts' : 'dreht links';
        info.textContent = `Sensor: ${d.light ? COLOR_NAMES[d.color] : 'Lampe aus'}`;
      },
    };
  },
};

/** Farbreihenfolge der Lampen/Tasten: D0/D4 rot, D1/D5 grün, D2/D6 gelb, D3/D7 blau */
const LED_CLASS = ['red', 'green', 'yellow', 'b2-blue'];
const KEY_CLASS = ['b2-fk-red', 'b2-fk-green', 'b2-fk-yellow', 'b2-fk-blue'];
/** Lage der Tasten im Feld (Bild im Handbuch): rot oben links, grün oben rechts, blau unten links, gelb unten rechts */
const KEY_POS = [[56, 8], [146, 8], [146, 106], [56, 106]] as const;

const farbtasten: DeviceDef = {
  id: 'farbtasten', name: 'Farben-Tasten', group: 'Spiele', ports: 1, width: 200,
  desc: '4-Farben-Anzeige mit 4 Eingabetasten (Reaktions-/Merktests wie Simon). Der Wert der Daten-Eingänge wird als Farbpunkt angezeigt: D0 = Rot, D1 = Grün, D2 = Gelb, D3 = Blau (1 = an). Die 4 Tasten liegen an den Daten-Ausgängen: D4 = Rot-Taste, D5 = Grün-Taste, D6 = Gelb-Taste, D7 = Blau-Taste (gedrückt = 0, sonst 1). Auch per PC-Tasten R, G, Y, B bei fokussiertem Gerät.',
  create(onInput) {
    const svg = board(200, 1);
    const k = new ColorKeys();
    const names = ['Rot', 'Grün', 'Gelb', 'Blau'];
    for (let i = 0; i < 4; i++) { wire(svg, i, 44); label(svg, 9, rowY(i) - 3, `D${i} ${names[i]}`); }
    for (let i = 4; i < 8; i++) { wire(svg, i, 44, true); label(svg, 9, rowY(i) - 3, `D${i} ${names[i - 4]}`); }
    // Feld: Quadranten, Lampenring in der Mitte, Tasten in den Ecken
    const px = 124, py = 80;
    el('rect', { x: 50, y: 3, width: 148, height: 154, rx: 3, class: 'b2-fk-field' }, svg);
    // Lampenring (Viertelbögen): rot oben links, grün oben rechts, gelb unten rechts, blau unten links
    const arcs: [number, number][] = [[-90, 0], [0, 90], [90, 180], [180, 270]];
    const lampOrder = [0, 1, 2, 3];
    const lamps: SVGElement[] = [];
    for (const c of lampOrder) {
      const [a0, a1] = arcs[c]!;
      lamps[c] = el('path', { d: annulusSector(px, py, 14, 26, a0 + 1, a1 - 1), class: `dev-led ${LED_CLASS[c]}` }, svg);
    }
    el('circle', { cx: px, cy: py, r: 11, class: 'b2-fk-hub' }, svg);
    for (let c = 0; c < 4; c++) {
      const [x, y] = KEY_POS[c]!;
      const key = pushButton(svg, x, y, 46, 46, '?', (down) => { k.press(c, down); onInput(); }, `key b2-fk ${KEY_CLASS[c]}`);
      key.setAttribute('aria-label', `Taste ${KEY_NAMES[c]}`);
    }
    const map: Record<string, number> = { r: 0, g: 1, y: 2, b: 3 };
    svg.setAttribute('tabindex', '0');
    svg.addEventListener('keydown', (e) => { const c = map[e.key.toLowerCase()]; if (c !== undefined && !e.repeat) { e.preventDefault(); k.press(c, true); onInput(); } });
    svg.addEventListener('keyup', (e) => { const c = map[e.key.toLowerCase()]; if (c !== undefined) { k.press(c, false); onInput(); } });
    const bank = new LampBank(lamps, (i, [p = 0]) => ((p >> i) & 1) === 1);
    return {
      svg,
      drive: () => k.inputs(),
      sample(pins, c) { k.setPins(pins[0] ?? 0xff); bank.sample(pins, c); },
      render() { bank.render(); },
    };
  },
};

export const COLOR_DEVICES: readonly DeviceDef[] = [farbsensor, farbtasten];
