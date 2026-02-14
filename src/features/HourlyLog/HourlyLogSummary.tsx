import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X, Save } from 'lucide-react';
import { useHourlyLog } from '../../hooks/useHourlyLog';
import { useCurrentTime } from '../../context/TimeContext';
import { format } from 'date-fns';

interface HourlyLogSummaryProps {
    date?: Date;
    onClickTitle?: () => void;
}

export const HourlyLogSummary: React.FC<HourlyLogSummaryProps> = ({ date, onClickTitle }) => {
    const { now: globalNow, dateKey: globalDateKey } = useCurrentTime();

    // Use provided date or fallback to global synchronized time
    const displayDate = date || globalNow;
    const dateKey = date ? format(displayDate, 'yyyy-MM-dd') : globalDateKey;
    const currentHour = displayDate.getHours();

    const { logs, saveLog } = useHourlyLog(dateKey);
    const [editingHour, setEditingHour] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    // Show 2 hours before and 2 hours after current hour
    const displayHours = Array.from({ length: 5 }, (_, i) => (currentHour - 2 + i + 24) % 24);

    const formatHour = (hour: number) => {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        return `${displayHour}:00 ${period}`;
    };

    return (
        <section style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <motion.h2
                    whileHover={onClickTitle ? { x: 5, opacity: 0.8 } : {}}
                    onClick={onClickTitle}
                    style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: onClickTitle ? 'pointer' : 'default' }}
                >
                    <Clock size={24} color="var(--accent-primary)" />
                    Hourly Journey
                </motion.h2>
                {!isMobile && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Focus Window</span>}
            </div>

            <div style={{
                background: 'var(--bg-card)',
                backdropFilter: 'blur(12px)',
                borderRadius: '24px',
                border: '1px solid var(--border-subtle)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                boxShadow: 'var(--shadow-soft)'
            }}>
                {displayHours.map(hour => {
                    const hasLog = !!logs[hour];
                    const isCurrent = hour === currentHour;

                    return (
                        <motion.div
                            key={hour}
                            whileHover={{ scale: 1.01 }}
                            onClick={() => {
                                setEditingHour(hour);
                                setEditValue(logs[hour] || '');
                            }}
                            style={{
                                background: isCurrent ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.03)',
                                padding: '0.85rem 1rem',
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                border: `1px solid ${isCurrent ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)'} `,
                                cursor: 'pointer'
                            }}
                        >
                            <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                color: isCurrent ? 'var(--accent-primary)' : 'var(--text-muted)',
                                minWidth: '65px'
                            }}>
                                {formatHour(hour)}
                            </span>
                            <span style={{
                                fontSize: '0.95rem',
                                color: hasLog ? 'var(--text-primary)' : 'var(--text-muted)',
                                fontStyle: hasLog ? 'normal' : 'italic',
                                flex: 1,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                            }}>
                                {logs[hour] || ''}
                            </span>
                        </motion.div>
                    );
                })}
            </div>

            {/* Quick Edit Overlay */}
            <AnimatePresence>
                {editingHour !== null && (
                    <div style={{
                        position: 'fixed', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '1rem', zIndex: 10000
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
                                width: '100%', maxWidth: '450px',
                                background: 'var(--bg-card)',
                                borderRadius: '28px', padding: '1.75rem',
                                position: 'relative', zIndex: 1,
                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                                border: '1px solid var(--border-subtle)'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                                    Editing {formatHour(editingHour)}
                                </h3>
                                <button onClick={() => setEditingHour(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <textarea
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                placeholder="What happened?"
                                style={{
                                    width: '100%', height: '100px',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '16px', padding: '1rem',
                                    color: 'var(--text-primary)', fontSize: '1rem',
                                    outline: 'none', resize: 'none', marginBottom: '1.5rem'
                                }}
                            />
                            <button
                                onClick={() => {
                                    saveLog(editingHour, editValue);
                                    setEditingHour(null);
                                }}
                                style={{
                                    width: '100%', padding: '0.85rem', borderRadius: '14px',
                                    background: 'var(--accent-primary)', border: 'none',
                                    color: 'white', fontWeight: 700, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                                }}
                            >
                                <Save size={18} />
                                Update Log
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </section>
    );
};
