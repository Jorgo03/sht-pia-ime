// Website Home: whether the page is still showing its full-screen hero. The
// site header is transparent with white text over the hero, and a solid bar
// once the visitor scrolls past it (components/web/site-header.tsx). Home
// reports its scroll position (components/web/website-home.tsx).
let overHero = true;
const listeners = new Set();

export function setOverHero(value) {
  if (value === overHero) return;
  overHero = value;
  for (const l of listeners) l();
}

export const subscribeOverHero = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const getOverHero = () => overHero;
