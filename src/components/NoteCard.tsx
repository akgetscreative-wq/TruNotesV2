import React from 'react';
import type { Note } from '../types';
import { CalendarDays, PenSquare, Sparkles, Star } from 'lucide-react';

interface NoteCardProps {
    note: Note;
    onClick: (note: Note) => void;
    onContextMenu?: (e: React.MouseEvent, note: Note) => void;
}

type ThemePalette = {
    tint: string;
    accent: string;
    border: string;
    chip: string;
    chipBorder: string;
    imageBg: string;
};

const lightThemes: Record<string, ThemePalette> = {
    rose: { tint: 'linear-gradient(180deg, rgba(255, 241, 242, 0.96), rgba(255, 255, 255, 0.94))', accent: '#f43f5e', border: 'rgba(244, 63, 94, 0.16)', chip: 'rgba(255,255,255,0.75)', chipBorder: 'rgba(244, 63, 94, 0.14)', imageBg: 'linear-gradient(180deg, rgba(255,245,247,0.98), rgba(255,255,255,0.95))' },
    sage: { tint: 'linear-gradient(180deg, rgba(240, 253, 244, 0.96), rgba(255, 255, 255, 0.94))', accent: '#10b981', border: 'rgba(16, 185, 129, 0.16)', chip: 'rgba(255,255,255,0.75)', chipBorder: 'rgba(16, 185, 129, 0.14)', imageBg: 'linear-gradient(180deg, rgba(240,253,244,0.98), rgba(255,255,255,0.95))' },
    sky: { tint: 'linear-gradient(180deg, rgba(240, 249, 255, 0.96), rgba(255, 255, 255, 0.94))', accent: '#0ea5e9', border: 'rgba(14, 165, 233, 0.16)', chip: 'rgba(255,255,255,0.75)', chipBorder: 'rgba(14, 165, 233, 0.14)', imageBg: 'linear-gradient(180deg, rgba(240,249,255,0.98), rgba(255,255,255,0.95))' },
    lavender: { tint: 'linear-gradient(180deg, rgba(245, 243, 255, 0.96), rgba(255, 255, 255, 0.94))', accent: '#8b5cf6', border: 'rgba(139, 92, 246, 0.16)', chip: 'rgba(255,255,255,0.75)', chipBorder: 'rgba(139, 92, 246, 0.14)', imageBg: 'linear-gradient(180deg, rgba(245,243,255,0.98), rgba(255,255,255,0.95))' },
    lemon: { tint: 'linear-gradient(180deg, rgba(255, 251, 235, 0.96), rgba(255, 255, 255, 0.94))', accent: '#d97706', border: 'rgba(217, 119, 6, 0.16)', chip: 'rgba(255,255,255,0.75)', chipBorder: 'rgba(217, 119, 6, 0.14)', imageBg: 'linear-gradient(180deg, rgba(255,251,235,0.98), rgba(255,255,255,0.95))' },
    default: { tint: 'linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(248, 250, 252, 0.95))', accent: '#64748b', border: 'rgba(148, 163, 184, 0.16)', chip: 'rgba(255,255,255,0.75)', chipBorder: 'rgba(148, 163, 184, 0.14)', imageBg: 'linear-gradient(180deg, rgba(248,250,252,0.98), rgba(255,255,255,0.95))' }
};

