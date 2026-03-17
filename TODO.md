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

---

## Medium Priority

### Other Improvements
- Add keyboard shortcuts (Cmd+S for save, Cmd+N for new note, etc.)
- Implement note search within content (not just titles)
- Add tags/labels system as alternative to categories
- Export multiple notes at once
- Import notes from other formats (Markdown files, etc.)
- Offline mode with queue for syncing when connection returns

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
