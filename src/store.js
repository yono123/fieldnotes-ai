// Fieldnotes AI — local persistence for log entries.
// Entries live in localStorage for this scaffold so the app works fully
// offline in the garden. Wiring Firestore sync is a documented next step
// (see SETUP.md) once Joe's Firebase project exists.

const KEY = "fieldnotes-ai.entries.v1";

export function loadEntries() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveEntry(entry, source, rawText) {
  const entries = loadEntries();
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    source, // "ON_DEVICE" | "IN_CLOUD" | "DEMO"
    rawText,
    ...entry,
  };
  entries.unshift(record);
  localStorage.setItem(KEY, JSON.stringify(entries));
  return record;
}

export function clearEntries() {
  localStorage.removeItem(KEY);
}
