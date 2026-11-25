# Date Bug Diagnosis — "2023-10-24" entry after the 7876595 fix

**Date of diagnosis:** 2026-11-25 (~05:10 UTC)
**Question:** The date fix (commit `7876595`) was built and redeployed, yet a live
regression test created a brand-new entry (today, 25 Nov 2026) that displayed
**2023-10-24**. Before the fix, entries showed 2024-05-20 / 2024-05-21.
**Scope:** diagnosis only — no code was changed.

---

## 1. Every code path that sets an entry's date

Exhaustive read of `src/ai.js`, `src/main.js`, `src/store.js`, `index.html`.
There are exactly **two** functions that ever produce an entry `date`, and
neither reads model output:

| Path | Where | How the date is set |
|---|---|---|
| Short-note tidy (hybrid) **and** long-log escalation (cloud) | `src/ai.js` → `tidyNote()` → `parseEntryJson(result.response.text(), text)` | Both routes share the single parser. `parseEntryJson` computes the date itself (see §2) and ignores any date in the model JSON. |
| Demo mode (Firebase not configured) | `src/ai.js` → `demoTidy()` | `date: todayIso()` |
| Weekly report | `src/ai.js` → `weeklyReport()` | Sets **no** dates — it only reads `e.date` of existing entries into the prompt. |
| Seed data | — | **Does not exist.** No seed/sample entries anywhere in `src/` or `index.html`; the sample button only fills the input box. Entries are created exclusively via `saveEntry()`. |
| Persistence | `src/store.js` → `saveEntry()` | Adds `id` (from `Date.now()`) and `createdAt` (from `new Date()`), then spreads `...entry` — it never computes or overrides `entry.date`. |
| Rendering | `src/main.js` → `renderEntries()` | Displays `e.date` verbatim; no date logic. |

**No path derives a date from server, model, or session data.** The only
inputs to an entry's date are (a) a date literally written in the user's own
note text, and (b) the browser's own clock.

## 2. Short-note path traced (the regression test used a short note)

`tidyNote()` (route `hybrid`, `PREFER_ON_DEVICE` with cloud fallback) calls:

```js
const entry = parseEntryJson(result.response.text(), text);
```

and `parseEntryJson` (current `src/ai.js`) begins:

```js
function parseEntryJson(raw, rawText) {
  // Never trust a date from the model; see "Entry dating" above.
  const date = extractExplicitDate(rawText) || todayIso();
```

`parsed.date` is never read — the returned object uses the locally computed
`date` in both the success and the catch branch.

The regression note was *"Trimmed the hedge along the front fence and watered
the young frangipani."* — it contains no digits and no month names, so
`extractExplicitDate()` returns `null`, and the entry date is exactly
`todayIso()`:

```js
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
```

**Consequence:** if the fixed code executed, the displayed date is, by
construction, the test browser's own `new Date()` (UTC) on the day of the
test. For it to display 2023-10-24, the browser's clock must read
2023-10-24 — OR the fixed code was not what executed (see §5).

For contrast, the pre-fix code (`git show e1ba44a:src/ai.js`) asked the model
for the date and trusted it — the original bug:

```
'{"date": "YYYY-MM-DD", "summary": ...}',
"Use today's date if the note gives none. ..."
...
date: parsed.date || fallbackDate,
```

That mechanism fully explains the pre-fix 2024-05-20 / 2024-05-21 stamps: two
entries created minutes apart in one session carried two *different* dates,
which no single clock can produce — the model invented them.

## 3. Does dist/ contain the fix? — YES, verified three ways

- **Markers in `dist/assets/index-C7JQJnAJ.js`** (82,864 bytes, built
  2026-11-25 05:07 UTC):
  - `Do NOT output a date` — present (new `ENTRY_SCHEMA_HINT`).
  - `january` / `february` / `november` — present (the fix's `MONTH_INDEX`
    string keys survive minification).
  - `extractExplicitDate` — 0 matches, **expected**: minification renames
    local functions (it appears as `sa` in the bundle; see §4).
  - Old-code markers `Use today` and `YYYY-MM-DD` — **absent**.
- **`dist/index.html`** references `assets/index-C7JQJnAJ.js`, the only JS
  bundle in `dist/assets/`.
- **Rebuild diff:** `npx vite build --outDir /tmp/fn-rebuild` produced a
  byte-identical JS bundle (same content hash `index-C7JQJnAJ`) and an
  identical `index.html`. `dist/` provably matches current `src/`.

## 4. Is the HOSTED site serving the fixed bundle? — YES (verified by fetch)

The live bundle at
`https://fieldnotes-ai-2794e.web.app/assets/index-C7JQJnAJ.js`
(crawled 2026-11-25 05:09 UTC) was fetched and inspected as text:

