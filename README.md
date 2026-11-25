# Fieldnotes AI

**Rough garden notes in — a clean field log out.**

Fieldnotes AI is a free web app for gardeners and field workers. During the
day you jot down rough, shorthand notes — *"pruned snow bush by gate, yellow
flowers dry, snake near compost again"* — and when you tap **Tidy up**, the
app turns them into a clean, structured end-of-day log entry: a summary plus
the **plants**, **tasks**, and **issues** it found in your note. A weekly
report can be generated from the saved entries.

Built for the **#BuildHybridAI 2026** hackathon (Google / Firebase).

## How it uses Firebase AI Logic hybrid inference

Hybrid inference is the core of this app, not a garnish. It uses the
Firebase AI Logic Web SDK (`firebase/ai`, JS SDK v13) exactly as documented
in the official
[hybrid inference getting-started guide](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started):

| Request | Route | Why |
| --- | --- | --- |
| Short note (≤ 600 chars / 90 words) | **On-device first** — `getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE, … })` runs Gemini Nano in Chrome via the Prompt API; the SDK falls back to the cloud model automatically when Nano is unavailable | Fast, private, free, and works in the garden with no signal |
| Long log (over the threshold) | **Escalated to the cloud** — a second model with `InferenceMode.PREFER_IN_CLOUD` produces the fuller structured summary | Long, messy logs are where the bigger cloud model earns its keep |
| Weekly report | **Cloud** (`PREFER_IN_CLOUD`) | It reasons over many entries at once |

Key implementation details (see `src/ai.js`):

- The backend is the Gemini Developer API:
  `getAI(app, { backend: new GoogleAIBackend() })`.
- `model.initializeDeviceModel(progressCallback)` is called from the
  button-click handler, as required by the Chrome Prompt API's
  user-activation rule, before the first `generateContent()` call.
- **The badge never lies:** every result shows an *On-device* or *Cloud*
  badge taken from `result.response.inferenceSource` — the SDK's own report
  of which path actually generated the answer.
- The cloud model is pinned via `inCloudParams`
  (`gemini-3.5-flash-lite`, the documented SDK v13 default), and the
  on-device model gets its system prompt via
  `onDeviceParams.createOptions.initialPrompts`.
- **App Check** is initialised alongside AI Logic (`src/firebase.js`):
  the debug provider on localhost, reCAPTCHA Enterprise when hosted.

Other Firebase products wired/planned: App Check (done), Hosting (deploy
step), Firestore (entry sync — planned next step, see `SETUP.md`; entries
currently persist in `localStorage` so the app works fully offline).

## Demo mode

Until a real Firebase project config is plugged into
`src/firebase-config.js`, the app runs in **demo mode**: it loads normally,
shows a banner explaining what's missing, and uses a tiny local text
tidy-up so the UI can be explored. Demo results are badged
"Demo (no AI)" — the app never pretends they came from a model.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the production build
```

For the on-device path you need Chrome 139+ on desktop with the Prompt API
flag enabled: `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`
→ **Enabled**, then restart Chrome. Without it, everything transparently
falls back to the cloud model — which is the point of hybrid inference.

## Project layout

```
index.html               Page shell (English UI)
src/main.js              UI wiring and rendering
src/ai.js                Hybrid routing: models, escalation rule, prompts
src/firebase.js          initializeApp + App Check + getAI()
src/firebase-config.js   ← Joe's Firebase project config goes here (TODO placeholders)
src/store.js             localStorage persistence for log entries
SETUP.md                 Step-by-step: from this scaffold to a live submission
LICENSE                  Apache-2.0
```

## What remains before submission

1. Plug Joe's Firebase project config into `src/firebase-config.js` and
   enable AI Logic + App Check in the Firebase console (checklist in
   `SETUP.md`).
2. Deploy to Firebase Hosting so judges get a live URL.
3. Record the ≤ 3-minute demo video (show the on-device badge and the
   cloud escalation) and publish it on YouTube.
4. Submit on Devpost before **1 Dec 2026, 05:00 WIB**.

## Licence

Apache-2.0 — see [LICENSE](LICENSE). Copyright 2026 Joe Stump.
