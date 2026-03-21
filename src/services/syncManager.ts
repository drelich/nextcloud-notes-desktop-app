import { Note } from '../types';
import { NextcloudAPI } from '../api/nextcloud';
import { localDB, SyncOperation } from '../db/localDB';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export class SyncManager {
  private api: NextcloudAPI | null = null;
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private statusCallback: ((status: SyncStatus, pendingCount: number) => void) | null = null;

  constructor() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyStatus('idle', 0);
      this.processSyncQueue();
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

  private notifyStatus(status: SyncStatus, pendingCount: number) {
    if (this.statusCallback) {
      this.statusCallback(status, pendingCount);
    }
  }

  private async getPendingCount(): Promise<number> {
    const queue = await localDB.getSyncQueue();
    return queue.length;
  }

  // Load notes from local DB first, then sync with server
  async loadNotes(): Promise<Note[]> {
    const localNotes = await localDB.getAllNotes();
    
    if (this.isOnline && this.api) {
      try {
        await this.syncWithServer();
        return await localDB.getAllNotes();
      } catch (error) {
        console.error('Failed to sync with server, using local data:', error);
        return localNotes;
      }
    }
    
    return localNotes;
  }

  // Sync with server: fetch remote notes and merge with local
  async syncWithServer(): Promise<void> {
    if (!this.api || !this.isOnline || this.syncInProgress) return;

    this.syncInProgress = true;
    this.notifyStatus('syncing', await this.getPendingCount());

    try {
      // First, process any pending operations
      await this.processSyncQueue();

      // Then fetch latest from server
      const serverNotes = await this.api.fetchNotes();
      const localNotes = await localDB.getAllNotes();

      // Merge strategy: server wins for conflicts (last-write-wins based on modified timestamp)
      const mergedNotes = this.mergeNotes(localNotes, serverNotes);
      
      // Save merged notes to local DB
      await localDB.clearNotes();
      await localDB.saveNotes(mergedNotes);

      this.notifyStatus('idle', 0);
    } catch (error) {
      console.error('Sync failed:', error);
      this.notifyStatus('error', await this.getPendingCount());
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  private mergeNotes(localNotes: Note[], serverNotes: Note[]): Note[] {
    const serverMap = new Map(serverNotes.map(n => [n.id, n]));
    const merged: Note[] = [];

    // Add all server notes (they are the source of truth)
    serverNotes.forEach(serverNote => {
      merged.push(serverNote);
    });

    // Add local-only notes (not yet synced, likely have temporary IDs)
    localNotes.forEach(localNote => {
      if (!serverMap.has(localNote.id)) {
        merged.push(localNote);
      }
    });

    return merged;
  }

  // Create note (offline-first)
  async createNote(title: string, content: string, category: string): Promise<Note> {
    // Create temporary note with negative ID for offline mode
    const tempNote: Note = {
      id: -Date.now(), // Temporary negative ID
      etag: '',
      readonly: false,
      content,
      title,
      category,
      favorite: false,
      modified: Math.floor(Date.now() / 1000),
    };

    // Save to local DB immediately
    await localDB.saveNote(tempNote);

    // Queue for sync
    const operation: SyncOperation = {
      id: `create-${tempNote.id}-${Date.now()}`,
      type: 'create',
      noteId: tempNote.id,
      note: tempNote,
      timestamp: Date.now(),
      retryCount: 0,
    };
    await localDB.addToSyncQueue(operation);

    // Try to sync immediately if online
    if (this.isOnline && this.api) {
      this.processSyncQueue().catch(console.error);
    } else {
      this.notifyStatus('offline', await this.getPendingCount());
    }

    return tempNote;
  }

  // Update note (offline-first)
  async updateNote(note: Note): Promise<Note> {
    // Update local DB immediately
    await localDB.saveNote(note);

    // Queue for sync
    const operation: SyncOperation = {
      id: `update-${note.id}-${Date.now()}`,
      type: 'update',
      noteId: note.id,
      note,
      timestamp: Date.now(),
      retryCount: 0,
    };
    await localDB.addToSyncQueue(operation);

    // Try to sync immediately if online
    if (this.isOnline && this.api) {
      this.processSyncQueue().catch(console.error);
    } else {
      this.notifyStatus('offline', await this.getPendingCount());
    }

    return note;
  }

  // Delete note (offline-first)
  async deleteNote(id: number): Promise<void> {
    // Delete from local DB immediately
    await localDB.deleteNote(id);

    // Queue for sync (only if it's a real server ID, not temporary)
    if (id > 0) {
      const operation: SyncOperation = {
        id: `delete-${id}-${Date.now()}`,
        type: 'delete',
        noteId: id,
        timestamp: Date.now(),
        retryCount: 0,
      };
      await localDB.addToSyncQueue(operation);

      // Try to sync immediately if online
      if (this.isOnline && this.api) {
        this.processSyncQueue().catch(console.error);
      } else {
        this.notifyStatus('offline', await this.getPendingCount());
      }
    }
  }

  // Process sync queue
  async processSyncQueue(): Promise<void> {
    if (!this.api || !this.isOnline || this.syncInProgress) return;

    const queue = await localDB.getSyncQueue();
    if (queue.length === 0) return;

    this.syncInProgress = true;
    this.notifyStatus('syncing', queue.length);

    for (const operation of queue) {
      try {
        await this.processOperation(operation);
        await localDB.removeFromSyncQueue(operation.id);
      } catch (error) {
        console.error(`Failed to process operation ${operation.id}:`, error);
        
        // Increment retry count
        operation.retryCount++;
        if (operation.retryCount > 5) {
          console.error(`Operation ${operation.id} failed after 5 retries, removing from queue`);
          await localDB.removeFromSyncQueue(operation.id);
        } else {
          await localDB.addToSyncQueue(operation);
        }
      }
    }

    this.syncInProgress = false;
    const remainingCount = await this.getPendingCount();
    this.notifyStatus(remainingCount > 0 ? 'error' : 'idle', remainingCount);
  }

  private async processOperation(operation: SyncOperation): Promise<void> {
    if (!this.api) throw new Error('API not initialized');

    switch (operation.type) {
      case 'create':
        if (operation.note) {
          const serverNote = await this.api.createNote(
            operation.note.title,
            operation.note.content,
            operation.note.category
          );
          
          // Replace temporary note with server note
          await localDB.deleteNote(operation.note.id);
          await localDB.saveNote(serverNote);
        }
        break;

      case 'update':
        if (operation.note && operation.note.id > 0) {
          const serverNote = await this.api.updateNote(operation.note);
          await localDB.saveNote(serverNote);
        }
        break;

      case 'delete':
        if (typeof operation.noteId === 'number' && operation.noteId > 0) {
          await this.api.deleteNote(operation.noteId);
        }
        break;
    }
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }
}

export const syncManager = new SyncManager();
