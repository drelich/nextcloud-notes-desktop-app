# TODO - Future Improvements

## High Priority

### Unsaved Note Switching
**Current Behavior:** When a note has unsaved changes, switching to another note is completely blocked. User must either save or discard changes first.

**Proposed Improvement:** Implement local session storage for unsaved changes:
- Store unsaved note content in browser's sessionStorage/localStorage
- Allow switching between notes without losing unsaved changes
- Each note maintains its own unsaved state independently
- Unsaved changes persist across note switches but don't trigger server sync
- Visual indicator shows which notes have unsaved local changes
- Only sync with server when user explicitly saves

**Benefits:**
- More flexible editing workflow
- Can work on multiple notes simultaneously
- No data loss when switching notes
- Better matches user expectations from modern editors

**Technical Approach:**
- Use Map/Object to store unsaved changes per note ID
- Key: note ID, Value: { title, content, timestamp }
- Load from local storage on note switch
- Clear local storage on explicit save or discard
- Add visual indicator (dot/asterisk) on notes with local changes

### PDF Export Styling
**Current Issue:** With custom Google Fonts in place, PDF export produces broken layout and styling. The jsPDF html() method doesn't properly handle web fonts and complex CSS.

**Needs Investigation:**
- jsPDF may not support external web fonts properly
- May need to embed fonts or use fallback system fonts for PDF
- Consider alternative approaches: html2canvas, puppeteer, or server-side PDF generation
- Ensure proper markdown rendering with headings, lists, code blocks, etc.
- Maintain consistent styling between preview and PDF output
- Consider bundling Google Fonts locally for offline support and better PDF rendering

### Offline Mode
**Current Issue:** App fails when internet connection is unavailable. No local caching, no change queuing, no sync on reconnect.

**Required Features:**
- Local-first storage of all notes (IndexedDB or localStorage)
- Work offline seamlessly - create, edit, delete notes
- Queue changes when offline for later sync
- Detect connection restore and push queued changes
- Conflict resolution when note changed both locally and on server
- Visual indicator showing online/offline status
- Show which notes have pending sync

**Technical Approach:**
- Cache all notes locally on successful fetch
- Intercept all API calls - if offline, work with local cache
- Maintain a sync queue: { noteId, action, timestamp, data }
- Use navigator.onLine and 'online'/'offline' events for detection
- On reconnect: process queue in order, handle conflicts
- Conflict strategy: last-write-wins or prompt user

**Synergy with Other Features:**
- Pairs well with "Unsaved Note Switching" (both need local storage)
- Bundled fonts ensure app works fully offline

---

## Medium Priority

### Other Improvements
- Add keyboard shortcuts (Cmd+S for save, Cmd+N for new note, etc.)
- Implement note search within content (not just titles)
- Add tags/labels system as alternative to categories
- Export multiple notes at once
- Import notes from other formats (Markdown files, etc.)

---

## Low Priority

### Nice to Have
- Note templates
- Rich text paste handling
- Image upload/embedding support
- Note linking (wiki-style)
- Version history/undo for saved notes
- Customizable editor themes
- Font size adjustment
