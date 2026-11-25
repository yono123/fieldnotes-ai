// Fieldnotes AI — UI wiring. All AI calls live in src/ai.js; this file only
// handles DOM, rendering, and status reporting.

import "./style.css";
import {
  tidyNote,
  weeklyReport,
  warmUpDeviceModel,
  routeFor,
  ESCALATION_CHAR_LIMIT,
  ESCALATION_WORD_LIMIT,
} from "./ai.js";
import { firebaseReady, appCheckStatus } from "./firebase.js";
import { loadEntries, saveEntry, clearEntries } from "./store.js";

const $ = (id) => document.getElementById(id);
const noteInput = $("note-input");
const tidyBtn = $("tidy-btn");
const entriesEl = $("entries");
const emptyState = $("empty-state");
const errorEl = $("error");
const progressEl = $("progress");

$("threshold-label").textContent = `${ESCALATION_CHAR_LIMIT} characters / ${ESCALATION_WORD_LIMIT} words`;

// ── Status pills ────────────────────────────────────────────────────────────
const firebaseStatus = $("firebase-status");
if (firebaseReady) {
  firebaseStatus.textContent = "Firebase: connected";
  firebaseStatus.className = "pill pill-cloud";
} else {
  firebaseStatus.textContent = "Firebase: demo mode";
  firebaseStatus.className = "pill pill-demo";
  $("demo-banner").hidden = false;
}
console.info("[Fieldnotes] App Check:", appCheckStatus);

async function checkDeviceModel() {
  const pill = $("device-status");
  if (!("LanguageModel" in window)) {
    pill.textContent = "On-device model: not supported in this browser";
    pill.className = "pill pill-neutral";
    return;
  }
  try {
    const availability = await window.LanguageModel.availability();
    const labels = {
      available: ["On-device model: Gemini Nano ready", "pill pill-device"],
      downloadable: [
        "On-device model: downloadable (starts on first use)",
        "pill pill-neutral",
      ],
      downloading: ["On-device model: downloading…", "pill pill-neutral"],
      unavailable: [
        "On-device model: unavailable — cloud fallback",
        "pill pill-neutral",
      ],
    };
    const [text, cls] = labels[availability] || [
      `On-device model: ${availability}`,
      "pill pill-neutral",
    ];
    pill.textContent = text;
    pill.className = cls;
  } catch {
    pill.textContent = "On-device model: status unknown";
    pill.className = "pill pill-neutral";
  }
}
checkDeviceModel();

// ── Input helpers ───────────────────────────────────────────────────────────
function updateRoutePreview() {
  const text = noteInput.value;
  $("char-count").textContent = `${text.length} characters`;
  if (!text.trim()) {
    $("route-preview").textContent = "";
    return;
  }
  $("route-preview").textContent =
    routeFor(text) === "cloud"
      ? "Long log → will escalate to the cloud model"
      : "Short note → on-device first (cloud fallback)";
}
noteInput.addEventListener("input", updateRoutePreview);

$("sample-btn").addEventListener("click", () => {
  noteInput.value =
    "pruned snow bush by the gate this morning, yellow flowers near the fence look dry — water tomorrow, red hanjuang leaves curling maybe too much sun, saw a small snake near the compost again be careful";
  updateRoutePreview();
  noteInput.focus();
});

// ── Rendering ───────────────────────────────────────────────────────────────
const SOURCE_BADGES = {
  ON_DEVICE: { label: "On-device", cls: "badge badge-device" },
  IN_CLOUD: { label: "Cloud", cls: "badge badge-cloud" },
  DEMO: { label: "Demo (no AI)", cls: "badge badge-demo" },
};

function badgeFor(source) {
  return SOURCE_BADGES[source] || SOURCE_BADGES.IN_CLOUD;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function chipList(title, items) {
  if (!items || !items.length) return "";
  const chips = items.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
  return `<div class="chip-group"><span class="chip-title">${title}</span><ul class="chips">${chips}</ul></div>`;
}

function renderEntries() {
  const entries = loadEntries();
  emptyState.hidden = entries.length > 0;
  entriesEl.innerHTML = entries
    .map((e) => {
      const badge = badgeFor(e.source);
      return `<li class="entry">
        <div class="entry-head">
          <span class="entry-date">${escapeHtml(e.date || "")}</span>
          <span class="${badge.cls}">${badge.label}</span>
        </div>
        <p class="entry-summary">${escapeHtml(e.summary || "")}</p>
        ${chipList("Plants", e.plants)}
        ${chipList("Tasks", e.tasks)}
        ${chipList("Issues", e.issues)}
        <details class="raw"><summary>Original note</summary><p>${escapeHtml(e.rawText || "")}</p></details>
      </li>`;
    })
    .join("");
}
renderEntries();

// ── Actions ─────────────────────────────────────────────────────────────────
function setBusy(busy) {
  tidyBtn.disabled = busy;
  tidyBtn.textContent = busy ? "Tidying…" : "Tidy up with hybrid AI";
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = !message;
}

tidyBtn.addEventListener("click", async () => {
  const text = noteInput.value.trim();
  showError("");
  if (!text) {
    showError("Write or paste a field note first.");
    return;
  }
  setBusy(true);
  progressEl.textContent = "";
  try {
    // initializeDeviceModel() must run on a user gesture, before the
    // first generateContent() call — this click handler is that gesture.
    await warmUpDeviceModel((pct) => {
      progressEl.textContent = `Downloading the on-device model… ${pct}%`;
    });
    progressEl.textContent = "";
    const { entry, source } = await tidyNote(text);
    saveEntry(entry, source, text);
    renderEntries();
    noteInput.value = "";
    updateRoutePreview();
  } catch (err) {
    console.error(err);
    showError(
      `Something went wrong while tidying that note (${err.message}). Your note text is still in the box — nothing was lost.`,
    );
  } finally {
    setBusy(false);
  }
});

$("report-btn").addEventListener("click", async () => {
  showError("");
  const entries = loadEntries();
  if (!entries.length) {
    showError("Add at least one log entry before asking for a weekly report.");
    return;
  }
  const btn = $("report-btn");
  btn.disabled = true;
  btn.textContent = "Writing report…";
  try {
    const { text, source } = await weeklyReport(entries);
    const out = $("report-output");
    const badge = badgeFor(source);
    out.innerHTML = `<div class="entry-head"><strong>Weekly report</strong><span class="${badge.cls}">${badge.label}</span></div><p>${escapeHtml(text).replaceAll("\n", "<br>")}</p>`;
    out.hidden = false;
  } catch (err) {
    console.error(err);
    showError(`Weekly report failed (${err.message}).`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Weekly report (cloud)";
  }
});

$("clear-btn").addEventListener("click", () => {
  clearEntries();
  renderEntries();
  $("report-output").hidden = true;
});
