import React from 'react';
import { Note } from '../types';

interface NotesListProps {
  notes: Note[];
  selectedNoteId: number | null;
  onSelectNote: (id: number) => void;
  onCreateNote: () => void;
  onDeleteNote: (note: Note) => void;
  onSync: () => void;
  onLogout: () => void;
  username: string;
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
  searchText: string;
  onSearchChange: (text: string) => void;
  showFavoritesOnly: boolean;
  onToggleFavorites: () => void;
}

export function NotesList({
  notes,
  selectedNoteId,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onSync,
  onLogout,
  username,
  theme,
  onThemeChange,
  searchText,
  onSearchChange,
  showFavoritesOnly,
  onToggleFavorites,
}: NotesListProps) {
  const [isSyncing, setIsSyncing] = React.useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    await onSync();
    setTimeout(() => setIsSyncing(false), 500);
  };
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getPreview = (content: string) => {
    const lines = content.split('\n').filter(l => l.trim());
    return lines.slice(1, 3).join(' ').substring(0, 100);
  };

  return (
    <div className="w-80 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Notes</h2>
          <div className="flex items-center space-x-1">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              title="Sync with Server"
            >
              <svg 
                className={`w-5 h-5 text-gray-700 dark:text-gray-300 ${isSyncing ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={onCreateNote}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="New Note"
            >
              <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        <input
          type="text"
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search notes..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <div className="flex items-center justify-between mt-3">
          <button
            onClick={onToggleFavorites}
            className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill={showFavoritesOnly ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            {showFavoritesOnly ? 'All Notes' : 'Favorites'}
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">{notes.length} notes</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">No notes found</p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              onClick={() => onSelectNote(note.id)}
              className={`p-3 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group ${
                note.id === selectedNoteId ? 'bg-blue-50 dark:bg-gray-800 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center flex-1 min-w-0">
                  {note.favorite && (
                    <svg className="w-4 h-4 text-yellow-500 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  )}
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {note.title || 'Untitled'}
                  </h3>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNote(note);
                  }}
                  className="ml-2 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-2">
                {note.category && (
                  <span className="bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full mr-2 text-gray-700 dark:text-gray-300">
                    {note.category}
                  </span>
                )}
                <span>{formatDate(note.modified)}</span>
              </div>

              {getPreview(note.content) && (
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {getPreview(note.content)}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* User Info and Logout */}
      <div className="border-t border-gray-200 p-4 bg-white dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
              {username.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-200 truncate font-medium">{username}</span>
          </div>
          <button
            onClick={onLogout}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
            title="Logout"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
        
        {/* Theme Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">Theme</span>
          <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => onThemeChange('light')}
              className={`p-1.5 rounded transition-colors ${
                theme === 'light' 
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              title="Light mode"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
            <button
              onClick={() => onThemeChange('dark')}
              className={`p-1.5 rounded transition-colors ${
                theme === 'dark' 
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              title="Dark mode"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </button>
            <button
              onClick={() => onThemeChange('system')}
              className={`p-1.5 rounded transition-colors ${
                theme === 'system' 
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              title="System theme"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