- Schema hint ends *"…issues": ["problem, pest, damage or follow-up"]}* and
  continues **"Do NOT output a date — the app stamps each entry with the
  correct date itself…"** — no `date` field is requested; `YYYY-MM-DD`
  appears nowhere in the hosted bundle.
- Minified fixed logic is present verbatim in structure:
  `function ia(){return new Date().toISOString().slice(0,10)}` (todayIso),
  the full month map `aa={january:0,february:1,…,december:11,…}`, the
  explicit-date extractor `sa(e)`, and the parser
  `function ca(e,t){let n=sa(t)||ia(); … return{date:n, summary:r.summary||…}}`
  — the date `n` is computed from the raw note text or the local clock
  *before* parsing, and the model's JSON contributes only
  summary/plants/tasks/issues.
- `demoTidy` minified as `da(e){…return{date:ia(),…}}` and `saveEntry` as
  `ha(...){…createdAt:new Date().toISOString(),…}` — same-clock stamps.

## 5. Git state — clean

- `git merge-base --is-ancestor 7876595 HEAD` → **YES**.
- `git diff 7876595 HEAD -- src/` → empty (the only later commit, `82bf686`,
  adds the go/no-go report; no source changes after the fix).
- Working tree matches HEAD for `src/` (only untracked `test-shots/`).

## 6. Ranked root-cause candidates

### #1 — MOST LIKELY: the test browser's clock is set to 2023-10-24

The fixed code — proven to be what is built (§3), committed (§5), and served
by Hosting at 05:09 UTC (§4) — can only stamp a dateless note with the
browser's own `new Date()`. The regression note contains no date tokens, so
`extractExplicitDate()` → `null` and the stamp **is** the browser clock
(§2). The test environment is the sandboxed Hatch Chromium, already known in
this project to be non-standard (its own loopback, no direct egress) — a
skewed/frozen VM clock fits that picture. Nothing in the app reads any other
clock: no server timestamp, no model field, no session data (§1, §4).

*Evidence against:* the browser's clock was not directly measured — this
needs one live-browser check (below). The harness timestamps for the test
(12:08–12:09 WIB) are measured outside the browser and say nothing about the
clock inside it.

### #2 — Possible: deploy-propagation race — the old bundle executed once more

Timeline is tight: `dist/` built 05:07 UTC, redeploy immediately after,
regression test ran 05:08–05:09 UTC. If the tester loaded the page in the
narrow window before the new Hosting version reached the serving edge, the
old code would have run and the cloud model would have invented a date
exactly as before — 2023-10-24 is the same failure signature as
2024-05-20/21.

*Evidence against:* the tester hard-reloaded (Ctrl+Shift+R);
`firebase.json` serves `/index.html` with `Cache-Control: no-cache`, so a
reload revalidates the HTML and pulls the new hashed bundle; and by
05:09 UTC the fixed bundle was already being served (§4). This candidate
requires the page load to have landed inside a seconds-wide race window.

### #3 — RULED OUT: a second code path still trusts a model-supplied date

Exhaustive source read (§1) plus inspection of the deployed bundle (§4):
one shared parser for both routes, demo path uses `todayIso()`, weekly
report sets no dates, no seed data exists, `store.js` never touches
`entry.date`. There is no second parser, fallback branch, or
structured-summary handler that reads a date from model output.

### #4 — RULED OUT (as the source of the new stamp): stale localStorage entry

Entries persist in the same browser profile across deploys, which is why the
old 2024-05-20/21 entries were still listed below the new one. But the tester
verified the top entry's "Original note" was the newly typed frangipani note,
so the 2023-10-24 stamp was written at creation time in that session, not
inherited.

### #5 — RULED OUT: UTC conversion in `toISOString()`

`todayIso()` uses UTC, which can shift the result by at most one day versus
local time — it cannot produce a date three years in the past.

## 7. Decisive follow-up (needs the live browser — parent/browser agent)

One check separates candidate #1 from #2, using data already stored by the
app: in the same browser profile, read the frangipani entry's record in
`localStorage["fieldnotes-ai.entries.v1"]`. `store.js` stamps every record
with `createdAt: new Date().toISOString()` and an `id` beginning with
`Date.now()` — both from the same browser clock as `todayIso()`.

- If `createdAt` ≈ **2023-10-24T…** → the browser clock is skewed; the fix
  works and the app is blameless. (Equivalently: evaluate
  `new Date().toISOString()` in the page console.)
- If `createdAt` ≈ **2026-11-25T05:08Z** while `date` is 2023-10-24 → the
  fixed code cannot have produced that record; it was the old bundle
  (candidate #2, a one-off race that cannot recur now that the fixed
  version is confirmed live).
