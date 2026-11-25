# Fieldnotes AI — Go/No-Go Hybrid Test

**Date:** Tue 25 Nov 2026 (WIB)
**Verdict: ⛔ BLOCKED — the test could not be executed in this environment.**
The blocker is browser/network sandboxing on this VM, **not** an app error.
No app code was changed. The hybrid path (on-device + cloud) remains **unverified**
until the test is run in a browser that can both (a) load the app and (b) reach Firebase.

---

## What was verified working

- The app server is up and the dist build is correct: `curl http://127.0.0.1:8080/`
  from the VM shell returns HTTP 200 with the real app HTML
  (`<title>Fieldnotes AI — a gardener's hybrid-AI field log</title>`,
  bundle `/assets/index-Di0FM8Gy.js`). Server: `python3 -m http.server 8080`
  (PID 2181, started by the parent agent) — left running, untouched.
- The full UI flow was mapped from source (`index.html`, `src/main.js`, `src/ai.js`,
  `src/firebase.js`):
  - Pills: `#firebase-status`, `#device-status`; demo banner `#demo-banner`.
  - Input `#note-input`, button `#tidy-btn`. The click handler itself calls
    `warmUpDeviceModel()` (the required user gesture → `initializeDeviceModel()`)
    before `tidyNote()`.
  - Results render as `#entries li.entry` with a badge from
    `response.inferenceSource`: **On-device** / **Cloud** / **Demo (no AI)**.
  - Routing: ≤600 chars and ≤90 words → hybrid (`PREFER_ON_DEVICE`);
    longer → cloud (`PREFER_IN_CLOUD`, model `gemini-3.5-flash-lite`).
  - App Check: on localhost the app pins the fixed debug token in
    `self.FIREBASE_APPCHECK_DEBUG_TOKEN` before `initializeAppCheck()`
    (token value intentionally not reproduced here; see `src/firebase.js`).

## Environment inventory (what tooling exists here)

| Tool | Status |
|---|---|
| Python Playwright | ❌ not installed (`ModuleNotFoundError: playwright`) |
| `~/.cache/ms-playwright/` | ❌ does not exist on this VM |
| Node Puppeteer / puppeteer-core | ❌ not installed anywhere found |
| Chromium binary | ✅ `/opt/meta-chromium/chrome` — "Muse Browser 157.0.8103.81" (Hatch CVM build) |
| Sanctioned launcher | ✅ `/opt/hatch/bin/hatch-chromium-sandbox` (referenced by `PUPPETEER_EXECUTABLE_PATH`) |
| Node.js | ✅ v24.22.1 (global `WebSocket` available) |

## What was attempted, and the exact failures

A zero-install CDP driver was written (`/tmp/fieldnotes-test/run-test.mjs`,
probe: `/tmp/fieldnotes-test/probe.mjs`) and the browser was driven over
`--remote-debugging-pipe` (fd 3/4, `\0`-delimited JSON) through the sanctioned
launcher. CDP itself worked (targets, sessions, navigation, screenshots,
console/network capture). The browser, however, has **no usable network**:

1. **Raw binary refuses to start:**
   `Hatch WebGL domain policy is required for browser startup`
   → must go through `hatch-chromium-sandbox`.
2. **Launcher rejects TCP debugging:**
   `hatch-chromium-sandbox: --remote-debugging-port cannot reach this Chromium, which has no network; use --remote-debugging-pipe`
3. **Navigation probes from inside the sandboxed Chromium** (exact errors):
   - `http://127.0.0.1:8080/` → `net::ERR_CONNECTION_REFUSED`
     (the sandbox has its **own loopback**; the app server is not on it)
   - `http://198.19.0.2:8081/` (VM host0 address, test server on 0.0.0.0) → `net::ERR_INTERNET_DISCONNECTED`
   - `http://198.19.0.1:8081/` → `net::ERR_ACCESS_DENIED`
   - `https://example.com/` → `net::ERR_INTERNET_DISCONNECTED`
4. **With `--proxy-server=` pointing at the environment's egress proxy:**
   - `https://example.com/` → `net::ERR_NO_SUPPORTED_PROXIES`
     (the egress proxy requires authentication; Chromium cannot present
     proxy credentials supplied via the command line)
   - `http://127.0.0.1:8080/` → still `net::ERR_CONNECTION_REFUSED`
5. **Direct egress from the VM shell also fails** (`curl --noproxy '*'`
   to example.com and to firebaseappcheck.googleapis.com → `000`), so even a
   freshly installed stock Chrome in this namespace could not reach Firebase
   directly, and could not use the authenticated proxy either (same
   `ERR_NO_SUPPORTED_PROXIES` limitation).
