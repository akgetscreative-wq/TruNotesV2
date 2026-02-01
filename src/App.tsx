import { App as CapacitorApp } from '@capacitor/app';
import { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { NoteList } from './features/NoteList';
import { Editor } from './features/Editor';
import { TodoList } from './features/Todo/TodoList';
import { CalendarView } from './features/Calendar/CalendarView';
import { Dashboard } from './features/Dashboard';
import { TimerView } from './features/Timer/TimerView';
import { TomorrowView } from './features/Todo/TomorrowView';
import type { Note } from './types';
import { useNotes } from './hooks/useNotes';
import { getJournalBackgroundPath } from './utils/assetLoader';
import { DeleteModal } from './components/DeleteModal';
import { Search, PenTool, AlertCircle, CheckCircle } from 'lucide-react';
import { ScribbleEditor } from './features/Scribble/ScribbleEditor';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TimerProvider } from './context/TimerContext';
import { LoginPage } from './features/Auth/LoginPage';
import { SyncSettings } from './features/Sync/SyncSettings';
import { SyncManager } from './features/Sync/SyncManager';
import { AnimatePresence, motion } from 'framer-motion';
import { SettingsView } from './features/Settings';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { ThemeProvider, useThemeContext } from './context/ThemeContext';

// Global Toast Handler
let toastHandler: (msg: string, type: 'error' | 'success') => void = () => { };
export const showToast = (msg: string, type: 'error' | 'success' = 'success') => toastHandler(msg, type);
(window as any).showToast = showToast;

import { useWidgetSync } from './hooks/useWidgetSync';

