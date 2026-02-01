import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, History, Check, Trash2, Coffee } from 'lucide-react';
import { useTodos } from '../../hooks/useTodos';
import { useTheme } from '../../hooks/useTheme';
import { format, parseISO } from 'date-fns';

export const TomorrowView: React.FC = () => {
    const { todos, addTodo, toggleTodo, deleteTodo, getTodosByDate, getTomorrowStr } = useTodos();
    const { theme } = useTheme();
    const [inputValue, setInputValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    const tomorrowStr = getTomorrowStr();
    const tomorrowTasks = getTodosByDate(tomorrowStr);

    // Get History: Unique dates in the past that have tasks
    const historyDates = Array.from(new Set(
        todos
            .filter(t => t.targetDate && t.targetDate < tomorrowStr && t.targetDate !== tomorrowStr)
            .map(t => t.targetDate)
    )).sort((a, b) => b.localeCompare(a)).slice(0, 5); // Show last 5 days

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;
        await addTodo(inputValue.trim(), tomorrowStr);
        setInputValue('');
    };

    const isDark = theme === 'dark';

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    return (
        <div className="tomorrow-view" style={{
            maxWidth: '1000px',
            margin: '0 auto',
            padding: isMobile ? '1rem' : '2rem',
            paddingTop: isMobile ? '4rem' : '2rem',
            minHeight: '100%'
        }}>
            {/* Artistic Header */}
            <header style={{ marginBottom: isMobile ? '2.5rem' : '4rem', position: 'relative' }}>
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.75rem' : '1rem', marginBottom: '1rem' }}
                >
                    <div style={{
                        padding: isMobile ? '0.6rem' : '0.75rem',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                        color: 'white',
                        boxShadow: '0 8px 16px rgba(245, 158, 11, 0.3)'
                    }}>
                        <Coffee size={isMobile ? 20 : 24} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: isMobile ? '0.75rem' : '0.9rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Planning Ahead
                        </h2>
                        <h1 style={{ fontSize: isMobile ? '1.8rem' : '2.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                            Tomorrow's Goals
                        </h1>
                    </div>
                </motion.div>

                <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '0.95rem' : '1.1rem', maxWidth: '600px', lineHeight: 1.5 }}>
                    Capture what you want to achieve tomorrow. These tasks will automatically move to your Dashboard when the day comes.
                </p>
            </header>

            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.5fr) minmax(0, 1fr)',
                gap: isMobile ? '3rem' : '3rem'
            }}>
                {/* Planning Section */}
                <section>
                    <motion.div
                        style={{ marginBottom: '2.5rem' }}
                        animate={{ scale: isFocused ? 1.02 : 1 }}
                        transition={{ duration: 0.2 }}
                    >
                        <form onSubmit={handleAdd} style={{ position: 'relative' }}>
                            <div style={{
                                background: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255, 255, 255, 0.8)',
                                backdropFilter: 'blur(20px)',
                                borderRadius: '24px',
                                border: `2px solid ${isFocused ? 'var(--accent-primary)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')}`,
                                padding: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'all 0.3s ease',
                                boxShadow: isFocused ? '0 10px 40px rgba(99, 102, 241, 0.15)' : 'var(--shadow-soft)'
                            }}>
                                <input
                                    type="text"
                                    placeholder="Add a goal..."
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    style={{
                                        flex: 1,
                                        background: 'transparent',
                                        border: 'none',
                                        padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem',
                                        fontSize: isMobile ? '1.05rem' : '1.2rem',
                                        color: 'var(--text-primary)',
                                        outline: 'none',
                                        width: '100%'
                                    }}
                                />
                                <motion.button
                                    type="submit"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    disabled={!inputValue.trim()}
                                    style={{
                                        background: 'var(--accent-primary)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '16px',
                                        padding: isMobile ? '0.75rem' : '0.8rem 1.5rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        opacity: inputValue.trim() ? 1 : 0.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        minWidth: isMobile ? '48px' : 'auto'
                                    }}
                                >
                                    <Plus size={20} />
                                    {!isMobile && 'Add Item'}
                                </motion.button>
                            </div>
                        </form>
                    </motion.div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <AnimatePresence mode="popLayout">
                            {tomorrowTasks.length > 0 ? (
                                tomorrowTasks.map((todo) => (
                                    <motion.div
                                        key={todo.id}
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        style={{
                                            background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'white',
                                            padding: isMobile ? '1.1rem' : '1.25rem',
                                            borderRadius: '20px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.85rem',
                                            border: '1px solid var(--border-subtle)',
                                            boxShadow: 'var(--shadow-soft)'
                                        }}
                                    >
                                        <button
                                            onClick={() => toggleTodo(todo)}
                                            style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '6px',
                                                border: `2px solid ${todo.completed ? 'var(--accent-primary)' : 'var(--text-muted)'}`,
                                                background: todo.completed ? 'var(--accent-primary)' : 'transparent',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                flexShrink: 0
                                            }}
                                        >
                                            {todo.completed && <Check size={14} color="white" strokeWidth={3} />}
                                        </button>
                                        <span style={{
                                            flex: 1,
                                            fontSize: isMobile ? '1rem' : '1.1rem',
                                            color: 'var(--text-primary)',
                                            textDecoration: todo.completed ? 'line-through' : 'none',
                                            opacity: todo.completed ? 0.6 : 1,
                                            wordBreak: 'break-word'
                                        }}>
                                            {todo.text}
                                        </span>
                                        <button onClick={() => deleteTodo(todo.id)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem' }}>
                                            <Trash2 size={18} />
                                        </button>
                                    </motion.div>
                                ))
                            ) : (
                                <div style={{
                                    padding: isMobile ? '3rem 1.5rem' : '4rem 2rem',
                                    textAlign: 'center',
                                    background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                                    borderRadius: '30px',
                                    border: '1px dashed var(--border-subtle)',
                                    color: 'var(--text-muted)',
                                    fontSize: isMobile ? '0.9rem' : '1rem'
                                }}>
                                    Your tomorrow is a blank canvas. Start planning!
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </section>

                {/* History Section */}
                <aside style={{ paddingBottom: '3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                        <History size={isMobile ? 18 : 20} color="var(--text-muted)" />
                        <h3 style={{ fontSize: isMobile ? '1.1rem' : '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>History</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {historyDates.length > 0 ? (
                            historyDates.map(dateStr => (
                                <HistoryCard key={dateStr} dateStr={dateStr} tasks={getTodosByDate(dateStr)} isDark={isDark} isMobile={isMobile} />
                            ))
                        ) : (
                            <div style={{ padding: '2rem', textAlign: 'center', border: '1px solid var(--border-subtle)', borderRadius: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                Your history will appear here over time.
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
};

const HistoryCard: React.FC<{ dateStr: string; tasks: any[]; isDark: boolean; isMobile: boolean }> = ({ dateStr, tasks, isDark, isMobile }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const completedCount = tasks.filter(t => t.completed).length;
    const date = parseISO(dateStr);

    const visibleTasks = isExpanded ? tasks : tasks.slice(0, 3);

    return (
        <motion.div
            whileHover={!isMobile ? { y: -4 } : {}}
            style={{
                background: isDark ? 'rgba(255, 255, 255, 0.04)' : 'white',
                padding: isMobile ? '1.1rem' : '1.5rem',
                borderRadius: '24px',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-soft)'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                    <div style={{ fontSize: isMobile ? '0.75rem' : '0.85rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                        {format(date, 'EEEE')}
                    </div>
                    <div style={{ fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {format(date, 'MMM d, yyyy')}
                    </div>
                </div>
                <div style={{ fontSize: isMobile ? '0.7rem' : '0.8rem', padding: '0.2rem 0.6rem', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                    {completedCount}/{tasks.length} {isMobile ? '' : 'Done'}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {visibleTasks.map(task => (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.8 }}>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: task.completed ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                        <span style={{ fontSize: isMobile ? '0.85rem' : '0.9rem', color: 'var(--text-secondary)', textDecoration: task.completed ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {task.text}
                        </span>
                    </div>
                ))}

                {tasks.length > 3 && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        style={{
                            fontSize: isMobile ? '0.75rem' : '0.8rem',
                            color: 'var(--accent-primary)',
                            fontStyle: 'italic',
                            marginTop: '0.25rem',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                        }}
                    >
                        {isExpanded ? 'Show less' : `+ ${tasks.length - 3} more`}
                    </button>
                )}
            </div>
        </motion.div>
    );
};
