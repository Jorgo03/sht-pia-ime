# Listing photos, profile photo, keyboard bar, price row, privacy policy

2026-10-21/22. Five fixes in the phone app (Expo). The website built from the
Expo app gets them too. Status words follow `docs/LAUNCH_TASKS.md`: VERIFIED,
IMPLEMENTED—UNVERIFIED, BLOCKED. The owner's screenshots were not attached to
the request, so this work follows its text and the live logs.

## 1. Privacy policy: "1. Kush jemi" removed

- **Change:** removed the privacy policy's first section ("Kush jemi" / "Who we
  are") from both language copies, `src/features/legal/content/sq.js` and
  `en.js`. The other sections are renumbered 1–12.
- **Scope:** the Terms keep their own "1. Kush jemi". There are only two copies:
  every other language shows the English text.
- **How it is shown:** the phone app and the website render the same content
  objects.
- **Status:** VERIFIED. The e2e test X08 opens the legal pages.

## 2. Listing wizard: photos, draft and publish

### Confirmed causes

1. **`ImageContextLostException`
   (`ImageFixOrientationTransformer.swift:58`).** It comes from Expo Go's own
   native copy of `expo-image-manipulator`, not from our code.
   - **Which version:** the logs' user agent shows Expo Go 57.0.9 on iOS 26.0.1.
     That Expo Go ships a manipulator older than the 57.0.21 this repo installs.
   - **Why it fails:** before 57.0.21, the transformer that rotates a photo
     upright creates a `CGContext` with the photo's own `bitsPerComponent`. iOS
     refuses that for 10-bit HDR photos (recent iPhone camera photos), the
     context is nil, and the transformer throws exactly this error.
   - **The upstream fix:** 57.0.21 draws through `drawInNewContext`, which
     accepts HDR.
   - **Who can fix it:** we cannot change Expo Go's native code.
