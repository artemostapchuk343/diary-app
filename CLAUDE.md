# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git workflow

After completing any meaningful unit of work — a feature, a fix, a refactor — commit and push to `main` immediately. Never let working changes sit uncommitted.

```bash
git add <specific files>
git commit -m "short description of what and why"
git push
```

Commit messages should be lowercase, imperative, and specific (e.g. `fix attachment delete not syncing to Drive`, `add calendar view to entry list`). Push after every commit so progress is never lost and Vercel deploys the latest state.

## Commands

```bash
npm run dev      # start dev server (localhost:5173)
npm run build    # production build
npm run lint     # ESLint
npm run preview  # preview production build locally
```

No test suite exists. Verify features by running `npm run dev` and testing in the browser.

## Environment

Google Drive sync requires `.env.local` with:
```
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_CLIENT_SECRET=...
```

Without these vars `isConfigured()` returns false and all Drive UI is hidden. The app works fully offline without them.

## Architecture

### Auth & lock flow

`useAuth.js` (Zustand) holds `unlocked` + `initializing`. On load, `App.jsx` renders a `<Guard>` that shows `LockScreen` until unlocked. Unlock state persists for the calendar day via `localStorage` (`diary_unlocked_date`). Password is verified with AES-GCM: `crypto.js` derives a key via PBKDF2 and stores a small `diary_verify` ciphertext in localStorage.

### Data layer

`db.js` — Dexie (IndexedDB) with three stores:
- `entries` — `++id, date, createdAt, updatedAt, sourceId` (sourceId indexed for cross-device dedup)
- `attachments` — `++id, entryId` (blob stored as base64 dataURL in `data` field)
- `settings` — key-value

Schema is versioned; when adding new indexes always add a `db.version(N+1)` block — do not modify earlier versions.

### Google Drive sync

`googleDrive.js` manages OAuth (PKCE flow, refresh token in localStorage), file I/O, and all sync logic. Key concepts:

- **Canonical ID**: `canonicalId(entry)` = `String(entry.sourceId || entry.id)` — stable across devices. Always use this when matching entries to Drive files.
- **Entry format on Drive**: Markdown with YAML front matter (`id`, `title`, `mood`, `createdAt`, `updatedAt`, `translations` as JSON). `entryToMarkdown` / `markdownToEntry` handle serialization.
- **Attachments on Drive**: stored as separate files with `appProperties: { isAttachment: 'true', entryId, attachmentName }`.
- **Tombstone**: `.diary-deleted` JSON file in the Drive folder tracks deleted canonical IDs. `uploadSingleEntry` checks this before uploading; `sync` applies remote deletions locally.
- **`sync()`**: bidirectional — uploads local-newer entries, downloads Drive-only entries, uploads local-only attachments, downloads Drive-only attachments.
- **`uploadSingleEntry(entry)`**: used for immediate save-time upload of a single entry + its attachments. Returns `{ status: 'previously_deleted' }` if the entry is tombstoned.

`useSync.js` (Zustand) wraps `sync()` with debounce (30s minimum interval), progress state, and an auto-trigger on `document.addEventListener('visibilitychange', ...)` at module level.

### Multi-language translations

Entries have a `translations` field: `{ uk: { title, body }, pl: { title, body } }`. The primary language (`title`/`body` at top level) is always preserved. `activeLang` state in `EntryEditor` (null = primary) controls which version is displayed and where Save writes.

### UI structure

- `src/pages/LockScreen.jsx` — password setup + unlock; optionally connects Drive to restore config
- `src/pages/EntryList.jsx` — list with search (covers primary + translations), three view modes (normal/compact/calendar) persisted to localStorage as `diary_view`; loads attachment existence in parallel for indicators
- `src/pages/EntryEditor.jsx` — read-only by default (`editing` state); Edit button enables mutations; Cancel restores from `entryData`
- `src/components/SyncPanel.jsx` — Drive connect/disconnect + manual sync trigger; rendered inside EntryList header
- `src/components/MoodPicker.jsx` — emoji picker popover
- `src/components/MediaLightbox.jsx` — full-screen image/video viewer; non-passive `wheel` listener for zoom (up to 8×); swipe for navigation

### Deployment

Deployed on Vercel at `https://diary-app-rho-ashen.vercel.app`. Push to `main` triggers automatic deployment. No CI configuration exists.
