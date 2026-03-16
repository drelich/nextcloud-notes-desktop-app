export interface Note {
  id: number;
  etag: string;
  readonly: boolean;
  content: string;
  title: string;
  category: string;
  favorite: boolean;
  modified: number;
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
