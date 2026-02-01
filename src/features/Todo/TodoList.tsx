import React, { useState, useEffect } from 'react';
import { Check, Plus, Trash2, Calendar, Sparkles, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { storage } from '../../lib/storage';
import { useTheme } from '../../hooks/useTheme';
import type { Todo } from '../../types';
import { HourlyLog } from '../HourlyLog/HourlyLog';
import { HourlyLogSummary } from '../HourlyLog/HourlyLogSummary';

export const TodoList: React.FC = () => {
    const { theme } = useTheme();
    const [todos, setTodos] = useState<Todo[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(true);
    const [focused, setFocused] = useState(false);
    const [showHourlyLog, setShowHourlyLog] = useState(false);

    const refreshTodos = async () => {
        try {
            const data = await storage.getTodos();
            setTodos(data.sort((a, b) => {
                if (a.completed === b.completed) return b.createdAt - a.createdAt;
                return a.completed ? 1 : -1;
            }));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshTodos();
        // Listen for external changes (sync, etc)
        const unsubscribe = storage.onDataChange(() => {
            console.log("TodoList: Data change detected, refreshing...");
            refreshTodos();
        });
        return unsubscribe;
    }, []);

    const handleAdd = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim()) return;

        const newTodo: Todo = {
            id: crypto.randomUUID(),
            text: inputValue.trim(),
            completed: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            targetDate: '' // Empty means general/pending task - not tied to a specific day
        };

        await storage.saveTodo(newTodo);
        setInputValue('');
        await refreshTodos();
    };

    const toggleTodo = async (todo: Todo) => {
        const updated: Todo = { ...todo, completed: !todo.completed, updatedAt: Date.now() };
        await storage.saveTodo(updated);
        await refreshTodos();
    };

    const deleteTodo = async (id: string) => {
        await storage.deleteTodo(id);
        await refreshTodos();
    };

    if (loading) return (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
                Loading your space...
            </motion.div>
        </div>
    );

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const isDark = theme === 'dark';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="todo-container"
            style={{
                maxWidth: '1200px',
                margin: '0 auto',
                minHeight: '80vh',
                position: 'relative',
                paddingTop: isMobile ? '2rem' : '0' // Extra room for the menu button and status bar
            }}
        >
            {/* Artistic Header Section */}
            <header style={{
                marginBottom: isMobile ? '1.5rem' : '3rem',
                textAlign: 'center',
                position: 'relative'
            }}>
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: isMobile ? '0.35rem 1rem' : '0.5rem 1.25rem',
                        borderRadius: '50px',
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                        marginBottom: '0.75rem',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <Sparkles size={isMobile ? 14 : 16} color={isDark ? '#e2e8f0' : '#64748b'} />
                        <span style={{ fontSize: isMobile ? '0.75rem' : '0.85rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                            Focus & Flow
                        </span>
                    </div>

                    <div style={{ position: 'relative', display: 'inline-block' }}>
                        <h1 style={{
                            fontSize: isMobile ? '2.5rem' : '4rem',
                            fontWeight: 700,
                            lineHeight: 1.1,
                            marginBottom: '0.5rem',
                            fontFamily: 'var(--font-serif)',
                            fontStyle: 'italic',
                            letterSpacing: '-0.05em',
                            color: isDark ? 'white' : 'black',
                            position: 'relative',
                            display: 'inline-block'
                        }}>
                            <span style={{
                                backgroundImage: isDark
                                    ? 'linear-gradient(to right, #f472b6, #c084fc, #818cf8)'
                                    : 'linear-gradient(to right, #db2777, #9333ea, #4f46e5)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                color: 'transparent',
                                paddingBottom: '0.1em'
                            }}>
                                My Tasks
                            </span>
                        </h1>
                        <motion.button
                            onClick={() => setShowHourlyLog(true)}
                            whileHover={{ scale: 1.1, rotate: 10 }}
                            whileTap={{ scale: 0.9 }}
                            style={{
                                position: 'absolute',
                                right: '-3rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'rgba(99, 102, 241, 0.1)',
                                border: 'none',
                                borderRadius: '12px',
                                padding: '0.6rem',
                                color: 'var(--accent-primary)',
                                cursor: 'pointer',
                                display: isMobile ? 'none' : 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <Clock size={24} />
                        </motion.button>
                        {isMobile && (
                            <button
                                onClick={() => setShowHourlyLog(true)}
                                style={{
                                    position: 'absolute',
                                    right: '-2rem',
                                    top: '0',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--accent-primary)',
                                    cursor: 'pointer'
                                }}
                            >
                                <Clock size={20} />
                            </button>
                        )}
                    </div>
                </motion.div>
            </header>

            <AnimatePresence>
                {showHourlyLog && (
                    <HourlyLog date={new Date()} onClose={() => setShowHourlyLog(false)} />
                )}
            </AnimatePresence>

            {/* Input Section */}
            <motion.div
                style={{
                    marginBottom: isMobile ? '2rem' : '3rem',
                    position: 'relative',
                    zIndex: 10,
                    maxWidth: isMobile ? '100%' : '700px',
                    margin: isMobile ? '0 1rem 2rem 1rem' : '0 auto 3rem auto'
                }}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                <form onSubmit={handleAdd} style={{ position: 'relative' }}>
                    <motion.div
                        animate={{
                            boxShadow: focused ? '0 8px 30px rgba(0,0,0,0.1)' : 'none',
                        }}
                        style={{
                            background: 'transparent',
                            borderBottom: '2px solid var(--border-subtle)',
                            padding: isMobile ? '0.25rem 0' : '0.5rem 0',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <input
                            type="text"
                            placeholder="Add a new task..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                padding: isMobile ? '0.75rem 0' : '1rem 0',
                                fontSize: isMobile ? '1.25rem' : '1.5rem',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                fontWeight: 300,
                                fontFamily: 'var(--font-serif)'
                            }}
                        />
                        <motion.button
                            type="submit"
                            whileHover={{ scale: 1.1, color: 'var(--accent-primary)' }}
                            whileTap={{ scale: 0.9 }}
                            disabled={!inputValue.trim()}
                            style={{
                                background: 'transparent',
                                color: inputValue.trim() ? 'var(--text-primary)' : 'var(--text-muted)',
                                border: 'none',
                                width: isMobile ? '40px' : '48px',
                                height: isMobile ? '40px' : '48px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: inputValue.trim() ? 'pointer' : 'default',
                                transition: 'all 0.2s',
                            }}
                        >
                            <Plus size={isMobile ? 24 : 28} strokeWidth={1.5} />
                        </motion.button>
                    </motion.div>
                </form>
            </motion.div>

            {/* Todo List - Stacked on Mobile */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: isMobile ? '1.5rem' : '2rem',
                alignItems: 'start',
                padding: isMobile ? '0 1rem' : '0'
            }}>
                {/* Left Column: Active Tasks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '1rem' }}>
                    <h3 style={{
                        fontSize: isMobile ? '1.1rem' : '1.2rem', color: 'var(--text-muted)', marginBottom: '0.25rem',
                        paddingLeft: '0.5rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}>
                        Active
                        <span style={{ fontSize: '0.75rem', background: 'var(--bg-card)', padding: '0.15rem 0.5rem', borderRadius: '8px' }}>
                            {todos.filter(t => !t.completed).length}
                        </span>
                    </h3>
                    <AnimatePresence mode="popLayout">
                        {todos.filter(t => !t.completed).map(todo => (
                            <TodoItem key={todo.id} todo={todo} isDark={isDark} isMobile={isMobile} toggleTodo={toggleTodo} deleteTodo={deleteTodo} />
                        ))}
                    </AnimatePresence>
                    {todos.filter(t => !t.completed).length === 0 && (
                        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', opacity: 0.6, border: '1px dashed var(--border-subtle)', borderRadius: '16px', fontSize: '0.9rem' }}>
                            No active tasks
                        </div>
                    )}
                </div>

                {/* Right Column: Completed Tasks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '1rem' }}>
                    <h3 style={{
                        fontSize: isMobile ? '1.1rem' : '1.2rem', color: 'var(--text-muted)', marginBottom: '0.25rem',
                        paddingLeft: '0.5rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}>
                        Completed
                        <span style={{ fontSize: '0.75rem', background: 'var(--bg-card)', padding: '0.15rem 0.5rem', borderRadius: '8px' }}>
                            {todos.filter(t => t.completed).length}
                        </span>
                    </h3>
                    <AnimatePresence mode="popLayout">
                        {todos.filter(t => t.completed).map(todo => (
                            <TodoItem key={todo.id} todo={todo} isDark={isDark} isMobile={isMobile} toggleTodo={toggleTodo} deleteTodo={deleteTodo} />
                        ))}
                    </AnimatePresence>
                    {todos.filter(t => t.completed).length === 0 && (
                        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', opacity: 0.6, border: '1px dashed var(--border-subtle)', borderRadius: '16px', fontSize: '0.9rem' }}>
                            No completed tasks yet
                        </div>
                    )}
                </div>
            </div>

            {/* Hourly Log Summary Integration */}
            <div style={{ maxWidth: isMobile ? '100%' : '700px', margin: isMobile ? '2rem 1rem' : '4rem auto 2rem auto' }}>
                <HourlyLogSummary />
            </div>
        </motion.div>
    );
};

const TodoItem: React.FC<{
    todo: Todo;
    isDark: boolean;
    isMobile: boolean;
    toggleTodo: (todo: Todo) => void;
    deleteTodo: (id: string) => void;
}> = ({ todo, isDark, isMobile, toggleTodo, deleteTodo }) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{
                opacity: 1,
                y: 0,
                // Active tasks get a purple tint, completed get standard background
                backgroundColor: todo.completed
                    ? (isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.6)')
                    : (isDark ? 'rgba(88, 28, 135, 0.6)' : 'rgba(237, 233, 254, 0.95)'), // Deep Purple vs Light Lavender
                borderColor: todo.completed
                    ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)')
                    : (isDark ? 'rgba(168, 85, 247, 0.35)' : 'rgba(168, 85, 247, 0.4)')
            }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '0.75rem' : '1rem',
                padding: isMobile ? '0.85rem' : '1.25rem',
                borderRadius: '16px',
                borderLeft: `3px solid ${todo.completed ? 'var(--text-muted)' : 'var(--accent-primary)'}`,
                border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.02)',
                // Purple glow for active items
                boxShadow: !todo.completed
                    ? (isDark ? '0 4px 20px rgba(168, 85, 247, 0.15)' : '0 4px 15px rgba(168, 85, 247, 0.25)')
                    : (isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.05)'),
                backdropFilter: 'blur(16px)',
                userSelect: 'none',
                opacity: todo.completed ? 0.6 : 1,
                transition: 'all 0.2s ease',
                width: '100%',
                boxSizing: 'border-box'
            }}
        >
            <motion.button
                onClick={() => toggleTodo(todo)}
                whileTap={{ scale: 0.8 }}
                style={{
                    flexShrink: 0,
                    width: isMobile ? '22px' : '28px',
                    height: isMobile ? '22px' : '28px',
                    borderRadius: '50%',
                    border: `2px solid ${todo.completed ? 'var(--accent-primary)' : (isDark ? '#c084fc' : '#9333ea')}`,
                    background: todo.completed ? 'var(--accent-primary)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                }}
            >
                {todo.completed && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <Check size={isMobile ? 12 : 16} color="white" strokeWidth={3} />
                    </motion.div>
                )}
            </motion.button>

            <div style={{ flex: 1, overflow: 'hidden' }}>
                <span style={{
                    display: 'block',
                    fontSize: isMobile ? '0.95rem' : '1.1rem',
                    textDecoration: todo.completed ? 'line-through' : 'none',
                    // Improve contrast on purple background
                    color: todo.completed
                        ? 'var(--text-muted)'
                        : (isDark ? '#f3e8ff' : '#4c1d95'), // Light lilac text on dark purple, Dark purple text on light lavender
                    fontWeight: todo.completed ? 'normal' : 600,
                    marginBottom: '0.15rem',
                    transition: 'color 0.2s',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                }}>
                    {todo.text}
                </span>
                <span style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                }}>
                    <Calendar size={10} />
                    {new Date(todo.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </span>
            </div>

            <motion.button
                onClick={() => deleteTodo(todo.id)}
                whileHover={{ scale: 1.1, color: '#ef4444' }}
                whileTap={{ scale: 0.9 }}
                style={{
                    color: 'var(--text-muted)',
                    padding: '6px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer'
                }}
            >
                <Trash2 size={isMobile ? 16 : 18} />
            </motion.button>
        </motion.div>
    );
};
