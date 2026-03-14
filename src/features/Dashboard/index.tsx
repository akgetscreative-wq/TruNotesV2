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
    onViewNotebooks?: () => void;
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
                                        {format(new Date(note.updatedAt), 'MMM d')}
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
const StatRow: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color: string;
    onClick?: () => void;
    delay?: number;
}> = ({ icon, label, value, color, onClick, delay = 0 }) => {
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay, duration: 0.4, ease: 'easeOut' }}
            onClick={onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.9rem 1rem',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.06)',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'background 0.2s'
            }}
        >
            <div style={{
                width: 40, height: 40,
                borderRadius: '12px',
                background: `${color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
            }}>
                {icon}
            </div>
            <span style={{ flex: 1, fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                {label}
            </span>
            <span style={{
                fontSize: '1rem', fontWeight: 700,
                background: `${color}25`,
                color: color,
                padding: '0.2rem 0.65rem',
                borderRadius: '10px',
                minWidth: '28px',
                textAlign: 'center'
            }}>
                {value}
            </span>
            {onClick && <ChevronRight size={16} color="var(--text-muted)" />}
        </motion.div>
    );
};

// ── Main Dashboard ──
export const Dashboard: React.FC<DashboardProps> = ({ notes, onNoteClick, onNewNote, onNewTask, onViewCalendar, onViewJournal, onViewTasks, onViewFavorites, onViewAI, onViewNotebooks }) => {
    const { theme } = useThemeContext();
    const { username } = useAuth();
    const { getTodosByDate, toggleTodo, todos } = useTodos();
    const { dateKey, now } = useCurrentTime();
    const todayTasks = getTodosByDate(dateKey);
    const tomorrowStr = format(addDays(now, 1), 'yyyy-MM-dd');

    const totalNotes = notes.length;
    const favoriteCount = notes.filter(n => n.isFavorite).length;
    const completedToday = todayTasks.filter(t => t.completed).length;
    const pendingTasks = todos.filter(t => !t.completed && t.targetDate !== tomorrowStr && t.targetDate !== dateKey);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const getEmoji = () => {
        const hour = new Date().getHours();
        if (hour < 12) return '☀️';
        if (hour < 18) return '🌤️';
        return '🌃';
    };

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    return (
        <div className="fade-in dashboard-scrollbar" style={{ paddingBottom: '4rem', position: 'relative' }}>
            <div style={{
                maxWidth: isMobile ? '100%' : '720px',
                margin: '0 auto',
                padding: isMobile ? '1rem 1.15rem' : '2rem',
                paddingTop: isMobile ? 'calc(var(--safe-top) + 3rem)' : '3rem',
                position: 'relative',
                zIndex: 1,
            }}>
                {/* ── Header ── */}
                <motion.div
                    initial={{ opacity: 0, y: -15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                    <h1 style={{
                        fontSize: isMobile ? '2rem' : '2.8rem',
                        fontWeight: 800,
                        lineHeight: 1.15,
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.03em',
                    }}>
                        {getGreeting()},
                        <br />
                        <span style={{
                            background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>
                            {username ? username.charAt(0).toUpperCase() + username.slice(1) : 'there'}
                        </span>{' '}{getEmoji()}
                    </h1>

                    <div style={{ display: 'flex', gap: isMobile ? '0.5rem' : '1rem', alignItems: 'center' }}>
                        <motion.button
                            whileHover={{ scale: 1.05, boxShadow: '0 12px 30px rgba(6, 182, 212, 0.4)' }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onNewTask || onViewTasks}
                            style={{
                                background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                                border: 'none',
                                borderRadius: '24px',
                                padding: isMobile ? '1rem 1.25rem' : '1.5rem 2.2rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                boxShadow: '0 8px 24px rgba(6, 182, 212, 0.3)',
                                color: 'white',
                                height: 'fit-content'
                            }}
                        >
                            <Plus size={isMobile ? 24 : 32} />
                            <span style={{
                                fontSize: isMobile ? '0.85rem' : '1rem',
                                fontWeight: 800,
                                letterSpacing: '0.02em',
                                textTransform: 'uppercase'
                            }}>
                                Todo
                            </span>
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.05, boxShadow: '0 12px 30px rgba(139, 92, 246, 0.4)' }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onViewAI}
                            style={{
                                background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                                border: 'none',
                                borderRadius: '24px',
                                padding: isMobile ? '1rem 1.25rem' : '1.5rem 2.2rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                boxShadow: '0 8px 24px rgba(236,72,153,0.3)',
                                color: 'white',
                                height: 'fit-content'
                            }}
                        >
                            <Sparkles size={isMobile ? 24 : 32} fill="rgba(255,255,255,0.2)" />
                            <span style={{
                                fontSize: isMobile ? '0.85rem' : '1rem',
                                fontWeight: 800,
                                letterSpacing: '0.02em',
                                textTransform: 'uppercase'
                            }}>
                                Akitsu
                            </span>
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.05, boxShadow: '0 12px 30px rgba(168, 85, 247, 0.4)' }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onViewNotebooks}
                            style={{
                                background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                                border: 'none',
                                borderRadius: '24px',
                                padding: isMobile ? '1rem 1.25rem' : '1.5rem 2.2rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                boxShadow: '0 8px 24px rgba(168, 85, 247, 0.3)',
                                color: 'white',
                                height: 'fit-content'
                            }}
                        >
                            <Book size={isMobile ? 24 : 32} />
                            <span style={{
                                fontSize: isMobile ? '0.85rem' : '1rem',
                                fontWeight: 800,
                                letterSpacing: '0.02em',
                                textTransform: 'uppercase'
                            }}>
                                Books
                            </span>
                        </motion.button>
                    </div>
                </motion.div>

                {/* ── Recent Notes Carousel ── */}
                <NoteCarousel notes={notes} onNoteClick={onNoteClick} />

                {/* ── Task Progress Card ── */}
                {todayTasks.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        onClick={onViewTasks}
                        style={{
                            background: theme === 'dark'
                                ? 'linear-gradient(135deg, rgba(16, 36, 44, 0.9), rgba(20, 44, 38, 0.8))'
                                : 'linear-gradient(135deg, rgba(240, 250, 255, 0.9), rgba(240, 255, 250, 0.8))',
                            borderRadius: '20px',
                            padding: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            marginBottom: '1.5rem',
                            border: '1px solid rgba(14, 165, 233, 0.15)',
                            cursor: 'pointer',
                            boxShadow: '0 8px 32px rgba(14, 165, 233, 0.12)'
                        }}
                    >
                        <TaskProgressRing completed={completedToday} total={todayTasks.length} />
                        <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                                Today's Progress
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {completedToday}/{todayTasks.length} todos completed
                            </p>
                            {/* mini progress bar */}
                            <div style={{
                                marginTop: '0.5rem',
                                height: 6,
                                borderRadius: 3,
                                background: 'rgba(255,255,255,0.08)',
                                overflow: 'hidden'
                            }}>
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${todayTasks.length > 0 ? (completedToday / todayTasks.length) * 100 : 0}%` }}
                                    transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
                                    style={{
                                        height: '100%',
                                        borderRadius: 3,
                                        background: 'linear-gradient(90deg, #0ea5e9, #22c55e)'
                                    }}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ── Stats Row ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.75rem' }}>
                    <StatRow
                        icon={<Book size={20} color="#6366f1" />}
                        label="Total Notes"
                        value={totalNotes}
                        color="#6366f1"
                        onClick={onViewJournal}
                        delay={0.15}
                    />
                    <StatRow
                        icon={<Star size={20} color="#f59e0b" />}
                        label="Favorites"
                        value={favoriteCount}
                        color="#f59e0b"
                        onClick={onViewFavorites}
                        delay={0.25}
                    />
                    <StatRow
                        icon={<CalendarIcon size={20} color="#22c55e" />}
                        label="Calendar"
                        value="→"
                        color="#22c55e"
                        onClick={onViewCalendar}
                        delay={0.35}
                    />
                    {pendingTasks.length > 0 && (
                        <StatRow
                            icon={<CheckSquare size={20} color="#ef4444" />}
                            label="Pending Todos"
                            value={pendingTasks.length}
                            color="#ef4444"
                            onClick={onViewTasks}
                            delay={0.45}
                        />
                    )}
                </div>

                {/* ── Today's Tasks (Inline) ── */}
                {todayTasks.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.5 }}
                        style={{ marginBottom: '1.75rem' }}
                    >
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            marginBottom: '0.75rem'
                        }}>
                            <h2 style={{
                                fontSize: '1.15rem', fontWeight: 700,
                                color: 'var(--text-primary)',
                                display: 'flex', alignItems: 'center', gap: '0.5rem'
                            }}>
                                <CheckSquare size={18} color="#a855f7" /> Today's Todos
                            </h2>
                            <span
                                onClick={onViewTasks}
                                style={{
                                    fontSize: '0.8rem', color: '#a855f7', cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                See All
                            </span>
                        </div>

                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: '0.5rem',
                            maxHeight: '260px', overflowY: 'auto'
                        }} className="dashboard-scrollbar">
                            {todayTasks.map((task, i) => (
                                <motion.div
                                    key={task.id}
                                    initial={{ opacity: 0, x: -15 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.5 + i * 0.05 }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                                        padding: '0.75rem 1rem',
                                        background: 'rgba(255,255,255,0.04)',
                                        borderRadius: '14px',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                    }}
                                >
                                    <button
                                        onClick={() => toggleTodo(task)}
                                        style={{
                                            width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                                            border: `2px solid ${task.completed ? '#a855f7' : 'rgba(255,255,255,0.2)'}`,
                                            background: task.completed ? 'linear-gradient(135deg, #a855f7, #ec4899)' : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', padding: 0
                                        }}
                                    >
                                        {task.completed && <Check size={12} color="white" strokeWidth={3} />}
                                    </button>
                                    <span style={{
                                        fontSize: '0.9rem', color: 'var(--text-primary)', flex: 1,
                                        textDecoration: task.completed ? 'line-through' : 'none',
                                        opacity: task.completed ? 0.5 : 1,
                                        wordBreak: 'break-word'
                                    }}>
                                        {task.text}
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ── Quick Actions ── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55, duration: 0.5 }}
                    style={{
                        marginBottom: '2rem'
                    }}
                >
                    <button
                        onClick={onNewNote}
                        style={{
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            border: 'none',
                            borderRadius: '16px',
                            padding: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.75rem',
                            cursor: 'pointer',
                            boxShadow: '0 8px 24px rgba(99,102,241,0.25)',
                            width: '100%'
                        }}
                    >
                        <Plus size={24} color="white" />
                        <span style={{ fontSize: '1rem', fontWeight: 600, color: 'white' }}>New Journal Entry</span>
                    </button>
                </motion.div>
            </div>
        </div>
    );
};
