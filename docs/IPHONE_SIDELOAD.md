# Shtëpia.ime as a normal app on your iPhone (free Apple ID)

The app is built on GitHub's free Mac machines and installed from Windows
with Sideloadly, signed with your own Apple ID. It then opens from its icon
like any app, with no laptop and no Expo Go.

Limits of a free Apple ID (Apple's rules, not the app's):

- It stops opening after **7 days**. Install it again the same way (step 4);
  your data in the app stays.
- At most 3 such apps on the phone at once.
- No push notifications and no "Continue with Apple". Google, LinkedIn,
  email and everything else work.

The paid Apple Developer Program ($99/year) removes all three limits.

## 1. Once: add the two settings to GitHub

GitHub → the repository **sht-pia-ime** → **Settings** → **Secrets and
variables** → **Actions** → **New repository secret**, twice:

| Name | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | the line with that name in `.env.local` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | the line with that name in `.env.local` |

Copy only the value after `=`, without quotes.

## 2. Build the app

GitHub → **Actions** → **iPhone app (free sideload)** → **Run workflow** →
**Run workflow**. It takes about 20–40 minutes. When the run is green, open it
and download **Shtepia-ime-ipa** at the bottom. Unzip it: inside is
`Shtepia-ime.ipa`.

## 3. Once: prepare Windows and the iPhone

- Install **iTunes** and **iCloud** from apple.com (not the Microsoft Store
  versions); Sideloadly needs them to talk to the phone.
- Install **Sideloadly** from sideloadly.io.
- On the iPhone: **Settings → Privacy & Security → Developer Mode** → on. The
  phone restarts and asks you to confirm.

## 4. Install

1. Connect the iPhone to the laptop with a cable, unlock it, tap **Trust**.
2. Open Sideloadly, drag `Shtepia-ime.ipa` into it, type your Apple ID
   email, press **Start**, and enter your Apple ID password when asked.
3. On the iPhone: **Settings → General → VPN & Device Management** → your
   Apple ID → **Trust**.
4. Open **Shtëpia.ime** from the home screen.

After 7 days the app will not open: repeat this section with the same `.ipa`,
or build a new one (step 2) to get the latest changes.
