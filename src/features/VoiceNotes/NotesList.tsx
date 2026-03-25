import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileAudio2 } from 'lucide-react';
import type { VoiceNote } from './types';
import { NoteCard } from './NoteCard';

interface NotesListProps {
    notes: VoiceNote[];
    loading: boolean;
    onOpen: (note: VoiceNote) => void;
    onExtractNow: (noteId: string) => void;
    dark?: boolean;
}

export const NotesList: React.FC<NotesListProps> = ({ notes, loading, onOpen, onExtractNow, dark = false }) => {
    if (!loading && notes.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    padding: '2rem',
                    borderRadius: '2rem',
                    background: dark ? 'linear-gradient(180deg, rgba(15,23,42,0.78) 0%, rgba(30,41,59,0.72) 100%)' : 'linear-gradient(180deg, rgba(255,255,255,0.74) 0%, rgba(245,247,255,0.9) 100%)',
                    border: dark ? '1px solid rgba(148,163,184,0.12)' : '1px solid rgba(255,255,255,0.45)',
                    boxShadow: dark ? '0 22px 48px rgba(2,6,23,0.28)' : '0 22px 48px rgba(54, 69, 122, 0.08)',
                    textAlign: 'center',
                    color: dark ? 'rgba(226,232,240,0.72)' : '#6d7d98',
                }}
            >
                <div style={{
                    width: '4rem',
                    height: '4rem',
                    borderRadius: '1.4rem',
                    margin: '0 auto 1rem auto',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'linear-gradient(135deg, rgba(193, 208, 255, 0.5) 0%, rgba(255, 220, 228, 0.55) 100%)',
                }}>
                    <FileAudio2 size={28} color={dark ? '#93c5fd' : '#4f73db'} />
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: dark ? '#f8fafc' : '#24344c', marginBottom: '0.35rem' }}>No notes yet. Start recording!</div>
                <div style={{ fontSize: '0.92rem', lineHeight: 1.6 }}>
                    Your raw transcript appears first, then Qwen can polish it into a clean summary card when the local AI model is available.
                </div>
            </motion.div>
        );
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <AnimatePresence>
                {notes.map(note => (
                    <NoteCard key={note.id} note={note} onOpen={onOpen} onExtractNow={onExtractNow} dark={dark} />
                ))}
            </AnimatePresence>
        </div>
    );
};
