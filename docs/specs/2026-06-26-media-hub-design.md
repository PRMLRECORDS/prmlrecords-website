# PRML Media Hub — Design Spec

**Date:** 2026-06-26
**Author:** PRML Records (with Claude)
**Status:** Approved for planning
**Scope:** Rebuild `media.html` into a live media hub, merge the player, add a curated gallery, add two forms, enable AdSense monetization on media + blog, and add Chromecast/AirPlay casting. Ships as **one combined build**.

---

## 1. Goals

1. Turn the media page from "Coming Soon" into a **live media hub**.
2. **Merge `player.html` into `media.html`** — one page, one player.
3. Display the site's media in a **curated gallery** with Video / Audio / Photos sections.
4. Let the on-page player **cast to Chromecast and AirPlay**.
5. Add a **public creator sign-up form** (capture → PRML follows up for a consultation).
6. Add an **unlisted internal intake form** for Quo to use during consultations.
7. **Monetize** the media + blog pages with Google AdSense (`ca-pub-6350346617000948`).

## 2. Source of truth & deploy

- **Live site folder:** `…/PRML_STUDIO/04_WEBSITE/prmlrecords.com/v3_current/prml-site/`
- **Deploy flow:** build → `prml-cache-bust` → `prml-deploy` (SEAUX9 approval gate) → `git push`.
- All existing page furniture is preserved: nav, cart, brand CSS (`brand.css`, `nav.css`, `notify.css`), GA4, Meta Pixel, `cookie-consent.js`, `cache-bust.js`.
- Brand system: bg `#F5E6C8`, charcoal `#2B2B2B`, red `#E01010`, tan `#C4B49A`; fonts Rubik Mono One, Odibee Sans, Roboto Slab.

## 3. `media.html` layout (top → bottom)

1. **Nav** (existing) — "Media Player" entry in the *More* dropdown now points to `media.html` (player is merged in).
2. **Hero** — copy changes from "Coming Soon" to live (e.g. "The PRML Media Hub is live").
3. **Featured player** — a main stage that plays the currently selected item:
   - Video → `<video>`; Audio → `<audio>`.
   - **AirPlay:** `x-webkit-airplay="allow"` (Safari shows the button automatically; audio/video only).
   - **Chromecast:** Google Cast SDK loaded + a "Cast" button that sends the current item to the TV. Default Media Receiver (no receiver registration needed).
4. **Gallery with tabs: Video / Audio / Photos.** Cards show thumbnail + title + artist. Clicking a card loads it into the featured player; photos open in a lightbox. Photos tab shows an on-brand "coming soon" placeholder until images are added.
5. **AdSense unit #1** — one tasteful manual unit between the gallery and the creator section.
6. **"Host your content with PRML" section** — pitch (see §6) + the public creator sign-up form.
7. **Footer** (existing).

## 4. Media data model

A single file `js/media-data.js` holds an array of items:

```js
const PRML_MEDIA = [
  { title, artist, type: "video" | "audio" | "photo", src, thumbnail, poster }
];
```

- Adding new media = adding one entry.
- **Thumbnails:** video items use the video's first frame (via `poster`/canvas capture); audio items use an on-brand generated cover; photos use the image itself.
- Seed items: `media/Phenomenal.mp4` (video), `media/999 Vybez Ft King Ju (Prod. By Seaux9).mp3` (audio).

## 5. Casting details

- HTTPS + same-origin media (already true), so no CORS work needed.
- AirPlay: native Safari, audio/video only (cannot cast still photos — documented limitation).
- Chromecast: Cast sender framework `https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1`; load current item's URL into the cast session. Chromecast can also display photos via the Cast media API (later enhancement; launch handles video/audio).

## 6. Forms (both → PRML Forms Kit: Google Sheet + Airtable + email to info@prmlrecords.com)

### 6a. Public creator sign-up (on `media.html`)
Fields: name, email, phone (optional), social/portfolio link, content type(s) (music / video / photography / art / other), "Do you make your own content, or need us to shoot it?", short goals box, consent checkbox.
On submit: save + show "Thanks — we'll reach out to set up your consultation." **No auto-booking.**
Destination: Sheet/Airtable table **"Creator Applications."**

### 6b. Quo's internal intake (`creator-intake.html`, unlisted, not in nav)
Deeper consultation form Quo or the artist fills during the interview. Fields: artist/legal name, contact, content type(s), self-produced vs PRML-produced (note: PRML-produced = larger revenue split), tools/equipment needed, expected volume/frequency, revenue expectations + proposed split notes, content-approval notes, timeline, anything else. Marked "PRML internal use."
Destination: Sheet/Airtable table **"Consultation Intake."**

### 6c. Creator pitch copy
Drafted in PRML's voice from the business rules, for owner review before go-live:
- Creators make their own content; **PRML approves all content** before it's hosted.
- Pay is **contract-by-contract**, fair & equitable.
- PRML **can shoot the content** — but takes a **larger share** of the revenue when it does.
- The **platform is already monetized** (ad revenue); serious creators can talk business.

## 7. AdSense — two-phase plan

**Phase 1 — verification (goes live for review):**
- AdSense loader snippet (`ca-pub-6350346617000948`) in the `<head>` of **all pages, including the home page**. No ad units yet → no ads display anywhere; Google just crawls to verify ownership.
- Add **`ads.txt`** at site root: `google.com, pub-6350346617000948, DIRECT, f08c47fec0942fa0`.
- Update **privacy policy** to disclose AdSense/cookies (via `prml-legal`) so review passes.

**Phase 2 — after approval:**
- Place manual ad **units** on **media + blog only** (one tasteful unit each). **Auto Ads stays off** → ads render nowhere else regardless of the loader.
- Optional cleanup ("layer of protection"): strip the loader snippet from non-media/blog pages so it physically exists only on those two.

**Owner-only steps:** create the ad units in AdSense to get real `data-ad-slot` IDs (placeholders wired until then); approve the deploy.

## 8. `player.html`

Converted to a thin **redirect to `media.html`** so existing links/bookmarks keep working.

## 9. Out of scope (YAGNI for this build)

- Subscription tiers / paywall (from MEDIA_PLATFORM spec) — future.
- Casting still **photos** to Chromecast — future enhancement.
- Auto-booking/calendar for consultations — manual follow-up for now.
- Creator content upload portal — creators are onboarded manually via the two forms first.

## 10. Acceptance criteria

- `media.html` shows a working player + Video/Audio/Photos gallery; selecting a card plays it.
- AirPlay button appears in Safari; Chromecast "Cast" button casts video/audio.
- Public sign-up writes to "Creator Applications" (Sheet + Airtable) and emails info@; shows thank-you.
- `creator-intake.html` exists, is unlisted, and writes to "Consultation Intake."
- AdSense loader present on all pages for review; `ads.txt` live; privacy policy mentions ads.
- `player.html` redirects to `media.html`.
- Passes `prml-cache-bust` + `prml-deploy` before going live.
