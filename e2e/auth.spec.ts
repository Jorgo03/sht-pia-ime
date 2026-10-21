import type { Page, Route } from '@playwright/test';

import { fakeSession, SIGNED_IN_USER } from './support/backend';
import { t } from './support/i18n';
import { axeViolations, expect, test } from './support/test';

// F4: email sign-up with a code, sign-in errors, and password recovery, on
// the website. Supabase Auth is answered here (no email is sent, no account
// is made); each test checks what the website sends and what it shows. Real
// delivery to a stranger's inbox needs the owner's SMTP sender (L15) and is
// NOT covered by these tests.

const CORS = { 'access-control-allow-origin': '*' };
const EMAIL = 'new.user@example.com';
const PASSWORD = 'correct-horse-battery';

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });

type Sent = { path: string; query: URLSearchParams; body: Record<string, unknown> };

/** Records every Auth request a test answers, in order. */
async function authRoute(page: Page, path: string, answer: (sent: Sent) => [number, unknown], log: Sent[]) {
  await page.route(`**/auth/v1/${path}*`, (route) => {
    const url = new URL(route.request().url());
    let body: Record<string, unknown> = {};
    try { body = route.request().postDataJSON() ?? {}; } catch { /* no body */ }
    const sent = { path, query: url.searchParams, body };
    log.push(sent);
    const [status, reply] = answer(sent);
    return json(route, status, reply);
  });
}

async function openSignUp(page: Page) {
  await page.goto('/profile');
  await page.getByRole('button', { name: new RegExp(t('common.signUp')) }).click();
  await expect(page.getByRole('button', { name: t('auth.createAccount') })).toBeVisible();
}

async function typeCode(page: Page, code: string) {
  for (const [i, digit] of [...code].entries()) {
    await page.getByRole('textbox', { name: t('auth.codeDigit').replace('{{n}}', String(i + 1)) }).fill(digit);
  }
}

test('F4-H1 sign-up sends the name and role, then the emailed code signs you in', async ({ page }) => {
  const log: Sent[] = [];
  await authRoute(page, 'signup', () => [200, { id: SIGNED_IN_USER.id, aud: 'authenticated', email: EMAIL, confirmation_sent_at: new Date().toISOString() }], log);
  await authRoute(page, 'verify', () => [200, fakeSession()], log);
  await openSignUp(page);

  await page.getByRole('textbox', { name: t('auth.fullName') }).fill('  Ana Hoxha ');
  await page.getByRole('textbox', { name: t('auth.email') }).fill(` ${EMAIL} `);
  await page.getByPlaceholder(t('auth.password'), { exact: true }).fill(PASSWORD);
  await page.getByPlaceholder(t('auth.confirmPassword')).fill(PASSWORD);
  await page.getByRole('button', { name: t('auth.createAccount') }).click();

  await expect(page.getByRole('heading', { name: t('auth.enterCode') })).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
  const signup = log.find((s) => s.path === 'signup')!;
  expect(signup.body).toMatchObject({ email: EMAIL, password: PASSWORD, data: { role: 'buyer', full_name: 'Ana Hoxha' } });
  // The confirmation link (if the template uses one) comes back to the site.
  expect(signup.query.get('redirect_to')).toMatch(/\/auth\/callback$/);

  await typeCode(page, '123456');
  await expect(page).toHaveURL(/\/$/);
  expect(log.find((s) => s.path === 'verify')?.body).toMatchObject({ email: EMAIL, token: '123456', type: 'signup' });
});

test('F4-N1 a wrong or expired code says so and clears the boxes', async ({ page }) => {
  const log: Sent[] = [];
  await authRoute(page, 'signup', () => [200, { id: SIGNED_IN_USER.id, aud: 'authenticated', email: EMAIL }], log);
  await authRoute(page, 'verify', () => [403, { code: 'otp_expired', msg: 'Token has expired or is invalid' }], log);
  await openSignUp(page);
  await page.getByRole('textbox', { name: t('auth.fullName') }).fill('Ana Hoxha');
  await page.getByRole('textbox', { name: t('auth.email') }).fill(EMAIL);
  await page.getByPlaceholder(t('auth.password'), { exact: true }).fill(PASSWORD);
  await page.getByPlaceholder(t('auth.confirmPassword')).fill(PASSWORD);
  await page.getByRole('button', { name: t('auth.createAccount') }).click();
  await typeCode(page, '000000');
  await expect(page.getByText(t('errors.invalidCode'))).toBeVisible();
  await expect(page.getByRole('textbox', { name: t('auth.codeDigit').replace('{{n}}', '1') })).toHaveValue('');
  await expect(page).toHaveURL(/\/profile$/);
});

