import type { Page, Route } from '@playwright/test';

import { fakeSession, SESSION_STORAGE_KEY, SIGNED_IN_USER } from './support/backend';
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

/** Sign-in form → "Forgot?" with the address typed, as a person would. */
async function openForgot(page: Page) {
  await page.goto('/profile');
  await page.getByRole('textbox', { name: t('auth.email') }).fill(EMAIL);
  await page.getByRole('button', { name: t('auth.forgotShort') }).click();
  await expect(page.getByRole('heading', { name: t('auth.forgotTitle') })).toBeVisible();
  await expect(page.getByRole('textbox', { name: t('auth.email') })).toHaveValue(EMAIL);
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

  await authRoute(page, 'logout', () => [200, {}], log);
  await openForgot(page);
  await page.getByRole('button', { name: t('auth.sendCode') }).click();
  // Neutral: the same words whether or not the address has an account.
  await expect(page.getByText(t('auth.resetCodeSent').replace('{{email}}', EMAIL))).toBeVisible();
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
  // Whoever else was in the account is signed out.
  expect(log.find((s) => s.path === 'logout')?.query.get('scope')).toBe('others');
  await expect(page.getByText(t('security.othersSignedOut'))).toBeVisible();
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
    await openForgot(page);
    await page.getByRole('button', { name: t('auth.sendCode') }).click();
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

// Google sign-in from the phone app in Expo Go returns through this site's
// /auth/callback?rt=<the app's exp:// address>&code=… (index.html relay). On a
// Samsung A23 the page stayed blank: Android's Chrome refuses a scripted jump
// to an app scheme without a tap, and the attempt also stopped the page
// loading. On Android the page now loads and shows a button to tap.
test.describe('mobile sign-in relay on Android', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; SM-A235F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  });

  const APP = 'exp://192.168.1.20:8081/--/auth/callback';

  test('F4-R1 shows a button carrying the code back to the app, and the website never uses the code', async ({ page }) => {
    const tokenCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/auth/v1/token')) tokenCalls.push(req.url());
    });
    const navigations: string[] = [];
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations.push(frame.url());
    });

    await page.goto(`/auth/callback?rt=${encodeURIComponent(APP)}&code=abc-123`);

    const button = page.getByRole('link', { name: t('authCallback.openApp') });
    await expect(button).toBeVisible();
    await expect(page.getByText(t('authCallback.returning'))).toBeVisible();
    await expect(button).toHaveAttribute('href', `${APP}?code=abc-123`);
    // The code left the address before the Supabase client loaded.
    await expect(page).toHaveURL(/\/auth\/callback$/);
    // Still here a moment later: no redirect to the profile or home page.
    await page.waitForTimeout(1500);
    await expect(button).toBeVisible();
    expect(tokenCalls).toEqual([]);
    expect(navigations.every((u) => !u.startsWith('exp:'))).toBe(true);
  });

  test('F4-R3 an Expo tunnel address (anyone can register one) gets no button and keeps no code', async ({ page }) => {
    await page.goto(`/auth/callback?rt=${encodeURIComponent('exp://u-attacker-8081.exp.direct/--/auth/callback')}&code=abc-123`);
    await page.waitForTimeout(1000);
    await expect(page.getByRole('link', { name: t('authCallback.openApp') })).toHaveCount(0);
    expect(await page.evaluate(() => (window as { __FHO_RELAY_TARGET__?: unknown }).__FHO_RELAY_TARGET__)).toBeUndefined();
  });

  test('F4-R2 a web address in rt is never followed and gets no button', async ({ page }) => {
    await page.goto(`/auth/callback?rt=${encodeURIComponent('https://evil.example/steal')}&code=abc-123`);
    await expect(page.getByRole('link', { name: t('authCallback.openApp') })).toHaveCount(0);
    await page.waitForTimeout(1000);
    expect(new URL(page.url()).hostname).toBe('localhost');
  });
});

// ---------- Pass 20: reset by code, links that cannot work, provider off ----------

