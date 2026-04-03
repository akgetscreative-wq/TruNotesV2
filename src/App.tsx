import { App as CapacitorApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { NoteList } from './features/NoteList';
import { JournalEditor } from './features/JournalEditor';
import { TodoList } from './features/Todo/TodoList';
import { CalendarView } from './features/Calendar/CalendarView';
import { Dashboard } from './features/Dashboard';
import { TimerView } from './features/Timer/TimerView';
import { TomorrowView } from './features/Todo/TomorrowView';
import type { Note } from './types';
import { useNotes } from './hooks/useNotes';
import { getJournalBackgroundPath } from './utils/assetLoader';
import bgImage from './assets/main-bg.png';
import { DeleteModal } from './components/DeleteModal';
import { Search, PenTool, Plus, AlertCircle, CheckCircle } from 'lucide-react';
import { ScribbleEditor } from './features/Scribble/ScribbleEditor';
import { AIView } from './features/AI/AIView';
// TruNotesAIView removed
import { AuthProvider, useAuth } from './context/AuthContext';
import { TimerProvider } from './context/TimerContext';
import { LoginPage } from './features/Auth/LoginPage';
import { SyncSettings } from './features/Sync/SyncSettings';
import { SyncManager } from './features/Sync/SyncManager';
import { AnimatePresence, motion } from 'framer-motion';
import { SettingsView } from './features/Settings';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { ThemeProvider, useThemeContext } from './context/ThemeContext';
import { TimeProvider } from './context/TimeContext';

// Global Toast Handler
let toastHandler: (msg: string, type: 'error' | 'success') => void = () => { };
export const showToast = (msg: string, type: 'error' | 'success' = 'success') => toastHandler(msg, type);
(window as any).showToast = showToast;

import { useWidgetSync } from './hooks/useWidgetSync';

function AuthenticatedApp() {
  useWidgetSync();
  const { notes, loading, addNote, updateNote, deleteNote, saveReorder } = useNotes();
  const { isAuthenticated, logout } = useAuth();
  const { journalBg: customJournalBg, bgDarknessLight, bgDarknessDark, tasksBg, tomorrowBg, bgBlurLight, bgBlurDark, dashboardBg } = useSettings();
  const { theme } = useThemeContext();

  const currentBgDarkness = theme === 'dark' ? bgDarknessDark : bgDarknessLight;
  const currentBgBlur = theme === 'dark' ? bgBlurLight : bgBlurDark;

  const [view, setView] = useState<'dashboard' | 'journal' | 'favorites' | 'tasks' | 'calendar' | 'timer' | 'tomorrow' | 'sync' | 'settings' | 'ai'>('dashboard');
  const [activeNote, setActiveNote] = useState<Note | undefined>(undefined);
  const [isCreating, setIsCreating] = useState(false);
  const [autoFocusTask, setAutoFocusTask] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [showExitToast, setShowExitToast] = useState(false);
  const savedScrollPos = useRef(0);
  const viewHistory = useRef<string[]>([]);

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
      // AI chat history is now session-based and handled within AIView

      // Check for view hint from widgets
      const checkIntent = async () => {
        const { value: targetView } = await Preferences.get({ key: 'last_widget_view' });
        if (targetView) {
          setView(targetView as any);
          await Preferences.remove({ key: 'last_widget_view' });
        }
      };
      checkIntent();

      const handle = await CapacitorApp.addListener('backButton', () => {
        const { activeNote, isCreating, view, isDeleteModalOpen } = stateRef.current;
        if (isDeleteModalOpen) { setIsDeleteModalOpen(false); return; }
        if (activeNote || isCreating) { setActiveNote(undefined); setIsCreating(false); restoreScroll(); return; }
        if (viewHistory.current.length > 0) { const prev = viewHistory.current.pop()!; setView(prev as any); return; }
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
    const journalBg = customJournalBg || defaultJournalBg;
    if (activeNote || isCreating || view === 'journal' || view === 'favorites') return journalBg;
    if (view === 'tasks') return tasksBg || journalBg;
    if (view === 'tomorrow') return tomorrowBg || journalBg;
    if (view === 'dashboard') return dashboardBg || (typeof bgImage === 'string' ? bgImage : '') || null;
    return null;
  })();

  const filteredNotes = notes.filter(n => (n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase())) && (view === 'favorites' ? n.isFavorite : true));

  const saveScroll = () => {
    const main = document.querySelector('main');
    if (main) savedScrollPos.current = main.scrollTop;
  };

  const restoreScroll = () => {
    let attempts = 0;
    const maxAttempts = 10; // Up to 1 second of retries

    const tryRestore = () => {
      const main = document.querySelector('main');
      if (main) {
        // Attempt restoration
        if (savedScrollPos.current > 0) {
          main.scrollTop = savedScrollPos.current;

          // Verify if it stuck. If not, the content might not be in the DOM yet.
          const delta = Math.abs(main.scrollTop - savedScrollPos.current);
          if (delta > 5 && attempts < maxAttempts) {
            attempts++;
            requestAnimationFrame(() => setTimeout(tryRestore, 50));
            return;
          }
        }
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(tryRestore, 50);
      }
    };

    // Initial delay to allow AnimatePresence to start the swap
    setTimeout(tryRestore, 100);
  };

  const openNote = (note: Note | undefined) => {
    saveScroll();
    setActiveNote(note);
  };

  const handleSave = async (title: string, content: string, data: Partial<Note>, shouldExit: boolean = true) => {
    if (activeNote && notes.some(n => n.id === activeNote.id)) await updateNote(activeNote.id, { title, content, ...data });
    else { const n = await addNote(title, content, { isFavorite: view === 'favorites', ...data }); if (!shouldExit) { setActiveNote(n); setIsCreating(false); } }
    if (shouldExit) { setActiveNote(undefined); setIsCreating(false); restoreScroll(); }
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
        disableGlobalSwipe={!!activeNote || view === 'calendar' || view === 'ai'}
        sidebar={<Sidebar currentView={view} onChangeView={(v) => { if (v === view) setResetKey(p => p + 1); else { viewHistory.current.push(view); setView(v); } setActiveNote(undefined); setIsCreating(false); setAutoFocusTask(false); }} onLogout={logout} />}
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
        {activeBgImage && (<><div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100dvh', zIndex: 0, backgroundImage: `url(${activeBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', pointerEvents: 'none' }} /><div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100dvh', zIndex: 0, background: theme === 'dark' ? `rgba(15, 23, 42, ${currentBgDarkness})` : `rgba(255, 255, 255, ${currentBgDarkness})`, backdropFilter: `blur(${currentBgBlur}px)`, pointerEvents: 'none' }} /></>)}

        <AnimatePresence mode="wait">
          {activeNote || isCreating ? (
            <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ width: '100%', height: '100%' }}>
              {activeNote?.type === 'drawing' ?
                <ScribbleEditor note={activeNote} onSave={(n: Note) => handleSave(n.title, n.content, { type: 'drawing', ...n }, false)} onClose={() => { setActiveNote(undefined); setIsCreating(false); restoreScroll(); }} onDelete={() => { setNoteToDelete(activeNote.id); setIsDeleteModalOpen(true); }} /> :
                <JournalEditor note={activeNote} onSave={handleSave} onBack={() => { setActiveNote(undefined); setIsCreating(false); restoreScroll(); }} onDelete={activeNote ? () => { setNoteToDelete(activeNote.id); setIsDeleteModalOpen(true); } : undefined} />
              }
            </motion.div>
          ) : (
            <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ width: '100%', height: '100%' }}>
              {(() => {
                switch (view) {
                  case 'dashboard': return <Dashboard notes={notes} onNoteClick={openNote} onReorder={saveReorder} onNewNote={() => { openNote(undefined); setIsCreating(true); }} onViewCalendar={() => { viewHistory.current.push(view); setView('calendar'); }} onViewJournal={() => { viewHistory.current.push(view); setView('journal'); }} onViewTasks={() => { viewHistory.current.push(view); setView('tasks'); }} onViewFavorites={() => { viewHistory.current.push(view); setView('favorites'); }} onViewAI={() => { viewHistory.current.push(view); setView('ai'); }} onNewTask={() => { setAutoFocusTask(true); viewHistory.current.push(view); setView('tasks'); }} />;
                  case 'tomorrow': return <TomorrowView />;
                  case 'tasks': return <TodoList autoFocusInput={autoFocusTask} onFocusComplete={() => setAutoFocusTask(false)} />;
                  case 'calendar': return <CalendarView notes={notes} onNoteClick={openNote} resetTrigger={resetKey} />;
                  case 'timer': return <TimerView />;
                  case 'sync': return <SyncSettings />;
                  case 'settings': return <SettingsView />;
                  case 'ai': return <AIView />;
                  // ai view removed
                  case 'journal':
                  case 'favorites':
                    return (
                      <div style={{ height: '100%', position: 'relative' }}>
                        <div className="container" style={{ position: 'relative', zIndex: 1, padding: isMobile ? 'calc(var(--safe-top) + 3.2rem) 1rem 1.25rem 1rem' : '2rem' }}>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            marginBottom: isMobile ? '1rem' : '1.4rem',
                            padding: isMobile ? '1rem' : '1.2rem',
                            borderRadius: isMobile ? '24px' : '30px',
                            background: theme === 'dark' ? 'linear-gradient(180deg, rgba(15,23,42,0.78), rgba(15,23,42,0.62))' : 'linear-gradient(180deg, rgba(255,255,255,0.7), rgba(255,255,255,0.52))',
                            border: theme === 'dark' ? '1px solid rgba(51, 65, 85, 0.9)' : '1px solid rgba(226, 232, 240, 0.9)',
                            boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
                            backdropFilter: 'blur(16px)'
                          }}>
                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '1rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                <span style={{ fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-primary)' }}>
                                  {view === 'favorites' ? 'Pinned writing' : 'Writing space'}
                                </span>
                                <h1 style={{ margin: 0, fontSize: isMobile ? '1.9rem' : '2.7rem', lineHeight: 1.05, letterSpacing: '-0.04em', fontWeight: 900 }}>
                                  {view === 'favorites' ? 'Favorites' : 'Notes'}
                                </h1>
                                <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: '640px', lineHeight: 1.7 }}>
                                  Find what matters faster with clearer cards, softer visuals, and a workspace that keeps your notes easy to scan.
                                </p>
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: isMobile ? 'column' : 'row',
                                  gap: '0.65rem',
                                  width: isMobile ? '100%' : 'auto'
                                }}
                              >
                                <button
                                  onClick={() => { openNote(undefined); setIsCreating(true); }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.6rem',
                                    padding: '0.9rem 1.1rem',
                                    borderRadius: '999px',
                                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                                    color: 'white',
                                    boxShadow: '0 14px 28px rgba(37, 99, 235, 0.24)',
                                    fontWeight: 700,
                                    alignSelf: isMobile ? 'stretch' : 'auto',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <Plus size={18} /> New note
                                </button>
                                <button
                                  onClick={() => { openNote({ id: crypto.randomUUID(), title: '', content: '', createdAt: Date.now(), updatedAt: Date.now(), type: 'drawing' }); setIsCreating(true); }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.6rem',
                                    padding: '0.9rem 1.1rem',
                                    borderRadius: '999px',
                                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.96), rgba(129, 140, 248, 0.96))',
                                    color: 'white',
                                    boxShadow: '0 14px 28px rgba(99, 102, 241, 0.22)',
                                    fontWeight: 700,
                                    alignSelf: isMobile ? 'stretch' : 'auto',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <PenTool size={18} /> Scribble note
                                </button>
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'stretch', gap: '0.75rem' }}>
                              <div style={{
                                flex: 1,
                                background: theme === 'dark' ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.72)',
                                padding: '0.85rem 1rem',
                                borderRadius: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                border: theme === 'dark' ? '1px solid rgba(51, 65, 85, 0.85)' : '1px solid rgba(226, 232, 240, 0.85)'
                              }}>
                                <Search size={18} color="var(--text-muted)" />
                                <input
                                  type="text"
                                  placeholder={view === 'favorites' ? 'Search favorites...' : 'Search notes...'}
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  style={{ width: '100%', fontSize: '0.95rem' }}
                                />
                              </div>

                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.55rem',
                                padding: '0.85rem 1rem',
                                borderRadius: '18px',
                                background: theme === 'dark' ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.72)',
                                border: theme === 'dark' ? '1px solid rgba(51, 65, 85, 0.85)' : '1px solid rgba(226, 232, 240, 0.85)',
                                color: 'var(--text-secondary)',
                                fontWeight: 600,
                                minWidth: isMobile ? 'auto' : '220px',
                                justifyContent: 'center'
                              }}>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{filteredNotes.length}</span>
                                <span>{filteredNotes.length === 1 ? 'result visible' : 'results visible'}</span>
                              </div>
                            </div>
                          </div>
                          <NoteList notes={filteredNotes} loading={loading} onNoteClick={openNote} onNewNote={() => { openNote(undefined); setIsCreating(true); }} onDelete={(id) => { setNoteToDelete(id); setIsDeleteModalOpen(true); }} onDuplicate={(n) => addNote(`${n.title} (Copy)`, n.content, n)} onToggleFavorite={(n) => updateNote(n.id, { isFavorite: !n.isFavorite })} />
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

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('a') || target.closest('.clickable')) {
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
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
    <div style={{ position: 'relative', width: '100vw', height: '100dvh', overflow: 'hidden', background: '#0f172a' }}>
      <ThemeProvider>
        <TimeProvider>
          <SettingsProvider>
            <AuthProvider>
              <TimerProvider>
                <AuthenticatedApp />
                <GlobalUI />
              </TimerProvider>
            </AuthProvider>
          </SettingsProvider>
        </TimeProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;
