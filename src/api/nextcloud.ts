import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { Note, APIConfig } from '../types';

export class NextcloudAPI {
  private baseURL: string;
  private serverURL: string;
  private authHeader: string;
  private username: string;

  constructor(config: APIConfig) {
    const url = config.serverURL.replace(/\/$/, '');
    this.serverURL = url;
    this.baseURL = `${url}/index.php/apps/notes/api/v1`;
    this.authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`);
    this.username = config.username;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseURL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': this.authHeader,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
    }

    return response.json();
  }

  async fetchNotes(): Promise<Note[]> {
    return this.request<Note[]>('/notes');
  }

  async createNote(title: string, content: string, category: string): Promise<Note> {
    return this.request<Note>('/notes', {
      method: 'POST',
      body: JSON.stringify({ title, content, category, favorite: false }),
    });
  }

  async updateNote(note: Note): Promise<Note> {
    return this.request<Note>(`/notes/${note.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: note.title,
        content: note.content,
        category: note.category,
        favorite: note.favorite,
      }),
    });
  }

  async deleteNote(id: number): Promise<void> {
    await this.request<void>(`/notes/${id}`, { method: 'DELETE' });
  }

  async fetchAttachment(_noteId: number, path: string, noteCategory?: string): Promise<string> {
    // Build WebDAV path: /remote.php/dav/files/{username}/Notes/{category}/.attachments.{noteId}/{filename}
    // The path from markdown is like: .attachments.38479/Screenshot.png
    // We need to construct the full WebDAV URL
    
    let webdavPath = `/remote.php/dav/files/${this.username}/Notes`;
    
    // Add category subfolder if present
    if (noteCategory) {
      webdavPath += `/${noteCategory}`;
    }
    
    // Add the attachment path (already includes .attachments.{id}/filename)
    webdavPath += `/${path}`;
    
    const url = `${this.serverURL}${webdavPath}`;
    console.log('Fetching attachment via WebDAV:', url);
    
    const response = await tauriFetch(url, {
      headers: {
        'Authorization': this.authHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch attachment: ${response.status}`);
    }

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  getServerURL(): string {
    return this.serverURL;
  }
}
