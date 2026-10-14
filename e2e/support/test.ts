import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';

import { isSimulatedFailure, mockBackend } from './backend';

// Every spec imports `test` from here instead of @playwright/test. It adds,
// for every test:
//   - the fake Supabase backend (no test ever reaches production);
//   - Albanian as the starting language and cookie consent accepted, the way
//     a returning visitor sees the site;
//   - a failure if the page throws, logs a console error, or the server
//     answers 5xx.
// A test that expects an error passes `test.use({ allowConsoleErrors: [/…/] })`.

type Options = { allowConsoleErrors: RegExp[]; language: string };

export const test = base.extend<Options & { guard: void }>({
  allowConsoleErrors: [[], { option: true }],
  language: ['sq', { option: true }],

  page: async ({ page, language }, use) => {
    await page.addInitScript((lang) => {
      try {
        if (!localStorage.getItem('fho_lang')) localStorage.setItem('fho_lang', lang);
        localStorage.setItem('fho_cookie_consent', 'accepted');
      } catch {
        // storage blocked: the app falls back to its defaults
      }
    }, language);
    await mockBackend(page);
    await use(page);
  },

  guard: [
    async ({ page, allowConsoleErrors }, use) => {
      const problems: string[] = [];
      page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const where = msg.location().url ?? '';
        if (isSimulatedFailure(where) || isSimulatedFailure(msg.text())) return;
        if (allowConsoleErrors.some((re) => re.test(msg.text()))) return;
        problems.push(`console error: ${msg.text()} (${where})`);
      });
      page.on('response', (res) => {
        if (res.status() >= 500 && !isSimulatedFailure(res.url())) problems.push(`HTTP ${res.status()}: ${res.url()}`);
      });
      await use();
      expect(problems, 'the page logged errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Serious and critical axe-core violations on the page (or one part of it).
 * Rules listed in `known` are tracked bugs in replica/bugs.md; they are left
 * out here so the test stays green, and must be removed once fixed.
 */
export async function axeViolations(page: Page, { include, known = [] }: { include?: string; known?: string[] } = {}) {
  let builder = new AxeBuilder({ page });
  if (include) builder = builder.include(include);
  const { violations } = await builder.analyze();
  return violations
    .filter((v) => (v.impact === 'serious' || v.impact === 'critical') && !known.includes(v.id))
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length}× e.g. ${v.nodes[0]?.target.join(' ')})`);
}
