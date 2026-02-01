import React from 'react';
import type { Note } from '../../types';
import { Activity, Clock, Star, Plus, Calendar as CalendarIcon, CheckSquare, Check } from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { useTodos } from '../../hooks/useTodos';
import bgImage from '../../assets/dashboard-bg-v2.jpg';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { HourlyLogSummary } from '../HourlyLog/HourlyLogSummary';

interface DashboardProps {
    notes: Note[];
    onNoteClick: (note: Note) => void;
    onReorder: (newOrder: Note[]) => void;
    onNewNote?: () => void;
    onViewCalendar?: () => void;
    onViewJournal?: () => void;
    onViewFavorites?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ notes, onNoteClick, onNewNote, onViewCalendar, onViewJournal, onViewFavorites }) => {
    const { theme } = useThemeContext();
    const { dashboardBg, bgDarknessLight, bgDarknessDark, bgBlurLight, bgBlurDark } = useSettings();
    const { username } = useAuth();

    // Derived theme values
    const currentBgDarkness = theme === 'dark' ? bgDarknessDark : bgDarknessLight;
    const effectiveBlur = theme === 'dark' ? bgBlurDark : bgBlurLight;
    // theme, isEditMode removed as unused to fix build errors

    // displayNotes removed as unused
    const recentNotes = notes.slice(0, 3);
    const totalNotes = notes.length;
    const favoriteCount = notes.filter(n => n.isFavorite).length;
    // DISCOVERY_DOCS removed as unused to fix build errors

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };



    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    return (
        <div className="fade-in dashboard-scrollbar" style={{
            height: '100%',
            overflowY: 'auto',
            paddingBottom: '4rem',
            position: 'relative'
        }}>
            {/* Background Container */}
            <div style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundImage: `url(${dashboardBg || bgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                zIndex: 0
            }} />

            {/* Theme-Aware Dynamic Glass Overlay - Linked to Settings (v4 style) */}
            {/* Pages affected: Dashboard, Journal, Tasks, Tomorrow */}
            <div style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: theme === 'dark' ? `rgba(15, 23, 42, ${currentBgDarkness})` : `rgba(255, 255, 255, ${currentBgDarkness})`,
                backdropFilter: `blur(${effectiveBlur}px)`,
                zIndex: 0
            }} />

            <div style={{
                maxWidth: isMobile ? '100%' : '1280px', // Wider desktop container
                margin: '0 auto',
                padding: isMobile ? '1rem' : '3rem 2rem', // More breathing room on desktop
                position: 'relative',
                zIndex: 1,
                paddingTop: isMobile ? '3.5rem' : '4rem' // Adjusted for better top spacing
            }}>
                <header style={{
                    marginBottom: isMobile ? '2rem' : '3rem',
                    background: theme === 'dark' ? `rgba(30, 41, 59, ${currentBgDarkness * 0.8})` : `rgba(255, 255, 255, ${currentBgDarkness * 0.5})`,
                    padding: isMobile ? '1.5rem 1.25rem' : '2rem',
                    borderRadius: '28px',
                    backdropFilter: `blur(${effectiveBlur * 0.8}px)`, // Slightly less blur for the header panel for clarity
                    border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.05)',
                    boxShadow: theme === 'dark' ? '0 10px 25px -5px rgba(0,0,0,0.3)' : '0 10px 20px -5px rgba(0,0,0,0.05)'
                }}>
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h1 style={{
                            fontSize: isMobile ? '3.2rem' : '5.0rem',
                            fontWeight: 900,
                            lineHeight: 1.1,
                            marginBottom: '0.5rem',
                            letterSpacing: '-0.05em',
                            background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>
                            {getGreeting()}{username ? `, ${username.charAt(0).toUpperCase() + username.slice(1)}` : ''},
                        </h1>
                        <p style={{
                            color: theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(30, 41, 59, 0.7)',
                            fontSize: isMobile ? '1rem' : '1.25rem',
                            maxWidth: '700px',
                            lineHeight: 1.5,
                            marginTop: '0.5rem'
                        }}>
                            Your workspace is ready. You have <strong style={{ color: '#6366f1', fontWeight: 800 }}>{totalNotes} notes</strong> helping you capture your world.
                        </p>
                    </motion.div>
                </header>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: isMobile ? '0.75rem' : '1.5rem',
                    marginBottom: isMobile ? '1.5rem' : '3rem'
                }}>
                    <QuickActionCard
                        icon={Plus}
                        label="New Note"
                        desc="Start writing immediately"
                        color="#6366f1"
                        onClick={onNewNote}
                        delay={0}
                        isMobile={isMobile}
                        theme={theme}
                    />
                    <QuickActionCard
                        icon={CalendarIcon}
                        label="Open Calendar"
                        desc="Plan your schedule"
                        color="#8b5cf6"
                        onClick={onViewCalendar}
                        delay={0}
                        isMobile={isMobile}
                        theme={theme}
                    />
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: isMobile ? '0.75rem' : '1.5rem',
                    marginBottom: isMobile ? '2.5rem' : '4rem'
                }}>
                    <StatCard
                        icon={Activity}
                        label="Total"
                        value={totalNotes.toString()}
                        color={theme === 'dark' ? '#60a5fa' : '#3b82f6'}
                        delay={0}
                        onClick={onViewJournal}
                        isClickable
                        isMobile={isMobile}
                        theme={theme}
                    />
                    <StatCard
                        icon={Clock}
                        label="Last"
                        value={recentNotes[0] ? format(new Date(recentNotes[0].updatedAt), 'MMM d') : '-'}
                        subtext={recentNotes[0] ? format(new Date(recentNotes[0].updatedAt), 'h:mm a') : ''}
                        color={theme === 'dark' ? '#34d399' : '#10b981'}
                        delay={0}
                        onClick={() => recentNotes[0] && onNoteClick(recentNotes[0])}
                        isClickable={!!recentNotes[0]}
                        isMobile={isMobile}
                        theme={theme}
                    />
                    <StatCard
                        icon={Star}
                        label="Favorites"
                        value={favoriteCount.toString()}
                        color={theme === 'dark' ? '#fbbf24' : '#f59e0b'}
                        delay={0}
                        onClick={onViewFavorites}
                        isClickable
                        isMobile={isMobile}
                        theme={theme}
                    />
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(400px, 1fr))',
                    gap: isMobile ? '2.5rem' : '2rem',
                    marginBottom: '4rem'
                }}>
                    <TodayAgenda />
                    <HourlyLogSummary />
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(400px, 1fr))',
                    gap: isMobile ? '2.5rem' : '2rem',
                    marginBottom: '4rem'
                }}>
                    <PendingTasks />
                </div>
            </div>
        </div>
    );
};

// --- Sub Components with Glass/Premium Style ---

const QuickActionCard = ({ icon: Icon, label, desc, color, onClick, delay, isMobile, theme }: any) => (
    <motion.button
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.4 }}
        whileHover={!isMobile ? {
            y: -5,
            scale: 1.02,
            boxShadow: theme === 'dark' ? '0 20px 40px -10px rgba(0,0,0,0.5)' : '0 20px 30px -10px rgba(0,0,0,0.1)'
        } : {}}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        style={{
            background: theme === 'dark' ? 'rgba(30, 41, 59, 0.45)' : 'rgba(255, 255, 255, 0.6)',
            borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
            backdropFilter: 'blur(10px)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderRadius: '28px',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            cursor: 'pointer',
            textAlign: 'left',
            color: theme === 'dark' ? '#ffffff' : '#1e293b',
            width: '100%',
            boxShadow: theme === 'dark' ? '0 10px 25px -5px rgba(0,0,0,0.3)' : '0 10px 20px -5px rgba(0,0,0,0.05)'
        }}
    >
        <div style={{
            width: '56px',
            height: '56px',
            minWidth: '56px',
            borderRadius: '16px',
            background: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: theme === 'dark' ? `0 8px 16px -4px ${color}66` : `0 4px 12px -2px ${color}44`
        }}>
            <Icon size={24} strokeWidth={2.5} color="white" />
        </div>
        <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.1rem' }}>{label}</div>
            <div style={{ fontSize: '0.85rem', color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(30, 41, 59, 0.5)' }}>{desc}</div>
        </div>
    </motion.button>
);

const StatCard = ({ icon: Icon, label, value, subtext, color, delay, onClick, isClickable, isMobile, theme }: any) => {
    const getBg = () => {
        if (theme === 'dark') {
            if (label === 'Total') return 'rgba(30, 41, 59, 0.6)';
            if (label === 'Last') return 'rgba(16, 185, 129, 0.2)';
            if (label === 'Favorites') return 'rgba(245, 158, 11, 0.15)';
        } else {
            if (label === 'Total') return 'rgba(235, 245, 255, 0.7)';
            if (label === 'Last') return 'rgba(220, 255, 235, 0.7)';
            if (label === 'Favorites') return 'rgba(255, 248, 220, 0.7)';
        }
        return 'rgba(255,255,255,0.6)';
    };

    return (
        <motion.button
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4 }}
            whileHover={isClickable && !isMobile ? {
                y: -5,
                scale: 1.02,
                boxShadow: theme === 'dark' ? '0 15px 35px rgba(0,0,0,0.3)' : '0 15px 25px rgba(0,0,0,0.06)'
            } : {}}
            whileTap={isClickable ? { scale: 0.98 } : {}}
            onClick={onClick}
            style={{
                background: getBg(),
                borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                backdropFilter: 'blur(10px)',
                borderWidth: '1px',
                borderStyle: 'solid',
                padding: '1.5rem',
                borderRadius: '32px',
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                cursor: isClickable ? 'pointer' : 'default',
                width: '100%',
                textAlign: 'left',
                color: theme === 'dark' ? '#ffffff' : '#1e293b',
                boxShadow: theme === 'dark' ? '0 8px 30px rgba(0,0,0,0.15)' : '0 8px 15px rgba(0,0,0,0.03)'
            }}
        >
            <div style={{
                color: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.8
            }}>
                <Icon size={32} strokeWidth={2.5} />
            </div>
            <div>
                <div style={{ fontSize: '2.25rem', fontWeight: 800, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: '0.9rem', color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(30, 41, 59, 0.5)', marginTop: '0.2rem', fontWeight: 600 }}>
                    {label === 'Total' ? 'Total Notes' : label}
                </div>
                {label === 'Last' && (
                    <div style={{ fontSize: '0.75rem', color: theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(30, 41, 59, 0.4)', marginTop: '0.2rem', fontWeight: 500 }}>
                        • {subtext || '12:00 AM'}
                    </div>
                )}
                {label === 'Favorites' && <div style={{ fontSize: '0.85rem', color: theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(30, 41, 59, 0.4)' }}></div>}
            </div>
        </motion.button>
    );
};

const TodayAgenda = () => {
    const { getTodosByDate, getTodayStr, toggleTodo } = useTodos();
    const todayStr = getTodayStr();
    const todayTasks = getTodosByDate(todayStr);

    if (todayTasks.length === 0) {
        return (
            <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <CheckSquare size={24} color="var(--accent-primary)" />
                        Today's scheduled tasks
                    </h2>
                </div>
                <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '24px',
                    border: '1px dashed var(--border-subtle)',
                    color: 'var(--text-muted)'
                }}>
                    No tasks scheduled for today.
                </div>
            </section>
        );
    }

    return (
        <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <CheckSquare size={24} color="var(--accent-primary)" />
                    Today's scheduled tasks
                </h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Scheduled for Today</span>
            </div>

            <div style={{
                background: 'var(--dashboard-header-bg)',
                backdropFilter: 'blur(12px)',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                maxHeight: '400px',
                overflowY: 'auto'
            }} className="dashboard-scrollbar">
                {todayTasks.map(task => (
                    <motion.div
                        key={task.id}
                        whileHover={{ scale: 1.01 }}
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            padding: '0.85rem',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}
                    >
                        <button
                            onClick={() => toggleTodo(task)}
                            style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '6px',
                                border: `2px solid ${task.completed ? 'var(--accent-primary)' : 'var(--text-muted)'}`,
                                background: task.completed ? 'var(--accent-primary)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0
                            }}
                        >
                            {task.completed && <Check size={12} color="white" strokeWidth={3} />}
                        </button>
                        <span style={{
                            fontSize: '0.95rem',
                            color: 'var(--text-primary)',
                            textDecoration: task.completed ? 'line-through' : 'none',
                            opacity: task.completed ? 0.6 : 1,
                            flex: 1,
                            wordBreak: 'break-word'
                        }}>
                            {task.text}
                        </span>
                    </motion.div>
                ))}
            </div>
        </section>
    );
};

const PendingTasks = () => {
    const { todos, getTodayStr, getTomorrowStr, toggleTodo } = useTodos();
    const todayStr = getTodayStr();
    const tomorrowStr = getTomorrowStr();
    // Filter: Not complete AND Not for tomorrow AND Not for today
    const pendingTasks = todos.filter(t => !t.completed && t.targetDate !== tomorrowStr && t.targetDate !== todayStr);

    return (
        <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Plus size={24} color="#f59e0b" /> {/* Reusing Plus but maybe List icon would be better? Using Plus for now or maybe Activity */}
                    Pending Tasks
                </h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Backlog</span>
            </div>

            <div style={{
                background: 'var(--dashboard-header-bg)',
                backdropFilter: 'blur(12px)',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                maxHeight: '400px',
                overflowY: 'auto'
            }} className="dashboard-scrollbar">
                {pendingTasks.length > 0 ? (
                    pendingTasks.map(task => (
                        <motion.div
                            key={task.id}
                            whileHover={{ scale: 1.01 }}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                padding: '0.85rem',
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}
                        >
                            <button
                                onClick={() => toggleTodo(task)}
                                style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '6px',
                                    border: `2px solid var(--text-muted)`,
                                    background: 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    flexShrink: 0
                                }}
                            >
                            </button>
                            <div style={{ flex: 1, wordBreak: 'break-word' }}>
                                <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{task.text}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                    {task.targetDate ? format(new Date(task.targetDate), 'MMM d') : 'General Task'}
                                </div>
                            </div>
                        </motion.div>
                    ))
                ) : (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No pending backlog. You're all caught up!
                    </div>
                )}
            </div>
        </section>
    );
};
