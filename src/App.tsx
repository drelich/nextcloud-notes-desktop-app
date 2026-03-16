import { useState, useEffect } from 'react';
import { LoginView } from './components/LoginView';
import { NotesList } from './components/NotesList';
import { NoteEditor } from './components/NoteEditor';
import { NextcloudAPI } from './api/nextcloud';
import { Note } from './types';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [api, setApi] = useState<NextcloudAPI | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [fontSize] = useState(14);
  const [username, setUsername] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

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
      
      const note = await api.createNote(`New Note ${timestamp}`, '', '');
      setNotes([note, ...notes]);
      setSelectedNoteId(note.id);
    } catch (error) {
      console.error('Create note failed:', error);
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

  const filteredNotes = notes.filter(note => {
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
      <NotesList
        notes={filteredNotes}
        selectedNoteId={selectedNoteId}
        onSelectNote={setSelectedNoteId}
        onCreateNote={handleCreateNote}
        onDeleteNote={handleDeleteNote}
        onSync={syncNotes}
        onLogout={handleLogout}
        username={username}
        theme={theme}
        onThemeChange={handleThemeChange}
        searchText={searchText}
        onSearchChange={setSearchText}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavorites={() => setShowFavoritesOnly(!showFavoritesOnly)}
      />
      <NoteEditor
        note={selectedNote}
        onUpdateNote={handleUpdateNote}
        fontSize={fontSize}
      />
    </div>
  );
}

export default App;
