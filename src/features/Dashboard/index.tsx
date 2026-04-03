import React, { useState } from 'react';
import type { Note } from '../../types';
import { Book, Star, Plus, Calendar as CalendarIcon, CheckSquare, Check, ChevronRight, Sparkles } from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { useTodos } from '../../hooks/useTodos';
import { useAuth } from '../../context/AuthContext';
import { useCurrentTime } from '../../context/TimeContext';
import { addDays } from 'date-fns';

interface DashboardProps {
    notes: Note[];
    onNoteClick: (note: Note) => void;
    onReorder: (newOrder: Note[]) => void;
    onNewNote?: () => void;
    onNewTask?: () => void;
    onViewCalendar?: () => void;
    onViewJournal?: () => void;
    onViewTasks?: () => void;
    onViewFavorites?: () => void;
    onViewAI?: () => void;
}

// ── Swipable Note Cards ──
const NoteCarousel: React.FC<{ notes: Note[]; onNoteClick: (note: Note) => void }> = ({ notes, onNoteClick }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const recentNotes = notes.slice(0, 5);

    if (recentNotes.length === 0) return null;

    const gradients = [
        'linear-gradient(135deg, rgba(237, 233, 254, 0.95) 0%, rgba(245, 243, 255, 0.95) 100%)', // Soft Lavender Paper
        'linear-gradient(135deg, rgba(224, 242, 254, 0.95) 0%, rgba(240, 249, 255, 0.95) 100%)', // Soft Sky Paper
        'linear-gradient(135deg, rgba(220, 252, 231, 0.95) 0%, rgba(240, 253, 244, 0.95) 100%)', // Soft Sage Paper
        'linear-gradient(135deg, rgba(254, 243, 199, 0.95) 0%, rgba(255, 251, 235, 0.95) 100%)', // Soft Amber Paper
        'linear-gradient(135deg, rgba(255, 228, 230, 0.95) 0%, rgba(255, 241, 242, 0.95) 100%)', // Soft Rose Paper
        'linear-gradient(135deg, rgba(241, 245, 249, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%)', // Soft Slate Paper
    ];

    const handleDragEnd = (_: any, info: any) => {
        // If dragged significantly in ANY direction, loop it to the back
        const distance = Math.sqrt(info.offset.x ** 2 + info.offset.y ** 2);
        if (distance > 50) {
            setActiveIndex(i => (i + 1) % recentNotes.length);
        }
    };

    const stripHtml = (html: string) => {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    };

    return (
        <div
            className="no-swipe"
            style={{ marginBottom: '1.5rem', paddingBottom: '0.5rem' }}
        >
            {/* The container needs enough height to hold the offset backend-cards without clipping */}
            <div style={{ position: 'relative', height: '175px' }}>
                <AnimatePresence>
                    {recentNotes.map((note, index) => {
                        const len = recentNotes.length;
                        // Calculate offset relative to the activeIndex to create a looping stack
                        const offset = (index - activeIndex + len) % len;

                        // Only render up to 3 cards deep, plus the one just swiped (which is at len - 1)
                        if (len > 3 && offset > 2 && offset !== len - 1) return null;

                        const isFront = offset === 0;
                        const isHidden = offset > 2; // applies to the swiped card in large queues

                        return (
                            <motion.div
                                key={note.id}
                                layout
                                initial={{ opacity: 0, y: 30, scale: 0.8 }}
                                animate={{
                                    opacity: isHidden ? 0 : 1 - offset * 0.3,
                                    y: isHidden ? 0 : offset * 12, // shift down visually
                                    x: 0, // ensure it returns horizontally
                                    scale: isHidden ? 0.8 : 1 - offset * 0.05,
                                    zIndex: 10 - offset,
                                }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                                drag={isFront}
                                dragSnapToOrigin={true}
                                onDragEnd={isFront ? handleDragEnd : undefined}
                                onPointerDown={(e) => isFront && e.stopPropagation()}
                                onClick={() => isFront && onNoteClick(note)}
                                style={{
                                    background: gradients[index % gradients.length],
                                    borderRadius: '24px',
                                    padding: '1.5rem',
                                    height: '160px',
                                    cursor: isFront ? 'grab' : 'default',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    boxShadow: isFront ? '0 10px 25px -5px rgba(0, 0, 0, 0.1)' : 'none',
                                    border: '1px solid rgba(0, 0, 0, 0.05)',
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0,
                                    touchAction: isFront ? 'none' : 'auto'
                                }}
                                whileTap={isFront ? { cursor: 'grabbing' } : {}}
                            >
                                <div>
                                    <h3 style={{
                                        fontSize: '1.2rem', fontWeight: 800, color: '#1e293b',
                                        marginBottom: '0.4rem'
                                    }}>
                                        {note.title || 'Untitled Note'}
                                    </h3>
                                    <p style={{
                                        fontSize: '0.9rem', color: '#475569',
                                        lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box',
                                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                    }}>
                                        {(() => {
                                            if (!note.content) return 'No content yet...';
                                            try {
                                                if (note.content.trim().startsWith('{')) {
                                                    const parsed = JSON.parse(note.content);
                                                    if (parsed._journalV2) {
                                                        const mainPart = parsed.mainContent || '';
                                                        const blockPart = (parsed.textBlocks || []).map((b: any) => b.content).join(' ');
                                                        return stripHtml(mainPart + ' ' + blockPart).slice(0, 120) || 'Blank Journal Entry';
                                                    }
                                                }
                                            } catch (e) { /* ignore */ }
                                            return stripHtml(note.content).slice(0, 120) || 'No content yet...';
                                        })()}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
                                        {format(new Date(note.createdAt), 'MMM d')}
                                    </span>
                                    <span style={{
                                        background: 'rgba(0,0,0,0.04)',
                                        padding: '0.3rem 0.8rem', borderRadius: '12px',
                                        fontSize: '0.75rem', color: '#475569', fontWeight: 600,
                                        border: '1px solid rgba(0,0,0,0.05)'
                                    }}>
                                        {note.isFavorite ? '⭐ Favorite' : '📝 Note'}
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
            {/* Dot indicators */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '0.75rem' }}>
                {recentNotes.map((_, i) => (
                    <motion.div
                        key={i}
                        animate={{
                            width: i === activeIndex ? 24 : 8,
                            backgroundColor: i === activeIndex ? '#6366f1' : 'rgba(0,0,0,0.1)'
                        }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        style={{ height: 8, borderRadius: 4, cursor: 'pointer' }}
                        onClick={() => setActiveIndex(i)}
                    />
                ))}
            </div>
        </div>
    );
};

// ── Task Progress Ring ──
const TaskProgressRing: React.FC<{ completed: number; total: number }> = ({ completed, total }) => {
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div style={{ position: 'relative', width: 70, height: 70 }}>
            <svg width="70" height="70" viewBox="0 0 70 70" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="35" cy="35" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                <motion.circle
                    cx="35" cy="35" r={radius} fill="none"
                    stroke="url(#progressGrad)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                />
                <defs>
                    <linearGradient id="progressGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                </defs>
            </svg>
            <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.85rem', fontWeight: 700, color: 'white'
            }}>
                {percentage}%
            </div>
        </div>
    );
};

// ── Stat Row Item ──
const TodayCalendarCard: React.FC<{ now: Date; onClick?: () => void; isMobile: boolean; dark: boolean }> = ({ now, onClick, isMobile, dark }) => {
    if (isMobile) {
        return (
            <motion.button type="button" initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.32, ease: 'easeOut' }} onClick={onClick} style={{ border: '1px solid rgba(255,255,255,0.1)', cursor: onClick ? 'pointer' : 'default', borderRadius: '22px', padding: '0.9rem 1rem', width: '100%', background: dark ? 'linear-gradient(135deg, rgba(79, 70, 229, 0.42) 0%, rgba(190, 24, 93, 0.32) 100%)' : 'linear-gradient(135deg, rgba(139, 92, 246, 0.96) 0%, rgba(236, 72, 153, 0.92) 100%)', boxShadow: dark ? '0 18px 36px rgba(2, 6, 23, 0.34)' : '0 16px 34px rgba(99, 102, 241, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.9rem', color: 'white', textAlign: 'left', overflow: 'hidden', position: 'relative', backdropFilter: 'blur(18px)' }}>
                <div aria-hidden style={{ position: 'absolute', right: '-18px', top: '-16px', width: '84px', height: '84px', borderRadius: '999px', background: dark ? 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 72%)' : 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 72%)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', position: 'relative', zIndex: 1 }}>
                    <div style={{ minWidth: '54px', height: '54px', borderRadius: '18px', background: 'rgba(255,255,255,0.14)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, lineHeight: 1 }}>{format(now, 'd')}</div>
                        <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', opacity: 0.9 }}>{format(now, 'EEE').toUpperCase()}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.82 }}>{format(now, 'EEEE')}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, marginTop: '0.18rem' }}>{format(now, 'MMMM d')}</div>
                        <div style={{ fontSize: '0.78rem', opacity: 0.8, marginTop: '0.16rem' }}>Open calendar</div>
                    </div>
                </div>
                <ChevronRight size={18} color="rgba(255,255,255,0.92)" style={{ position: 'relative', zIndex: 1, flexShrink: 0 }} />
            </motion.button>
        );
    }

    return (
        <motion.button type="button" initial={{ opacity: 0, scale: 0.92, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} whileHover={{ y: -4, scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.4, ease: 'easeOut' }} onClick={onClick} style={{ border: '1px solid rgba(255,255,255,0.12)', cursor: onClick ? 'pointer' : 'default', borderRadius: '28px', padding: 0, minWidth: '152px', background: dark ? 'linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.84) 100%)' : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,247,255,0.96) 100%)', boxShadow: dark ? '0 22px 44px rgba(2, 6, 23, 0.34)' : '0 16px 36px rgba(99, 102, 241, 0.14)', display: 'flex', flexDirection: 'column', alignItems: 'stretch', position: 'relative', overflow: 'hidden', backdropFilter: 'blur(18px)' }}>
            <motion.div aria-hidden animate={{ opacity: [0.32, 0.6, 0.32], scale: [1, 1.04, 1] }} transition={{ duration: 4.6, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', right: '-16px', top: '-12px', width: '92px', height: '92px', borderRadius: '999px', background: dark ? 'radial-gradient(circle, rgba(244, 114, 182, 0.18) 0%, transparent 72%)' : 'radial-gradient(circle, rgba(254, 205, 211, 0.48) 0%, transparent 72%)' }} />
            <div style={{ position: 'relative', padding: '0.82rem 1rem 0.96rem 1rem', background: dark ? 'linear-gradient(135deg, rgba(79, 70, 229, 0.52) 0%, rgba(190, 24, 93, 0.42) 100%)' : 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', color: 'white', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                    <div>
                        <div style={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.9 }}>{format(now, 'EEEE')}</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '0.2rem', opacity: 0.92 }}>{format(now, 'MMMM')}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>{[0, 1].map((ring) => (<span key={ring} style={{ width: '10px', height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.9)' }} />))}</div>
                </div>
            </div>
            <div style={{ padding: '1rem 1.1rem 1.12rem 1.1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.28rem', position: 'relative' }}>
                <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 2.3, repeat: Infinity, ease: 'easeInOut' }} style={{ fontSize: '2.8rem', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.08em', color: dark ? '#f8fafc' : '#1f2a44' }}>{format(now, 'd')}</motion.div>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: dark ? 'rgba(226,232,240,0.7)' : '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{format(now, 'EEE')}</div>
                <div style={{ marginTop: '0.35rem', padding: '0.34rem 0.7rem', borderRadius: '999px', background: dark ? 'rgba(99, 102, 241, 0.18)' : 'linear-gradient(135deg, rgba(219, 234, 254, 0.95), rgba(254, 226, 226, 0.9))', color: dark ? '#c7d2fe' : '#4f46e5', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.04em' }}>Open calendar</div>
            </div>
        </motion.button>
    );
};

const QuickLinkCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    accent: string;
    onClick?: () => void;
    dark?: boolean;
}> = ({ icon, title, subtitle, accent, onClick, dark = false }) => {
    return (
        <motion.button
            type="button"
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            style={{
                width: '100%',
                border: dark ? '1px solid rgba(148,163,184,0.12)' : '1px solid rgba(255,255,255,0.5)',
                borderRadius: '20px',
                padding: '0.9rem',
                background: dark ? 'linear-gradient(180deg, rgba(15,23,42,0.74) 0%, rgba(30,41,59,0.64) 100%)' : 'linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(246,248,255,0.94) 100%)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.8rem',
                textAlign: 'left',
                cursor: onClick ? 'pointer' : 'default',
                boxShadow: dark ? '0 16px 30px rgba(2,6,23,0.22)' : '0 12px 30px rgba(148, 163, 184, 0.1)',
                backdropFilter: 'blur(14px)'
            }}
        >
            <div style={{ width: 40, height: 40, borderRadius: '14px', background: `${accent}20`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.96rem', fontWeight: 800, color: dark ? '#f8fafc' : '#1f2a44', marginBottom: '0.14rem' }}>{title}</div>
                <div style={{ fontSize: '0.8rem', color: dark ? 'rgba(226,232,240,0.68)' : '#66758f', lineHeight: 1.45 }}>{subtitle}</div>
            </div>
            <ChevronRight size={16} color={dark ? 'rgba(226,232,240,0.4)' : '#94a3b8'} />
        </motion.button>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ notes, onNoteClick, onNewNote, onNewTask, onViewCalendar, onViewJournal, onViewTasks, onViewFavorites, onViewAI }) => {
    const { theme } = useThemeContext();
    const dark = theme === 'dark';
    const { username } = useAuth();
    const { getTodosByDate, toggleTodo, todos } = useTodos();
    const { dateKey, now } = useCurrentTime();
    const todayTasks = getTodosByDate(dateKey);
    const tomorrowStr = format(addDays(now, 1), 'yyyy-MM-dd');

    const totalNotes = notes.length;
    const favoriteCount = notes.filter(n => n.isFavorite).length;
    const completedToday = todayTasks.filter(t => t.completed).length;
    const pendingTasks = todos.filter(t => !t.completed && t.targetDate !== tomorrowStr && t.targetDate !== dateKey);
    const notesToday = notes.filter(note => format(new Date(note.createdAt), 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')).length;
    const focusTasks = todayTasks.slice(0, 4);
    const fallbackTasks = pendingTasks.slice(0, 4);
    const queueTasks = focusTasks.length > 0 ? focusTasks : fallbackTasks;
    const isUsingOldTasks = focusTasks.length === 0 && queueTasks.length > 0;
    const completionRatio = todayTasks.length > 0 ? Math.round((completedToday / todayTasks.length) * 100) : 0;
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const shellBg = dark
        ? 'linear-gradient(180deg, rgba(15,23,42,0.78) 0%, rgba(15,23,42,0.62) 100%)'
        : 'linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(247,249,255,0.94) 100%)';
    const shellBorder = dark ? '1px solid rgba(148,163,184,0.12)' : '1px solid rgba(255,255,255,0.45)';
    const shellShadow = dark ? '0 22px 48px rgba(2, 6, 23, 0.34)' : '0 18px 42px rgba(148, 163, 184, 0.08)';
    const muted = dark ? 'rgba(226,232,240,0.68)' : '#64748b';
    const title = dark ? '#f8fafc' : '#1f2a44';
    const softPanel = dark ? 'rgba(15,23,42,0.52)' : 'rgba(255,255,255,0.7)';

    return (
        <div className="fade-in dashboard-scrollbar" style={{ paddingBottom: '4rem', position: 'relative' }}>
            <div style={{
                maxWidth: isMobile ? '100%' : '940px',
                margin: '0 auto',
                padding: isMobile ? '0.9rem 1rem' : '2.2rem',
                paddingTop: isMobile ? 'calc(var(--safe-top) + 3rem)' : '3rem',
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: isMobile ? '0.85rem' : '1.1rem'
            }}>
                <motion.section
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.42 }}
                    style={{
                        borderRadius: isMobile ? '26px' : '30px',
                        padding: isMobile ? '1rem' : '1.3rem 1.4rem',
                        background: shellBg,
                        border: shellBorder,
                        boxShadow: shellShadow,
                        backdropFilter: 'blur(18px)'
                    }}
                >
                    <div style={{ fontSize: '0.76rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: muted, marginBottom: '0.55rem' }}>
                        Focus dashboard
                    </div>
                    <h1 style={{ margin: 0, fontSize: isMobile ? '1.95rem' : '2.9rem', fontWeight: 900, lineHeight: 1.04, color: 'var(--text-primary)', letterSpacing: '-0.05em' }}>
                        {getGreeting()}, <span style={{ background: 'linear-gradient(135deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{username ? username.charAt(0).toUpperCase() + username.slice(1) : 'there'}</span>
                    </h1>
                    <p style={{ margin: '0.62rem 0 0 0', color: 'var(--text-secondary)', fontSize: isMobile ? '0.92rem' : '0.98rem', lineHeight: 1.65, maxWidth: '38rem' }}>
                        Keep today work-first: current tasks, fast capture, and the notes you are most likely to open next.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, minmax(0, 1fr))' : 'repeat(3, minmax(0, 140px))', gap: '0.65rem', marginTop: '0.92rem' }}>
                        {[
                            ['Tasks', todayTasks.length, '#38bdf8'],
                            ['Done', completedToday, '#22c55e'],
                            ['Notes', totalNotes, '#818cf8'],
                        ].map(([labelText, value, color]) => (
                            <div key={String(labelText)} style={{ padding: isMobile ? '0.72rem' : '0.8rem 0.85rem', borderRadius: '18px', background: softPanel, border: dark ? '1px solid rgba(148,163,184,0.1)' : '1px solid rgba(255,255,255,0.48)' }}>
                                <div style={{ fontSize: '0.72rem', color: muted, fontWeight: 700, marginBottom: '0.24rem' }}>{labelText}</div>
                                <div style={{ fontSize: isMobile ? '1.15rem' : '1.3rem', fontWeight: 900, color: String(color) }}>{value}</div>
                            </div>
                        ))}
                    </div>
                </motion.section>

                {isMobile ? (
                    <>
                        <motion.section
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05, duration: 0.38 }}
                            style={{ borderRadius: '24px', padding: '1rem', background: shellBg, border: shellBorder, boxShadow: shellShadow, backdropFilter: 'blur(18px)' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', gap: '0.8rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: muted, marginBottom: '0.2rem' }}>Today</div>
                                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Work queue</h2>
                                </div>
                                <button onClick={onViewTasks} style={{ border: 'none', background: dark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.1)', color: dark ? '#c7d2fe' : '#6366f1', padding: '0.52rem 0.8rem', borderRadius: '999px', fontWeight: 700, cursor: 'pointer' }}>Open</button>
                            </div>
                            {queueTasks.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    {queueTasks.map((task) => (
                                        <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.82rem 0.9rem', borderRadius: '18px', background: softPanel, border: dark ? '1px solid rgba(148,163,184,0.08)' : '1px solid rgba(255,255,255,0.52)' }}>
                                            <button onClick={() => toggleTodo(task)} style={{ width: 22, height: 22, borderRadius: 8, flexShrink: 0, border: `2px solid ${task.completed ? '#22c55e' : 'rgba(148, 163, 184, 0.45)'}`, background: task.completed ? 'linear-gradient(135deg, #22c55e, #14b8a6)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                                                {task.completed && <Check size={11} color="white" strokeWidth={3} />}
                                            </button>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', textDecoration: task.completed ? 'line-through' : 'none', opacity: task.completed ? 0.58 : 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.text}</div>
                                                <div style={{ fontSize: '0.76rem', color: muted, marginTop: '0.14rem' }}>
                                                    {task.completed ? 'Completed' : (isUsingOldTasks ? 'Pending from backlog' : 'In focus today')}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ padding: '0.95rem', borderRadius: '18px', background: softPanel, color: 'var(--text-secondary)', lineHeight: 1.6 }}>No tasks scheduled for today or backlog.</div>
                            )}
                        </motion.section>

                        <TodayCalendarCard now={now} onClick={onViewCalendar} isMobile={true} dark={dark} />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <QuickLinkCard icon={<Plus size={18} />} title="New note" subtitle="Capture fast" accent="#818cf8" onClick={onNewNote} dark={dark} />
                            <QuickLinkCard icon={<CheckSquare size={18} />} title="New task" subtitle="Add today" accent="#22d3ee" onClick={onNewTask || onViewTasks} dark={dark} />
                            <QuickLinkCard icon={<Book size={18} />} title={`Notes (${totalNotes})`} subtitle="Open notes" accent="#6366f1" onClick={onViewJournal} dark={dark} />
                            <QuickLinkCard icon={<Star size={18} />} title={`Favorites (${favoriteCount})`} subtitle="Pinned notes" accent="#f59e0b" onClick={onViewFavorites} dark={dark} />
                        </div>
                    </>
                ) : (
                    <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) auto', gap: '1rem', alignItems: 'stretch' }}>
                        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.38 }} style={{ borderRadius: '28px', padding: '1.15rem', background: shellBg, border: shellBorder, boxShadow: shellShadow, backdropFilter: 'blur(18px)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.75rem' }}>
                                <QuickLinkCard icon={<Plus size={18} />} title="New note" subtitle="Capture a thought fast" accent="#6366f1" onClick={onNewNote} dark={dark} />
                                <QuickLinkCard icon={<CheckSquare size={18} />} title="New task" subtitle="Add work for today" accent="#06b6d4" onClick={onNewTask || onViewTasks} dark={dark} />
                                <QuickLinkCard icon={<CalendarIcon size={18} />} title="Calendar" subtitle="See the month clearly" accent="#22c55e" onClick={onViewCalendar} dark={dark} />
                                <QuickLinkCard icon={<Sparkles size={18} />} title="Akitsu" subtitle="Ask for help instantly" accent="#ec4899" onClick={onViewAI} dark={dark} />
                            </div>
                        </motion.section>
                        <TodayCalendarCard now={now} onClick={onViewCalendar} isMobile={false} dark={dark} />
                    </section>
                )}

                <section style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.24fr) minmax(280px, 0.96fr)', gap: '1rem' }}>
                    {!isMobile && (
                        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} style={{ borderRadius: '28px', padding: '1.15rem', background: shellBg, border: shellBorder, boxShadow: shellShadow, backdropFilter: 'blur(18px)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem', gap: '1rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.76rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: muted, marginBottom: '0.24rem' }}>Today</div>
                                    <h2 style={{ margin: 0, fontSize: '1.28rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Work queue</h2>
                                </div>
                                <button onClick={onViewTasks} style={{ border: 'none', background: dark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.1)', color: dark ? '#c7d2fe' : '#6366f1', padding: '0.56rem 0.84rem', borderRadius: '999px', fontWeight: 700, cursor: 'pointer' }}>Open tasks</button>
                            </div>
                            {queueTasks.length > 0 ? (
                                <div className="dashboard-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '340px', overflowY: 'auto' }}>
                                    {queueTasks.map((task, index) => (
                                        <motion.div key={task.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.16 + index * 0.05 }} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.9rem 1rem', borderRadius: '20px', background: softPanel, border: dark ? '1px solid rgba(148,163,184,0.08)' : '1px solid rgba(255,255,255,0.55)' }}>
                                            <button onClick={() => toggleTodo(task)} style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, border: `2px solid ${task.completed ? '#22c55e' : 'rgba(148, 163, 184, 0.45)'}`, background: task.completed ? 'linear-gradient(135deg, #22c55e, #14b8a6)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                                                {task.completed && <Check size={12} color="white" strokeWidth={3} />}
                                            </button>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', textDecoration: task.completed ? 'line-through' : 'none', opacity: task.completed ? 0.55 : 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.text}</div>
                                                <div style={{ fontSize: '0.78rem', color: muted, marginTop: '0.18rem' }}>
                                                    {task.completed ? 'Completed' : (isUsingOldTasks ? 'Pending from backlog' : 'In focus today')}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ padding: '1rem', borderRadius: '20px', background: softPanel, color: 'var(--text-secondary)', lineHeight: 1.65 }}>No tasks scheduled for today or backlog.</div>
                            )}
                        </motion.section>
                    )}

                    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.4 }} style={{ borderRadius: isMobile ? '24px' : '28px', padding: isMobile ? '1rem' : '1.15rem', background: dark ? 'linear-gradient(155deg, rgba(30,41,59,0.74) 0%, rgba(15,23,42,0.76) 100%)' : 'linear-gradient(155deg, rgba(240,249,255,0.88) 0%, rgba(250,245,255,0.92) 52%, rgba(255,247,237,0.9) 100%)', border: shellBorder, boxShadow: shellShadow, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto minmax(0, 1fr)', gap: '1rem', alignItems: 'center', backdropFilter: 'blur(18px)' }}>
                        <TaskProgressRing completed={completedToday} total={todayTasks.length || 1} />
                        <div>
                            <div style={{ fontSize: '0.76rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: muted, marginBottom: '0.35rem' }}>Today at a glance</div>
                            <div style={{ fontSize: isMobile ? '1.12rem' : '1.32rem', fontWeight: 900, color: title, letterSpacing: '-0.03em', marginBottom: '0.72rem' }}>
                                {todayTasks.length > 0 ? `${completionRatio}% of today's work is complete` : 'You have a clean slate today'}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: '0.7rem' }}>
                                {[
                                    ['Today tasks', todayTasks.length, '#38bdf8'],
                                    ['Completed', completedToday, '#22c55e'],
                                    ['Notes today', notesToday, '#818cf8'],
                                    ['Backlog', pendingTasks.length, '#f97316'],
                                ].map(([labelText, value, color]) => (
                                    <div key={String(labelText)} style={{ padding: '0.8rem 0.85rem', borderRadius: '18px', background: softPanel, border: dark ? '1px solid rgba(148,163,184,0.08)' : '1px solid rgba(255,255,255,0.55)' }}>
                                        <div style={{ fontSize: '0.74rem', color: muted, marginBottom: '0.28rem', fontWeight: 700 }}>{labelText}</div>
                                        <div style={{ fontSize: '1.18rem', fontWeight: 900, color: String(color) }}>{value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.section>

                    {!isMobile && (
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.4 }} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            <QuickLinkCard icon={<Book size={18} />} title={`Notes (${totalNotes})`} subtitle="Browse your writing and recent entries" accent="#6366f1" onClick={onViewJournal} dark={dark} />
                            <QuickLinkCard icon={<Star size={18} />} title={`Favorites (${favoriteCount})`} subtitle="Open the notes you revisit most" accent="#f59e0b" onClick={onViewFavorites} dark={dark} />
                            <QuickLinkCard icon={<CalendarIcon size={18} />} title="Calendar view" subtitle="See time, plans, and note history" accent="#22c55e" onClick={onViewCalendar} dark={dark} />
                        </motion.div>
                    )}
                </section>

                <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }} style={{ borderRadius: isMobile ? '24px' : '28px', padding: isMobile ? '1rem' : '1.15rem', background: shellBg, border: shellBorder, boxShadow: shellShadow, backdropFilter: 'blur(18px)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', gap: '1rem', flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontSize: '0.76rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: muted, marginBottom: '0.24rem' }}>Notes</div>
                            <h2 style={{ margin: 0, fontSize: isMobile ? '1.16rem' : '1.3rem', fontWeight: 900, color: title, letterSpacing: '-0.03em' }}>Recent writing</h2>
                        </div>
                        <button onClick={onNewNote} style={{ border: 'none', background: dark ? 'linear-gradient(135deg, rgba(99,102,241,0.95), rgba(168,85,247,0.9))' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', padding: '0.66rem 0.94rem', borderRadius: '999px', fontWeight: 800, cursor: 'pointer' }}>New journal entry</button>
                    </div>
                    <NoteCarousel notes={notes} onNoteClick={onNoteClick} />
                </motion.section>
            </div>
        </div>
    );
};
