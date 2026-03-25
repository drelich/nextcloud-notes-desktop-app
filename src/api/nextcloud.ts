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

  async fetchAttachment(_noteId: number | string, path: string, noteCategory?: string): Promise<string> {
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
    console.log(`[Note ${_noteId}] Fetching attachment via WebDAV:`, url);
    
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

  async uploadAttachment(noteId: number | string, file: File, noteCategory?: string): Promise<string> {
    // Create .attachments.{noteId} directory path and upload file via WebDAV PUT
    // Returns the relative path to insert into markdown
    
    let webdavPath = `/remote.php/dav/files/${this.username}/Notes`;
    
    if (noteCategory) {
      webdavPath += `/${noteCategory}`;
    }
    
    const attachmentDir = `.attachments.${noteId}`;
    const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize filename
    const fullPath = `${webdavPath}/${attachmentDir}/${fileName}`;
    
    const url = `${this.serverURL}${fullPath}`;
    console.log('Uploading attachment via WebDAV:', url);
    
    // First, try to create the attachments directory (MKCOL)
    // This may fail if it already exists, which is fine
    try {
      await tauriFetch(`${this.serverURL}${webdavPath}/${attachmentDir}`, {
        method: 'MKCOL',
        headers: {
          'Authorization': this.authHeader,
        },
      });
    } catch (e) {
      // Directory might already exist, continue
    }
    
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Upload the file via PUT
    const response = await tauriFetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: arrayBuffer,
    });

    if (!response.ok && response.status !== 201 && response.status !== 204) {
      throw new Error(`Failed to upload attachment: ${response.status}`);
    }

    // Return the relative path for markdown
    return `${attachmentDir}/${fileName}`;
  }

  async fetchCategoryColors(): Promise<Record<string, number>> {
    const webdavPath = `/remote.php/dav/files/${this.username}/Notes/.category-colors.json`;
    const url = `${this.serverURL}${webdavPath}`;
    
    try {
      const response = await tauriFetch(url, {
        headers: {
          'Authorization': this.authHeader,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          // File doesn't exist yet, return empty object
          return {};
        }
        throw new Error(`Failed to fetch category colors: ${response.status}`);
      }

      const text = await response.text();
      return JSON.parse(text);
    } catch (error) {
      console.warn('Could not fetch category colors, using empty:', error);
      return {};
    }
  }

  async saveCategoryColors(colors: Record<string, number>): Promise<void> {
    const webdavPath = `/remote.php/dav/files/${this.username}/Notes/.category-colors.json`;
    const url = `${this.serverURL}${webdavPath}`;
    
    const content = JSON.stringify(colors, null, 2);
    
    const response = await tauriFetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
      body: content,
    });

    if (!response.ok && response.status !== 201 && response.status !== 204) {
      throw new Error(`Failed to save category colors: ${response.status}`);
    }
  }

  // WebDAV-based note operations
  private parseNoteFromContent(content: string, filename: string, category: string, etag: string, modified: number): Note {
    const lines = content.split('\n');
    const title = lines[0] || filename.replace('.txt', '');
    const noteContent = lines.slice(1).join('\n').trim();
    
    return {
      id: `${category}/${filename}`,
      filename,
      path: category ? `${category}/${filename}` : filename,
      etag,
      readonly: false,
      content: noteContent,
      title,
      category,
      favorite: false,
      modified,
    };
  }

  private formatNoteContent(note: Note): string {
    return `${note.title}\n${note.content}`;
  }

  async fetchNotesWebDAV(): Promise<Note[]> {
    const webdavPath = `/remote.php/dav/files/${this.username}/Notes`;
    const url = `${this.serverURL}${webdavPath}`;
    
    const response = await tauriFetch(url, {
      method: 'PROPFIND',
      headers: {
        'Authorization': this.authHeader,
        'Depth': 'infinity',
        'Content-Type': 'application/xml',
      },
      body: `<?xml version="1.0"?>
        <d:propfind xmlns:d="DAV:">
          <d:prop>
            <d:getlastmodified/>
            <d:getetag/>
            <d:getcontenttype/>
            <d:resourcetype/>
          </d:prop>
        </d:propfind>`,
    });

    if (!response.ok) {
      throw new Error(`Failed to list notes: ${response.status}`);
    }

    const xmlText = await response.text();
    const notes: Note[] = [];
    
    // Parse XML response
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const responses = xmlDoc.getElementsByTagNameNS('DAV:', 'response');
    
    for (let i = 0; i < responses.length; i++) {
      const responseNode = responses[i];
      const href = responseNode.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent || '';
      
      // Skip if not a .txt file
      if (!href.endsWith('.txt')) continue;
      
      // Skip hidden files
      const filename = href.split('/').pop() || '';
      if (filename.startsWith('.')) continue;
      
      const propstat = responseNode.getElementsByTagNameNS('DAV:', 'propstat')[0];
      const prop = propstat?.getElementsByTagNameNS('DAV:', 'prop')[0];
      
      const etag = prop?.getElementsByTagNameNS('DAV:', 'getetag')[0]?.textContent || '';
      const lastModified = prop?.getElementsByTagNameNS('DAV:', 'getlastmodified')[0]?.textContent || '';
      const modified = lastModified ? Math.floor(new Date(lastModified).getTime() / 1000) : 0;
      
      // Extract category from path
      const pathParts = href.split('/Notes/')[1]?.split('/');
      const category = pathParts && pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';
      
      // Fetch file content
      try {
        const fileUrl = `${this.serverURL}${href}`;
        const fileResponse = await tauriFetch(fileUrl, {
          headers: { 'Authorization': this.authHeader },
        });
        
        if (fileResponse.ok) {
          const content = await fileResponse.text();
          const note = this.parseNoteFromContent(content, filename, category, etag, modified);
          notes.push(note);
        }
      } catch (error) {
        console.error(`Failed to fetch note ${filename}:`, error);
      }
    }
    
    return notes;
  }

  async createNoteWebDAV(title: string, content: string, category: string): Promise<Note> {
    const filename = `${title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, ' ').trim()}.txt`;
    const categoryPath = category ? `/${category}` : '';
    const webdavPath = `/remote.php/dav/files/${this.username}/Notes${categoryPath}/${filename}`;
    const url = `${this.serverURL}${webdavPath}`;
    
    // Ensure category directory exists
    if (category) {
      try {
        const categoryUrl = `${this.serverURL}/remote.php/dav/files/${this.username}/Notes/${category}`;
        await tauriFetch(categoryUrl, {
          method: 'MKCOL',
          headers: { 'Authorization': this.authHeader },
        });
      } catch (e) {
        // Directory might already exist
      }
    }
    
    const noteContent = `${title}\n${content}`;
    
    const response = await tauriFetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'text/plain',
      },
      body: noteContent,
    });

    if (!response.ok && response.status !== 201 && response.status !== 204) {
      throw new Error(`Failed to create note: ${response.status}`);
    }

    const etag = response.headers.get('etag') || '';
    const modified = Math.floor(Date.now() / 1000);
    
    return {
      id: `${category}/${filename}`,
      filename,
      path: category ? `${category}/${filename}` : filename,
      etag,
      readonly: false,
      content,
      title,
      category,
      favorite: false,
      modified,
    };
  }

  async updateNoteWebDAV(note: Note): Promise<Note> {
    const categoryPath = note.category ? `/${note.category}` : '';
    const webdavPath = `/remote.php/dav/files/${this.username}/Notes${categoryPath}/${note.filename}`;
    const url = `${this.serverURL}${webdavPath}`;
    
    const noteContent = this.formatNoteContent(note);
    
    const response = await tauriFetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'text/plain',
        'If-Match': note.etag, // Prevent overwriting if file changed
      },
      body: noteContent,
    });

    if (!response.ok && response.status !== 204) {
      if (response.status === 412) {
        throw new Error('Note was modified by another client. Please refresh.');
      }
      throw new Error(`Failed to update note: ${response.status}`);
    }

    const etag = response.headers.get('etag') || note.etag;
    
    return {
      ...note,
      etag,
      modified: Math.floor(Date.now() / 1000),
    };
  }

  async deleteNoteWebDAV(note: Note): Promise<void> {
    const categoryPath = note.category ? `/${note.category}` : '';
    const webdavPath = `/remote.php/dav/files/${this.username}/Notes${categoryPath}/${note.filename}`;
    const url = `${this.serverURL}${webdavPath}`;
    
    const response = await tauriFetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': this.authHeader },
    });

    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to delete note: ${response.status}`);
    }
  }

  async moveNoteWebDAV(note: Note, newCategory: string): Promise<Note> {
    const oldCategoryPath = note.category ? `/${note.category}` : '';
    const newCategoryPath = newCategory ? `/${newCategory}` : '';
    const oldPath = `/remote.php/dav/files/${this.username}/Notes${oldCategoryPath}/${note.filename}`;
    const newPath = `/remote.php/dav/files/${this.username}/Notes${newCategoryPath}/${note.filename}`;
    
    // Ensure new category directory exists
    if (newCategory) {
      try {
        const categoryUrl = `${this.serverURL}/remote.php/dav/files/${this.username}/Notes/${newCategory}`;
        await tauriFetch(categoryUrl, {
          method: 'MKCOL',
          headers: { 'Authorization': this.authHeader },
        });
      } catch (e) {
        // Directory might already exist
      }
    }
    
    const response = await tauriFetch(`${this.serverURL}${oldPath}`, {
      method: 'MOVE',
      headers: {
        'Authorization': this.authHeader,
        'Destination': `${this.serverURL}${newPath}`,
      },
    });

    if (!response.ok && response.status !== 201 && response.status !== 204) {
      throw new Error(`Failed to move note: ${response.status}`);
    }

    return {
      ...note,
      category: newCategory,
      path: newCategory ? `${newCategory}/${note.filename}` : note.filename || '',
      id: `${newCategory}/${note.filename}`,
    };
  }
}