test('F4-H6 reset with the emailed code on any device: one send, code, new password', async ({ page }) => {
  const log: Sent[] = [];
  await page.route('**/auth/v1/recover*', async (route) => {
    log.push({ path: 'recover', query: new URL(route.request().url()).searchParams, body: route.request().postDataJSON() });
    await new Promise((r) => setTimeout(r, 300));
    return json(route, 200, {});
  });
  await authRoute(page, 'verify', () => [200, fakeSession()], log);
  await authRoute(page, 'user', () => [200, SIGNED_IN_USER], log);
  await authRoute(page, 'logout', () => [200, {}], log);
  await openForgot(page);
  await page.getByRole('button', { name: t('auth.sendCode') }).dblclick();
  await expect(page.getByRole('heading', { name: t('auth.enterCode') })).toBeVisible();
  expect(log.filter((s) => s.path === 'recover')).toHaveLength(1);

  await typeCode(page, '654321');
  await expect(page.getByRole('heading', { name: t('auth.recoveryTitle') })).toBeVisible();
  expect(log.find((s) => s.path === 'verify')?.body).toMatchObject({ email: EMAIL, token: '654321', type: 'recovery' });

  await page.getByPlaceholder(t('auth.newPassword')).fill('a-new-long-password');
  await page.getByPlaceholder(t('auth.confirmPassword')).fill('a-new-long-passworD');
  await page.getByRole('button', { name: t('auth.updatePassword') }).click();
  await expect(page.getByText(t('errors.passwordMismatch'))).toBeVisible();
  expect(log.some((s) => s.path === 'user' && s.body.password)).toBe(false);

  await page.getByPlaceholder(t('auth.confirmPassword')).fill('a-new-long-password');
  await page.getByRole('button', { name: t('auth.updatePassword') }).click();
  await expect(page.getByText(t('auth.recoverySuccess'))).toBeVisible();
});

test('F4-N7 a reset link opened in another browser says so and offers the code instead', async ({ page }) => {
  const log: Sent[] = [];
  await authRoute(page, 'token', () => [200, fakeSession()], log);
  // No PKCE verifier in this browser: the link's ?code= cannot be used here.
  await page.goto('/profile?code=from-another-browser');
  await expect(page.getByText(t('errors.linkOtherDevice'))).toBeVisible();
  await expect(page.getByRole('heading', { name: t('auth.forgotTitle') })).toBeVisible();
  await expect(page).toHaveURL(/\/profile$/);
  expect(log).toEqual([]);
});