test('F4-N2 sign-up checks the form before sending anything', async ({ page }) => {
  const log: Sent[] = [];
  await authRoute(page, 'signup', () => [200, {}], log);
  await openSignUp(page);
  await page.getByRole('textbox', { name: t('auth.fullName') }).fill('Ana Hoxha');
  await page.getByRole('textbox', { name: t('auth.email') }).fill('not-an-email');
  await page.getByPlaceholder(t('auth.password'), { exact: true }).fill(PASSWORD);
  await page.getByPlaceholder(t('auth.confirmPassword')).fill(PASSWORD);
  await page.getByRole('button', { name: t('auth.createAccount') }).click();
  await expect(page.getByText(t('errors.invalidEmail'))).toBeVisible();

  await page.getByRole('textbox', { name: t('auth.email') }).fill(EMAIL);
  await page.getByPlaceholder(t('auth.confirmPassword')).fill('something-else');
  await page.getByRole('button', { name: t('auth.createAccount') }).click();
  await expect(page.getByText(t('errors.passwordMismatch'))).toBeVisible();

  await page.getByPlaceholder(t('auth.password'), { exact: true }).fill('short');
  await page.getByPlaceholder(t('auth.confirmPassword')).fill('short');
  await page.getByRole('button', { name: t('auth.createAccount') }).click();
  await expect(page.getByText(t('errors.passwordMin'))).toBeVisible();
  expect(log).toEqual([]);
});

test('F4-N3 a wrong password gets a plain message, not the raw error', async ({ page }) => {
  // The shared fake backend refuses every sign-in with Supabase's real text.
  await page.goto('/profile');
  await page.getByRole('textbox', { name: t('auth.email') }).fill(EMAIL);
  await page.getByPlaceholder(t('auth.password'), { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: t('auth.stepInside') }).click();
  await expect(page.getByText(t('errors.invalidCredentials'))).toBeVisible();
  await expect(page.getByText('Invalid login credentials')).toHaveCount(0);
});

test('F4-H2 password recovery: request, open the emailed link, set a new password', async ({ page }) => {
  const log: Sent[] = [];
  await authRoute(page, 'recover', () => [200, {}], log);
  // The link's code is exchanged for a recovery session (PKCE).
  await authRoute(page, 'token', () => [200, fakeSession()], log);
  await authRoute(page, 'user', () => [200, SIGNED_IN_USER], log);

  await page.goto('/profile');
  await page.getByRole('textbox', { name: t('auth.email') }).fill(EMAIL);
  await page.getByRole('button', { name: t('auth.forgotShort') }).click();
  await expect(page.getByText(t('auth.resetSent'))).toBeVisible();
  const recover = log.find((s) => s.path === 'recover')!;
  expect(recover.body).toMatchObject({ email: EMAIL });
  expect(recover.query.get('redirect_to')).toMatch(/\/profile$/);
  // PKCE: a challenge goes out, the verifier stays in this browser.
  expect(recover.body.code_challenge).toBeTruthy();

  // The emailed link lands on /profile?code=…; same browser, as in real life.
  await page.goto('/profile?code=e2e-recovery-code');
  await expect(page.getByRole('heading', { name: t('auth.recoveryTitle') })).toBeVisible();
  const exchange = log.find((s) => s.path === 'token')!;
  expect(exchange.query.get('grant_type')).toBe('pkce');
  expect(exchange.body).toMatchObject({ auth_code: 'e2e-recovery-code' });

  await page.getByPlaceholder(t('auth.newPassword')).fill('short');
  await page.getByPlaceholder(t('auth.confirmPassword')).fill('short');
  await page.getByRole('button', { name: t('auth.updatePassword') }).click();
  await expect(page.getByText(t('errors.passwordMin'))).toBeVisible();
  expect(log.some((s) => s.path === 'user' && s.body.password)).toBe(false);

  await page.getByPlaceholder(t('auth.newPassword')).fill('a-new-long-password');
  await page.getByPlaceholder(t('auth.confirmPassword')).fill('a-new-long-password');
  await page.getByRole('button', { name: t('auth.updatePassword') }).click();
  await expect(page.getByText(t('auth.recoverySuccess'))).toBeVisible();
  expect(log.find((s) => s.path === 'user' && s.body.password)?.body).toMatchObject({ password: 'a-new-long-password' });
  // Then on to the signed-in profile.
  await page.getByRole('button', { name: t('common.done') }).click();
  await expect(page.getByRole('button', { name: t('profile.edit.title') })).toBeVisible();
});