2. **Uploads were refused with HTTP 400 `InvalidMimeType` ("mime type
   text/plain is not supported").** The live storage logs show this on both
   buckets.
   - **Why:** the app uploaded a React Native `Blob`. supabase-js wraps a Blob
     in multipart form data, and on React Native that part arrives as
     `text/plain`.
   - **Which buckets refuse it:** `property-images` allows only
     jpeg/png/webp/gif/mp4/quicktime; `avatars` allows only jpeg/png/webp.
3. **A save could create two listings.** A tap during a save, or a retry after
   a lost reply, sent a second INSERT, and the database gave each one a new id.
4. **Errors and photos left behind.**
   - A failed save could show the raw native error text.
   - Photos uploaded before a failed insert stayed in storage.
   - Native image objects were never released.

### What changed

**Picking and preparing photos (`lib/upload.ts`)**

- The picker asks iOS for the compatible representation
  (`preferredAssetRepresentationMode: Compatible`): an 8-bit JPEG instead of
  HEIC/HDR. That avoids the failing transform inside Expo Go.
- If processing still fails, the original photo is uploaded instead, but only
  when its type is one the bucket allows and its size is known and under 10 MB
  (`chooseUploadSource`). Otherwise the person sees a translated message.
- Photos that are already small enough are not enlarged.
- Native image objects are released in `finally`.

**Uploading**

- Uploads send the file's bytes (`fetch(uri).arrayBuffer()`) with the real
  `Content-Type`. This is the pattern Supabase documents for React Native.
- Uploads are all-or-nothing and keep the photos in order
  (`uploadAllOrNothing`). If one photo fails, the ones already uploaded are
  removed.
- Shared helpers live in `src/features/listings/lib/mediaUpload.js`.

**Saving (`app/listing/new.tsx`)**

- Only one save runs at a time (a ref guard).
- The listing id is made in the app (`expo-crypto` UUID) and reused on every
  retry.
- If a retry meets a duplicate key (`23505`), the earlier attempt already
  landed. The app updates that row instead of creating a second one, and removes
  only media the row no longer uses.
- Photos are removed after a failed insert only when the database definitely
  refused it (it returned an error code). After a lost reply they are kept,
  because the row may exist.
- Only translated messages are shown:
  - `errors.photoPrepareFailed`
  - `errors.imageUploadFailed`
  - `errors.valueOutOfRange`
  - `errors.listingSaveFailed`

  The form stays filled in, and success is shown only after the server confirms
  the save.
- In development, `lib/debug.ts` logs the cause with secrets and personal data
  redacted. It does nothing in production.

**Price input**

- `normalizeAmount` accepts "1.200.000", "1,200,000" and "1200,50".

### Proof

**Unit tests (`tests/mediaUpload.test.mjs`)**

- Choosing the processed photo or a fallback:
  - a HEIC original, an oversized one, or one of unknown or zero size is
    refused;
  - an empty or unreadable file is a failure, never an upload.
- All-or-nothing ordering and cleanup.
- Recognising a duplicate key.
- **The real supabase-js client:** an ArrayBuffer goes out as the raw body with
  `content-type: image/jpeg`, not multipart.

**End-to-end tests (`e2e-expo/flows.spec.ts`)**

These run on the website built from the Expo app, on phone and desktop. Every
one passes.

| Test | What it checks |
|---|---|
| X20 | Publish with two photos: two uploads, each `image/jpeg`, not multipart, over 100 bytes. One INSERT with status `active`, price 1200000, EUR, a UUID id, and both photos in order. |
| X21 | Save as draft: one INSERT with status `draft`. |
| X22 | The first upload is refused. A translated message appears, no raw error text, no INSERT, the form is kept. The retry saves exactly one listing. |
| X23 | The first INSERT reply is lost, then the retry gets a 409. The same id is reused, one PATCH sets the listing `active`, and no photos are removed. |

**Live permissions (read-only, 2026-10-22)**

- `properties`:
  - create only with yourself as `owner_id`;
  - update and delete only as the owner or agent;
  - other people's non-active rows are hidden.
- `property-images`: write, change and delete only under `<your user id>/`.
- I tried the other-user write test as a rolled-back transaction. It stopped at
  the Supabase confirmation prompt for UPDATE/DELETE and timed out unattended.
  Nothing was written; a check afterwards found no probe rows or files. So the
  write refusals are confirmed by the policy definitions, not by running a
  write.
- A read-only check as a stranger account was inconclusive: the table has no
  non-active rows today.

### Status

- Saving logic and uploads in the website build: VERIFIED.
- On an iPhone in Expo Go (HDR photos, a real upload to Supabase):
  IMPLEMENTED—UNVERIFIED. There is no device or simulator here, and this sandbox
  cannot reach `supabase.co`.
- A store or development build includes manipulator 57.0.21, which fixes the
  HDR case even without the picker option.

## 3. Profile photo

### Confirmed cause

The same `text/plain` Blob upload as above, refused by the `avatars` bucket.
The app showed "Fotoja nuk u ruajt. Provo përsëri."

### What changed

- `pickAvatar` always re-encodes the photo to a 512 px JPEG. That also drops
  EXIF data, GPS included. It never falls back to the original.
- It returns the bytes.
- `saveAvatar` (`src/features/auth/lib/avatar.js`) accepts a Blob (website) or
  an ArrayBuffer (phone):
  - It refuses an empty or over-2 MB body before uploading.
  - It uploads `<user id>/avatar-<time>.jpg` without overwriting
    (`upsert: false`).
  - It then updates `profiles.avatar_url`.
  - Only after that update succeeds does it remove the old photo. If the update
    fails, it removes the new file and keeps the old one.

### Proof

| Test | What it checks |
|---|---|
| X25 | Replace the photo: one upload, path `<id>/avatar-N.jpg`, `image/jpeg`, not multipart. One profile update with the new URL, then the old file is removed. |
| X26 | The profile update is refused (403, RLS). The translated message appears, the old photo is kept, and the new file is removed. |

- **Unit test:** an empty or 3 MB body is refused without uploading.
- **Live permissions:** `rls_profile_avatar.sql` 9/9 (earlier pass). The
  policies were re-read today and still allow writes only under
  `avatars/<your id>/`.

### Status

- Website build: VERIFIED.
- On a phone: IMPLEMENTED—UNVERIFIED.

## 4. "U krye" keyboard bar

### Cause

The old bar was an iOS `InputAccessoryView`:

- every field had to opt in;
- it did not appear above the multi-line description or the number pads in
  Expo Go;
- it did nothing on Android.

### What changed

`components/ui/keyboard-done-bar.tsx` is a bar driven by the keyboard's own
events, so it serves every field on the screen, of any keyboard type:

- **iOS:** listens to `keyboardWillShow`, `keyboardWillHide` and
  `keyboardWillChangeFrame`.
- **Android:** listens to `keyboardDidShow` and `keyboardDidHide`.

**Look**

- An orange gradient pill (accent → accentEnd) at least 44 high and 96 wide,
  with a bold white label.
- The pill has a pressed state, the label "U krye", and the hint
  `common.closeKeyboard` for screen readers.

**Position**

- The bar takes real space as the last child of the screen, so the focused
  field and the screen's own buttons stay visible above it.
- On iOS it lifts by the gap between the container's bottom and the keyboard's
  top (`src/lib/keyboardLift.js`, unit-tested).
- On Android the window already shrinks for the keyboard, so the bar sits at
  the bottom as it is.
- On the web it renders nothing.

**Where it is used**

- the listing wizard;
- the property page and its viewing form;
- saved searches;
- edit profile;
- the report sheet;
- sign-in in Profile;
- chat;
- the filter sheet;
- the listing assistant;
- Explore.

### Status

IMPLEMENTED—UNVERIFIED. Keyboards only exist on a device or simulator; tsc and
the export build pass.

## 5. Price field and "Monedha"

### What changed

- The price field's icon is now `payments`, a banknote with no currency sign.
- `constants/theme.ts` gains a `Control` token (height 54, side padding 16,
  icon-to-text gap 10, icon 18). `Field` and `SelectField variant="form"` both
  use it.
- The currency column is 112 wide.
- All four selects in the wizard use the form variant.

### Measured

Measured by e2e test X24 on the website build, at 320 and 390 px, light and
dark. All four runs gave the same numbers:

| Measure | Value |
|---|---|
| Price field height / currency height | 54 / 54 |
| Top difference / bottom difference | 0 / 0 |
| Gap between them | 12 |
| Currency width | 112 |
| Corner radius | 14 / 14 |
| Field edge to icon | 17 (16 padding + 1 border) |
| Icon | 18 |
| Icon to text | 10 |
| Icon vertical centre offset | 0 |
| Left / right gutter | 14 / 14 |

Also seen, not changed: at 320 px the wizard's step dots end about 3 px from the
right edge.

### Status

VERIFIED (website build). The phone uses the same components and tokens.

## Files

- `app/listing/new.tsx`
- `lib/upload.ts`
- `lib/debug.ts` (new)
- `src/features/listings/lib/mediaUpload.js` and `.d.ts` (new)
- `src/features/auth/lib/avatar.js` and `.d.ts`
- `components/profile/edit-profile-sheet.tsx`
- `components/ui/keyboard-done-bar.tsx`
- `src/lib/keyboardLift.js` and `.d.ts` (new)
- The bar placements:
  - `app/(tabs)/explore.tsx`
  - `app/(tabs)/profile.tsx`
  - `app/messages/[id].tsx`
  - `app/property/[id].tsx`
  - `app/saved-searches/index.tsx`
  - `components/property/filter-sheet.tsx`
  - `components/property/listing-assistant.tsx`
  - `components/safety/report-sheet.tsx`
- `components/ui/field.tsx`
- `components/ui/select-field.tsx`
- `constants/theme.ts`
- `src/features/listings/lib/listingForm.js` and `.d.ts`
- `src/features/legal/content/sq.js`
- `src/features/legal/content/en.js`
- The eight locale files
- Tests:
  - `tests/mediaUpload.test.mjs`
  - `tests/keyboardLift.test.mjs`
  - `tests/listingForm.test.mjs`
  - `e2e-expo/flows.spec.ts` (X20–X26)

No migrations and no Edge Function changes. Permissions are unchanged.

## Only the owner can do

1. In Expo Go on an iPhone:
   - Publish a listing with two recent camera photos (HDR), save a draft, edit
     it, and check it in My Listings.
   - Set and then replace the profile photo.
   - Check "U krye" above the description and the number pads.
2. The same on Android.
3. A development or store build (EAS, Expo login): it carries manipulator
   57.0.21, the native HDR fix.
4. To run the other-user write check for real, approve the UPDATE/DELETE prompt
   in Supabase.
