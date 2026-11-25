// ─────────────────────────────────────────────────────────────────────────────
// Fieldnotes AI — hybrid inference routing (the heart of this entry)
//
// Built on the Firebase AI Logic hybrid-inference API for Web
// (docs: https://firebase.google.com/docs/ai-logic/hybrid/web/get-started):
//
//   • getAI(app, { backend: new GoogleAIBackend() })            (src/firebase.js)
//   • getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE,
//                              inCloudParams: { model, generationConfig },
//                              onDeviceParams: { createOptions } })
//   • model.initializeDeviceModel(progressCb) — must be called on/after a
//     user interaction (button click) and before generateContent().
//   • result.response.inferenceSource → "ON_DEVICE" | "IN_CLOUD" tells us
//     which path ACTUALLY served the request, so the UI badge is truthful.
//
// Routing policy (real, app-level, on top of the SDK's own fallback):
//   • SHORT notes  → hybrid model with PREFER_ON_DEVICE: Gemini Nano in
//     Chrome tidies the note locally when available; the SDK silently
//     falls back to the cloud model when it isn't.
//   • LONG logs    → escalated straight to a cloud model
//     (PREFER_IN_CLOUD) for a fuller structured summary — long text is
//     where the bigger cloud model earns its keep.
//   • Weekly report → always cloud (it reasons over many entries at once).
// ─────────────────────────────────────────────────────────────────────────────

import { getGenerativeModel, InferenceMode } from "firebase/ai";
import { ai, firebaseReady } from "./firebase.js";

/** Notes longer than this are escalated to the cloud model. */
export const ESCALATION_CHAR_LIMIT = 600;
/** …or longer than this many words, whichever comes first. */
export const ESCALATION_WORD_LIMIT = 90;

/** Cloud model used for escalations and as the hybrid fallback. */
const CLOUD_MODEL = "gemini-3.5-flash-lite"; // documented SDK v13 default

const SYSTEM_INSTRUCTION = [
  "You are Fieldnotes AI, an assistant for gardeners and field workers.",
  "You turn rough, quickly-typed field notes into a clean end-of-day log.",
  "Always answer in English. Be concise and factual; never invent plants,",
  "tasks, or problems that are not in the note.",
].join(" ");

let hybridModel = null;
let cloudModel = null;
let deviceModelInitialised = false;

function getHybridModel() {
  if (!hybridModel) {
    hybridModel = getGenerativeModel(ai, {
      // On-device first (Gemini Nano via Chrome's Prompt API),
      // cloud fallback handled by the SDK.
      mode: InferenceMode.PREFER_ON_DEVICE,
      inCloudParams: {
        model: CLOUD_MODEL,
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
      },
      onDeviceParams: {
        createOptions: {
          expectedInputs: [{ type: "text", languages: ["en"] }],
          expectedOutputs: [{ type: "text", languages: ["en"] }],
          initialPrompts: [
            {
              role: "system",
              content: [{ type: "text", value: SYSTEM_INSTRUCTION }],
            },
          ],
        },
      },
    });
  }
  return hybridModel;
}

function getCloudModel() {
  if (!cloudModel) {
    cloudModel = getGenerativeModel(ai, {
      mode: InferenceMode.PREFER_IN_CLOUD,
      inCloudParams: {
        model: CLOUD_MODEL,
        generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
      },
      onDeviceParams: {
        createOptions: {
          expectedInputs: [{ type: "text", languages: ["en"] }],
          expectedOutputs: [{ type: "text", languages: ["en"] }],
          initialPrompts: [
            {
              role: "system",
              content: [{ type: "text", value: SYSTEM_INSTRUCTION }],
            },
          ],
        },
      },
    });
  }
  return cloudModel;
}

/**
 * Must be called from a user-gesture handler (button click) before the
 * first hybrid request, per the Chrome Prompt API user-activation rule.
 * Reports model-download progress via the optional callback.
 */
export async function warmUpDeviceModel(onProgress) {
  if (!firebaseReady || deviceModelInitialised) return;
  try {
    await getHybridModel().initializeDeviceModel((fraction) => {
      if (onProgress) onProgress(Math.round(fraction * 100));
    });
    deviceModelInitialised = true;
  } catch (err) {
    // Not fatal: PREFER_ON_DEVICE falls back to the cloud model.
    console.warn("[Fieldnotes] On-device model warm-up failed:", err);
  }
}

/** Decide the route for a piece of text. Exported for transparency/tests. */
export function routeFor(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (text.length > ESCALATION_CHAR_LIMIT || words > ESCALATION_WORD_LIMIT) {
    return "cloud";
  }
  return "hybrid";
}

const ENTRY_SCHEMA_HINT = [
  "Respond with ONLY a JSON object (no markdown fences) of this shape:",
  '{"summary": "one or two clean sentences",',
  ' "plants": ["plant or area mentioned"], "tasks": ["task done or to do"],',
  ' "issues": ["problem, pest, damage or follow-up"]}',
  "Do NOT output a date — the app stamps each entry with the correct date",
  "itself, and a model-supplied date would be a guess. Use empty arrays",
  "when a category is absent.",
].join("\n");

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// ── Entry dating ────────────────────────────────────────────────────────────
// The model must never supply an entry's date: it has no reliable notion of
// "today" and will happily invent a plausible one (live testing on
// 2026-11-25 produced entries dated 2024-05-20/21). So the date is derived
// here, client-side, from exactly two trustworthy sources:
//   1. an explicit calendar date written in the user's own note text that
//      this parser can verify character-for-character, or
//   2. the actual current date.
// Anything ambiguous (e.g. 03/04/2026 — day-first or month-first?) falls
// back to today.

