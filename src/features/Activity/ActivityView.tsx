import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart2, Smartphone, Monitor, Clock, Zap, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { storage } from '../../lib/storage';
import type { ActivitySession } from '../../types';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import { useThemeContext } from '../../context/ThemeContext';

export const ActivityView: React.FC = () => {
    const { theme: _theme } = useThemeContext();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [sessions, setSessions] = useState<ActivitySession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSessions = async () => {
            setLoading(true);
            try {
                const dateStr = format(selectedDate, 'yyyy-MM-dd');
                const data = await storage.getActivitySessions(dateStr);
                setSessions(data.sort((a, b) => a.startTime - b.startTime));
            } finally {
                setLoading(false);
            }
        };
        fetchSessions();
    }, [selectedDate]);

    const totalDuration = sessions.length > 0 ? sessions.reduce((acc, s) => acc + s.duration, 0) : 0;
    const totalHours = Math.floor(totalDuration / (1000 * 60 * 60));
    const totalMinutes = Math.floor((totalDuration % (1000 * 60 * 60)) / (1000 * 60));

    // Stats calculations
    const appUsageMap = new Map<string, number>();
    const deviceUsageMap = { android: 0, pc: 0 };

    sessions.forEach(s => {
        appUsageMap.set(s.appName, (appUsageMap.get(s.appName) || 0) + s.duration);
        deviceUsageMap[s.deviceType] += s.duration;
    });

    const topApps = Array.from(appUsageMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const busiestHourString = () => {
        if (sessions.length === 0) return 'None';
        const hours = new Array(24).fill(0);
        sessions.forEach(s => {
            const h = new Date(s.startTime).getHours();
            hours[h] += s.duration;
        });
        const maxVal = Math.max(...hours);
        const h = hours.indexOf(maxVal);
        return h === -1 ? 'None' : `${h}:00`;
    };

    if (loading) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
                <Clock className="animate-spin" size={48} color="var(--accent-primary)" />
                <p style={{ color: 'var(--text-secondary)' }}>Gathering insights...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '1rem', color: 'var(--text-primary)', height: '100%', overflowY: 'auto' }}>
            <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <BarChart2 size={32} color="var(--accent-primary)" />
                        Activity Hub
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>Insights into your digital life</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-card)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                    <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><ChevronLeft size={20} /></button>
                    <span style={{ fontWeight: 600, minWidth: '100px', textAlign: 'center' }}>{isSameDay(selectedDate, new Date()) ? 'Today' : format(selectedDate, 'MMM dd')}</span>
                    <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><ChevronRight size={20} /></button>
                </div>
            </header>

            {sessions.length === 0 ? (
                <div style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '4rem 2rem', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                    <Smartphone size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                    <h2 style={{ opacity: 0.8 }}>No Activity Recorded</h2>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '1rem auto' }}>
                        If you're on Android, ensure you have granted <b>"Usage Access"</b> in System Settings &gt; Apps &gt; Special App Access.
                    </p>
                </div>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        <StatCard icon={<Clock color="#3b82f6" />} label="Total Screen Time" value={`${totalHours}h ${totalMinutes}m`} sub="Across all devices" />
                        <StatCard icon={<Zap color="#eab308" />} label="Busiest Time" value={busiestHourString()} sub="Highest peak activity" />
                        <StatCard icon={<Smartphone color="#22c55e" />} label="Android Usage" value={`${Math.round(deviceUsageMap.android / (1000 * 60))}m`} sub="Mobile interaction" />
                        <StatCard icon={<Monitor color="#a855f7" />} label="PC Usage" value={`${Math.round(deviceUsageMap.pc / (1000 * 60))}m`} sub="Desktop workflow" />
                    </div>

                    <section style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-subtle)', marginBottom: '2rem' }}>
                        <h3 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Filter size={18} /> Integrated 24h Timeline
                        </h3>
                        <div style={{ position: 'relative', height: '140px', width: '100%', overflowX: 'auto', background: 'rgba(0,0,0,0.03)', borderRadius: '12px', padding: '10px 0' }}>
                            <div style={{ display: 'flex', position: 'absolute', width: '2400px', height: '100%' }}>
                                {Array.from({ length: 24 }).map((_, i) => (
                                    <div key={i} style={{ width: '100px', height: '100%', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '8px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 500 }}>
                                        {i}:00
                                    </div>
                                ))}
                            </div>
                            <div style={{ position: 'absolute', height: '50px', top: '50px', width: '2400px' }}>
                                {sessions.map((s) => {
                                    const startH = new Date(s.startTime).getHours();
                                    const startM = new Date(s.startTime).getMinutes();
                                    const left = (startH * 100) + (startM / 60 * 100);
                                    const width = (s.duration / (1000 * 60 * 60)) * 100;

                                    return (
                                        <motion.div
                                            key={s.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            whileHover={{ scaleY: 1.2, boxShadow: '0 8px 20px rgba(0,0,0,0.2)' }}
                                            style={{
                                                position: 'absolute',
                                                left: `${left}px`,
                                                width: `${Math.max(width, 4)}px`,
                                                height: '40px',
                                                background: s.deviceType === 'pc'
                                                    ? 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)'
                                                    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                zIndex: 10,
                                                border: '1px solid rgba(255,255,255,0.1)'
                                            }}
                                            title={`${s.appName} (${Math.round(s.duration / 60000)}m)`}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '2rem', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 14, height: 14, background: '#3b82f6', borderRadius: 4 }} /> Android Sessions</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 14, height: 14, background: '#a855f7', borderRadius: 4 }} /> PC Sessions</div>
                        </div>
                    </section>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                        <section style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-subtle)' }}>
                            <h3 style={{ margin: '0 0 1.5rem' }}>Top 5 Applications</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {topApps.map(([name, duration], idx) => (
                                    <div key={name} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                                        <div style={{ width: '100px', fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                                        <div style={{ flex: 1, height: '10px', background: 'rgba(0,0,0,0.05)', borderRadius: '5px', position: 'relative' }}>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(duration / topApps[0][1]) * 100}%` }}
                                                style={{ height: '100%', background: `hsl(${220 + idx * 25}, 70%, 50%)`, borderRadius: '5px' }}
                                            />
                                        </div>
                                        <div style={{ width: '50px', textAlign: 'right', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            {Math.round(duration / 60000)}m
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <h3 style={{ margin: '0 0 1.5rem', alignSelf: 'flex-start' }}>Device Distribution</h3>
                            <div style={{ position: 'relative', width: '180px', height: '180px' }}>
                                <svg viewBox="0 0 32 32" style={{ transform: 'rotate(-90deg)', borderRadius: '50%', width: '100%', height: '100%' }}>
                                    <circle r="16" cx="16" cy="16" fill="#a855f7" />
                                    <circle r="16" cx="16" cy="16" fill="transparent"
                                        stroke="#3b82f6"
                                        strokeWidth="32"
                                        strokeDasharray={`${(deviceUsageMap.android / (totalDuration || 1)) * 100} 100`}
                                    />
                                </svg>
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--bg-card)', width: '110px', height: '110px', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.05)' }}>
                                    <span style={{ fontSize: '24px', fontWeight: 800 }}>{totalDuration ? Math.round((deviceUsageMap.android / totalDuration) * 100) : 0}%</span>
                                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>MOBILE</span>
                                </div>
                            </div>
                            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '2rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                    <div style={{ width: 12, height: 12, border: '3px solid #3b82f6', borderRadius: '50%' }} /> Android
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                    <div style={{ width: 12, height: 12, border: '3px solid #a855f7', borderRadius: '50%' }} /> PC
                                </div>
                            </div>
                        </section>
                    </div>
                </>
            )}
        </div>
    );
};

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    sub: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, sub }) => (
    <motion.div
        whileHover={{ y: -5, boxShadow: 'var(--shadow-lg)' }}
        style={{
            background: 'var(--bg-card)',
            padding: '1.5rem',
            borderRadius: '24px',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-soft)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem'
        }}
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>
            <div style={{ background: 'rgba(0,0,0,0.03)', padding: '8px', borderRadius: '12px' }}>{icon}</div> {label}
        </div>
        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', opacity: 0.8 }}>{sub}</div>
    </motion.div>
);
