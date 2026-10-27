# Free iPhone advert for Shtëpia.ime

This makes the same 40-second vertical advert as the Higgsfield one (real app
screens in an iPhone frame, an Albanian caption per feature, the door ending)
with **free tools only**. Nothing here costs money or needs an account, and the
app's production data is never touched (the recorder uses the e2e fake backend).

| Step | Tool | Cost |
| --- | --- | --- |
| Film the app's screens | Playwright (already in the app) | free |
| iPhone frame, captions, end card | Playwright drawing HTML with the app's fonts | free |
| Put it all together | ffmpeg (installed by `npm install` below) | free |
| Voice-over, optional | Microsoft neural voices through `msedge-tts` | free |
| Music, optional | Pixabay Music, or the open ACE-Step model | free |

Building takes about 6 minutes on a laptop: 3 to build the app, 4 to film, 2 to
assemble. No GPU is needed.

## Once

From the app folder (`sht-pia-ime`), in PowerShell or any terminal:

```powershell
git fetch origin ad-assets
git archive -o ad-tools.zip origin/ad-assets ad-tools
tar -xf ad-tools.zip
del ad-tools.zip
Add-Content .git/info/exclude "ad-tools/"   # keeps the tools out of the app's commits
cd ad-tools; npm install; cd ..
npm run test:e2e:install                    # Playwright's browser, if not installed yet
```

## Every time

1. **Serve the app** (first time it builds, about 3 minutes; leave it running):

   ```powershell
   node ad-tools/serve-app.mjs
   ```

   After you change the app, add `--rebuild` so the advert shows the new version.

2. **Film the 14 scenes**, in a second terminal (about 4 minutes):

   ```powershell
   npx playwright test -c ad-tools/playwright.config.ts
   ```

   The clips land in `ad-tools/scenes/` (`s01.mp4` … `s14.mp4`).

3. **Optional voice-over**, free, in Albanian (needs internet):

   ```powershell
   node ad-tools/voiceover.mjs "Shtëpia jote, në xhep. Gjej, ruaj dhe bisedo për shtëpinë tënde. Shtëpia.ime, së shpejti."
   ```

   Voices: `sq-AL-AnilaNeural` (female, default) or `--voice sq-AL-IlirNeural`
   (male). It writes `ad-tools/voice.mp3`.

4. **Optional music**: save a track as `ad-tools/music.mp3` (see "Free music" below).

5. **Make the advert** (about 2 minutes):

   ```powershell
   node ad-tools/make-ad.mjs
   node ad-tools/make-ad.mjs --music ad-tools/music.mp3 --voice ad-tools/voice.mp3   # with sound
   ```

   The video is `ad-tools/out/shtepia-ime-ad.mp4`: 1080×1920, 30 fps, about 40 s.
   Music is lowered automatically under a voice-over and fades out at the end.

## Changing it

- **Captions, order, timing**: `SHOTS` at the top of `make-ad.mjs`. Each row is
  the clip, which seconds of it to use, the scene length and the caption
  (`<br>` breaks the line).
- **What each scene does** (taps, scrolling, typing): `record-scenes.spec.ts`,
  one `test('sNN …')` per scene. The sample listings, names and chat are at the
  top of that file.
- **Real photos instead of the warm gradients**: replace `ad-tools/stand/g0.png`
  … `g7.png` with your own photos (any size, they are cropped). Use photos you
  have the rights to.
- **Another language**: change `locale: 'sq-AL'` in `record-scenes.spec.ts` and
  the captions in `make-ad.mjs`.

## Free music

- **Pixabay Music** (pixabay.com/music): free for commercial use, attribution
  not required. Search "corporate", "uplifting" or "acoustic", pick about
  40 seconds, download the MP3.
- **ACE-Step 1.5** (open music model): its model card says generated music can
  be used commercially. Use the free online demo on Hugging Face (Spaces,
  "ACE-Step"; it can queue when busy), or run it at home: it needs under 4 GB of
  graphics memory. Prompt example: "warm uplifting acoustic pop, light piano,
  soft claps, 100 bpm, instrumental".
- Avoid Meta's MusicGen for adverts: its weights are licensed for
  non-commercial use only.

## Free AI shots (optional)

The advert needs no AI on the screen. If you want a cinematic opening like the
Higgsfield door clip, these open models are free:

- **Wan 2.2** (Alibaba, Apache 2.0): text-to-video and image-to-video. The 5B
  model runs on one 24 GB graphics card at 720p, or try it on a free Hugging Face
  Space.
- **LTX-Video** (Lightricks): free for companies under $10M revenue a year,
  fast on consumer cards.

Put the clip in `ad-tools/scenes/` (for example `intro.mp4`, vertical) and add a
row for it at the start of `SHOTS` with an empty caption.

## Good to know

- `msedge-tts` uses the voice service behind Edge's "Read aloud". It is free and
  needs no key, but it is not an official Microsoft product for businesses. For
  a large paid campaign, Azure's own text-to-speech (same Anila and Ilir
  voices) has a free monthly allowance and clear commercial terms.
- In-app chat times read "yesterday" in English when filmed in Chrome (Chrome
  has no Albanian relative-time data). The recorder dates the sample messages
  more than a week back, so the app prints a plain date instead.
