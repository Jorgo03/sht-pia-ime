// Website: the page content sits in a centred column, and React Native for
// web scrolls it inside its own container, not the page. A mouse wheel over
// the margins beside the column then did nothing (APP_WEBSITE_PARITY_REPORT:
// up to 320px each side at 1920px). This forwards such wheel events to the
// column's main scroller, so the whole window scrolls the page.

/** The largest scrollable element inside `root`, or null. */
export function mainScroller(root) {
  let best = null;
  let bestArea = 0;
  for (const el of root.querySelectorAll('div')) {
    if (el.scrollHeight <= el.clientHeight + 1) continue;
    const oy = getComputedStyle(el).overflowY;
    if (oy !== 'auto' && oy !== 'scroll') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const area = r.width * r.height;
    if (area > bestArea) {
      best = el;
      bestArea = area;
    }
  }
  return best;
}

/**
 * Listens on `page` for wheel events that start outside `column` and scrolls
 * the column's main scroller instead. Returns the cleanup function.
 */
export function forwardWheel(page, column) {
  const onWheel = (e) => {
    if (column.contains(e.target) || e.ctrlKey) return;
    const target = mainScroller(column);
    if (!target) return;
    target.scrollBy({ top: e.deltaY, left: 0 });
    e.preventDefault();
  };
  page.addEventListener('wheel', onWheel, { passive: false });
  return () => page.removeEventListener('wheel', onWheel);
}
