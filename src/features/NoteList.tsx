import React, { useEffect, useState } from 'react';
import type { Note } from '../types';
import { NoteCard } from '../components/NoteCard';
import { Plus, Trash2, Copy, Star, ExternalLink, Sparkles } from 'lucide-react';

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

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, note: Note) => {
        e.preventDefault();

        let x = e.clientX;
        let y = e.clientY;
        const menuWidth = 220;
        const menuHeight = 250;

        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 20;
        if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 20;

        setContextMenu({ x, y, noteId: note.id });
    };

    const activeNote = contextMenu ? notes.find((n) => n.id === contextMenu.noteId) : null;
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
        borderRadius: '10px',
        fontSize: '0.9rem',
        transition: 'background 0.2s',
        outline: 'none'
    };

    if (loading) {
        return (
            <div
                style={{
                    textAlign: 'center',
                    padding: '4rem',
                    color: 'var(--text-secondary)',
                    background: 'rgba(255,255,255,0.55)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '28px',
                    boxShadow: 'var(--shadow-soft)'
                }}
            >
                Loading your thoughts...
            </div>
        );
    }

    return (
        <div className="fade-in" style={{ padding: 0 }}>
            {notes.length === 0 ? (
                <div className="notes-empty-state">
                    <div className="notes-empty-icon"><Sparkles size={22} /></div>
                    <h3>No notes yet</h3>
                    <p>Start a new note and your writing space will begin to fill up here.</p>
                    <button className="notes-primary-action" onClick={onNewNote}>
                        <Plus size={18} />
                        Create your first note
                    </button>
                </div>
            ) : (
                <div className="note-grid note-grid-redesigned">
                    {notes.map((note) => (
                        <NoteCard
                            key={note.id}
                            note={note}
                            onClick={onNoteClick}
                            onContextMenu={handleContextMenu}
                        />
                    ))}
                </div>
            )}

            {contextMenu && activeNote && (
                <div
                    style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        zIndex: 9999,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '16px',
                        padding: '0.5rem',
                        boxShadow: '0 20px 45px rgba(15, 23, 42, 0.18)',
                        backdropFilter: 'blur(20px)',
                        minWidth: '220px',
                        animation: 'fadeIn 0.1s ease-out'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        style={{
                            padding: '0.55rem 0.8rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: 'var(--text-muted)',
                            borderBottom: '1px solid var(--border-subtle)',
                            marginBottom: '0.5rem'
                        }}
                    >
                        Note actions
                    </div>

                    <button
                        onClick={() => { onNoteClick(activeNote); setContextMenu(null); }}
                        style={menuItemStyle}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <ExternalLink size={16} /> Open note
                    </button>

                    {onToggleFavorite && (
                        <button
                            onClick={() => { onToggleFavorite(activeNote); setContextMenu(null); }}
                            style={menuItemStyle}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <Star size={16} fill={activeNote.isFavorite ? 'currentColor' : 'none'} color={activeNote.isFavorite ? '#f59e0b' : 'currentColor'} />
                            {activeNote.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
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
                            <Trash2 size={16} /> Delete note
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
