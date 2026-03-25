export interface Note {
  id: number | string; // number for API, string (filename) for WebDAV
  etag: string;
  readonly: boolean;
  content: string;
  title: string;
  category: string;
  favorite: boolean;
  modified: number;
  filename?: string; // WebDAV: actual filename on server
  path?: string; // WebDAV: full path including category
}

export interface APIConfig {
  serverURL: string;
  username: string;
  password: string;
}

export interface AppSettings {
  serverURL: string;
  username: string;
  syncInterval: number;
  fontSize: number;
}
