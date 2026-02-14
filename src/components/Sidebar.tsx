import { Home, Book, Star, CheckSquare, Calendar, LogOut, Hourglass, Coffee, Cloud, Settings, Brain } from 'lucide-react';
import { motion } from 'framer-motion';
import { ThemeToggle } from './UI/ThemeToggle';
import { useTheme } from '../hooks/useTheme';

interface SidebarProps {
    currentView: 'dashboard' | 'journal' | 'favorites' | 'tasks' | 'calendar' | 'timer' | 'tomorrow' | 'sync' | 'settings' | 'ai';
    onChangeView: (view: 'dashboard' | 'journal' | 'favorites' | 'tasks' | 'calendar' | 'timer' | 'tomorrow' | 'sync' | 'settings' | 'ai') => void;
    onLogout: () => void;
    onClose?: () => void;
    dragX?: any; // The buttery smooth MotionValue from Layout
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onLogout, onClose, dragX }) => {
    const { theme } = useTheme();

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    const allItems = [
        { id: 'dashboard', label: 'Home', icon: Home },
        { id: 'tomorrow', label: 'Soon', icon: Coffee },
        { id: 'journal', label: 'Journal', icon: Book },
        { id: 'favorites', label: 'Star', icon: Star },
        { id: 'tasks', label: 'Tasks', icon: CheckSquare },
        { id: 'calendar', label: 'Plan', icon: Calendar },
        { id: 'timer', label: 'Focus', icon: Hourglass },
        { id: 'sync', label: 'Sync', icon: Cloud },
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'ai', label: 'AI Assist', icon: Brain },
    ] as const;

    const renderButton = (item: typeof allItems[number], mobileStyle: boolean = false) => {
        const isActive = currentView === item.id;
        return (
            <motion.button
                key={item.id}
                onClick={() => {
                    onChangeView(item.id);
                    if (onClose) onClose();
                }}
                whileHover={!isMobile ? { scale: 1.02, x: 5, backgroundColor: isActive ? 'var(--bg-card)' : 'rgba(127, 127, 127, 0.1)' } : {}}
                whileTap={{ scale: 0.95 }}
                className={mobileStyle ? `bottom-nav-item ${isActive ? 'active' : ''}` : ''}
                style={!mobileStyle ? {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--accent-primary)' : (theme === 'dark' ? '#cbd5e1' : '#475569'),
                    backgroundColor: isActive && !isMobile ? (theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'var(--bg-card)') : 'transparent',
                    boxShadow: isActive && !isMobile ? 'var(--shadow-soft)' : 'none',
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    cursor: 'pointer'
                } : {}}
            >
                <item.icon size={mobileStyle ? 22 : 20} color={isActive ? 'var(--accent-primary)' : 'currentColor'} />
                <span>{item.label}</span>
            </motion.button>
        );
    };

    if (isMobile) {
        return (
            <>
                {/* 1. Slide-out Drawer */}
                <motion.aside
                    className={`sidebar mobile-drawer`}
                    style={{
                        background: theme === 'dark' ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.6)',
                        borderRight: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
                        x: dragX // Directly follow finger
                    }}
                >
                    <div style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <img
                                src="logo.png"
                                alt="Logo"
                                style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain' }}
                            />
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>TruNotes</h2>
                        </div>
                    </div>

                    <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {allItems.map(item => renderButton(item))}
                    </nav>

                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ padding: '0 0.5rem' }}><ThemeToggle /></div>
                        <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '0.5rem 0' }} />
                        <button onClick={onLogout} style={{ color: '#ef4444', border: 'none', background: 'none', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', fontSize: '1rem', fontWeight: 500, cursor: 'pointer' }}>
                            <LogOut size={20} /> Logout
                        </button>
                    </div>
                </motion.aside>
            </>
        );
    }

    // DESKTOP VIEW
    return (
        <motion.aside
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="sidebar"
            style={{
                width: '260px',
                height: 'calc(100vh - 2rem)',
                margin: '1rem',
                background: theme === 'dark'
                    ? 'linear-gradient(145deg, rgba(15, 23, 42, 0.4) 0%, rgba(30, 41, 59, 0.2) 100%)'
                    : 'linear-gradient(145deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.1) 100%)',
                backdropFilter: 'blur(40px)',
                display: 'flex',
                flexDirection: 'column',
                padding: '2rem',
                border: theme === 'dark'
                    ? '1px solid rgba(255, 255, 255, 0.08)'
                    : '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '24px',
                boxShadow: theme === 'dark'
                    ? '0 8px 32px rgba(0, 0, 0, 0.2)'
                    : '0 8px 32px rgba(0, 0, 0, 0.05)',
                position: 'sticky',
                top: '1rem',
                zIndex: 50
            }}
        >
            <div style={{ marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img
                    src="logo.png"
                    alt="Logo"
                    style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'contain' }}
                />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>TruNotes</h2>
            </div>
            <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {allItems.map(item => renderButton(item))}
            </nav>
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ padding: '0 1rem' }}><ThemeToggle /></div>
                <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '0.5rem 0' }} />
                <motion.button
                    onClick={onLogout}
                    whileHover={{ scale: 1.02, x: 5, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '8px',
                        fontSize: '1rem', fontWeight: 500, color: '#ef4444', background: 'transparent', width: '100%',
                        textAlign: 'left', border: 'none', cursor: 'pointer'
                    }}
                >
                    <LogOut size={20} /> Logout
                </motion.button>
            </div>
        </motion.aside>
    );
};
