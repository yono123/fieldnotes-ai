# Fieldnotes AI — Setup Checklist

From this local scaffold to a live, submittable #BuildHybridAI entry.
Deadline: **Tue 1 Dec 2026, 05:00 WIB**. Steps marked 👤 are Joe's
(accounts/identities); steps marked 🤖 are the agent's.

## 1. Firebase project (👤 Joe, in the Firebase Console)

- [ ] Create (or open) the Firebase project for Fieldnotes AI.
- [ ] **AI Services → AI Logic → Get started**: run the guided workflow,
      choose the **Gemini Developer API** provider (free tier). This
      enables the required APIs and turns on App Check enforcement for
      AI Logic.
- [ ] **Project settings → General → Your apps → Web app (`</>`)**:
      register the app (nickname "Fieldnotes AI Web") and copy the
      `firebaseConfig` object it shows.

## 2. Plug the config into the app (🤖) — ✅ DONE 25 Nov 2026

- [x] Paste the real values into `src/firebase-config.js`
      (replace every `TODO_…`). The web config is not a secret — it is
      safe to commit — but no other keys ever go in the repo.
      **Done:** project `fieldnotes-ai-2794e`, web app
      `fieldnotes-ai-web`; production build re-run and verified — the
      bundle contains the real project ID, so demo mode is off.
- [ ] `npm run dev` and confirm the header pill says
      "Firebase: connected" and the demo banner is gone.
      (Production build is served locally from `dist/` — see next steps.)

### Next steps (exact order, as of 25 Nov 2026)

- [ ] (a) Open the local URL (production build served from `dist/`).
      The app pins a **fixed App Check debug token** for localhost —
      `8fa2aadb-bf48-43e9-bdd3-ae1f63b3f805` (set in `src/firebase.js`,
      localhost only; hosted builds use reCAPTCHA Enterprise).
- [ ] (b) Register that fixed token in **Firebase Console → App Check
      → Apps → fieldnotes-ai-web → Manage debug tokens**.
- [ ] (c) **Go/no-go test:** a short note should return an **On-device**
      badge where Chrome's Prompt API is available; a long log should
      return a **Cloud** badge.
- [ ] (d) Deploy to **Firebase Hosting**.
- [ ] (e) Demo video + **Devpost submit before 1 Dec 05:00 WIB**.

## 3. App Check (👤 + 🤖)

Local development uses the **debug provider** (accepted for hackathon
submissions) with a **fixed debug token** pinned in `src/firebase.js`:
`8fa2aadb-bf48-43e9-bdd3-ae1f63b3f805`. It applies only on
`localhost`/`127.0.0.1` — production (hosted) builds never use it and go
through reCAPTCHA Enterprise instead.

- [x] 🤖 Pin the fixed debug token in `src/firebase.js` (done 25 Nov
      2026; production build re-run, served bundle verified to contain
      the token).
- [ ] 👤 Firebase Console → **App Check → Apps → fieldnotes-ai-web →
      Manage debug tokens** → register the fixed token above
      (registration in progress via browser).
- [ ] 🤖 Re-run locally and make a test request — it should succeed
      instead of failing App Check enforcement.

For the hosted site:

- [ ] 👤 App Check → register **reCAPTCHA Enterprise** for the web app and
      copy the site key.
- [ ] 🤖 Put the site key in `appCheckSiteKey` in
      `src/firebase-config.js`, rebuild, redeploy.

## 4. Prove the hybrid path (🤖) — go/no-go checkpoint: 27 Nov 2026 WIB

- [ ] Chrome 139+ desktop, flag
      `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`
      enabled; in DevTools console, `await LanguageModel.availability()`
      returns `available` (or trigger the download with
      `await LanguageModel.create()`).
- [ ] Tidy a **short** note → result badge says **On-device**.
- [ ] Paste a **long** log (> 600 chars) → badge says **Cloud** and the
      entry has structured plants/tasks/issues.
- [ ] Tidy a note in a browser without Nano (or with the flag off) →
      still works, badge says **Cloud** (SDK fallback).
- [ ] Weekly report generates from saved entries.

## 5. Hosting (🤖, needs 👤 project from step 1)

- [ ] `npm run build`
- [ ] Deploy `dist/` to **Firebase Hosting** (`firebase deploy --only hosting`
      from Joe's project) and note the live URL for the Devpost form.
- [ ] Smoke-test the hosted URL end-to-end (short note + long log).

## 6. Optional next step — Firestore sync (🤖)

- [ ] Entries currently persist in `localStorage` only. If time allows:
      add Firestore (`notes` collection) + anonymous auth so the log
      survives across devices, with security rules that scope documents
      to the signed-in user. Not required for a compliant entry.

## 7. Demo video + submission (🤖 produces, 👤 uploads/submits)

- [ ] 🤖 Record ≤ 3 minutes, English narration/subtitles, showing:
      (1) a short note tidied with the **On-device** badge,
      (2) a long log escalated with the **Cloud** badge,
      (3) the weekly report.
- [ ] 👤 Upload the video publicly to Joe's YouTube channel.
- [ ] 👤 Submit on Devpost (#BuildHybridAI 2026): platform **Web/Chrome**,
      public repo URL, hosted URL, video URL, and the English text
      description of how Firebase AI Logic hybrid inference is used
      (draft lives in the README's hybrid section).
- [ ] Final check before submitting: repo shows the Apache-2.0 licence,
      no secrets anywhere in the repo, app free and unrestricted for
      judge testing through the judging period.
