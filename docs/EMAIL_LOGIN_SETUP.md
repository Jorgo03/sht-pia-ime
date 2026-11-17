# Email login: connecting Gmail (temporary sender)

Owner decision 2026-11-08: send login codes through a Gmail account until there
is a domain. Everything here is typed into Google's and Supabase's own pages.
**The app password never goes in chat, in this repo, or in the app.**

## 1. Gmail

1. Create a new Gmail account just for this, for example one named after the
   app. Every person who logs in will see this address, and a new account keeps
   your personal mailbox out of it.
2. Turn on **2-Step Verification** for that account.
3. Open <https://myaccount.google.com/apppasswords>, create one named
   `Shtepia.ime` and copy the 16 letters.

## 2. Supabase: Authentication → Emails → SMTP Settings

| Field | Value |
| --- | --- |
| Enable custom SMTP | On |
| Sender email | the Gmail address |
| Sender name | `Shtëpia.ime` |
| Host | `smtp.gmail.com` |
| Port | `587` |
| Minimum interval per user | `60` seconds |
| Username | the Gmail address |
| Password | the 16 letters, no spaces |

Gmail sends only as the account that logged in, so the sender and the username
must be the same address.

## 3. Supabase: Authentication → Rate Limits

| Setting | Value | Why |
| --- | --- | --- |
| Emails per hour | `20` | Stays under Gmail's daily sending limit, which suspends the account if it is exceeded |
| Token verifications | `30` per 5 minutes, per IP | The server's protection against guessing codes. Do not raise it |

## 4. Supabase: Authentication → Sign In / Providers → Email

| Setting | Value |
| --- | --- |
| Email OTP Expiration | `600` (the email says 10 minutes) |
| Email OTP Length | `6` |

Leave **Confirm email** as it is for now. It goes on after the delivery tests
pass (DECISIONS.md §17: on before mail works, sign-up stops working).

## 5. Supabase: Authentication → Emails → Templates → Magic Link

- Subject: `Kodi yt i hyrjes · Your Login Verification Code`
- Body: the whole of `supabase/templates/magic_link.html`

## What Gmail can and cannot show

| Status | Where to see it |
| --- | --- |
| Requested, or refused by Gmail | Supabase logs (Authentication). A refusal shows in the app as "We couldn't send the verification code" |
| Accepted by Gmail | The account's **Sent** folder |
| Bounced | A "Delivery Status Notification" arrives in that account's inbox |
| Delivered, Inbox or Spam | **Not available.** Only a test mailbox can show it |

Delivery events, bounce webhooks and SPF/DKIM/DMARC on our own name need a
domain and Resend. Inbox placement can't be guaranteed on either setup: the
receiving mail service decides.

## Later, in this order

1. Real delivery proven with Gmail, Outlook and one other provider.
2. Existing accounts proven to reach their own data with a code.
3. Confirm email on.
4. A domain and Resend replace Gmail: only section 2 changes.

Sign-in stays on email and password by default, with the code one tap away
(DECISIONS.md §19).
