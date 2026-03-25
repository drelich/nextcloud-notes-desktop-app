import { Note } from '../types';
import { NextcloudAPI } from '../api/nextcloud';
import { localDB } from '../db/localDB';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export class SyncManager {
  private api: NextcloudAPI | null = null;
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private statusCallback: ((status: SyncStatus, pendingCount: number) => void) | null = null;
  private syncCompleteCallback: (() => void) | null = null;

  constructor() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyStatus('idle', 0);
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyStatus('offline', 0);
    });
  }

  setAPI(api: NextcloudAPI | null) {
    this.api = api;
  }

  setStatusCallback(callback: (status: SyncStatus, pendingCount: number) => void) {
    this.statusCallback = callback;
  }

  setSyncCompleteCallback(callback: () => void) {
    this.syncCompleteCallback = callback;
  }

  private notifyStatus(status: SyncStatus, pendingCount: number) {
    if (this.statusCallback) {
      this.statusCallback(status, pendingCount);
    }
  }

  // Load notes: cache-first, then sync in background
  async loadNotes(): Promise<Note[]> {
    // Try to load from cache first (instant)
    const cachedNotes = await localDB.getAllNotes();
    
    // If we have cached notes and we're offline, return them
    if (!this.isOnline) {
      this.notifyStatus('offline', 0);
      return cachedNotes;
    }

    // If we have cached notes, return them immediately
    // Then sync in background
    if (cachedNotes.length > 0) {
      this.syncInBackground();
      return cachedNotes;
    }

    // No cache - must fetch from server
    if (!this.api) {
      throw new Error('API not initialized');
    }

    try {
      this.notifyStatus('syncing', 0);
      const notes = await this.fetchAndCacheNotes();
      this.notifyStatus('idle', 0);
      return notes;
    } catch (error) {
      this.notifyStatus('error', 0);
      throw error;
    }
  }

  // Background sync: compare etags and only fetch changed content
  private async syncInBackground(): Promise<void> {
    if (!this.api || this.syncInProgress) return;

    this.syncInProgress = true;
    try {
      this.notifyStatus('syncing', 0);
      
      // Get metadata for all notes (fast - no content)
      const serverNotes = await this.api.fetchNotesWebDAV();
      const cachedNotes = await localDB.getAllNotes();
      
      // Build maps for comparison
      const serverMap = new Map(serverNotes.map(n => [n.id, n]));
      const cachedMap = new Map(cachedNotes.map(n => [n.id, n]));
      
      // Find notes that need content fetched (new or changed etag)
      const notesToFetch: Note[] = [];
      for (const serverNote of serverNotes) {
        const cached = cachedMap.get(serverNote.id);
        if (!cached || cached.etag !== serverNote.etag) {
          notesToFetch.push(serverNote);
        }
      }
      
      // Fetch content for changed notes
      for (const note of notesToFetch) {
        try {
          const fullNote = await this.api.fetchNoteContentWebDAV(note);
          await localDB.saveNote(fullNote);
        } catch (error) {
          console.error(`Failed to fetch note ${note.id}:`, error);
        }
      }
      
      // Remove deleted notes from cache
      for (const cachedNote of cachedNotes) {
        if (!serverMap.has(cachedNote.id)) {
          await localDB.deleteNote(cachedNote.id);
        }
      }
      
      this.notifyStatus('idle', 0);
      
      // Notify that sync is complete so UI can reload
      if (this.syncCompleteCallback) {
        this.syncCompleteCallback();
      }
    } catch (error) {
      console.error('Background sync failed:', error);
      this.notifyStatus('error', 0);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Fetch all notes and cache them
  private async fetchAndCacheNotes(): Promise<Note[]> {
    if (!this.api) throw new Error('API not initialized');
    
    const serverNotes = await this.api.fetchNotesWebDAV();
    const notesWithContent: Note[] = [];
    
    for (const note of serverNotes) {
      try {
        const fullNote = await this.api.fetchNoteContentWebDAV(note);
        notesWithContent.push(fullNote);
        await localDB.saveNote(fullNote);
      } catch (error) {
        console.error(`Failed to fetch note ${note.id}:`, error);
      }
    }
    
    return notesWithContent;
  }

  // Fetch content for a specific note on-demand
  async fetchNoteContent(note: Note): Promise<Note> {
    if (!this.api) {
      throw new Error('API not initialized');
    }

    if (!this.isOnline) {
      throw new Error('Cannot fetch note content while offline');
    }

    try {
      const fullNote = await this.api.fetchNoteContentWebDAV(note);
      await localDB.saveNote(fullNote);
      return fullNote;
    } catch (error) {
      throw error;
    }
  }

  // Create note on server and cache
  async createNote(title: string, content: string, category: string): Promise<Note> {
    if (!this.api) {
      throw new Error('API not initialized');
    }

    if (!this.isOnline) {
      this.notifyStatus('offline', 0);
      throw new Error('Cannot create note while offline');
    }

    try {
      this.notifyStatus('syncing', 0);
      const note = await this.api.createNoteWebDAV(title, content, category);
      await localDB.saveNote(note);
      this.notifyStatus('idle', 0);
      
      // Trigger background sync to fetch any other changes
      this.syncInBackground().catch(err => console.error('Background sync failed:', err));
      
      return note;
    } catch (error) {
      this.notifyStatus('error', 0);
      throw error;
    }
  }

  // Update note on server and cache
  async updateNote(note: Note): Promise<Note> {
    if (!this.api) {
      throw new Error('API not initialized');
    }

    if (!this.isOnline) {
      this.notifyStatus('offline', 0);
      throw new Error('Cannot update note while offline');
    }

    try {
      this.notifyStatus('syncing', 0);
      const updatedNote = await this.api.updateNoteWebDAV(note);
      await localDB.saveNote(updatedNote);
      this.notifyStatus('idle', 0);
      
      // Trigger background sync to fetch any other changes
      this.syncInBackground().catch(err => console.error('Background sync failed:', err));
      
      return updatedNote;
    } catch (error) {
      this.notifyStatus('error', 0);
      throw error;
    }
  }

  // Delete note from server and cache
  async deleteNote(note: Note): Promise<void> {
    if (!this.api) {
      throw new Error('API not initialized');
    }

    if (!this.isOnline) {
      this.notifyStatus('offline', 0);
      throw new Error('Cannot delete note while offline');
    }

    try {
      this.notifyStatus('syncing', 0);
      await this.api.deleteNoteWebDAV(note);
      await localDB.deleteNote(note.id);
      this.notifyStatus('idle', 0);
    } catch (error) {
      this.notifyStatus('error', 0);
      throw error;
    }
  }

  // Move note to different category on server and cache
  async moveNote(note: Note, newCategory: string): Promise<Note> {
    if (!this.api) {
      throw new Error('API not initialized');
    }

    if (!this.isOnline) {
      this.notifyStatus('offline', 0);
      throw new Error('Cannot move note while offline');
    }

    try {
      this.notifyStatus('syncing', 0);
      const movedNote = await this.api.moveNoteWebDAV(note, newCategory);
      await localDB.deleteNote(note.id);
      await localDB.saveNote(movedNote);
      this.notifyStatus('idle', 0);
      
      // Trigger background sync to fetch any other changes
      this.syncInBackground().catch(err => console.error('Background sync failed:', err));
      
      return movedNote;
    } catch (error) {
      this.notifyStatus('error', 0);
      throw error;
    }
  }

  // Manual sync with server
  async syncWithServer(): Promise<void> {
    if (!this.api || !this.isOnline || this.syncInProgress) return;
    await this.syncInBackground();
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }
}

export const syncManager = new SyncManager();
