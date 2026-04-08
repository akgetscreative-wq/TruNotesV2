import React, { useState, useEffect } from 'react';
import { Check, Plus, Trash2, Calendar, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { storage } from '../../lib/storage';
import { useTheme } from '../../hooks/useTheme';
import type { Todo } from '../../types';
import { HourlyLog } from '../HourlyLog/HourlyLog';
import { HourlyLogSummary } from '../HourlyLog/HourlyLogSummary';

interface TodoListProps {
    autoFocusInput?: boolean;
    onFocusComplete?: () => void;
}

export const TodoList: React.FC<TodoListProps> = ({ autoFocusInput, onFocusComplete }) => {
    const { theme } = useTheme();
    const [todos, setTodos] = useState<Todo[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(true);
    const [focused, setFocused] = useState(false);
    const [showHourlyLog, setShowHourlyLog] = useState(false);
    const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (autoFocusInput && inputRef.current && !loading) {
            inputRef.current.focus();
            if (onFocusComplete) onFocusComplete();
        }
    }, [autoFocusInput, loading, onFocusComplete]);

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
                paddingTop: isMobile ? 'calc(var(--safe-top) + 2.5rem)' : '0', // Extra room for the menu button and status bar
                zIndex: 1
            }}
        >
            {/* Artistic Header Section */}
            <header style={{
                marginBottom: isMobile ? '1.5rem' : '3rem',
                position: 'relative',
                padding: isMobile ? '0' : '0 1rem'
            }}>
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        alignItems: isMobile ? 'center' : 'flex-end',
                        justifyContent: 'space-between',
                        gap: isMobile ? '1rem' : '0'
                    }}
                >
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                        <h1 style={{
                            fontSize: isMobile ? '2.5rem' : '4rem',
                            fontWeight: 700,
                            lineHeight: 1.1,
                            marginBottom: '0',
                            fontFamily: 'var(--font-sans)',
                            letterSpacing: '-0.02em',
                            color: isDark ? 'white' : 'black',
                            position: 'relative',
                            display: 'inline-block'
                        }}>
                            <span style={{
                                backgroundImage: isDark
                                    ? 'linear-gradient(to right, #0ea5e9, #22c55e)'
                                    : 'linear-gradient(to right, #0284c7, #16a34a)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                color: 'transparent',
                                paddingBottom: '0.1em'
                            }}>
                                Todos
                            </span>
                        </h1>
                    </div>

                    <motion.button
                        onClick={() => setShowHourlyLog(true)}
                        whileHover={{ scale: 1.05, boxShadow: '0 8px 25px rgba(14, 165, 233, 0.4)' }}
                        whileTap={{ scale: 0.95 }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: isDark ? 'rgba(14, 165, 233, 0.15)' : 'rgba(240, 250, 255, 0.9)',
                            border: `1px solid ${isDark ? 'rgba(14, 165, 233, 0.3)' : 'rgba(14, 165, 233, 0.4)'}`,
                            borderRadius: '20px',
                            padding: '0.6rem 1.25rem',
                            color: isDark ? '#38bdf8' : '#0369a1',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            fontFamily: 'var(--font-sans)',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <Clock size={18} />
                        View Hourly Log
                    </motion.button>
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
                            ref={inputRef}
                            type="text"
                            placeholder="Add a new todo..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            maxLength={500}
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                padding: isMobile ? '0.75rem 0' : '1rem 0',
                                fontSize: isMobile ? '1.25rem' : '1.5rem',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                fontWeight: 500,
                                fontFamily: 'var(--font-sans)',
                                letterSpacing: '-0.01em'
                            }}
                        />
                        <motion.button
                            type="submit"
                            whileHover={{ scale: 1.1, color: '#0ea5e9' }}
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

            {/* Tabs for Todos */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '1rem',
                marginBottom: '2rem',
                padding: '0 1rem'
            }}>
                <button
                    onClick={() => setActiveTab('pending')}
                    style={{
                        padding: '0.6rem 1.75rem',
                        borderRadius: '24px',
                        border: 'none',
                        background: activeTab === 'pending' ? 'linear-gradient(135deg, #0ea5e9, #22c55e)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                        color: activeTab === 'pending' ? 'white' : 'var(--text-secondary)',
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: activeTab === 'pending' ? '0 8px 20px rgba(14, 165, 233, 0.3)' : 'none'
                    }}
                >
                    Pending ({todos.filter(t => !t.completed).length})
                </button>
                <button
                    onClick={() => setActiveTab('completed')}
                    style={{
                        padding: '0.6rem 1.75rem',
                        borderRadius: '24px',
                        border: 'none',
                        background: activeTab === 'completed' ? 'linear-gradient(135deg, #0ea5e9, #22c55e)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                        color: activeTab === 'completed' ? 'white' : 'var(--text-secondary)',
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: activeTab === 'completed' ? '0 8px 20px rgba(14, 165, 233, 0.3)' : 'none'
                    }}
                >
                    Completed ({todos.filter(t => t.completed).length})
                </button>
            </div>

            {/* Todo List - Tabbed Layout */}
            <div style={{
                maxWidth: '700px',
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: isMobile ? '0.75rem' : '1rem',
                padding: isMobile ? '0 1rem' : '0'
            }}>
                <AnimatePresence mode="popLayout">
                    {todos.filter(t => activeTab === 'pending' ? !t.completed : t.completed).map(todo => (
                        <TodoItem key={todo.id} todo={todo} isDark={isDark} isMobile={isMobile} toggleTodo={toggleTodo} deleteTodo={deleteTodo} />
                    ))}
                </AnimatePresence>
                {todos.filter(t => activeTab === 'pending' ? !t.completed : t.completed).length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', border: '1.5px dashed var(--border-subtle)', borderRadius: '24px', fontSize: '1rem', fontStyle: 'italic', fontFamily: 'var(--font-serif)', marginTop: '1rem' }}
                    >
                        {activeTab === 'pending' ? 'All caught up! No pending todos.' : 'No completed todos yet. Keep going!'}
                    </motion.div>
                )}
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
                // Active tasks get a blue tint, completed get standard background
                backgroundColor: todo.completed
                    ? (isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.6)')
                    : (isDark ? 'rgba(14, 165, 233, 0.08)' : 'rgba(240, 250, 255, 0.95)'), // Deep Blue vs Light Blue
                borderColor: todo.completed
                    ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)')
                    : (isDark ? 'rgba(14, 165, 233, 0.3)' : 'rgba(14, 165, 233, 0.3)')
            }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '0.75rem' : '1rem',
                padding: isMobile ? '0.85rem' : '1.25rem',
                borderRadius: '16px',
                borderLeft: `3.5px solid ${todo.completed ? 'var(--text-muted)' : '#0ea5e9'}`,
                border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.02)',
                // Blue/Green glow for active items
                boxShadow: !todo.completed
                    ? (isDark ? '0 4px 20px rgba(14, 165, 233, 0.15)' : '0 4px 15px rgba(14, 165, 233, 0.25)')
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
                    border: `2px solid ${todo.completed ? '#22c55e' : (isDark ? '#38bdf8' : '#0ea5e9')}`,
                    background: todo.completed ? '#22c55e' : 'transparent',
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
                    // Improve contrast on blue background
                    color: todo.completed
                        ? 'var(--text-muted)'
                        : (isDark ? '#e0f2fe' : '#0369a1'), // Light blue text on dark blue, Dark blue text on light blue
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