6. Hatch's own audit runtime (`/opt/muse/assets/spaces/ts-runtime/dist/playwright-audit.js`)
   gives the sandboxed browser network via a `--hatch-sandbox-proxy` flag and a
   proxy auth token that is *"injected by the transport ledger"* — i.e. network
   access for this browser is plumbed by the Hatch browser service
   (`/opt/hatch/bin/browser-service`), which a shell/subagent cannot replicate.

**Consequence:** the readings in the first automated run (title `127.0.0.1`,
no pills found, "demo banner visible", `'LanguageModel' in window === false`)
were all taken from Chrome's `ERR_CONNECTION_REFUSED` error page, **not** from
the app — they are invalid as app measurements and are recorded here only to
prevent misreading them later. Screenshot evidence:
`test-shots/01-load-failed-err-connection-refused.png`.
Screenshots 02/03 were never captured because the app page never loaded.

## Test-by-test verdict

| Test | Verdict |
|---|---|
| Page load + status pills (Firebase / Gemini Nano) | ⛔ Not executed — app unreachable from the only local Chromium |
| Short note → badge + result | ⛔ Not executed |
| Long log → badge + result | ⛔ Not executed |
| Gemini Nano availability in this Chromium build | ❓ Unknown — could not be measured (error page reading is invalid) |
| Firebase / App Check errors | None observed — no Firebase request was ever made |

## What is needed to complete this test (for the parent agent)

The test needs a browser with (a) a network path to both the app URL and
Google/Firebase endpoints, and (b) the app served on a URL that browser can open.

- **Option A (preferred):** run the two note tests through the parent agent's
  live Hatch browser tooling (the browser service that already has network +
  proxy plumbing). Caveat from project history: the browser tool previously
  rejected `http://127.0.0.1:8080/` as `invalid_request`, and the sandboxed
  browser's loopback is not the VM's — so the app likely must first be exposed
  on a non-localhost URL (Option B) for that browser to load it.
- **Option B:** deploy `dist/` to Firebase Hosting (project
  `fieldnotes-ai-2794e`) → public HTTPS URL, then test there. Note: on a hosted
  (non-localhost) domain the app currently **skips App Check** unless a
  reCAPTCHA Enterprise site key is added in `src/firebase-config.js`, while the
  console shows "Firebase AI Logic Basic — Enforced", so AI calls would be
  rejected until App Check is wired for the hosted domain (site key + provider
  registration in the console). That is an app/config change for the parent to approve.
- **Option C:** approve a local harness build: install Chrome-for-Testing
  (~200 MB; /tmp is only 512 MB, so it must live under `~/.cache` or the
  workspace) **plus** a small local forward proxy that injects the egress
  proxy's `Proxy-Authorization` header, chained so the browser gets internet
  while still reaching `127.0.0.1:8080` directly. Workable in principle,
  unverified; needs parent approval before installing anything.
- Whichever browser is used, Gemini Nano presence must be read from the
  `#device-status` pill on the real app page; if it reports unavailable there,
  a Cloud badge on the short note is the designed fallback, not a failure.

## Cleanup note

A temporary test server on port 8081 (started for probing) was stopped.
The parent's app server on port 8080 was left running. No app files were modified;
the only files created are this report, `test-shots/01-load-failed-err-connection-refused.png`,
and the throwaway drivers under `/tmp/fieldnotes-test/`.

---

## Addendum — 25 Nov 2026: invented entry dates found in live test, fixed

During live testing of the hosted build on 25 Nov 2026, processed entries
came back stamped with invented dates (**2024-05-21** and **2024-05-20**)
instead of the actual date, even though the test notes mentioned no date.

**Root cause** (`src/ai.js`): the entry schema (`ENTRY_SCHEMA_HINT`) asked
the model to output a `"date"` field and instructed it to *"Use today's date
if the note gives none"* — but the model has no reliable notion of today, so
it supplied a plausible stale date, and `parseEntryJson` trusted
`parsed.date` over the correct client-side fallback date.

**Fix** (commit `7876595`): the model is never asked for a date again, and
any date it might still emit is ignored. Entry dates are now derived
client-side from the raw note text only: an explicit calendar date written
in the note (ISO, month-name, or unambiguous numeric form) is honoured;
anything else — including ambiguous numeric dates like 03/04/2026 — is
stamped with the actual current date. Verified with 10 parser test cases
(explicit dates honoured, ambiguous/invalid/relative dates fall back to
today) and a clean production build (`vite build`, 21 modules). Redeploy
is the parent agent's step.
