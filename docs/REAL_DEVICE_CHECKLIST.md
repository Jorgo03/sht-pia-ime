# Real-device checklist: iPhone with Expo Go

Fill in the Result column on the phone (✓ works, ✗ broken + what you saw).
Nothing here is ticked yet: real-device testing is not done until you have
gone through it. Checks run on the laptop before handing over (2026-11-06):
Expo SDK 58.0.23, expo-doctor 20/20, iPhone bundle builds and loads,
Supabase reachable with the app's anon key (3 active listings).

## Before you start

- iPhone: install or update **Expo Go** from the App Store (it must be the
  SDK 58 version, the current one).
- You need two accounts you control: one **Klient** (buyer) and one
  **Agjent** (agent), with two email addresses you can read. Several checks
  below need both, on two phones or by signing out and in.

## Starting the app (Windows)

1. Close any terminal still running Expo (`Ctrl + C` in it). An old one keeps
   showing the address of the network you were on when you started it.
2. Open **PowerShell** or **Terminal** in the project folder.
3. Pick by network:
   - **Home Wi-Fi** (laptop and iPhone on the same one): `npm start`
   - **Café / office / public Wi-Fi**, or the phone on mobile data:
     `npm run expo:tunnel:qr` (needs `npx expo login` once; you are logged in
     as jorgo03)
   - **Neither works:** turn on the iPhone's **Personal Hotspot**, join it from
     the laptop, then `npm start`
4. A page with a QR code opens in your browser. Wait for it to turn green.
5. On the iPhone, open the **Camera**, point it at the QR code, tap the
   **Open in Expo Go** banner.
6. The first load builds the app (20–60 seconds). Later loads are quick.

If the phone says it cannot connect: you are on a network that blocks
devices from reaching each other; use the tunnel or the hotspot. If you see
`ERR_NGROK_3200`: the tunnel stopped; run the command again.

**"Failed to download remote update"** (Android Expo Go) means the phone
could not download the app from the laptop: nothing was running, the laptop
is on another network now, or an old QR / Expo Go's "recently opened" entry
was used. It is not a bug in the app. Start the server again and scan a fresh
QR. Someone who is **not on your Wi-Fi** (a friend at home) can only open it
through the tunnel (`npm run expo:tunnel:qr`), and only while your laptop
keeps that command running.

**Android friends: open it inside Expo Go**, with Expo Go's own **Scan QR
code** button, or **Enter URL manually** and the full `exp://c-…on.expo.app`
link. Not in a browser, and not shortened: a page saying *Unsupported
namespace "jorgo03"* means the leading `c-` was lost. Opening the link in a
browser also makes the laptop build the website, which can stall the server.

## Checks

| # | Area | Do this | Expect | Result |
|---|---|---|---|---|
| 1 | Start | Open the app | Splash, then Home with listings and photos; no red error screen | |
| 2 | Registration | Profile → Regjistrohu → Klient, email + password | Code email arrives; entering the code signs you in | |
| 3 | Registration | Same as Agjent with the second email | Signed in; agent menu items (dashboard, leads) appear | |
| 4 | Login | Sign out, sign in again; also try a wrong password 5 times | Signed in; after wrong tries a "wait N seconds" message | |
| 5 | Email code | Profile → Kod me email | A 6-digit code arrives and signs you in | |
| 6 | Google | Profile → Google | Back in the app, signed in | |
| 7 | LinkedIn | Profile → LinkedIn, log in, Allow | Back in the app, signed in (this completes the LinkedIn setup) | |
| 8 | Password reset | Signed out → Harruat? → code → new password | New password works; old one does not | |
| 9 | Profile | Edit name and phone, change the photo | Saved; still there after closing and reopening the app | |
| 10 | Stay signed in | Close Expo Go fully (swipe away), reopen | Still signed in | |
| 11 | Back from background | Leave the app 2+ minutes, come back | Still works, data loads | |
| 12 | Listings | Scroll Home and Explore | Photos load, prices and places shown | |
| 13 | Search and filters | Explore: type a city, Sale/Rent, open Filters (price, rooms) | Results change; "no results" shown when nothing matches | |
| 14 | Listing page | Open one; swipe photos; tap a photo | Gallery and full-screen photo work; map shows | |
| 15 | Favourites | Tap the heart; open Favourites | Listing is there; still there after reopening | |
| 16 | Create listing (agent) | + → fill all steps, 2 photos from the camera roll, publish | Appears in My Listings and on Home | |
| 17 | Edit listing (agent) | My Listings → edit price and a photo | Change shows on the listing page | |
| 18 | Delete listing (agent) | My Listings → Fshi → confirm | Asks first; listing disappears | |
| 19 | Message (client → agent) | On the agent's listing: Bisedo | Message sent | |
| 20 | Message (agent side) | As the agent: Messages | The client's message is there; reply arrives on the client side | |
| 21 | Viewing request (client) | On the listing: Planifiko një vizitë, pick date and time | Request sent | |
| 22 | Viewing (agent side) | As the agent: Viewings / dashboard | Request shown; confirming it shows as confirmed for the client | |
| 23 | Notifications | Allow notifications when asked; send a message from the other account | A push arrives (iPhone in Expo Go only; Android Expo Go cannot) | |
| 24 | Block | In a chat: ⋮ menu → Blloko përdoruesin → confirm | The other person can no longer message you; Unblock works | |
| 25 | Report | In a chat: ⋮ → Raporto këtë përdorues | Report form sends | |
| 26 | Delete a conversation | – | **Not built**: the app has no way to delete a conversation (block instead) | n/a |
| 27 | Keyboard | Type in sign-in, new listing, messages | Fields and the send/next buttons stay visible above the keyboard | |
| 28 | Layout | Rotate is off (portrait); check a long title, small text, dark mode (☀/☾ in the header) | Nothing cut off or overlapping | |
| 29 | Language | Header language menu → English | Whole app switches; stays after reopening | |
| 30 | Offline | Turn on Airplane mode, pull to refresh, turn it off, retry | A clear error with a retry button, then it loads | |

## Known Expo Go limits (not bugs)

- Push notifications do not exist in Expo Go on Android (iPhone is fine).
- Apple Sign-In inside Expo Go signs in as Expo Go, not as Shtëpia.ime; it
  needs a development build (paid Apple account) to test properly.
- The AI chat is switched off on purpose.
