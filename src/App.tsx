import { useState, useEffect } from 'react';
import { LoginView } from './components/LoginView';
import { NotesList } from './components/NotesList';
import { NoteEditor } from './components/NoteEditor';
import { CategoriesSidebar } from './components/CategoriesSidebar';
import { NextcloudAPI } from './api/nextcloud';
import { Note } from './types';
import { syncManager, SyncStatus } from './services/syncManager';
import { localDB } from './db/localDB';
import { useOnlineStatus } from './hooks/useOnlineStatus';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [api, setApi] = useState<NextcloudAPI | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [manualCategories, setManualCategories] = useState<string[]>([]);
  const [isCategoriesCollapsed, setIsCategoriesCollapsed] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [username, setUsername] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editorFont, setEditorFont] = useState('Source Code Pro');
  const [editorFontSize, setEditorFontSize] = useState(14);
  const [previewFont, setPreviewFont] = useState('Merriweather');
  const [previewFontSize, setPreviewFontSize] = useState(16);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    const initApp = async () => {
      await localDB.init();
      
      const savedServer = localStorage.getItem('serverURL');
      const savedUsername = localStorage.getItem('username');
      const savedPassword = localStorage.getItem('password');
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
      const savedEditorFont = localStorage.getItem('editorFont');
      const savedPreviewFont = localStorage.getItem('previewFont');

      if (savedTheme) {
        setTheme(savedTheme);
      }
      if (savedEditorFont) {
        setEditorFont(savedEditorFont);
      }
      if (savedPreviewFont) {
        setPreviewFont(savedPreviewFont);
      }
      const savedEditorFontSize = localStorage.getItem('editorFontSize');
      const savedPreviewFontSize = localStorage.getItem('previewFontSize');
      if (savedEditorFontSize) {
        setEditorFontSize(parseInt(savedEditorFontSize, 10));
      }
      if (savedPreviewFontSize) {
        setPreviewFontSize(parseInt(savedPreviewFontSize, 10));
      }

      if (savedServer && savedUsername && savedPassword) {
        const apiInstance = new NextcloudAPI({
          serverURL: savedServer,
          username: savedUsername,
          password: savedPassword,
        });
        setApi(apiInstance);
        syncManager.setAPI(apiInstance);
        setUsername(savedUsername);
        setIsLoggedIn(true);
        
        // Load notes from local DB immediately
        const localNotes = await localDB.getAllNotes();
        if (localNotes.length > 0) {
          setNotes(localNotes.sort((a, b) => b.modified - a.modified));
          setSelectedNoteId(localNotes[0].id);
        }
      }
    };
    
    initApp();
  }, []);

  useEffect(() => {
    const updateEffectiveTheme = () => {
      if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setEffectiveTheme(isDark ? 'dark' : 'light');
      } else {
        setEffectiveTheme(theme);
      }
    };

    updateEffectiveTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => updateEffectiveTheme();
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', effectiveTheme === 'dark');
  }, [effectiveTheme]);

  useEffect(() => {
    syncManager.setStatusCallback((status, count) => {
      setSyncStatus(status);
      setPendingSyncCount(count);
    });
  }, []);

  useEffect(() => {
    if (api && isLoggedIn) {
      loadNotes();
      const interval = setInterval(() => syncNotes(), 300000);
      return () => clearInterval(interval);
    }
  }, [api, isLoggedIn]);

  const loadNotes = async () => {
    try {
      const loadedNotes = await syncManager.loadNotes();
      setNotes(loadedNotes.sort((a, b) => b.modified - a.modified));
      if (!selectedNoteId && loadedNotes.length > 0) {
        setSelectedNoteId(loadedNotes[0].id);
      }
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  };

  const syncNotes = async () => {
    try {
      await syncManager.syncWithServer();
      await loadNotes();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const handleLogin = async (serverURL: string, username: string, password: string) => {
    localStorage.setItem('serverURL', serverURL);
    localStorage.setItem('username', username);
    localStorage.setItem('password', password);

    const apiInstance = new NextcloudAPI({ serverURL, username, password });
    setApi(apiInstance);
    syncManager.setAPI(apiInstance);
    setUsername(username);
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    localStorage.removeItem('serverURL');
    localStorage.removeItem('username');
    localStorage.removeItem('password');
    await localDB.clearNotes();
    await localDB.clearSyncQueue();
    setApi(null);
    syncManager.setAPI(null);
    setUsername('');
    setNotes([]);
    setSelectedNoteId(null);
    setIsLoggedIn(false);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const handleEditorFontChange = (font: string) => {
    setEditorFont(font);
    localStorage.setItem('editorFont', font);
  };

  const handlePreviewFontChange = (font: string) => {
    setPreviewFont(font);
    localStorage.setItem('previewFont', font);
  };

  const handleEditorFontSizeChange = (size: number) => {
    setEditorFontSize(size);
    localStorage.setItem('editorFontSize', size.toString());
  };

  const handlePreviewFontSizeChange = (size: number) => {
    setPreviewFontSize(size);
    localStorage.setItem('previewFontSize', size.toString());
  };

  const handleCreateNote = async () => {
    try {
      const timestamp = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).replace(/[/:]/g, '-').replace(', ', ' ');
      
      const note = await syncManager.createNote(`New Note ${timestamp}`, '', selectedCategory);
      setNotes([note, ...notes]);
      setSelectedNoteId(note.id);
    } catch (error) {
      console.error('Create note failed:', error);
    }
  };

  const handleCreateCategory = (name: string) => {
    if (!manualCategories.includes(name)) {
      setManualCategories([...manualCategories, name]);
    }
  };

  const handleUpdateNote = async (updatedNote: Note) => {
    try {
      await syncManager.updateNote(updatedNote);
      setNotes(notes.map(n => n.id === updatedNote.id ? updatedNote : n));
    } catch (error) {
      console.error('Update note failed:', error);
    }
  };

  const handleDeleteNote = async (note: Note) => {
    try {
      await syncManager.deleteNote(note.id);
      const remainingNotes = notes.filter(n => n.id !== note.id);
      setNotes(remainingNotes);
      if (selectedNoteId === note.id) {
        setSelectedNoteId(remainingNotes[0]?.id || null);
      }
    } catch (error) {
      console.error('Delete note failed:', error);
    }
  };

  const categoriesFromNotes = Array.from(new Set(notes.map(n => n.category).filter(c => c)));
  const categories = Array.from(new Set([...categoriesFromNotes, ...manualCategories])).sort();

  const filteredNotes = notes.filter(note => {
    if (selectedCategory && note.category !== selectedCategory) return false;
    if (showFavoritesOnly && !note.favorite) return false;
    if (searchText) {
      const search = searchText.toLowerCase();
      return note.title.toLowerCase().includes(search) ||
             note.content.toLowerCase().includes(search);
    }
    return true;
  });

  const selectedNote = notes.find(n => n.id === selectedNoteId) || null;

  if (!isLoggedIn) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen">
      {!isFocusMode && (
        <>
          <CategoriesSidebar
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onCreateCategory={handleCreateCategory}
            isCollapsed={isCategoriesCollapsed}
            onToggleCollapse={() => setIsCategoriesCollapsed(!isCategoriesCollapsed)}
            username={username}
            onLogout={handleLogout}
            theme={theme}
            onThemeChange={handleThemeChange}
            editorFont={editorFont}
            onEditorFontChange={handleEditorFontChange}
            editorFontSize={editorFontSize}
            onEditorFontSizeChange={handleEditorFontSizeChange}
            previewFont={previewFont}
            onPreviewFontChange={handlePreviewFontChange}
            previewFontSize={previewFontSize}
            onPreviewFontSizeChange={handlePreviewFontSizeChange}
          />
          <NotesList
            notes={filteredNotes}
            selectedNoteId={selectedNoteId}
            onSelectNote={setSelectedNoteId}
            onCreateNote={handleCreateNote}
            onDeleteNote={handleDeleteNote}
            onSync={syncNotes}
            searchText={searchText}
            onSearchChange={setSearchText}
            showFavoritesOnly={showFavoritesOnly}
            onToggleFavorites={() => setShowFavoritesOnly(!showFavoritesOnly)}
            hasUnsavedChanges={hasUnsavedChanges}
            syncStatus={syncStatus}
            pendingSyncCount={pendingSyncCount}
            isOnline={isOnline}
          />
        </>
      )}
      <NoteEditor
        note={selectedNote}
        onUpdateNote={handleUpdateNote}
        onUnsavedChanges={setHasUnsavedChanges}
        categories={categories}
        isFocusMode={isFocusMode}
        onToggleFocusMode={() => setIsFocusMode(!isFocusMode)}
        editorFont={editorFont}
        editorFontSize={editorFontSize}
        previewFont={previewFont}
        previewFontSize={previewFontSize}
        api={api}
      />
    </div>
  );
}

export default App;
