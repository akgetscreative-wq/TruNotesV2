import React, { useState, useEffect } from 'react';
import type { Note } from '../types';
import { NoteCard } from '../components/NoteCard';
import { Plus, Trash2, Copy, Star, ExternalLink } from 'lucide-react';

interface NoteListProps {
    notes: Note[];
    loading: boolean;
    onNoteClick: (note: Note) => void;
    onNewNote: () => void;
    onDelete?: (id: string) => void;
    onDuplicate?: (note: Note) => void;
    onToggleFavorite?: (note: Note) => void;
}

export const NoteList: React.FC<NoteListProps> = ({
    notes, loading, onNoteClick, onNewNote,
    onDelete, onDuplicate, onToggleFavorite
}) => {
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; noteId: string } | null>(null);

    // Close menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, note: Note) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            noteId: note.id
        });
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                Loading your thoughts...
            </div>
        );
    }

    const activeNote = contextMenu ? notes.find(n => n.id === contextMenu.noteId) : null;

    const menuItemStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        width: '100%',
        padding: '0.6rem 0.75rem',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-primary)',
        textAlign: 'left' as const,
        cursor: 'pointer',
        borderRadius: '6px',
        fontSize: '0.9rem',
        transition: 'background 0.2s',
        outline: 'none'
    };

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    return (
        <div className="fade-in" style={{ padding: isMobile ? '0 0.5rem' : '0' }}>
            <div
                className="note-grid"
                style={{
                    background: 'var(--dashboard-header-bg)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: isMobile ? '20px' : '32px',
                    border: '1px solid var(--border-subtle)',
                    marginTop: isMobile ? '3rem' : '1rem', // Space for hamburger
                    minHeight: isMobile ? 'auto' : '60vh',
                    boxShadow: 'var(--shadow-soft)',
                    paddingBottom: '5rem'
                }}
            >
                <button
                    onClick={onNewNote}
                    style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '2px dashed var(--border-subtle)',
                        borderRadius: '12px',
                        height: isMobile ? '190px' : '240px', // Match NoteCard height
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-primary)',
                        gap: '0.8rem',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                    }}
                >
                    <div style={{
                        background: 'var(--accent-primary)',
                        padding: isMobile ? '0.75rem' : '1rem',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
                    }}>
                        <Plus size={isMobile ? 20 : 24} strokeWidth={3} />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: isMobile ? '1rem' : '1.1rem' }}>New Note</span>
                </button>

                {notes.map((note) => (
                    <NoteCard
                        key={note.id}
                        note={note}
                        onClick={onNoteClick}
                        onContextMenu={handleContextMenu}
                    />
                ))}
            </div>

            {/* Context Menu */}
            {contextMenu && activeNote && (
                <div
                    style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        zIndex: 9999,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '12px',
                        padding: '0.5rem',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                        backdropFilter: 'blur(20px)',
                        minWidth: '220px',
                        animation: 'fadeIn 0.1s ease-out'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--text-muted)',
                        borderBottom: '1px solid var(--border-subtle)',
                        marginBottom: '0.5rem'
                    }}>
                        Note Actions
                    </div>

                    <button
                        onClick={() => { onNoteClick(activeNote); setContextMenu(null); }}
                        style={menuItemStyle}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <ExternalLink size={16} /> Open Note
                    </button>

                    {onToggleFavorite && (
                        <button
                            onClick={() => { onToggleFavorite(activeNote); setContextMenu(null); }}
                            style={menuItemStyle}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <Star size={16} fill={activeNote.isFavorite ? "currentColor" : "none"} color={activeNote.isFavorite ? "#f59e0b" : "currentColor"} />
                            {activeNote.isFavorite ? 'Remove form Favorites' : 'Add to Favorites'}
                        </button>
                    )}

                    {onDuplicate && (
                        <button
                            onClick={() => { onDuplicate(activeNote); setContextMenu(null); }}
                            style={menuItemStyle}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <Copy size={16} /> Duplicate
                        </button>
                    )}

                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.5rem 0' }} />

                    {onDelete && (
                        <button
                            onClick={() => { onDelete(activeNote.id); setContextMenu(null); }}
                            style={{ ...menuItemStyle, color: '#ef4444' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <Trash2 size={16} /> Delete Note
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
