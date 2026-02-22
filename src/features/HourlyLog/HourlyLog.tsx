import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X, Save, Calendar } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useHourlyLog } from '../../hooks/useHourlyLog';
import { format } from 'date-fns';

interface HourlyLogProps {
    date: Date;
    onClose: () => void;
}

export const HourlyLog: React.FC<HourlyLogProps> = ({ date, onClose }) => {
    const { theme } = useTheme();
    const { logs, saveLog } = useHourlyLog(format(date, 'yyyy-MM-dd'));
    const [activeHour, setActiveHour] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    const handleSaveHour = async () => {
        if (activeHour === null) return;
        setIsSaving(true);
        await saveLog(activeHour, editValue);
        setActiveHour(null);
        setIsSaving(false);
    };

    const formatHour = (hour: number) => {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        return `${displayHour}:00 ${period}`;
    };

    const getBlockStyle = (hour: number, hasContent: boolean) => {
        let colors = { light: '', dark: '', glow: '' };
        if (hour >= 5 && hour < 12) { // Morning
            colors = { light: 'rgba(56, 189, 248, 0.1)', dark: 'rgba(56, 189, 248, 0.05)', glow: '#38bdf8' };
        } else if (hour >= 12 && hour < 17) { // Afternoon
            colors = { light: 'rgba(14, 165, 233, 0.1)', dark: 'rgba(14, 165, 233, 0.05)', glow: '#0ea5e9' };
        } else if (hour >= 17 && hour < 21) { // Evening
            colors = { light: 'rgba(34, 197, 94, 0.1)', dark: 'rgba(34, 197, 94, 0.05)', glow: '#22c55e' };
        } else { // Night
            colors = { light: 'rgba(20, 184, 166, 0.1)', dark: 'rgba(20, 184, 166, 0.05)', glow: '#14b8a6' };
        }

        const isDark = theme === 'dark';

        return {
            background: hasContent
                ? (isDark ? colors.dark : colors.light)
                : (isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)'),
            border: `1px solid ${hasContent ? colors.glow + '50' : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)')}`,
            accent: colors.glow,
            shadow: hasContent && isDark ? `0 8px 25px ${colors.glow}20` : (hasContent ? `0 8px 20px ${colors.glow}30` : 'none')
        };
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: theme === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(15px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: isMobile ? '0' : '2rem'
            }}
        >
            <div style={{
                width: '100%', maxWidth: '1000px', height: isMobile ? '100%' : '90vh',
                background: theme === 'dark' ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(30px)',
                borderRadius: isMobile ? '0' : '32px',
                border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
                display: 'flex', flexDirection: 'column',
                boxShadow: theme === 'dark' ? '0 25px 50px -12px rgba(0,0,0,0.6)' : '0 25px 50px -12px rgba(0,0,0,0.1)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <header style={{
                    padding: '1.5rem 2rem',
                    borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.05)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: theme === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.4)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            padding: '0.75rem', borderRadius: '14px',
                            background: theme === 'dark' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9'
                        }}>
                            <Clock size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                                Hourly Journey
                            </h2>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Calendar size={14} /> {date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        padding: '0.5rem', borderRadius: '50%', background: 'transparent',
                        border: 'none', cursor: 'pointer', color: 'var(--text-secondary)'
                    }}>
                        <X size={24} />
                    </button>
                </header>

                {/* Grid */}
                <div style={{
                    flex: 1, overflowY: 'auto', padding: '1.5rem',
                    display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                    gap: '1rem'
                }} className="dashboard-scrollbar">
                    {Array.from({ length: 24 }).map((_, hour) => {
                        const hasContent = !!logs[hour];
                        const style = getBlockStyle(hour, hasContent);

                        return (
                            <motion.div
                                key={hour}
                                layoutId={`hour-${hour}`}
                                onClick={() => {
                                    setActiveHour(hour);
                                    setEditValue(logs[hour] || '');
                                }}
                                whileHover={{ scale: 1.02 }}
                                style={{
                                    padding: '1.25rem',
                                    borderRadius: '18px',
                                    background: style.background,
                                    border: style.border,
                                    borderLeft: `5px solid ${hasContent ? style.accent : 'transparent'}`,
                                    cursor: 'pointer',
                                    position: 'relative',
                                    minHeight: '120px',
                                    display: 'flex', flexDirection: 'column', gap: '0.75rem',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: style.shadow,
                                    backdropFilter: 'blur(10px)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{
                                        fontSize: '0.75rem', fontWeight: 700,
                                        color: 'var(--text-muted)', textTransform: 'uppercase'
                                    }}>
                                        {formatHour(hour)}
                                    </span>
                                    {hasContent && (
                                        <div style={{
                                            width: '8px', height: '8px', borderRadius: '50%',
                                            background: style.accent,
                                            boxShadow: `0 0 10px ${style.accent}80`
                                        }} />
                                    )}
                                </div>
                                <p style={{
                                    margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)',
                                    lineHeight: 1.5,
                                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden', fontStyle: hasContent ? 'normal' : 'italic',
                                    opacity: hasContent ? 1 : 0.4
                                }}>
                                    {logs[hour] || 'Tap to log journey...'}
                                </p>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Edit Modal (Portal-like inside) */}
                <AnimatePresence>
                    {activeHour !== null && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'absolute', inset: 0, zIndex: 10,
                                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '1rem'
                            }}
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 20 }}
                                style={{
                                    width: '100%', maxWidth: '500px',
                                    background: theme === 'dark' ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                                    backdropFilter: 'blur(20px)',
                                    border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0,0,0,0.05)',
                                    borderRadius: '24px', padding: '2rem',
                                    boxShadow: theme === 'dark' ? '0 25px 50px -12px rgba(0,0,0,0.6)' : '0 25px 50px -12px rgba(0,0,0,0.1)'
                                }}
                            >
                                <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                                        Logging {formatHour(activeHour)}
                                    </h3>
                                    <button onClick={() => setActiveHour(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                        <X size={20} />
                                    </button>
                                </div>

                                <textarea
                                    autoFocus
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSaveHour();
                                        }
                                    }}
                                    placeholder="Write your highlight for this hour..."
                                    style={{
                                        width: '100%', height: '150px',
                                        background: theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
                                        border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.05)',
                                        borderRadius: '16px', padding: '1rem',
                                        color: 'var(--text-primary)', fontSize: '1rem',
                                        outline: 'none', resize: 'none',
                                        fontFamily: 'inherit'
                                    }}
                                />

                                <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                                    <button
                                        onClick={() => setActiveHour(null)}
                                        style={{
                                            flex: 1, padding: '0.75rem', borderRadius: '12px',
                                            background: 'transparent', border: '1px solid var(--border-subtle)',
                                            color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveHour}
                                        disabled={isSaving}
                                        style={{
                                            flex: 1, padding: '0.75rem', borderRadius: '12px',
                                            background: 'linear-gradient(135deg, #0ea5e9, #22c55e)', border: 'none',
                                            color: 'white', fontWeight: 600, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                            boxShadow: '0 4px 15px rgba(14, 165, 233, 0.3)'
                                        }}
                                    >
                                        <Save size={18} />
                                        {isSaving ? 'Saving...' : 'Save Log'}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};
