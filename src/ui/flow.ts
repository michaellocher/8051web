/** Animierte Datentransporte zwischen Elementen der Oberfläche ("Befehl holen"). */
import { h, isVisible } from './dom.ts';

let layer: HTMLElement | undefined;
let generation = 0;
/** „Stop nach jeder Animation" (Optionen): nach jedem Datentransport auf Taste/Mausklick warten */
let stopAfterAnimation = false;

export function setStopAfterAnimation(on: boolean) {
  stopAfterAnimation = on;
}

/** wartet auf einen beliebigen Tastendruck oder linken Mausklick */
function waitForUser(gen: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  layer?.classList.add('waiting');
  const done = () => {
    removeEventListener('keydown', done, true);
    removeEventListener('pointerdown', done, true);
    clearInterval(poll);
    layer?.classList.remove('waiting');
    resolve();
  };
  // abgebrochene Animation (neuer Schritt, RESET) beendet das Warten ebenfalls
  const poll = setInterval(() => { if (gen !== generation) done(); }, 100);
  addEventListener('keydown', done, true);
  addEventListener('pointerdown', done, true);
  return promise;
}

export function initFlow(el: HTMLElement) {
  layer = el;
}

/** Bricht laufende Animationen ab */
export function cancelFlows() {
  generation++;
  layer?.replaceChildren();
}

const center = (e: Element) => {
  const r = e.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Bewegt ein Datenpaket von `from` nach `to`. */
export async function packet(from: Element | undefined, to: Element | undefined, text: string, kind: '' | 'w' | 'code' = '', ms = 520): Promise<void> {
  if (!layer || !isVisible(from as HTMLElement) || !isVisible(to as HTMLElement) || reducedMotion()) {
    if (to) flash(to);
    return;
  }
  const gen = generation;
  const a = center(from!), b = center(to!);
  const p = h('div', { class: `packet ${kind}`, text });
  layer.append(p);
  const w = p.offsetWidth / 2, hh = p.offsetHeight / 2;
  const anim = p.animate(
    [
      { transform: `translate(${a.x - w}px, ${a.y - hh}px) scale(.7)`, opacity: 0 },
      { transform: `translate(${a.x - w}px, ${a.y - hh}px) scale(1)`, opacity: 1, offset: 0.15 },
      { transform: `translate(${b.x - w}px, ${b.y - hh}px) scale(1)`, opacity: 1, offset: 0.9 },
      // bei „Stop nach jeder Animation" bleibt das Datenpaket am Ziel sichtbar
      stopAfterAnimation
        ? { transform: `translate(${b.x - w}px, ${b.y - hh}px) scale(1)`, opacity: 1 }
        : { transform: `translate(${b.x - w}px, ${b.y - hh}px) scale(.8)`, opacity: 0 },
    ],
    { duration: ms, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' },
  );
  try {
    await anim.finished;
  } catch {
    /* abgebrochen */
  }
  if (gen === generation && stopAfterAnimation) await waitForUser(gen);
  p.remove();
  if (gen === generation) flash(to!);
}

export function flash(e: Element) {
  e.classList.remove('flash');
  void (e as HTMLElement).offsetWidth;
  e.classList.add('flash');
}

export const isCurrent = (gen: number) => gen === generation;
export const currentGeneration = () => generation;
