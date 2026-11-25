// ─────────────────────────────────────────────────────────────────────────────
// Fieldnotes AI — Firebase project configuration
//
// TODO(Joe): Replace every "TODO_…" placeholder below with the real values
// from your Firebase project:
//   Firebase Console → Project settings → General → "Your apps" → Web app →
//   "Firebase SDK snippet" → Config.
//
// These values are NOT secret keys (Firebase web config is safe to commit),
// but the repo ships with placeholders so no real project data is baked in
// before Joe's project exists. While any value still starts with "TODO_",
// the app runs in DEMO MODE: it loads, explains what is missing, and uses a
// small local text tidy-up instead of calling Firebase AI Logic.
// ─────────────────────────────────────────────────────────────────────────────

export const firebaseConfig = {
  apiKey: "TODO_API_KEY",
  authDomain: "TODO_PROJECT_ID.firebaseapp.com",
  projectId: "TODO_PROJECT_ID",
  storageBucket: "TODO_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "TODO_MESSAGING_SENDER_ID",
  appId: "TODO_APP_ID",
};

// reCAPTCHA Enterprise site key for App Check (production).
// Firebase Console → App Check → register the web app with
// reCAPTCHA Enterprise, then paste the site key here.
// On localhost the app uses the App Check *debug provider* instead
// (see src/firebase.js), so this is only needed once the app is hosted.
export const appCheckSiteKey = "TODO_RECAPTCHA_ENTERPRISE_SITE_KEY";

/** True only when Joe's real Firebase config has been plugged in. */
export function isFirebaseConfigured() {
  return Object.values(firebaseConfig).every(
    (v) => typeof v === "string" && v.length > 0 && !v.startsWith("TODO_"),
  );
}