test.describe('when Supabase refuses to send', () => {
  // The browser logs the refused request (429) as a console error.
  test.use({ allowConsoleErrors: [/429/] });

  test('F4-E1 the email quota says "wait", not "try again"', async ({ page }) => {
    const log: Sent[] = [];
    await authRoute(page, 'recover', () => [429, { code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' }], log);
    await page.goto('/profile');
    await page.getByRole('textbox', { name: t('auth.email') }).fill(EMAIL);
    await page.getByRole('button', { name: t('auth.forgotShort') }).click();
    await expect(page.getByText(t('errors.rateLimited'))).toBeVisible();
  });
});

async function openEmailCode(page: Page) {
  await page.goto('/profile');
  await page.getByRole('button', { name: t('auth.signInWithEmail') }).click();
  await page.getByPlaceholder(t('auth.email')).fill(EMAIL);
}

test('F4-H5 a double click sends one code, and the code signs in once', async ({ page }) => {
  const log: Sent[] = [];
  // Slow answers, so the second click lands while the first is in flight.
  await page.route('**/auth/v1/otp*', async (route) => {
    log.push({ path: 'otp', query: new URL(route.request().url()).searchParams, body: route.request().postDataJSON() });
    await new Promise((r) => setTimeout(r, 400));
    return json(route, 200, {});
  });
  await page.route('**/auth/v1/verify*', async (route) => {
    log.push({ path: 'verify', query: new URL(route.request().url()).searchParams, body: route.request().postDataJSON() });
    await new Promise((r) => setTimeout(r, 400));
    return json(route, 200, fakeSession());
  });
  await openEmailCode(page);
  await page.getByRole('button', { name: t('auth.sendCode') }).dblclick();
  await expect(page.getByRole('heading', { name: t('auth.enterCode') })).toBeVisible();
  expect(log.filter((s) => s.path === 'otp')).toHaveLength(1);
  expect(log[0].body).toMatchObject({ email: EMAIL });

  // Paste fills every box at once, then a typed last digit fires again.
  await page.getByRole('textbox', { name: t('auth.codeDigit').replace('{{n}}', '1') }).focus();
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData('text', '123456');
    document.querySelector('.otp-inputs')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
  });
  await page.getByRole('textbox', { name: t('auth.codeDigit').replace('{{n}}', '6') }).fill('6').catch(() => {});
  await expect(page).toHaveURL(/\/$/);
  expect(log.filter((s) => s.path === 'verify')).toHaveLength(1);
});

test.describe('server wait', () => {
  test.use({ allowConsoleErrors: [/status of 429/] });

  test('F4-N6 "wait N seconds" from Supabase sets the resend timer and keeps the earlier code usable', async ({ page }) => {
    const log: Sent[] = [];
    await authRoute(page, 'otp', () => [429, { code: 'over_email_send_rate_limit', msg: 'For security purposes, you can only request this after 42 seconds.' }], log);
    await openEmailCode(page);
    await page.getByRole('button', { name: t('auth.sendCode') }).click();
    await expect(page.getByRole('heading', { name: t('auth.enterCode') })).toBeVisible();
    await expect(page.getByText(t('errors.waitSeconds').replace('{{s}}', '42'))).toBeVisible();
    // The countdown starts from the server's 42 (it may have ticked once).
    await expect(page.getByRole('button', { name: new RegExp(t('auth.resendIn').replace('{{s}}', '4[12]')) })).toBeDisabled();
  });
});