const darkThemes: Record<string, ThemePalette> = {
    rose: { tint: 'linear-gradient(180deg, rgba(76, 5, 25, 0.74), rgba(30, 41, 59, 0.92))', accent: '#fda4af', border: 'rgba(251, 113, 133, 0.2)', chip: 'rgba(15,23,42,0.5)', chipBorder: 'rgba(251, 113, 133, 0.18)', imageBg: 'linear-gradient(180deg, rgba(76,5,25,0.45), rgba(15,23,42,0.92))' },
    sage: { tint: 'linear-gradient(180deg, rgba(6, 78, 59, 0.72), rgba(15, 23, 42, 0.92))', accent: '#86efac', border: 'rgba(74, 222, 128, 0.2)', chip: 'rgba(15,23,42,0.5)', chipBorder: 'rgba(74, 222, 128, 0.18)', imageBg: 'linear-gradient(180deg, rgba(6,78,59,0.42), rgba(15,23,42,0.92))' },
    sky: { tint: 'linear-gradient(180deg, rgba(7, 89, 133, 0.72), rgba(15, 23, 42, 0.92))', accent: '#7dd3fc', border: 'rgba(56, 189, 248, 0.2)', chip: 'rgba(15,23,42,0.5)', chipBorder: 'rgba(56, 189, 248, 0.18)', imageBg: 'linear-gradient(180deg, rgba(7,89,133,0.42), rgba(15,23,42,0.92))' },
    lavender: { tint: 'linear-gradient(180deg, rgba(76, 29, 149, 0.68), rgba(15, 23, 42, 0.92))', accent: '#c4b5fd', border: 'rgba(167, 139, 250, 0.2)', chip: 'rgba(15,23,42,0.5)', chipBorder: 'rgba(167, 139, 250, 0.18)', imageBg: 'linear-gradient(180deg, rgba(76,29,149,0.42), rgba(15,23,42,0.92))' },
    lemon: { tint: 'linear-gradient(180deg, rgba(120, 53, 15, 0.7), rgba(15, 23, 42, 0.92))', accent: '#fde68a', border: 'rgba(251, 191, 36, 0.2)', chip: 'rgba(15,23,42,0.5)', chipBorder: 'rgba(251, 191, 36, 0.18)', imageBg: 'linear-gradient(180deg, rgba(120,53,15,0.42), rgba(15,23,42,0.92))' },
    default: { tint: 'linear-gradient(180deg, rgba(30, 41, 59, 0.96), rgba(15, 23, 42, 0.94))', accent: '#cbd5e1', border: 'rgba(148, 163, 184, 0.18)', chip: 'rgba(15,23,42,0.5)', chipBorder: 'rgba(148, 163, 184, 0.16)', imageBg: 'linear-gradient(180deg, rgba(30,41,59,0.96), rgba(15,23,42,0.94))' }
};

const getPreview = (note: Note) => {
    if (!note.content) return 'Start writing and this note will appear here.';

    try {
        if (note.content.trim().startsWith('{')) {
            const parsed = JSON.parse(note.content);
            if (parsed._journalV2) {
                const mainPart = parsed.mainContent || '';
                const blockPart = (parsed.textBlocks || []).map((block: { content?: string }) => block.content || '').join(' ');
                const combined = `${mainPart} ${blockPart}`.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                return combined || 'Blank journal entry';
            }
        }
    } catch {
        // Fall back to plain-text rendering.
    }

    return note.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || 'Empty note';
};

const formatStamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isSameDay = date.toDateString() === now.toDateString();

    if (isSameDay) {
        return `Today, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const NoteCard: React.FC<NoteCardProps> = ({ note, onClick, onContextMenu }) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const isDark = typeof document !== 'undefined' && (document.documentElement.getAttribute('data-theme') === 'dark' || document.body.getAttribute('data-theme') === 'dark');
    const paletteSource = isDark ? darkThemes : lightThemes;
    const theme = paletteSource[note.color || 'default'] || paletteSource.default;
    const preview = getPreview(note);
    const tags = note.tags?.slice(0, isMobile ? 2 : 3) || [];
    const isDrawing = note.type === 'drawing';

    return (
        <article
            onClick={() => onClick(note)}
            onContextMenu={(e) => onContextMenu?.(e, note)}
            className="note-card"
            style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                minHeight: isMobile ? '220px' : '260px',
                padding: isMobile ? '1rem' : '1.2rem',
                borderRadius: isMobile ? '24px' : '28px',
                background: theme.tint,
                border: `1px solid ${theme.border}`,
                boxShadow: isDark ? '0 24px 50px rgba(2, 6, 23, 0.38)' : '0 20px 45px rgba(15, 23, 42, 0.08)',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.28s ease, box-shadow 0.28s ease, border-color 0.28s ease',
                backdropFilter: 'blur(18px)'
            }}
            onMouseEnter={(e) => {
                if (!isMobile) {
                    e.currentTarget.style.transform = 'translateY(-6px)';
                    e.currentTarget.style.boxShadow = isDark ? '0 28px 60px rgba(2, 6, 23, 0.48)' : '0 26px 55px rgba(15, 23, 42, 0.14)';
                    e.currentTarget.style.borderColor = theme.accent;
                }
            }}
            onMouseLeave={(e) => {
                if (!isMobile) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = isDark ? '0 24px 50px rgba(2, 6, 23, 0.38)' : '0 20px 45px rgba(15, 23, 42, 0.08)';
                    e.currentTarget.style.borderColor = theme.border;
                }
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: '0 auto auto 0',
                    width: '100%',
                    height: isMobile ? '88px' : '100px',
                    background: `radial-gradient(circle at top left, ${theme.accent}18, transparent 62%)`,
                    pointerEvents: 'none'
                }}
            />

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.9rem', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                    <div
                        style={{
                            width: '0.7rem',
                            height: '0.7rem',
                            borderRadius: '999px',
                            background: theme.accent,
                            boxShadow: `0 0 0 6px ${theme.accent}18`
                        }}
                    />
                    <span
                        style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: theme.accent
                        }}
                    >
                        {isDrawing ? 'Sketch note' : 'Quick note'}
                    </span>
                </div>

                {note.isFavorite && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '2rem',
                            height: '2rem',
                            borderRadius: '999px',
                            background: isDark ? 'rgba(15,23,42,0.52)' : 'rgba(255,255,255,0.75)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.22)',
                            flexShrink: 0
                        }}
                    >
                        <Star size={14} fill="currentColor" />
                    </div>
                )}
            </div>

            {isDrawing ? (
                <div
                    style={{
                        position: 'relative',
                        overflow: 'hidden',
                        borderRadius: isMobile ? '18px' : '22px',
                        minHeight: isMobile ? '116px' : '132px',
                        background: theme.imageBg,
                        border: '1px solid rgba(148, 163, 184, 0.16)',
                        marginBottom: '0.85rem'
                    }}
                >
                    <img
                        src={note.content}
                        alt={note.title || 'Sketch note'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            right: '0.7rem',
                            bottom: '0.7rem',
                            padding: '0.3rem 0.55rem',
                            borderRadius: '999px',
                            background: isDark ? 'rgba(15,23,42,0.78)' : 'rgba(255,255,255,0.85)',
                            color: isDark ? 'rgba(226, 232, 240, 0.82)' : 'var(--text-secondary)',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            border: `1px solid ${theme.chipBorder}`
                        }}
                    >
                        Scribble
                    </div>
                </div>
            ) : (
                <>
                    <h3
                        style={{
                            margin: 0,
                            fontSize: isMobile ? '1rem' : '1.18rem',
                            lineHeight: 1.25,
                            fontWeight: 800,
                            color: isDark ? '#f8fafc' : '#1e293b',
                            letterSpacing: '-0.02em'
                        }}
                    >
                        {note.title || 'Untitled note'}
                    </h3>

                    <p
                        style={{
                            margin: '0.7rem 0 0',
                            color: isDark ? 'rgba(226, 232, 240, 0.92)' : '#334155',
                            fontSize: isMobile ? '0.82rem' : '0.94rem',
                            lineHeight: 1.65,
                            display: '-webkit-box',
                            WebkitLineClamp: isMobile ? 4 : 5,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            opacity: 0.95,
                            flex: 1
                        }}
                    >
                        {preview}
                    </p>
                </>
            )}

            {!isDrawing && tags.length > 0 && (
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.9rem' }}>
                    {tags.map((tag) => (
                        <span
                            key={tag}
                            style={{
                                padding: '0.35rem 0.6rem',
                                borderRadius: '999px',
                                background: theme.chip,
                                border: `1px solid ${theme.chipBorder}`,
                                color: isDark ? 'rgba(226, 232, 240, 0.82)' : 'var(--text-secondary)',
                                fontSize: '0.72rem',
                                fontWeight: 600
                            }}
                        >
                            #{tag}
                        </span>
                    ))}
                </div>
            )}

            <div
                style={{
                    marginTop: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid rgba(148, 163, 184, 0.14)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: isDark ? 'rgba(226, 232, 240, 0.78)' : 'var(--text-secondary)', minWidth: 0 }}>
                    <CalendarDays size={14} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {formatStamp(note.updatedAt || note.createdAt)}
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: theme.accent, flexShrink: 0 }}>
                    {isDrawing ? <PenSquare size={14} /> : <Sparkles size={14} />}
                    <span style={{ fontSize: '0.76rem', fontWeight: 700 }}>
                        {isDrawing ? 'Visual' : 'Readable'}
                    </span>
                </div>
            </div>
        </article>
    );
};
