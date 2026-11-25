// ─────────────────────────────────────────────────────────────────────────────
// Fieldnotes AI — Firebase project configuration
//
// Real config connected 25 Nov 2026: project "fieldnotes-ai"
// (fieldnotes-ai-2794e), web app "fieldnotes-ai-web", values copied from
//   Firebase Console → Project settings → General → "Your apps" → Web app →
//   "Firebase SDK snippet" → Config.
//
// These values are NOT secret keys (Firebase web config is safe to commit).
// If any value ever starts with "TODO_" again, the app runs in DEMO MODE:
// it loads, explains what is missing, and uses a small local text tidy-up
// instead of calling Firebase AI Logic.
// ─────────────────────────────────────────────────────────────────────────────

export const firebaseConfig = {
  apiKey: "AIzaSyB5LeQFytlHHmFqnqh_lb8_bL3D4fhyGjE",
  authDomain: "fieldnotes-ai-2794e.firebaseapp.com",
  projectId: "fieldnotes-ai-2794e",
  storageBucket: "fieldnotes-ai-2794e.firebasestorage.app",
  messagingSenderId: "119608711417",
  appId: "1:119608711417:web:d4a623818cbabe7ec06a28",
};

// reCAPTCHA Enterprise site key for App Check (production).
// Registered 25 Nov 2026: Firebase Console → App Check → Apps →
// fieldnotes-ai-web → provider "Fraud Defense" (formerly reCAPTCHA
// Enterprise) — status Registered. This is the public site key, safe
// to commit.
// On localhost the app uses the App Check *debug provider* instead
// (see src/firebase.js), so this is only used once the app is hosted.
export const appCheckSiteKey = "6LdlGjEuAAAAAHye-Mu93qgJaQjPZnyPzB8w1JDP";

/** True only when Joe's real Firebase config has been plugged in. */
export function isFirebaseConfigured() {
  return Object.values(firebaseConfig).every(
    (v) => typeof v === "string" && v.length > 0 && !v.startsWith("TODO_"),
  );
}
