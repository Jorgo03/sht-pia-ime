import { expect, test } from './support/test';

// F11: an uncaught error is reported to client_errors, redacted, with no user
// attached and no query string in the route. The event is synthetic (no real
// crash), so the page itself stays healthy.

test('F11-H1 an uncaught error is reported, redacted, once', async ({ page, writes }) => {
  await page.goto('/search?city=Tiran%C3%AB');
  await page.evaluate(() => {
    const error = new Error('Failed for ana@example.com +355 69 123 4567');
    window.dispatchEvent(new ErrorEvent('error', { error, message: error.message }));
    window.dispatchEvent(new ErrorEvent('error', { error, message: error.message }));
  });
  await expect.poll(() => writes.filter((w) => w.table === 'client_errors').length).toBe(1);
  const report = writes.find((w) => w.table === 'client_errors')!.body;
  expect(report).toMatchObject({ platform: 'web', kind: 'uncaught', route: '/search', message: 'Failed for <redacted> <redacted>' });
  expect(report.app_version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(Object.keys(report).sort()).toEqual(['app_version', 'fingerprint', 'kind', 'message', 'platform', 'route', 'stack']);
});
