// ─────────────────────────────────────────────────────────────────────────────
// Fieldnotes AI — Firebase initialisation
//
// Wires up, in order:
//   1. initializeApp() with Joe's project config (src/firebase-config.js)
//   2. Firebase App Check — REQUIRED by Firebase AI Logic. On localhost we
//      use the debug provider with a fixed debug token (see below) that is
//      registered in Firebase Console → App Check → Apps → Manage debug
//      tokens. On a hosted domain we use reCAPTCHA Enterprise.
//   3. Firebase AI Logic (the `firebase/ai` module) with the Gemini
//      Developer API backend.
//
// If the config is still placeholder, nothing here throws: the module
// exports `firebaseReady = false` and the app runs in demo mode.
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import { getAI, GoogleAIBackend } from "firebase/ai";
import {
  firebaseConfig,
  appCheckSiteKey,
  isFirebaseConfigured,
} from "./firebase-config.js";

export const firebaseReady = isFirebaseConfigured();

export let firebaseApp = null;
export let ai = null;
export let appCheckStatus = "not configured (demo mode)";

if (firebaseReady) {
  try {
    firebaseApp = initializeApp(firebaseConfig);

    // ── App Check ──────────────────────────────────────────────────────────
    // Debug provider for local development: setting this flag BEFORE
    // initializeAppCheck() makes the SDK generate/print a debug token.
    // Docs: https://firebase.google.com/docs/app-check/web/debug-provider
    const isLocalhost = ["localhost", "127.0.0.1"].includes(
      window.location.hostname,
    );
    if (isLocalhost) {
      // Fixed local debug token, registered in Firebase Console App Check
      // for this project; localhost only, never used in production (hosted
      // builds use reCAPTCHA Enterprise).
      // eslint-disable-next-line no-restricted-globals
      self.FIREBASE_APPCHECK_DEBUG_TOKEN =
        "8fa2aadb-bf48-43e9-bdd3-ae1f63b3f805";
    }

    if (isLocalhost || !appCheckSiteKey.startsWith("TODO_")) {
      initializeAppCheck(firebaseApp, {
        // With the debug-token flag set (localhost), the SDK exchanges the
        // debug token instead of running reCAPTCHA attestation.
        provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
      appCheckStatus = isLocalhost
        ? "debug provider (localhost) — register the console debug token in the Firebase console"
        : "reCAPTCHA Enterprise";
    } else {
      appCheckStatus =
        "skipped — add the reCAPTCHA Enterprise site key in src/firebase-config.js before hosting";
      console.warn("[Fieldnotes] App Check not initialised:", appCheckStatus);
    }

    // ── Firebase AI Logic ──────────────────────────────────────────────────
    // Gemini Developer API backend (free tier; recommended by the
    // hybrid-inference getting-started guide).
    ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
  } catch (err) {
    console.error("[Fieldnotes] Firebase initialisation failed:", err);
    appCheckStatus = `initialisation failed: ${err.message}`;
  }
}
