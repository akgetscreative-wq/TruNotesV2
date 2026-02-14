import React from 'react';
import type { Note } from '../types';
import { Calendar, Star } from 'lucide-react';

interface NoteCardProps {
    note: Note;
    onClick: (note: Note) => void;
    onContextMenu?: (e: React.MouseEvent, note: Note) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onClick, onContextMenu }) => {
    const colorClass = `note-color-${note.color || 'default'}`;

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    return (
        <div
            onClick={() => onClick(note)}
            onContextMenu={(e) => {
                if (onContextMenu) onContextMenu(e, note);
            }}
            className={`note-card ${colorClass}`}
            style={{
                backgroundColor: 'var(--note-bg)',
                backgroundImage: 'linear-gradient(transparent 96%, rgba(0,0,0,0.03) 97%)',
                backgroundSize: isMobile ? '100% 1.25rem' : '100% 1.6rem',
                backgroundAttachment: 'local',
                padding: isMobile ? '0.75rem 1rem' : '1.5rem',
                paddingLeft: isMobile ? '1.8rem' : '3.5rem',
                borderRadius: '8px 16px 16px 8px',
                cursor: 'pointer',
                transition: 'transform 0.3s ease, filter 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
                height: isMobile ? '190px' : '240px',
                overflow: 'hidden',
                position: 'relative',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(0,0,0,0.03)',

                // Transparent Punch Holes (Subtler)
                maskImage: isMobile
                    ? 'radial-gradient(circle at 8px 50%, transparent 3px, black 3.5px)'
                    : 'radial-gradient(circle at 18px 50%, transparent 7px, black 7.5px)',
                WebkitMaskImage: isMobile
                    ? 'radial-gradient(circle at 8px 50%, transparent 3px, black 3.5px)'
                    : 'radial-gradient(circle at 18px 50%, transparent 7px, black 7.5px)',
                maskSize: isMobile ? '100% 20px' : '100% 40px',
                WebkitMaskSize: isMobile ? '100% 20px' : '100% 40px',
                maskRepeat: 'repeat-y',
                WebkitMaskRepeat: 'repeat-y',

                filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.03))',
            }}
            onMouseEnter={(e) => {
                if (!isMobile) {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.filter = 'drop-shadow(0 12px 20px rgba(0,0,0,0.1))';
                }
            }}
            onMouseLeave={(e) => {
                if (!isMobile) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.filter = 'drop-shadow(0 4px 10px rgba(0,0,0,0.05))';
                }
            }}
        >

            {/* Emotional Indicator - Minimal Dot */}
            {note.mood && (
                <div style={{
                    position: 'absolute',
                    top: isMobile ? '0.5rem' : '1rem',
                    right: isMobile ? '0.5rem' : '1rem',
                    fontSize: isMobile ? '0.7rem' : '1rem',
                    opacity: 0.6,
                    filter: 'grayscale(0.3)',
                    zIndex: 10
                }}>
                    {note.mood}
                </div>
            )}

            {note.type === 'drawing' ? (
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    margin: isMobile ? '-0.75rem -1rem' : '-1.5rem',
                    marginBottom: '0.4rem',
                    marginLeft: isMobile ? '-1.8rem' : '-3.5rem'
                }}>
                    <div style={{ flex: 1, overflow: 'hidden', background: '#f8fafc', position: 'relative' }}>
                        <img
                            src={note.content}
                            alt={note.title || "Scribble"}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                opacity: 0.95,
                                paddingLeft: isMobile ? '1.8rem' : '3.5rem'
                            }}
                        />
                        <div style={{
                            position: 'absolute',
                            bottom: '0.3rem',
                            right: '0.3rem',
                            background: 'rgba(255,255,255,0.8)',
                            padding: '0.1rem 0.3rem',
                            borderRadius: '3px',
                            fontSize: '0.5rem',
                            fontWeight: 600,
                            backdropFilter: 'blur(4px)'
                        }}>
                            SCRIBBLE
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <h3 style={{
                        fontSize: isMobile ? '0.95rem' : '1.4rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: '0.1rem',
                        fontFamily: 'var(--font-serif)',
                        paddingRight: '1rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {note.title || 'Untitled'}
                    </h3>

                    <p style={{
                        flex: 1,
                        color: 'var(--note-text-body)',
                        fontSize: isMobile ? '0.75rem' : '1rem',
                        lineHeight: isMobile ? '1.4' : '1.6',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: isMobile ? 3 : 5,
                        WebkitBoxOrient: 'vertical',
                        opacity: 0.9
                    }}>
                        {note.content ? note.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : 'Empty note...'}
                    </p>
                </>
            )}

            {/* Tags Row - Minimal Pills */}
            {note.tags && note.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    {note.tags.slice(0, isMobile ? 2 : 3).map(tag => (
                        <span key={tag} style={{
                            fontSize: '0.6rem',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            backgroundColor: 'rgba(0,0,0,0.05)',
                            color: 'var(--text-secondary)',
                            fontWeight: 500
                        }}>
                            #{tag}
                        </span>
                    ))}
                </div>
            )}

            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                marginTop: 'auto',
                paddingTop: '0.5rem',
                borderTop: '1px solid rgba(0,0,0,0.03)'
            }}>
                <Calendar size={12} />
                <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                {note.isFavorite && (
                    <div style={{ marginLeft: 'auto', color: '#f59e0b' }}>
                        <Star size={14} fill="#f59e0b" />
                    </div>
                )}
            </div>
        </div>
    );
};
