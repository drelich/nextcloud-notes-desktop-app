import { Note, APIConfig } from '../types';

export class NextcloudAPI {
  private baseURL: string;
  private authHeader: string;

  constructor(config: APIConfig) {
    const url = config.serverURL.replace(/\/$/, '');
    this.baseURL = `${url}/index.php/apps/notes/api/v1`;
    this.authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`);
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
}