const MONTH_INDEX = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sept: 8, sep: 8,
  oct: 9, nov: 10, dec: 11,
};
const MONTH_ALT = Object.keys(MONTH_INDEX)
  .sort((a, b) => b.length - a.length)
  .join("|");

function toIsoDate(year, monthIndex, day) {
  const d = new Date(Date.UTC(year, monthIndex, day));
  // Reject overflow dates like 31 February, which Date would roll over.
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== monthIndex ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d.toISOString().slice(0, 10);
}

/** ISO date explicitly written in the note text, or null if none is verifiable. */
function extractExplicitDate(text) {
  let m = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/); // 2026-11-25
  if (m) return toIsoDate(+m[1], +m[2] - 1, +m[3]);

  m = text.match(
    new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_ALT})\\.?\\s+(\\d{4})\\b`, "i"),
  ); // 25 November 2026
  if (m) return toIsoDate(+m[3], MONTH_INDEX[m[2].toLowerCase()], +m[1]);

  m = text.match(
    new RegExp(`\\b(${MONTH_ALT})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, "i"),
  ); // November 25, 2026
  if (m) return toIsoDate(+m[3], MONTH_INDEX[m[1].toLowerCase()], +m[2]);

  m = text.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/); // 25/11/2026 or 11/25/2026
  if (m) {
    const first = +m[1];
    const second = +m[2];
    if (first > 12 && second <= 12) return toIsoDate(+m[3], second - 1, first);
    if (second > 12 && first <= 12) return toIsoDate(+m[3], first - 1, second);
    return null; // ambiguous ordering — caller falls back to today
  }
  return null;
}

function parseEntryJson(raw, rawText) {
  // Never trust a date from the model; see "Entry dating" above.
  const date = extractExplicitDate(rawText) || todayIso();
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no JSON object in response");
    const parsed = JSON.parse(match[0]);
    return {
      date,
      summary: parsed.summary || raw.trim(),
      plants: Array.isArray(parsed.plants) ? parsed.plants : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    };
  } catch {
    // Model didn't follow the schema — keep its text as the summary.
    return {
      date,
      summary: raw.trim(),
      plants: [],
      tasks: [],
      issues: [],
    };
  }
}

/**
 * Tidy one note. Returns { entry, source } where source is:
 *   "ON_DEVICE" | "IN_CLOUD"  — reported by the SDK (response.inferenceSource)
 *   "DEMO"                    — Firebase not configured; local fallback used
 */
export async function tidyNote(rawText) {
  const text = rawText.trim();
  if (!firebaseReady) {
    return { entry: demoTidy(text), source: "DEMO" };
  }

  const route = routeFor(text);
  const model = route === "cloud" ? getCloudModel() : getHybridModel();
  const prompt =
    route === "cloud"
      ? `This is a long field log. Summarise it into a structured log entry.\n${ENTRY_SCHEMA_HINT}\n\nField log:\n${text}`
      : `Tidy this short field note into a structured log entry.\n${ENTRY_SCHEMA_HINT}\n\nField note:\n${text}`;

  const result = await model.generateContent(prompt);
  const entry = parseEntryJson(result.response.text(), text);
  // inferenceSource is the SDK's own report of the path that served us.
  return { entry, source: result.response.inferenceSource || "IN_CLOUD" };
}

/** Weekly report over saved entries — always a cloud job. */
export async function weeklyReport(entries) {
  if (!firebaseReady) {
    return { text: demoWeeklyReport(entries), source: "DEMO" };
  }
  const digest = entries
    .map(
      (e) =>
        `- ${e.date}: ${e.summary} | plants: ${e.plants.join(", ") || "—"} | tasks: ${e.tasks.join(", ") || "—"} | issues: ${e.issues.join(", ") || "—"}`,
    )
    .join("\n");
  const prompt = [
    "Write a short weekly field report for a gardener from these daily log",
    "entries. Group by: work completed, plant care, and open issues to",
    "follow up next week. Plain text, short paragraphs, no JSON.",
    "",
    digest,
  ].join("\n");
  const result = await getCloudModel().generateContent(prompt);
  return {
    text: result.response.text().trim(),
    source: result.response.inferenceSource || "IN_CLOUD",
  };
}

// ── Demo-mode fallbacks (no Firebase configured) ────────────────────────────
// Deliberately simple, deterministic, and clearly labelled "Demo" in the UI:
// they exist so the app can be explored before Joe's Firebase project is
// plugged in. They are NOT AI and the UI never pretends otherwise.

function demoTidy(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  return {
    date: todayIso(),
    summary: clean.charAt(0).toUpperCase() + clean.slice(1),
    plants: [],
    tasks: [],
    issues: [],
  };
}

function demoWeeklyReport(entries) {
  if (!entries.length) return "No entries yet — add some field notes first.";
  const lines = entries.map((e) => `- ${e.date}: ${e.summary}`);
  return `Weekly field report (demo)\n\n${lines.join("\n")}`;
}
