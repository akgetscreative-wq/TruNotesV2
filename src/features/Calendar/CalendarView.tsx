import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useTransform, useMotionValue } from 'framer-motion';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getHours, getDay, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, X, CheckSquare, Square, Star, Clock } from 'lucide-react';
import type { Note, Todo } from '../../types';
import { useTodos } from '../../hooks/useTodos';
import { useTheme } from '../../hooks/useTheme';
import { calendarBackgrounds } from '../../assets/calendar_backgrounds';
import { getCalendarBackgroundPath } from '../../utils/assetLoader';
import { HourlyLog } from '../HourlyLog/HourlyLog';
import { useHourlyLog } from '../../hooks/useHourlyLog';

interface CalendarProps {
    notes: Note[];
    onNoteClick: (note: Note) => void;
    resetTrigger?: number;
}

// Helper for monthly images
// Helper removed in favor of async loader hook/effect
// const getMonthBackground = ...

export const CalendarView: React.FC<CalendarProps> = ({ notes, onNoteClick, resetTrigger }) => {
    const { todos, toggleTodo } = useTodos(); // Fetch todos
    const [currentDate, setCurrentDate] = useState(new Date());
    // Use the statically imported image as initial state for instant loading
    const [monthBg, setMonthBg] = useState<string>(calendarBackgrounds[currentDate.getMonth() + 1]);

    // Update background when month changes (Instant fallback + Async custom check)
    useEffect(() => {
        const month = currentDate.getMonth() + 1;
        // 1. Set static immediately to prevent blank screen
        setMonthBg(calendarBackgrounds[month]);

        // 2. Check for external customized background (Async)
        let isMounted = true;
        const loadBg = async () => {
            try {
                const bg = await getCalendarBackgroundPath(month);
                if (isMounted) setMonthBg(bg);
            } catch (err) {
                console.error("Failed to load calendar background", err);
            }
        };
        loadBg();
        return () => { isMounted = false; };
    }, [currentDate]);

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const { theme } = useTheme();
    const [focusedNote, setFocusedNote] = useState<Note | null>(null);
    const [showHourlyLog, setShowHourlyLog] = useState(false);

    // Watch for reset trigger
    useEffect(() => {
        if (resetTrigger && resetTrigger > 0) {
            setSelectedDate(null);
            setFocusedNote(null);
        }
    }, [resetTrigger]);

    const handleNotePopup = (note: Note, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setFocusedNote(note);
    };

    const { days, startPadding } = useMemo(() => {
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);
        const days = eachDayOfInterval({ start, end });
        const startPadding = getDay(start);
        return { days, startPadding };
    }, [currentDate]);

    const notesByDate = useMemo(() => {
        const map = new Map<string, Note[]>();
        notes.forEach(note => {
            const dateKey = new Date(note.createdAt).toDateString();
            if (!map.has(dateKey)) map.set(dateKey, []);
            map.get(dateKey)?.push(note);
        });
        return map;
    }, [notes]);

    const todosByDate = useMemo(() => {
        const map = new Map<string, Todo[]>();
        todos.forEach(todo => {
            if (!todo.targetDate || typeof todo.targetDate !== 'string') return;

            const parts = todo.targetDate.split('-');
            if (parts.length !== 3) return;

            const [y, m, d] = parts.map(Number);
            const dateObj = new Date(y, m - 1, d);
            if (isNaN(dateObj.getTime())) return;

            const dateKey = dateObj.toDateString();

            if (!map.has(dateKey)) map.set(dateKey, []);
            map.get(dateKey)?.push(todo);
        });
        return map;
    }, [todos]);

    const favoriteNotesThisMonth = useMemo(() => {
        return notes.filter(note => {
            if (!note.isFavorite) return false;
            const date = new Date(note.createdAt);
            return date.getMonth() === currentDate.getMonth() &&
                date.getFullYear() === currentDate.getFullYear();
        });
    }, [notes, currentDate]);

    const changeMonth = (delta: number) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setCurrentDate(newDate);
    };

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    // Minimum distance for swipe
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null); // otherwise the swipe is fired even with usual touch events
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;
        if (isLeftSwipe) {
            changeMonth(1); // Inverted per request: Left swipe -> Prev
        }
        if (isRightSwipe) {
            changeMonth(-1); // Inverted per request: Right swipe -> Next
        }
    };

    return (
        <div className="fade-in" style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
            {/* Global Fixed Background Layer - Monthly Image */}
            <div style={{
                position: 'fixed',
                inset: 0,
                zIndex: -1,
                pointerEvents: 'none',
                overflow: 'hidden'
            }}>
                {/* 1. The Real Monthly Image */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `url(${monthBg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    transition: 'background-image 0.8s ease'
                }} />

                {/* 2. Theme Overlay Scrim (Blur + Color) */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: theme === 'dark'
                        ? 'linear-gradient(rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.8))'
                        : 'linear-gradient(rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.6))',
                    backdropFilter: 'blur(0px)', // High blur for global atmosphere
                    transition: 'background 0.5s ease'
                }} />

                {/* 3. Ambient Blobs (Matches Todo Tab) */}
                <div style={{
                    position: 'absolute',
                    top: '10%',
                    right: '10%',
                    width: isMobile ? '200px' : '400px',
                    height: isMobile ? '200px' : '400px',
                    background: theme === 'dark' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                    filter: 'blur(80px)',
                    borderRadius: '50%',
                    transform: 'translateZ(0)'
                }} />
                <div style={{
                    position: 'absolute',
                    bottom: '10%',
                    left: '5%',
                    width: isMobile ? '250px' : '500px',
                    height: isMobile ? '250px' : '500px',
                    background: theme === 'dark' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                    filter: 'blur(100px)',
                    borderRadius: '50%',
                    transform: 'translateZ(0)'
                }} />
            </div>

            <AnimatePresence mode="popLayout">
                {!selectedDate ? (
                    <motion.div
                        key="calendar"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                        style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: isMobile ? '0.5rem' : '1rem', overflowY: 'auto' }}
                    >
                        <header style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: isMobile ? '1rem' : '1.5rem',
                            maxWidth: '900px',
                            margin: isMobile ? '3rem auto 1rem auto' : '0 auto 1.5rem auto', // 3rem top on mobile for hamburger
                            width: '100%',
                            padding: isMobile ? '0 0.5rem' : '0'
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <h2 style={{ fontSize: isMobile ? '1.4rem' : '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{format(currentDate, 'MMMM yyyy')}</h2>
                                <span style={{ fontSize: isMobile ? '0.8rem' : '0.95rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '0.2rem' }}>
                                    Today: {format(new Date(), 'EEEE, MMM do')}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => changeMonth(-1)} style={{ padding: isMobile ? '0.3rem' : '0.4rem', borderRadius: '50%', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                                    <ChevronLeft size={isMobile ? 18 : 20} />
                                </button>
                                <button onClick={() => changeMonth(1)} style={{ padding: isMobile ? '0.3rem' : '0.4rem', borderRadius: '50%', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                                    <ChevronRight size={isMobile ? 18 : 20} />
                                </button>
                            </div>
                        </header>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(7, 1fr)',
                            gap: isMobile ? '4px' : '0.5rem',
                            padding: isMobile ? '0.5rem' : '1rem',
                            background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)',
                            backdropFilter: 'blur(3px)',
                            borderRadius: '20px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: 'var(--shadow-medium)',
                            perspective: '1000px',
                            maxWidth: '900px',
                            margin: '0 auto',
                            width: '100%'
                        }}>
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, paddingBottom: '0.5rem', fontSize: isMobile ? '0.65rem' : '0.85rem' }}>
                                    {isMobile ? day.substring(0, 1) : day}
                                </div>
                            ))}

                            {Array.from({ length: startPadding }).map((_, i) => (
                                <div key={`empty-${i}`} />
                            ))}

                            {days.map(day => {
                                const dateKey = day.toDateString();
                                const dayNotes = notesByDate.get(dateKey) || [];
                                const dayTodos = todosByDate.get(dateKey) || [];
                                const hasNotes = dayNotes.length > 0;
                                const hasTodos = dayTodos.length > 0;

                                return (
                                    <GlassDateCell
                                        key={day.toISOString()}
                                        day={day}
                                        hasNotes={hasNotes}
                                        hasTodos={hasTodos}
                                        dayNotes={dayNotes}
                                        dayTodos={dayTodos}
                                        isMobile={isMobile}
                                        onClick={() => setSelectedDate(day)}
                                    />
                                );
                            })}
                        </div>

                        {/* Month's Favourites for Mobile */}
                        {isMobile && (
                            <div style={{
                                marginTop: '2.5rem',
                                padding: '0 0.5rem 1.5rem 0.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <div style={{ padding: '0.4rem', borderRadius: '10px', background: '#fffbeb', display: 'flex' }}>
                                        <Star size={18} fill="#f59e0b" color="#f59e0b" />
                                    </div>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Month's Favourites</h3>
                                </div>

                                {favoriteNotesThisMonth.length > 0 ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '1rem' }}>
                                        {favoriteNotesThisMonth.map(note => (
                                            <motion.div
                                                key={note.id}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => onNoteClick(note)}
                                                className={`note-color-${note.color || 'default'}`}
                                                style={{
                                                    padding: '1.25rem',
                                                    borderRadius: '20px',
                                                    background: 'rgba(255, 255, 255, 0.4)',
                                                    backdropFilter: 'blur(10px)',
                                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                                    boxShadow: 'var(--shadow-soft)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '0.5rem',
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--accent-primary)', opacity: 0.6 }} />
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{note.title}</h4>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{format(new Date(note.createdAt), 'MMM d')}</span>
                                                </div>
                                                <p style={{
                                                    fontSize: '0.85rem',
                                                    color: 'var(--text-secondary)',
                                                    margin: 0,
                                                    lineHeight: 1.4,
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden'
                                                }}>
                                                    {note.content.replace(/<[^>]*>/g, '').substring(0, 100)}...
                                                </p>
                                            </motion.div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: '2.5rem 1.5rem',
                                        color: 'var(--text-muted)',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        borderRadius: '24px',
                                        border: '1.5px dashed rgba(255, 255, 255, 0.2)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}>
                                        <Star size={24} color="var(--text-muted)" opacity={0.3} />
                                        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>No favorites marked for this month yet.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <TimelineView
                        key="timeline"
                        date={selectedDate}
                        notes={notesByDate.get(selectedDate.toDateString()) || []}
                        todos={todosByDate.get(selectedDate.toDateString()) || []}
                        onClose={() => setSelectedDate(null)}
                        onNoteClick={handleNotePopup}
                        onDirectEdit={onNoteClick}
                        onNext={() => setSelectedDate(addDays(selectedDate, 1))}
                        onPrev={() => setSelectedDate(addDays(selectedDate, -1))}
                        focusedNote={focusedNote}
                        setFocusedNote={setFocusedNote}
                        onToggleTodo={toggleTodo}
                        onHourlyClick={() => setShowHourlyLog(true)}
                        isMobile={isMobile}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showHourlyLog && selectedDate && (
                    <HourlyLog date={selectedDate} onClose={() => setShowHourlyLog(false)} />
                )}
            </AnimatePresence>
        </div>
    );
};

const GlassDateCell: React.FC<{
    day: Date;
    hasNotes: boolean;
    hasTodos: boolean;
    dayNotes: Note[];
    dayTodos: Todo[];
    isMobile: boolean;
    onClick: () => void
}> = ({ day, hasNotes, hasTodos, dayNotes, dayTodos, isMobile, onClick }) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotateX = useTransform(y, [-50, 50], [10, -10]);
    const rotateY = useTransform(x, [-50, 50], [-10, 10]);
    const { theme } = useTheme();

    function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
        if (isMobile) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        x.set(event.clientX - centerX);
        y.set(event.clientY - centerY);
    }

    const isSunday = getDay(day) === 0;

    return (
        <motion.div
            onClick={onClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => { x.set(0); y.set(0); }}
            style={{
                rotateX,
                rotateY,
                transformStyle: 'preserve-3d',
                aspectRatio: '1',
                borderRadius: isMobile ? '8px' : '16px',
                background: theme === 'dark'
                    ? 'rgba(30, 238, 245, 0.15)'
                    : 'rgba(255, 255, 255, 0.73)',
                backdropFilter: 'blur(12px)',
                border: theme === 'dark'
                    ? '1px solid rgba(255, 255, 255, 0.1)'
                    : '1px solid rgba(255, 255, 255, 0.6)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                color: 'var(--text-primary)',
                boxShadow: theme === 'dark'
                    ? '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                    : '0 4px 20px -5px rgba(0, 150, 136, 0.1)'
            }}
            whileHover={!isMobile ? {
                scale: 1.04,
                zIndex: 10,
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25), 0 0 30px rgba(6, 182, 212, 0.6), inset 0 0 20px rgba(165, 243, 252, 0.4)',
                borderColor: 'rgba(167, 243, 255, 0.8)',
                background: theme === 'dark'
                    ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.88), rgba(151, 253, 241, 0.17))'
                    : 'linear-gradient(135deg, #FFFFFF 0%, #e3f9f9ff 100%)'
            } : {}}
            whileTap={{ scale: 0.95 }}
        >
            {/* Sunday Pink Label */}
            {isSunday && (
                <div style={{
                    position: 'absolute',
                    left: isMobile ? '4px' : '8px',
                    top: isMobile ? '6px' : '12px',
                    bottom: isMobile ? '6px' : '12px',
                    width: isMobile ? '2px' : '3px',
                    borderRadius: '4px',
                    background: '#f472b6ff',
                    boxShadow: '0 0 8px rgba(244, 114, 182, 0.4)'
                }} />
            )}

            <div style={{ transform: 'translateZ(20px)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: isMobile ? '1.5rem' : '3.5rem', fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1, color: 'var(--text-primary)' }}>
                    {format(day, 'd')}
                </span>
            </div>

            {hasNotes && (
                <div style={{ position: 'absolute', bottom: isMobile ? '4px' : '8px', display: 'flex', gap: '2px', transform: 'translateZ(10px)' }}>
                    {dayNotes.slice(0, isMobile ? 2 : 3).map((note, i) => (
                        <div key={i} style={{
                            width: isMobile ? '3px' : '4px', height: isMobile ? '3px' : '4px',
                            borderRadius: '50%',
                            background: note.color && note.color !== 'default'
                                ? `var(--note-accent)`
                                : 'var(--accent-primary)'
                        }} className={`note-color-${note.color || 'default'}`} />
                    ))}
                    {hasTodos && <div style={{ width: isMobile ? '3px' : '4px', height: isMobile ? '3px' : '4px', borderRadius: '1px', background: 'var(--text-muted)' }} />}
                </div>
            )}
            {!hasNotes && hasTodos && (
                <div style={{ position: 'absolute', bottom: isMobile ? '4px' : '8px', display: 'flex', gap: '2px', transform: 'translateZ(10px)' }}>
                    {dayTodos.slice(0, isMobile ? 2 : 3).map((_, i) => (
                        <div key={i} style={{ width: isMobile ? '3px' : '4px', height: isMobile ? '3px' : '4px', borderRadius: '1px', background: 'var(--text-muted)' }} />
                    ))}
                </div>
            )}
        </motion.div>
    );
};

const TimelineView: React.FC<{
    date: Date;
    notes: Note[];
    todos: Todo[];
    onClose: () => void;
    onNoteClick: (note: Note, e: React.MouseEvent) => void;
    onDirectEdit: (note: Note) => void;
    onNext: () => void;
    onPrev: () => void;
    focusedNote: Note | null;
    setFocusedNote: (note: Note | null) => void;
    onToggleTodo: (todo: Todo) => void;
    onHourlyClick: () => void;
    isMobile: boolean;
}> = ({ date, notes, todos, onClose, onNoteClick, onDirectEdit, onNext, onPrev, focusedNote, setFocusedNote, onToggleTodo, onHourlyClick, isMobile }) => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const containerRef = useRef<HTMLDivElement>(null);
    const { theme } = useTheme();
    const { logs, saveLog } = useHourlyLog(date);
    const [editingHour, setEditingHour] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');

    // -- Animation Logic --
    const prevDateRef = useRef(date);
    const [direction, setDirection] = useState(0);

    // Update direction when date changes
    if (date.getTime() !== prevDateRef.current.getTime()) {
        setDirection(date.getTime() > prevDateRef.current.getTime() ? 1 : -1);
        prevDateRef.current = date;
    }

    const slideVariants = {
        enter: (d: number) => ({ x: d > 0 ? 50 : -50, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (d: number) => ({ x: d > 0 ? -50 : 50, opacity: 0 })
    };

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
        }}>
            {/* 1. Monthly Background Layer (Synced with Month View) */}
            <div style={{
                position: 'fixed',
                inset: 0,
                zIndex: -1,
                pointerEvents: 'none',
                overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `url(${calendarBackgrounds[date.getMonth() + 1]})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'blur(20px) saturate(1.2)',
                    opacity: 0.9,
                    transition: 'opacity 0.5s ease'
                }} />
                {/* Darken/Lighten Overlays */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: theme === 'dark'
                        ? 'rgba(15, 23, 42, 0.6)'
                        : 'rgba(255, 255, 255, 0.3)',
                    transition: 'background 0.5s ease'
                }} />
            </div>

            {/* 2. Floating Glass Timeline Panel */}
            <div style={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'center',
                padding: '2rem 1rem 2rem 1rem',
                position: 'relative',
                zIndex: 1
            }}>
                <motion.div
                    // Main Container Animation (Entry from Month View)
                    initial={{ y: 50, opacity: 0 }}
                    animate={{
                        y: 0,
                        opacity: 1,
                        filter: focusedNote ? 'blur(10px) brightness(0.8)' : 'none',
                        scale: focusedNote ? 0.95 : 1
                    }}
                    exit={{ y: 50, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    style={{
                        width: '100%',
                        // maxWidth removed to fill width
                        background: theme === 'dark'
                            ? 'rgba(15, 23, 42, 0.4)' // More transparent
                            : 'rgba(255, 255, 255, 0.3)', // More transparent
                        backdropFilter: 'blur(25px) saturate(120%)',
                        borderRadius: '24px',
                        border: theme === 'dark'
                            ? '1px solid rgba(255, 255, 255, 0.1)'
                            : '1px solid rgba(255, 255, 255, 0.4)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        height: '100%',
                        color: theme === 'dark' ? '#f1f5f9' : '#1e293b'
                    }}
                >
                    {/* -- DATE CONTENT SLIDER -- */}
                    <AnimatePresence mode='popLayout' custom={direction} initial={false}>
                        <motion.div
                            key={date.toISOString()}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}
                        >
                            {/* Panel Header */}
                            <div style={{
                                padding: '1.5rem 2rem',
                                borderBottom: '1px solid rgba(0,0,0,0.05)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <button
                                        onClick={onPrev}
                                        style={{
                                            padding: '0.5rem',
                                            borderRadius: '50%',
                                            background: 'rgba(255,255,255,0.1)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            color: 'inherit',
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                    >
                                        <ChevronLeft size={20} />
                                    </button>

                                    <div>
                                        <h2 style={{
                                            fontSize: '2rem', fontWeight: 700,
                                            color: theme === 'dark' ? '#f8fafc' : '#1e293b',
                                            letterSpacing: '-0.02em',
                                            lineHeight: 1
                                        }}>
                                            {format(date, 'EEEE')}
                                        </h2>
                                        <p style={{
                                            color: theme === 'dark' ? '#94a3b8' : '#475569',
                                            fontWeight: 500,
                                            marginTop: '0.25rem'
                                        }}>
                                            {format(date, 'MMMM do, yyyy')}
                                        </p>
                                    </div>

                                    <button
                                        onClick={onNext}
                                        style={{
                                            padding: '0.5rem',
                                            borderRadius: '50%',
                                            background: 'rgba(255,255,255,0.1)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            color: 'inherit',
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <button
                                        onClick={onHourlyClick}
                                        style={{
                                            padding: '0.75rem',
                                            background: 'rgba(99, 102, 241, 0.1)',
                                            borderRadius: '50%',
                                            color: 'var(--accent-primary)',
                                            cursor: 'pointer',
                                            border: '1px solid rgba(99, 102, 241, 0.2)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                        title="View Hourly Journey"
                                    >
                                        <Clock size={20} />
                                    </button>
                                    <button
                                        onClick={() => onClose()}
                                        style={{
                                            padding: '0.75rem',
                                            background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.4)',
                                            borderRadius: '50%',
                                            color: 'inherit',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            border: '1px solid rgba(255,255,255,0.1)'
                                        }}
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Panel Content (Scrollable) */}
                            <div className="calendar-scrollbar" ref={containerRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 2rem 2rem 2rem' }}>

                                {/* Tasks Section */}
                                <div style={{
                                    marginBottom: '2rem',
                                    padding: '1rem',
                                    background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.5)',
                                    borderRadius: '16px',
                                    border: theme === 'dark' ? 'none' : '1px solid rgba(0,0,0,0.05)'
                                }}>
                                    <h3 style={{
                                        fontSize: '1rem',
                                        fontWeight: 600,
                                        color: theme === 'dark' ? 'var(--text-muted)' : '#475569',
                                        marginBottom: '1rem',
                                        display: 'flex', alignItems: 'center', gap: '0.5rem'
                                    }}>
                                        <CheckSquare size={16} /> Tasks
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {todos.map(todo => (
                                            <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <button
                                                    onClick={() => onToggleTodo(todo)}
                                                    style={{
                                                        cursor: 'pointer',
                                                        color: todo.completed
                                                            ? 'var(--accent-primary)'
                                                            : (theme === 'dark' ? 'var(--text-muted)' : '#475569'),
                                                        background: 'transparent',
                                                        border: 'none',
                                                        padding: 0,
                                                        display: 'flex'
                                                    }}
                                                >
                                                    {todo.completed ? <CheckSquare size={20} /> : <Square size={20} />}
                                                </button>
                                                <span style={{
                                                    fontSize: '1rem',
                                                    color: 'var(--text-primary)',
                                                    textDecoration: todo.completed ? 'line-through' : 'none',
                                                    opacity: todo.completed ? 0.6 : 1,
                                                    fontWeight: 500
                                                }}>
                                                    {todo.text}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {hours.map(hour => (
                                    <div key={hour} style={{
                                        height: '140px',
                                        borderTop: hour === 0 ? 'none' : '1px solid rgba(0,0,0,0.05)',
                                        position: 'relative',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        paddingTop: '1.5rem'
                                    }}>
                                        <span style={{
                                            minWidth: '60px',
                                            color: theme === 'dark' ? '#64748b' : '#475569',
                                            fontSize: '0.9rem',
                                            fontWeight: 700,
                                            fontFeatureSettings: '"tnum"',
                                            cursor: 'pointer',
                                            padding: '4px 8px',
                                            borderRadius: '8px',
                                            background: 'rgba(0,0,0,0.02)',
                                            textAlign: 'center'
                                        }} onClick={() => {
                                            setEditingHour(hour);
                                            setEditValue(logs[hour] || '');
                                        }}>
                                            {hour.toString().padStart(2, '0')}:00
                                        </span>

                                        <div className="no-scrollbar" style={{
                                            flex: 1,
                                            position: 'relative',
                                            height: '100%',
                                            marginLeft: '1rem',
                                            display: 'flex',
                                            gap: '1rem',
                                            overflowX: 'auto',
                                            alignItems: 'center',
                                            paddingRight: '2rem' // End padding for scroll
                                        }}>
                                            {/* Hourly Log Entry */}
                                            {logs[hour] && (
                                                <motion.div
                                                    whileHover={{ scale: 1.01 }}
                                                    onClick={() => {
                                                        setEditingHour(hour);
                                                        setEditValue(logs[hour] || '');
                                                    }}
                                                    style={{
                                                        padding: '1rem',
                                                        borderRadius: '16px',
                                                        background: theme === 'dark' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(238, 242, 255, 0.8)',
                                                        border: `1px solid ${theme === 'dark' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)'}`,
                                                        color: 'var(--text-primary)',
                                                        fontSize: '0.9rem',
                                                        lineHeight: 1.5,
                                                        minWidth: isMobile ? '180px' : '280px',
                                                        maxWidth: isMobile ? '240px' : '400px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'center',
                                                        gap: '0.4rem',
                                                        boxShadow: 'var(--shadow-soft)'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.6 }}>
                                                        <Clock size={12} />
                                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Log</span>
                                                    </div>
                                                    <p style={{ margin: 0, fontWeight: 500 }}>{logs[hour]}</p>
                                                </motion.div>
                                            )}

                                            {!logs[hour] && notes.filter(n => getHours(new Date(n.createdAt)) === hour).length === 0 && (
                                                <button
                                                    onClick={() => {
                                                        setEditingHour(hour);
                                                        setEditValue('');
                                                    }}
                                                    style={{
                                                        padding: '0.75rem 1.5rem',
                                                        borderRadius: '12px',
                                                        border: '1.5px dashed var(--border-subtle)',
                                                        background: 'transparent',
                                                        color: 'var(--text-muted)',
                                                        fontSize: '0.85rem',
                                                        cursor: 'pointer',
                                                        height: '40px',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    + Add Log or Note
                                                </button>
                                            )}

                                            {notes.filter(n => getHours(new Date(n.createdAt)) === hour).map(note => (
                                                <motion.div
                                                    layoutId={`note-${note.id}`}
                                                    key={note.id}
                                                    initial={{ opacity: 0, x: -10, scale: 0.98 }}
                                                    animate={{
                                                        opacity: 1,
                                                        x: 0,
                                                        scale: 1,
                                                        backgroundColor: theme === 'dark' ? 'rgba(250, 204, 21, 0.4)' : 'rgba(254, 252, 232, 0.95)',
                                                        borderColor: theme === 'dark' ? 'rgba(250, 204, 21, 0.6)' : 'rgba(253, 224, 71, 0.5)'
                                                    }}
                                                    onClick={(e) => onNoteClick(note, e)}
                                                    style={{
                                                        padding: '1rem',
                                                        borderRadius: '16px',
                                                        boxShadow: '0 4px 15px -3px rgba(0, 0, 0, 0.05)',
                                                        cursor: 'pointer',
                                                        borderLeft: `4px solid var(--accent-primary)`,
                                                        backdropFilter: 'blur(5px)',
                                                        minWidth: isMobile ? '200px' : '320px',
                                                        maxWidth: isMobile ? '240px' : '450px',
                                                        minHeight: '100px',
                                                        height: 'auto',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'center',
                                                        flexShrink: 0
                                                    }}
                                                    whileHover={{
                                                        y: -4,
                                                        backgroundColor: theme === 'dark'
                                                            ? 'rgba(250, 204, 21, 0.5)'
                                                            : 'rgba(250, 204, 21, 0.4)', // Rich yellow on hover
                                                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                                                    }}
                                                    whileTap={{ scale: 0.98 }}
                                                >
                                                    <motion.h4
                                                        layoutId={`note-title-${note.id}`}
                                                        style={{
                                                            fontWeight: 700,
                                                            color: theme === 'dark' ? '#f1f5f9' : '#0f172a',
                                                            marginBottom: '0.25rem',
                                                            fontSize: '1rem',
                                                            whiteSpace: 'normal',
                                                            display: '-webkit-box',
                                                            WebkitLineClamp: 2,
                                                            WebkitBoxOrient: 'vertical',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis'
                                                        }}
                                                    >
                                                        {note.title}
                                                    </motion.h4>
                                                    <motion.p
                                                        layoutId={`note-content-${note.id}`}
                                                        style={{
                                                            fontSize: '0.85rem',
                                                            color: theme === 'dark' ? '#94a3b8' : '#475569',
                                                            whiteSpace: 'normal',
                                                            display: '-webkit-box',
                                                            WebkitLineClamp: 3,
                                                            WebkitBoxOrient: 'vertical',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            opacity: 0.9
                                                        }}
                                                    >
                                                        {note.content.replace(/<[^>]*>/g, '')}
                                                    </motion.p>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Inline Edit Modal for Hourly Log */}
                            <AnimatePresence>
                                {editingHour !== null && (
                                    <div style={{
                                        position: 'fixed', inset: 0, zIndex: 1000,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        padding: '1rem'
                                    }}>
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            onClick={() => setEditingHour(null)}
                                            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)' }}
                                        />
                                        <motion.div
                                            initial={{ scale: 0.9, y: 20 }}
                                            animate={{ scale: 1, y: 0 }}
                                            exit={{ scale: 0.9, y: 20 }}
                                            style={{
                                                width: '100%', maxWidth: '500px',
                                                background: 'var(--bg-card)',
                                                borderRadius: '24px', padding: '1.5rem',
                                                position: 'relative', zIndex: 1,
                                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                                                border: '1px solid var(--border-subtle)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                                                    Hour Log: {editingHour.toString().padStart(2, '0')}:00
                                                </h3>
                                                <button onClick={() => setEditingHour(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                                    <X size={20} />
                                                </button>
                                            </div>
                                            <textarea
                                                autoFocus
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                placeholder="What happened during this hour?"
                                                style={{
                                                    width: '100%', height: '120px',
                                                    background: 'var(--bg-secondary)',
                                                    border: '1px solid var(--border-subtle)',
                                                    borderRadius: '16px', padding: '1rem',
                                                    color: 'var(--text-primary)', fontSize: '1rem',
                                                    outline: 'none', resize: 'none', marginBottom: '1.5rem'
                                                }}
                                            />
                                            <div style={{ display: 'flex', gap: '1rem' }}>
                                                <button
                                                    onClick={() => setEditingHour(null)}
                                                    style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        saveLog(editingHour, editValue);
                                                        setEditingHour(null);
                                                    }}
                                                    style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', background: 'var(--accent-primary)', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer' }}
                                                >
                                                    Save Log
                                                </button>
                                            </div>
                                        </motion.div>
                                    </div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </AnimatePresence>
                </motion.div>

                {/* 3. Note Overlay Portal - Simplified for reliability */}
                {focusedNote && createPortal(
                    <div
                        onClick={() => setFocusedNote(null)}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 9999,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '1rem'
                        }}
                    >
                        {/* Backdrop */}
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'rgba(255, 255, 255, 0.4)', // Whitish backdrop
                                backdropFilter: 'blur(8px)',
                                zIndex: 0
                            }}
                        />

                        {/* Modal Content */}
                        <div
                            className={`note-color-${focusedNote.color || 'default'}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onDirectEdit(focusedNote);
                            }}
                            style={{
                                position: 'relative',
                                zIndex: 10,
                                width: '100%',
                                maxWidth: '600px',
                                maxHeight: '80vh',
                                background: theme === 'dark' ? '#1e293b' : '#ffffff', // Solid fallback
                                borderRadius: '24px',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                cursor: 'pointer',
                                border: '1px solid var(--border-subtle)'
                            }}
                        >
                            <div style={{
                                padding: '1.5rem',
                                borderBottom: '1px solid var(--border-subtle)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'rgba(127,127,127, 0.05)'
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h4 style={{
                                        fontSize: '1.4rem',
                                        fontWeight: 700,
                                        color: 'var(--text-primary)',
                                        marginBottom: '0.25rem',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {focusedNote.title}
                                    </h4>
                                    <p style={{
                                        fontSize: '0.9rem',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        {format(new Date(focusedNote.createdAt), 'MMMM do, h:mm a')}
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setFocusedNote(null); }}
                                    style={{
                                        padding: '0.5rem',
                                        borderRadius: '50%',
                                        background: 'transparent',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        marginLeft: '1rem'
                                    }}
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="calendar-scrollbar" style={{ padding: '1.5rem', overflowY: 'auto' }}>
                                <p style={{
                                    fontSize: '1.1rem',
                                    lineHeight: '1.7',
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {focusedNote.content}
                                </p>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        </div>
    );
};
