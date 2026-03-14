import React, { useState, useEffect } from 'react';

interface Todo {
    id: string;
    text: string;
    completed: boolean;
    targetDate: string;
    createdAt: number;
}

export const DesktopWidget: React.FC = () => {
    const [todos, setTodos] = useState<Todo[]>([]);
    const [newTask, setNewTask] = useState('');

    useEffect(() => {
        const api = (window as any).widgetAPI;
        if (!api) {
            setTodos([
                { id: '1', text: 'Study for skill', completed: false, targetDate: '2024-01-01', createdAt: Date.now() },
                { id: '2', text: 'Check tata elxsi for buying', completed: false, targetDate: 'daily', createdAt: Date.now() },
                { id: '3', text: 'Sell ashoka limited if falls below 120', completed: false, targetDate: '2024-01-01', createdAt: Date.now() },
            ]);
            return;
        }
        api.onTodosUpdate((t: Todo[]) => setTodos(t || []));
        api.requestTodos();
    }, []);

    const handleToggle = (id: string) => {
        const api = (window as any).widgetAPI;
        if (api) api.toggleTodo(id);
    };

    const handleAdd = () => {
        const t = newTask.trim();
        if (!t) return;
        const api = (window as any).widgetAPI;
        if (api) api.addTodo(t);
        setNewTask('');
    };

    const handleClose = () => {
        const api = (window as any).widgetAPI;
        if (api) api.hideWidget();
    };

    const pending = todos.filter(t => !t.completed);

    return (
        <div style={{
            width: '100%', height: '100%',
            background: 'rgba(12, 14, 12, 0.92)',
            borderRadius: 14,
            border: '1px solid rgba(16,185,129,0.15)',
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            fontFamily: "'Inter', system-ui, sans-serif",
        }}>
            {/* Header — drag handle + close only */}
            <div style={{
                padding: '2px 4px',
                display: 'flex', alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                WebkitAppRegion: 'drag', cursor: 'grab', flexShrink: 0,
            } as React.CSSProperties}>
                <div style={{ flex: 1 }} />
                <button onClick={handleClose} title="Close" style={{
                    width: 14, height: 14, borderRadius: 3, padding: 0,
                    background: 'rgba(255,255,255,0.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    WebkitAppRegion: 'no-drag', cursor: 'pointer',
                } as React.CSSProperties}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.25)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                >
                    <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
            </div>

            {/* Task list */}
            <div style={{
                flex: 1, overflowY: 'auto', padding: '2px 4px',
                display: 'flex', flexDirection: 'column', gap: 1,
            }}>
                {pending.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '12px 0', color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>✓</div>
                ) : pending.map(task => (
                    <div key={task.id} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 6px', borderRadius: 5,
                        transition: 'background 0.1s',
                    }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                        <button onClick={() => handleToggle(task.id)} style={{
                            width: 13, height: 13, borderRadius: 3, flexShrink: 0, padding: 0,
                            background: 'transparent',
                            border: '1.2px solid rgba(16,185,129,0.3)',
                            cursor: 'pointer',
                        }} />
                        <span style={{
                            fontSize: 10.5, color: 'rgba(255,255,255,0.75)',
                            lineHeight: 1.25, flex: 1, wordBreak: 'break-word',
                        }}>{task.text}</span>
                    </div>
                ))}
            </div>

            {/* Add task */}
            <div style={{
                padding: '4px 4px 5px', display: 'flex', gap: 3, flexShrink: 0,
                borderTop: '1px solid rgba(255,255,255,0.03)',
            }}>
                <input
                    value={newTask}
                    onChange={e => setNewTask(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder="+"
                    style={{
                        flex: 1, padding: '3px 6px', borderRadius: 4,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.8)', fontSize: 10, outline: 'none',
                        fontFamily: 'inherit',
                    }}
                />
                <button onClick={handleAdd} style={{
                    width: 22, height: 22, borderRadius: 4, padding: 0,
                    background: newTask.trim() ? 'linear-gradient(135deg, #10b981, #06b6d4)' : 'rgba(255,255,255,0.03)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={newTask.trim() ? 'white' : 'rgba(255,255,255,0.15)'} strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </button>
            </div>
        </div>
    );
};