function AuthenticatedApp() {
  useWidgetSync();
  const { notes, loading, addNote, updateNote, deleteNote, saveReorder } = useNotes();
  const { isAuthenticated, logout } = useAuth();
  const { journalBg: customJournalBg, bgDarknessLight, bgDarknessDark, tasksBg, tomorrowBg, bgBlurLight, bgBlurDark } = useSettings();
  const { theme } = useThemeContext();

  const currentBgDarkness = theme === 'dark' ? bgDarknessDark : bgDarknessLight;
  const currentBgBlur = theme === 'dark' ? bgBlurLight : bgBlurDark;

  const [view, setView] = useState<'dashboard' | 'journal' | 'favorites' | 'tasks' | 'calendar' | 'timer' | 'tomorrow' | 'sync' | 'settings'>('dashboard');
  const [activeNote, setActiveNote] = useState<Note | undefined>(undefined);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [showExitToast, setShowExitToast] = useState(false);

  // Pull to Refresh State
  const [pullStart, setPullStart] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'offline'>('idle');
  const PULL_THRESHOLD = 150;

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const [defaultJournalBg, setDefaultJournalBg] = useState<string>('');

  const stateRef = useRef({ activeNote, isCreating, view, isDeleteModalOpen });
  useEffect(() => { stateRef.current = { activeNote, isCreating, view, isDeleteModalOpen }; }, [activeNote, isCreating, view, isDeleteModalOpen]);

  useEffect(() => { getJournalBackgroundPath().then(setDefaultJournalBg); }, []);

  useEffect(() => {
    let lastBackPress = 0;
    const setupListener = async () => {
      const handle = await CapacitorApp.addListener('backButton', () => {
        const { activeNote, isCreating, view, isDeleteModalOpen } = stateRef.current;
        if (isDeleteModalOpen) { setIsDeleteModalOpen(false); return; }
        if (activeNote || isCreating) { setActiveNote(undefined); setIsCreating(false); return; }
        if (view !== 'dashboard') { setView('dashboard'); return; }
        const now = Date.now();
        if (now - lastBackPress < 2000) { CapacitorApp.exitApp(); }
        else { lastBackPress = now; setShowExitToast(true); setTimeout(() => setShowExitToast(false), 2000); }
      });
      return handle;
    };
    const listenerPromise = setupListener();
    return () => { listenerPromise.then(h => h.remove()); };
  }, []);

  // Pull to Refresh Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile || activeNote || isCreating || isRefreshing) return;
    const scrollPos = window.scrollY;
    // Only trigger if at the very top AND starting from the top 100px of the screen
    if (scrollPos === 0 && e.touches[0].clientY < 100) {
      // Prevent Pull-to-Sync if Sync is disabled
      const isSyncEnabled = localStorage.getItem('trunotes_sync_enabled') === 'true';
      if (!isSyncEnabled) return;

      setPullStart(e.touches[0].clientY);
      setIsPulling(true);
    }
  };

  const handleTouchMove = (_e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;
  };

  const handleTouchEnd = async (e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) {
      setIsPulling(false);
      return;
    }
    const finalY = e.changedTouches[0].clientY;
    const diff = finalY - pullStart;

    // Reset pulling states immediately so we don't get stuck in a "pulling" visual state
    setIsPulling(false);
    setPullStart(0);

    if (diff > PULL_THRESHOLD) {
      setIsRefreshing(true);

      if (!navigator.onLine) {
        setSyncStatus('offline');
        setTimeout(() => {
          setIsRefreshing(false);
          setSyncStatus('idle');
        }, 3000);
        return;
      }

      setSyncStatus('loading');
      try {
        if ((window as any).triggerSync) {
          // We call triggerSync(true) to keep the detailed success toasts, 
          // but our refreshing state is now correctly managed.
          await (window as any).triggerSync(true);
        }
        setSyncStatus('success');
      } catch (e) {
        console.error("Sync failed", e);
        setSyncStatus('error');
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setSyncStatus('idle');
        }, 3000);
      }
    }
  };

  if (!isAuthenticated) return <LoginPage />;

  const activeBgImage = (() => {
    if (activeNote || isCreating || view === 'journal' || view === 'favorites') return customJournalBg || defaultJournalBg;
    if (view === 'tasks') return tasksBg;
    if (view === 'tomorrow') return tomorrowBg;
    return null;
  })();

  const filteredNotes = notes.filter(n => (n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase())) && (view === 'favorites' ? n.isFavorite : true));

  const handleSave = async (title: string, content: string, data: Partial<Note>, shouldExit: boolean = true) => {
    if (activeNote && notes.some(n => n.id === activeNote.id)) await updateNote(activeNote.id, { title, content, ...data });
    else { const n = await addNote(title, content, { isFavorite: view === 'favorites', ...data }); if (!shouldExit) { setActiveNote(n); setIsCreating(false); } }
    if (shouldExit) { setActiveNote(undefined); setIsCreating(false); }
  };

  const confirmDelete = async () => { if (noteToDelete) { await deleteNote(noteToDelete); setNoteToDelete(null); setIsDeleteModalOpen(false); setActiveNote(undefined); setIsCreating(false); if (view !== 'favorites' && view !== 'dashboard') setView('journal'); } };

  return (
    <div
      style={{ height: '100%', width: '100%' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Layout
        isFocusedContent={!!activeNote || isCreating}
        disableGlobalSwipe={view === 'calendar'}
        sidebar={<Sidebar currentView={view} onChangeView={(v) => { if (v === view) setResetKey(p => p + 1); else setView(v); setActiveNote(undefined); setIsCreating(false); }} onLogout={logout} />}
      >
        <SyncManager />

        {/* Premium Pull-to-Sync Results Notification */}
        <AnimatePresence>
          {isMobile && (syncStatus === 'success' || syncStatus === 'error' || syncStatus === 'offline') && (
            <motion.div
              initial={{ y: -100, x: '-50%', opacity: 0 }}
              animate={{ y: 40, x: '-50%', opacity: 1 }}
              exit={{ y: -100, x: '-50%', opacity: 0 }}
              style={{
                position: 'fixed',
                left: '50%',
                zIndex: 10000,
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '1rem',
                borderRadius: '50%',
                border: `2px solid ${syncStatus === 'success' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'
                  }`,
                boxShadow: syncStatus === 'success' ? '0 0 20px rgba(34, 197, 94, 0.2)' : '0 0 20px rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(25px)',
                WebkitBackdropFilter: 'blur(25px)',
                pointerEvents: 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {syncStatus === 'success' ? <CheckCircle size={32} color="#22c55e" /> : <AlertCircle size={32} color="#ef4444" />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>{showExitToast && (<motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} style={{ position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.8)', color: 'white', padding: '0.8rem 1.5rem', borderRadius: '24px', zIndex: 10000 }}>Press back again to exit</motion.div>)}</AnimatePresence>
        {activeBgImage && (<><div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, backgroundImage: `url(${activeBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }} /><div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, background: theme === 'dark' ? `rgba(15, 23, 42, ${currentBgDarkness})` : `rgba(255, 255, 255, ${currentBgDarkness})`, backdropFilter: `blur(${currentBgBlur}px)` }} /></>)}

        <AnimatePresence mode="wait">
          {activeNote || isCreating ? (
            <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ width: '100%', height: '100%' }}>
              {activeNote?.type === 'drawing' ?
                <ScribbleEditor note={activeNote} onSave={(n: Note) => handleSave(n.title, n.content, { type: 'drawing', ...n }, false)} onClose={() => { setActiveNote(undefined); setIsCreating(false); }} onDelete={() => { setNoteToDelete(activeNote.id); setIsDeleteModalOpen(true); }} /> :
                <Editor note={activeNote} onSave={handleSave} onBack={() => { setActiveNote(undefined); setIsCreating(false); }} onDelete={activeNote ? () => { setNoteToDelete(activeNote.id); setIsDeleteModalOpen(true); } : undefined} />
              }
            </motion.div>
          ) : (
            <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ width: '100%', height: '100%' }}>
              {(() => {
                switch (view) {
                  case 'dashboard': return <Dashboard notes={notes} onNoteClick={setActiveNote} onReorder={saveReorder} onNewNote={() => { setActiveNote(undefined); setIsCreating(true); }} onViewCalendar={() => setView('calendar')} onViewJournal={() => setView('journal')} onViewFavorites={() => setView('favorites')} />;
                  case 'tomorrow': return <TomorrowView />;
                  case 'tasks': return <TodoList />;
                  case 'calendar': return <CalendarView notes={notes} onNoteClick={setActiveNote} resetTrigger={resetKey} />;
                  case 'timer': return <TimerView />;
                  case 'sync': return <SyncSettings />;
                  case 'settings': return <SettingsView />;
                  case 'journal':
                  case 'favorites':
                    return (
                      <div style={{ height: '100%', position: 'relative' }}>
                        <div className="container" style={{ position: 'relative', zIndex: 1, padding: isMobile ? '3.5rem 1rem 1rem 1rem' : '2rem' }}>
                          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '1.5rem', gap: '1rem' }}>
                            <h1 style={{ fontSize: isMobile ? '1.8rem' : '2.5rem', fontWeight: 800 }}>{view === 'favorites' ? 'Favorites' : 'Journal'}</h1>
                            <div style={{ display: 'flex', alignItems: 'center', width: isMobile ? '100%' : 'auto', gap: '0.5rem' }}>
                              <button onClick={() => { setActiveNote({ id: crypto.randomUUID(), title: '', content: '', createdAt: Date.now(), updatedAt: Date.now(), type: 'drawing' }); setIsCreating(true); }} style={{ background: 'var(--bg-card)', padding: '0.5rem 1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--accent-primary)', border: '1px solid var(--border-subtle)' }}><PenTool size={18} /> Scribble</button>
                              <div style={{ background: 'var(--bg-card)', padding: '0.5rem 0.75rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', maxWidth: '300px', border: '1px solid var(--border-subtle)' }}><Search size={18} color="var(--text-muted)" /><input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%' }} /></div>
                            </div>
                          </div>
                          <NoteList notes={filteredNotes} loading={loading} onNoteClick={setActiveNote} onNewNote={() => { setActiveNote(undefined); setIsCreating(true); }} onDelete={(id) => { setNoteToDelete(id); setIsDeleteModalOpen(true); }} onDuplicate={(n) => addNote(`${n.title} (Copy)`, n.content, n)} onToggleFavorite={(n) => updateNote(n.id, { isFavorite: !n.isFavorite })} />
                        </div>
                      </div>
                    );
                  default: return <div>Select View</div>;
                }
              })()}
            </motion.div>
          )}
        </AnimatePresence>
        <DeleteModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={confirmDelete} />
      </Layout>
    </div>
  );
}

function GlobalUI() {
  const [notification, setNotification] = useState<{ message: string, type: 'error' | 'success' } | null>(null);

  useEffect(() => {
    const handler = (message: string, type: 'error' | 'success') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 3500);
    };

    toastHandler = handler;
    (window as any).showToast = handler;
  }, []);

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -50, x: '-50%' }}
          style={{
            position: 'fixed', top: '24px', left: '50%', zIndex: 20000,
            background: notification.type === 'error' ? '#ef4444' : 'var(--accent-primary)',
            color: 'white', padding: '1rem 1.5rem', borderRadius: '16px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '280px'
          }}
        >
          {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          {notification.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function App() {
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <ThemeProvider>
        <SettingsProvider>
          <AuthProvider>
            <TimerProvider>
              <AuthenticatedApp />
              <GlobalUI />
            </TimerProvider>
          </AuthProvider>
        </SettingsProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;
