import { Note } from '../types';

const DB_NAME = 'nextcloud-notes-db';
const DB_VERSION = 1;
const NOTES_STORE = 'notes';
const SYNC_QUEUE_STORE = 'syncQueue';

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  noteId: number | string;
  note?: Note;
  timestamp: number;
  retryCount: number;
}

class LocalDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(NOTES_STORE)) {
          const notesStore = db.createObjectStore(NOTES_STORE, { keyPath: 'id' });
          notesStore.createIndex('modified', 'modified', { unique: false });
          notesStore.createIndex('category', 'category', { unique: false });
        }

        if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
          db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' });
        }
      };
    });
  }

  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // Notes operations
  async getAllNotes(): Promise<Note[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(NOTES_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getNote(id: number | string): Promise<Note | undefined> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(NOTES_STORE);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveNote(note: Note): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(NOTES_STORE, 'readwrite');
      const request = store.put(note);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveNotes(notes: Note[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(NOTES_STORE, 'readwrite');
      const transaction = store.transaction;
      
      notes.forEach(note => store.put(note));
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async deleteNote(id: number | string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(NOTES_STORE, 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearNotes(): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(NOTES_STORE, 'readwrite');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Sync queue operations
  async addToSyncQueue(operation: SyncOperation): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(SYNC_QUEUE_STORE, 'readwrite');
      const request = store.put(operation);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSyncQueue(): Promise<SyncOperation[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(SYNC_QUEUE_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removeFromSyncQueue(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(SYNC_QUEUE_STORE, 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearSyncQueue(): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(SYNC_QUEUE_STORE, 'readwrite');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const localDB = new LocalDB();
