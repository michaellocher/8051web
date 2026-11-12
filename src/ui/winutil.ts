/** Frei verschiebbare Fenster (Speicherfenster, ASM-Anzeige) – wie die MDI-Fenster des Originals. */

let zTop = 150;
const homes = new Map<HTMLElement, { left: number; top: number }>();

export function bringToFront(win: HTMLElement) {
  win.style.zIndex = String(++zTop);
}

/** Macht ein `.ext-window` am Kopf verschiebbar und über ✕ schließbar. */
export function makeWindow(win: HTMLElement, home: { left: number; top: number }) {
  homes.set(win, home);
  place(win, home);
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
  win.addEventListener('pointerdown', () => bringToFront(win));
  win.querySelector('[data-x="close"]')?.addEventListener('click', () => { win.hidden = true; });
}

function place(win: HTMLElement, p: { left: number; top: number }) {
  win.style.left = `${p.left}px`;
  win.style.top = `${p.top}px`;
}

export function openWindow(win: HTMLElement) {
  win.hidden = false;
  bringToFront(win);
}

/** „Fenster ordnen": alle Fenster an ihre Standardposition (Modellfenster kaskadiert) */
export function arrangeWindows() {
  let i = 0;
  for (const win of document.querySelectorAll<HTMLElement>('.ext-window')) {
    const home = homes.get(win) ?? { left: 80 + i * 28, top: 90 + i * 28 };
    if (!homes.has(win)) i++;
    place(win, home);
    win.style.width = win.style.height = '';
  }
}
