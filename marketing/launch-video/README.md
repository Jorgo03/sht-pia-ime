# Shtëpia.ime — launch video

A 25-second vertical ad (1080×1920, 30 fps, MP4) built with [HyperFrames](https://hyperframes.heygen.com): HTML + GSAP, rendered to video. It lives outside the app; nothing in `app/`, `src/` or `assets/` is changed by it.

**The listings in it are fictional.** The six properties, their photos (AI-generated, `assets/photos/`), prices and the agent "Elira Dervishi" are made up. The screens are the real app (its Expo web build) showing those listings, in Albanian.

## Scenes

Each scene is its own composition in `compositions/`; `index.html` only places them on the timeline.

| File | Time | Caption |
| --- | --- | --- |
| `s1-hook.html` | 0–3 s | Po kërkon *shtëpinë tënde?* |
| `s2-reveal.html` | 3–7 s | Njihuni me *Shtëpia.ime.* |
| `s3-discover.html` | 7–12 s | Zbulo. Kërko. *Krahaso.* |
| `s4-explore.html` | 12–17 s | Gjej mundësinë *e duhur për ty.* |
| `s5-experience.html` | 17–21 s | Çdo mundësi, *në një vend.* |
| `s6-final.html` | 21–25 s | SHTËPIA JOTE. / ZGJEDHJA JOTE. / Zbulo Shtëpia.ime. |

Scenes 3, 4 and 5 start on the previous scene's last frame (same phone pose and screen), and scene 6 starts at 20.6 s to fade over scene 5. Keep those start times if you retime a scene.

Shared pieces: `assets/film.css` (colours, caption style, the CSS phone) and `assets/film.js` (caption builder, word reveal, glass glare, screen crossfade).

## Making the next ad

- **New words:** each scene's caption is a variable (`lead` in white, `accent` in orange; `line1`/`line2`/`cta` in scene 6). Change the defaults in the scene's `film.vars({...})` call, or keep the file and override at render time.
- **New screens:** re-capture, then point the `<img class="shot">` tags at the new files.
- **New scene:** copy the closest scene file, give it a new `data-composition-id`, and add a host `<div>` in `index.html`.

## Commands

Needs Node, Chrome and FFmpeg on `PATH` (`npx hyperframes doctor` checks).

```bash
cd marketing/launch-video
npx hyperframes@0.8.225 check                         # lint, runtime, layout
npx hyperframes@0.8.225 snapshot --at 2,5,9,14,19,23   # stills to look at
npx hyperframes@0.8.225 preview                       # Studio, in the browser
npx hyperframes@0.8.225 render -f 30 -q delivery -o renders/shtepia-ime-launch-1080x1920.mp4
```

### Re-capturing the app screens

`capture/capture.mjs` serves an Expo web export, answers every Supabase request in the browser with the listings in `capture/demo-listings.mjs` (so it never reads or writes production), and saves 1290×2796 screenshots into `assets/screens/{light,dark}/`.

```bash
npx expo export -p web --output-dir <tmp>/expo-web
node marketing/launch-video/capture/capture.mjs <tmp>/expo-web light
node marketing/launch-video/capture/capture.mjs <tmp>/expo-web dark
```

Set `PW_CHROMIUM_PATH` to a Chrome binary if Playwright's own Chromium is not installed. Map tiles and fonts load from the internet.

## Not in it yet

- **No sound.** There is no music bed or sound design; add a licensed track as an `<audio>` clip in `index.html`.
- The first frame is black on purpose (the brief opens in darkness). Social players use frame 0 as the thumbnail, so upload a custom cover (e.g. the 2.4 s or 24 s frame).