test('F4-N8 an expired or used link says so at once, on both landing pages', async ({ page }) => {
  await page.goto('/profile#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  await expect(page.getByText(t('errors.linkExpired'))).toBeVisible();
  await expect(page.getByRole('heading', { name: t('auth.forgotTitle') })).toBeVisible();

  const started = Date.now();
  await page.goto('/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  await expect(page.getByText(t('errors.linkExpired'))).toBeVisible();
  expect(Date.now() - started).toBeLessThan(10_000);
  await page.getByRole('button', { name: t('authConfirm.goSignIn') }).click();
  await expect(page).toHaveURL(/\/profile$/);
});

test('F4-N9 a sign-up link opened in another browser does not spin, it explains', async ({ page }) => {
  await page.goto('/auth/callback?code=from-another-browser');
  await expect(page.getByText(t('errors.linkOtherDevice'))).toBeVisible();
});

const TOKEN_HASH = 'pkce_' + '0123456789abcdef'.repeat(3) + '01234567';

test('F4-H7 /auth/confirm waits for the button, then a reset link opens the new-password form', async ({ page }) => {
  const log: Sent[] = [];
  await authRoute(page, 'verify', () => [200, fakeSession()], log);
  await authRoute(page, 'user', () => [200, SIGNED_IN_USER], log);
  await page.goto(`/auth/confirm?token_hash=${TOKEN_HASH}&type=recovery`);
  await expect(page.getByRole('heading', { name: t('authConfirm.titleRecovery') })).toBeVisible();
  // A mail scanner opening the link uses nothing up: no verify until the press.
  await page.waitForTimeout(500);
  expect(log).toEqual([]);
  // The token left the address bar.
  await expect(page).toHaveURL(/\/auth\/confirm$/);
  expect(await axeViolations(page)).toEqual([]);

  await page.getByRole('button', { name: t('authConfirm.ctaRecovery') }).click();
  await expect(page.getByRole('heading', { name: t('auth.recoveryTitle') })).toBeVisible();
  expect(log.find((s) => s.path === 'verify')?.body).toMatchObject({ token_hash: TOKEN_HASH, type: 'recovery' });
});

test('F4-H8 /auth/confirm for a sign-up link confirms and signs in', async ({ page }) => {
  const log: Sent[] = [];
  await authRoute(page, 'verify', () => [200, fakeSession()], log);
  await page.goto(`/auth/confirm?token_hash=${TOKEN_HASH}&type=email`);
  await page.getByRole('button', { name: t('authConfirm.ctaEmail') }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(log.find((s) => s.path === 'verify')?.body).toMatchObject({ token_hash: TOKEN_HASH, type: 'email' });
});

test.describe('a used confirm link', () => {
  test.use({ allowConsoleErrors: [/403/] });

  test('F4-N10 /auth/confirm: a used link says so and leads to a new code; a broken one never calls Supabase', async ({ page }) => {
    const log: Sent[] = [];
    await authRoute(page, 'verify', () => [403, { error_code: 'otp_expired', msg: 'Email link is invalid or has expired' }], log);
    await page.goto(`/auth/confirm?token_hash=${TOKEN_HASH}&type=recovery`);
    await page.getByRole('button', { name: t('authConfirm.ctaRecovery') }).click();
    await expect(page.getByText(t('errors.linkExpired'))).toBeVisible();
    await page.getByRole('button', { name: t('authConfirm.requestNew') }).click();
    await expect(page.getByRole('heading', { name: t('auth.forgotTitle') })).toBeVisible();

    log.length = 0;
    await page.goto('/auth/confirm?token_hash=<script>&type=admin');
    await expect(page.getByText(t('errors.linkInvalid'))).toBeVisible();
    expect(log).toEqual([]);
  });
});

test('F4-N11 an unconfirmed account is taken to its code, with a resend', async ({ page }) => {
  const log: Sent[] = [];
  await authRoute(page, 'token', () => [400, { error_code: 'email_not_confirmed', msg: 'Email not confirmed' }], log);
  await authRoute(page, 'resend', () => [200, {}], log);
  await page.goto('/profile');
  await page.getByRole('textbox', { name: t('auth.email') }).fill(EMAIL);
  await page.getByPlaceholder(t('auth.password'), { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: t('auth.stepInside') }).click();
  await expect(page.getByText(t('auth.confirmFirst'))).toBeVisible();
  await page.getByRole('button', { name: t('auth.resendCode') }).click();
  await expect(page.getByText(t('auth.newCodeSent'))).toBeVisible();
  const resend = log.find((s) => s.path === 'resend')!;
  expect(resend.body).toMatchObject({ email: EMAIL, type: 'signup' });
  expect(resend.query.get('redirect_to')).toMatch(/\/auth\/callback$/);
});

test('F4-N12 a provider switched off in Supabase gets a plain message, not its raw error page', async ({ page }) => {
  await page.route('**/auth/v1/settings*', (route) => json(route, 200, { external: { email: true, google: true, apple: false, linkedin_oidc: false } }));
  const authorize: string[] = [];
  page.on('request', (r) => { if (r.url().includes('/authorize')) authorize.push(r.url()); });
  await page.goto('/profile');
  await page.getByRole('button', { name: t('auth.continueWithApple') }).click();
  await expect(page.getByText(t('errors.providerUnavailable'))).toBeVisible();
  expect(authorize).toEqual([]);
  await expect(page).toHaveURL(/\/profile$/);
});

// ---------- Pass 20: change the password while signed in ----------

test.describe('signed in: Password & security', () => {
  test.use({ signedIn: true });
  const CURRENT = 'the-current-one';

  async function openSecurity(page: Page, log: Sent[]) {
    await authRoute(page, 'token', (sent) => sent.body.password === CURRENT
      ? [200, fakeSession()]
      : [400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' }], log);
    await page.route('**/auth/v1/user*', (route) => {
      const req = route.request();
      if (req.method() === 'PUT') log.push({ path: 'user', query: new URL(req.url()).searchParams, body: req.postDataJSON() });
      return json(route, 200, SIGNED_IN_USER);
    });
    await authRoute(page, 'logout', () => [200, {}], log);
    await page.goto('/profile');
    await page.getByRole('button', { name: t('security.row') }).click();
    await expect(page.getByRole('dialog', { name: t('security.title') })).toBeVisible();
  }

  test('F4-H9 the current password is checked, then the new one is set and other devices signed out', async ({ page }) => {
    const log: Sent[] = [];
    await openSecurity(page, log);
    const dialog = page.getByRole('dialog', { name: t('security.title') });
    // The sheet itself; the dimmed dashboard behind the backdrop is not on show.
    expect(await axeViolations(page, { include: '[role="dialog"]' })).toEqual([]);

    await dialog.getByLabel(t('security.currentPassword')).fill('not-it-at-all');
    await dialog.getByLabel(t('auth.newPassword')).fill('a-brand-new-password');
    await dialog.getByLabel(t('auth.confirmPassword')).fill('a-brand-new-password');
    await dialog.getByRole('button', { name: t('security.save') }).click();
    await expect(dialog.getByText(t('errors.currentPasswordWrong'))).toBeVisible();
    expect(log.some((s) => s.path === 'user')).toBe(false);

    await dialog.getByLabel(t('security.currentPassword')).fill(CURRENT);
    await dialog.getByRole('button', { name: t('security.save') }).dblclick();
    await expect(dialog.getByText(t('security.success'))).toBeVisible();
    await expect(dialog.getByText(t('security.othersSignedOut'))).toBeVisible();
    const checks = log.filter((s) => s.path === 'token');
    expect(checks.at(-1)?.body).toMatchObject({ email: SIGNED_IN_USER.email, password: CURRENT });
    expect(log.filter((s) => s.path === 'user')).toHaveLength(1);
    expect(log.find((s) => s.path === 'user')?.body).toMatchObject({ password: 'a-brand-new-password' });
    expect(log.find((s) => s.path === 'logout')?.query.get('scope')).toBe('others');
    // The passwords are not left behind anywhere the page can read later.
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(stored).not.toContain('a-brand-new-password');
    expect(stored).not.toContain(CURRENT);
  });

  test('F4-N13 mismatched, short or unchanged new passwords never reach Supabase', async ({ page }) => {
    const log: Sent[] = [];
    await openSecurity(page, log);
    const dialog = page.getByRole('dialog', { name: t('security.title') });
    const fill = async (current: string, next: string, confirm: string) => {
      await dialog.getByLabel(t('security.currentPassword')).fill(current);
      await dialog.getByLabel(t('auth.newPassword')).fill(next);
      await dialog.getByLabel(t('auth.confirmPassword')).fill(confirm);
      await dialog.getByRole('button', { name: t('security.save') }).click();
    };
    await fill(CURRENT, 'short', 'short');
    await expect(dialog.getByText(t('errors.passwordMin'), { exact: true }).last()).toBeVisible();
    await fill(CURRENT, 'long-enough-one', 'long-enough-two');
    await expect(dialog.getByText(t('errors.passwordMismatch'))).toBeVisible();
    await fill(CURRENT, CURRENT, CURRENT);
    await expect(dialog.getByText(t('errors.passwordSame'))).toBeVisible();
    expect(log).toEqual([]);
  });

  test('F4-N14 a session that has ended says so instead of "something went wrong"', async ({ page }) => {
    const log: Sent[] = [];
    await openSecurity(page, log);
    await page.unroute('**/auth/v1/user*');
    await page.route('**/auth/v1/user*', (route) => route.request().method() === 'PUT'
      ? json(route, 403, { error_code: 'session_not_found', msg: 'Session from session_id claim in JWT does not exist' })
      : json(route, 200, SIGNED_IN_USER));
    const dialog = page.getByRole('dialog', { name: t('security.title') });
    await dialog.getByLabel(t('security.currentPassword')).fill(CURRENT);
    await dialog.getByLabel(t('auth.newPassword')).fill('a-brand-new-password');
    await dialog.getByLabel(t('auth.confirmPassword')).fill('a-brand-new-password');
    await dialog.getByRole('button', { name: t('security.save') }).click();
    await expect(dialog.getByText(t('errors.sessionExpired'))).toBeVisible();
  });
});

test.describe('signed in with Google only', () => {
  test.use({ signedIn: true });

  test('F4-N15 a Google-only account is told there is no password here, not shown a form', async ({ page }) => {
    const googleOnly = { ...SIGNED_IN_USER, app_metadata: { provider: 'google', providers: ['google'] }, identities: [{ provider: 'google' }] };
    await page.addInitScript(([key, session]) => localStorage.setItem(key, session), [SESSION_STORAGE_KEY, JSON.stringify({ ...fakeSession(), user: googleOnly })] as const);
    await page.route('**/auth/v1/user*', (route) => json(route, 200, googleOnly));
    await page.goto('/profile');
    await page.getByRole('button', { name: t('security.row') }).click();
    const dialog = page.getByRole('dialog', { name: t('security.title') });
    await expect(dialog.getByText(t('security.providerOnly').replaceAll('{{providers}}', 'Google'))).toBeVisible();
    await expect(dialog.getByLabel(t('security.currentPassword'))).toHaveCount(0);
  });
});
