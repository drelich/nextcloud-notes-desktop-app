import { useState, useEffect } from 'react';
import { LoginView } from './components/LoginView';
import { NotesList } from './components/NotesList';
import { NoteEditor } from './components/NoteEditor';
import { CategoriesSidebar } from './components/CategoriesSidebar';
import { NextcloudAPI } from './api/nextcloud';
import { Note } from './types';

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
  const [fontSize] = useState(14);
  const [username, setUsername] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    const savedServer = localStorage.getItem('serverURL');
    const savedUsername = localStorage.getItem('username');
    const savedPassword = localStorage.getItem('password');
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;

    if (savedTheme) {
      setTheme(savedTheme);
    }

    if (savedServer && savedUsername && savedPassword) {
      const apiInstance = new NextcloudAPI({
        serverURL: savedServer,
        username: savedUsername,
        password: savedPassword,
      });
      setApi(apiInstance);
      setUsername(savedUsername);
      setIsLoggedIn(true);
    }
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
    if (api && isLoggedIn) {
      syncNotes();
      const interval = setInterval(syncNotes, 300000);
      return () => clearInterval(interval);
    }
  }, [api, isLoggedIn]);

  const syncNotes = async () => {
    if (!api) return;
    try {
      const fetched = await api.fetchNotes();
      setNotes(fetched.sort((a, b) => b.modified - a.modified));
      if (!selectedNoteId && fetched.length > 0) {
        setSelectedNoteId(fetched[0].id);
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const handleLogin = (serverURL: string, username: string, password: string) => {
    localStorage.setItem('serverURL', serverURL);
    localStorage.setItem('username', username);
    localStorage.setItem('password', password);

    const apiInstance = new NextcloudAPI({ serverURL, username, password });
    setApi(apiInstance);
    setUsername(username);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('serverURL');
    localStorage.removeItem('username');
    localStorage.removeItem('password');
    setApi(null);
    setUsername('');
    setNotes([]);
    setSelectedNoteId(null);
    setIsLoggedIn(false);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const handleCreateNote = async () => {
    if (!api) return;
    try {
      const timestamp = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).replace(/[/:]/g, '-').replace(', ', ' ');
      
      const note = await api.createNote(`New Note ${timestamp}`, '', selectedCategory);
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
    if (!api) return;
    try {
      console.log('Sending to API - content length:', updatedNote.content.length);
      console.log('Sending to API - last 50 chars:', updatedNote.content.slice(-50));
      const result = await api.updateNote(updatedNote);
      console.log('Received from API - content length:', result.content.length);
      console.log('Received from API - last 50 chars:', result.content.slice(-50));
      // Update notes array with server response now that we have manual save
      setNotes(notes.map(n => n.id === result.id ? result : n));
    } catch (error) {
      console.error('Update note failed:', error);
    }
  };

  const handleDeleteNote = async (note: Note) => {
    if (!api) return;
    
    try {
      await api.deleteNote(note.id);
      setNotes(notes.filter(n => n.id !== note.id));
      if (selectedNoteId === note.id) {
        setSelectedNoteId(notes[0]?.id || null);
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
          />
        </>
      )}
      <NoteEditor
        note={selectedNote}
        onUpdateNote={handleUpdateNote}
        fontSize={fontSize}
        onUnsavedChanges={setHasUnsavedChanges}
        categories={categories}
        isFocusMode={isFocusMode}
        onToggleFocusMode={() => setIsFocusMode(!isFocusMode)}
      />
    </div>
  );
}

export default App;
