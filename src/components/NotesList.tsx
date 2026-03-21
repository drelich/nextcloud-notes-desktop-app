import React from 'react';
import { Note } from '../types';
import { SyncStatus } from '../services/syncManager';

interface NotesListProps {
  notes: Note[];
  selectedNoteId: number | null;
  onSelectNote: (id: number) => void;
  onCreateNote: () => void;
  onDeleteNote: (note: Note) => void;
  onSync: () => void;
  searchText: string;
  onSearchChange: (text: string) => void;
  showFavoritesOnly: boolean;
  onToggleFavorites: () => void;
  hasUnsavedChanges: boolean;
  syncStatus: SyncStatus;
  pendingSyncCount: number;
  isOnline: boolean;
}

export function NotesList({
  notes,
  selectedNoteId,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onSync,
  searchText,
  onSearchChange,
  showFavoritesOnly,
  onToggleFavorites,
  hasUnsavedChanges,
  syncStatus: _syncStatus,
  pendingSyncCount,
  isOnline,
}: NotesListProps) {
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [deleteClickedId, setDeleteClickedId] = React.useState<number | null>(null);
  const [width, setWidth] = React.useState(() => {
    const saved = localStorage.getItem('notesListWidth');
    return saved ? parseInt(saved, 10) : 320;
  });
  const [isResizing, setIsResizing] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    await onSync();
    setTimeout(() => setIsSyncing(false), 500);
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX - (containerRef.current?.getBoundingClientRect().left || 0);
      if (newWidth >= 240 && newWidth <= 600) {
        setWidth(newWidth);
        localStorage.setItem('notesListWidth', newWidth.toString());
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleDeleteClick = (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Prevent deletion if there are unsaved changes on a different note
    if (hasUnsavedChanges && note.id !== selectedNoteId) {
      return;
    }
    
    if (deleteClickedId === note.id) {
      // Second click - actually delete
      onDeleteNote(note);
      setDeleteClickedId(null);
    } else {
      // First click - show confirmation state
      setDeleteClickedId(note.id);
      // Reset after 3 seconds
      setTimeout(() => setDeleteClickedId(null), 3000);
    }
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
    // grab first 100 characters of note's content, remove markdown syntax from the preview
    const previewContent = content.substring(0, 100);
    const cleanedPreview = previewContent.replace(/[#*`]/g, '');
    return cleanedPreview;
  };

  const getCategoryColor = (category: string) => {
    // Generate consistent pastel color based on category name
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
      hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Pastel color palette (light, subtle tones)
    const colors = [
      { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
      { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
      { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
      { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300' },
      { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' },
      { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300' },
      { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
      { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300' },
      { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
      { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300' },
    ];
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  return (
    <div 
      ref={containerRef}
      className="bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col relative flex-shrink-0"
      style={{ width: `${width}px`, minWidth: '240px', maxWidth: '600px' }}
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Notes</h2>
            {!isOnline && (
              <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded-full flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
                </svg>
                Offline
              </span>
            )}
            {pendingSyncCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
                {pendingSyncCount} pending
              </span>
            )}
          </div>
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
              onClick={() => {
                // Prevent switching if current note has unsaved changes
                if (hasUnsavedChanges && note.id !== selectedNoteId) {
                  return;
                }
                onSelectNote(note.id);
              }}
              className={`p-3 border-b border-gray-200 dark:border-gray-700 transition-colors group ${
                note.id === selectedNoteId 
                  ? 'bg-blue-50 dark:bg-gray-800 border-l-4 border-l-blue-500' 
                  : hasUnsavedChanges 
                    ? 'cursor-not-allowed opacity-50' 
                    : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={hasUnsavedChanges && note.id !== selectedNoteId ? 'Save current note before switching' : ''}
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
                <div className="flex items-center gap-2">
                  {deleteClickedId === note.id && (
                    <span className="text-xs text-red-600 dark:text-red-400 font-medium whitespace-nowrap">
                      Click again to delete
                    </span>
                  )}
                  <button
                    onClick={(e) => handleDeleteClick(note, e)}
                    className={`p-1 rounded transition-all opacity-0 group-hover:opacity-100 ${
                      deleteClickedId === note.id
                        ? 'bg-red-600 text-white opacity-100'
                        : 'hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400'
                    }`}
                    title={deleteClickedId === note.id ? "Click again to confirm deletion" : "Delete"}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                <span>{formatDate(note.modified)}</span>
                {note.category && (() => {
                  const colors = getCategoryColor(note.category);
                  return (
                    <span className={`px-2 py-0.5 ${colors.bg} ${colors.text} rounded-full text-xs font-medium`}>
                      {note.category}
                    </span>
                  );
                })()}
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
      
      {/* Resize Handle */}
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-blue-500 transition-colors group"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
      >
        <div className="absolute inset-y-0 -right-1 w-3" />
      </div>
    </div>
  );
}
