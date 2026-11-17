// Small helpers every scene uses, so a new ad is a new caption and a new
// screenshot rather than new animation code. Loaded once by index.html.
// Deterministic only: no clocks, no randomness (HyperFrames seeks frames).
window.film = {
  // A scene's text: its own defaults, overridden by any values the host or
  // the CLI (`render --variables`) passes in.
  vars(defaults) {
    const given = window.__hyperframes?.getVariables?.() ?? {};
    const out = { ...defaults };
    for (const [k, v] of Object.entries(given)) if (v != null && v !== '') out[k] = v;
    return out;
  },

  // Fills `.caption` from the scene's variables: `lead` in white, `accent` in
  // italic orange (the app's own headline style). Returns one span per word.
  caption(el, lead, accent) {
    el.textContent = '';
    const add = (text, parent) => {
      for (const word of text.split(/\s+/).filter(Boolean)) {
        const span = document.createElement('span');
        span.className = 'w';
        span.textContent = word;
        parent.append(span, ' ');
      }
    };
    if (lead) add(lead, el);
    if (accent) {
      const em = document.createElement('em');
      add(accent, em);
      el.append(em);
    }
    return Array.from(el.querySelectorAll('.w'));
  },

  // Words rise out of a soft blur, one after another.
  wordsIn(tl, words, at, stagger = 0.09) {
    tl.fromTo(words,
      { opacity: 0, y: 46, filter: 'blur(14px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out', stagger }, at);
  },

  wordsOut(tl, words, at) {
    tl.to(words, { opacity: 0, y: -24, filter: 'blur(10px)', duration: 0.45, ease: 'power2.in', stagger: 0.03 }, at);
  },

  // A band of light crossing the phone's glass.
  glare(tl, el, at, duration = 1.3) {
    tl.fromTo(el, { xPercent: -60 }, { xPercent: 60, duration, ease: 'power2.inOut' }, at);
  },

  // Crossfade from one screenshot to the next, with a little settle.
  swap(tl, from, to, at, duration = 0.55) {
    tl.fromTo(to, { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration, ease: 'power2.out' }, at);
    tl.to(from, { opacity: 0, duration, ease: 'power2.out' }, at);
  },
};
