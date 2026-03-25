import React from 'react';
import { useThemeContext } from '../../context/ThemeContext';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Sparkles, Wand2, X } from 'lucide-react';
import type { VoiceNote } from './types';

interface NoteModalProps {
    note: VoiceNote | null;
    onClose: () => void;
    onExtractNow: (noteId: string) => void;
}

export const NoteModal: React.FC<NoteModalProps> = ({ note, onClose, onExtractNow }) => {
    const { theme } = useThemeContext();
    const dark = theme === 'dark';

    return (
        <AnimatePresence>
            {note && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(11, 19, 37, 0.48)',
                            backdropFilter: 'blur(10px)',
                            zIndex: 120,
                        }}
                    />

                    <motion.div
                        initial={{ opacity: 0, y: 26, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 22, scale: 0.96 }}
                        transition={{ duration: 0.24, ease: 'easeOut' }}
                        style={{
                            position: 'fixed',
                            inset: 'max(2rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom)) 1rem',
                            maxWidth: '48rem',
                            margin: '0 auto',
                            zIndex: 121,
                            borderRadius: '2rem',
                            overflow: 'hidden',
                            background: dark ? 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 100%)' : 'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(246,248,255,0.96) 100%)',
                            border: dark ? '1px solid rgba(148,163,184,0.12)' : '1px solid rgba(255,255,255,0.58)',
                            boxShadow: dark ? '0 32px 80px rgba(2, 6, 23, 0.44)' : '0 32px 80px rgba(22, 31, 61, 0.22)',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <div style={{ padding: '1.1rem 1.1rem 0.85rem 1.1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: dark ? 'rgba(226,232,240,0.66)' : '#6c7d98', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                                    {note.summaryProvider === 'qwen' && note.status === 'completed' ? <Bot size={14} /> : <Sparkles size={14} />}
                                    {note.status === 'completed'
                                        ? note.summaryProvider === 'qwen'
                                            ? 'Qwen Summary Ready'
                                            : 'Basic Summary Ready'
                                        : note.status === 'processing'
                                            ? 'AI is extracting now'
                                            : 'Transcript saved'}
                                </div>
                                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: dark ? '#f8fafc' : '#233451', letterSpacing: '-0.03em' }}>
                                    {note.status === 'completed' ? note.title : 'Voice Note Transcript'}
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                style={{
                                    width: '2.6rem',
                                    height: '2.6rem',
                                    borderRadius: '999px',
                                    border: 'none',
                                    background: dark ? 'rgba(15,23,42,0.78)' : 'rgba(221, 228, 247, 0.85)',
                                    color: dark ? '#e2e8f0' : '#33415f',
                                    display: 'grid',
                                    placeItems: 'center',
                                    cursor: 'pointer',
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="dashboard-scrollbar" style={{ padding: '0 1.1rem 1.1rem 1.1rem', overflowY: 'auto' }}>
                            {note.status !== 'completed' && (
                                <div style={{
                                    marginBottom: '1rem',
                                    borderRadius: '1.25rem',
                                    padding: '0.9rem 1rem',
                                    background: dark ? 'rgba(120, 53, 15, 0.22)' : 'rgba(255, 233, 209, 0.72)',
                                    border: dark ? '1px solid rgba(251, 191, 36, 0.18)' : '1px solid rgba(248, 177, 106, 0.35)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '1rem',
                                    flexWrap: 'wrap',
                                }}>
                                    <div style={{ color: dark ? '#fcd34d' : '#7d5420', fontSize: '0.9rem', lineHeight: 1.5 }}>
                                        {note.status === 'processing'
                                            ? 'Raw transcript is ready and AI is creating the polished summary.'
                                            : 'This note is queued for AI extraction. Qwen will be used when the local model is available, otherwise the worker falls back to a simpler summary.'}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onExtractNow(note.id)}
                                        disabled={note.status === 'processing'}
                                        style={{
                                            padding: '0.7rem 1rem',
                                            borderRadius: '999px',
                                            border: 'none',
                                            background: 'linear-gradient(135deg, #7d9cff 0%, #9ab0ff 100%)',
                                            color: 'white',
                                            fontWeight: 800,
                                            cursor: note.status === 'processing' ? 'not-allowed' : 'pointer',
                                            opacity: note.status === 'processing' ? 0.72 : 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                        }}
                                    >
                                        <Wand2 size={15} />
                                        Extract now
                                    </button>
                                </div>
                            )}

                            {note.status === 'completed' && (
                                <section style={{
                                    marginBottom: '1rem',
                                    padding: '1rem',
                                    borderRadius: '1.5rem',
                                    background: note.summaryProvider === 'qwen'
                                        ? 'linear-gradient(135deg, rgba(221, 232, 255, 0.78) 0%, rgba(238, 242, 255, 0.9) 100%)'
                                        : 'linear-gradient(135deg, rgba(214, 255, 241, 0.7) 0%, rgba(233, 241, 255, 0.85) 100%)',
                                    border: note.summaryProvider === 'qwen'
                                        ? '1px solid rgba(144, 170, 245, 0.42)'
                                        : '1px solid rgba(156, 206, 193, 0.4)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', fontWeight: 800, color: note.summaryProvider === 'qwen' ? '#4468d8' : '#336b63', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.55rem' }}>
                                        {note.summaryProvider === 'qwen' ? <Bot size={14} /> : <Sparkles size={14} />}
                                        {note.summaryProvider === 'qwen' ? 'Qwen Summary' : 'Summary'}
                                    </div>
                                    <div style={{ color: dark ? 'rgba(226,232,240,0.9)' : '#274458', lineHeight: 1.8, fontSize: '0.96rem' }}>{note.summary}</div>
                                </section>
                            )}

                            {note.audioDataUrl && (
                                <section style={{
                                    marginBottom: '1rem',
                                    padding: '1rem',
                                    borderRadius: '1.5rem',
                                    background: dark ? 'rgba(15,23,42,0.72)' : 'rgba(237, 242, 255, 0.9)',
                                    border: dark ? '1px solid rgba(96,165,250,0.16)' : '1px solid rgba(177, 190, 235, 0.55)',
                                }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: dark ? 'rgba(226,232,240,0.66)' : '#667792', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.55rem' }}>
                                        Recording
                                    </div>
                                    <audio controls preload="metadata" style={{ width: '100%' }}>
                                        <source src={note.audioDataUrl} />
                                    </audio>
                                </section>
                            )}

                            <section style={{
                                padding: '1rem',
                                borderRadius: '1.5rem',
                                background: dark ? 'rgba(15,23,42,0.62)' : 'rgba(255,255,255,0.82)',
                                border: dark ? '1px solid rgba(148,163,184,0.12)' : '1px solid rgba(220, 227, 248, 0.9)',
                            }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#667792', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.55rem' }}>
                                    Transcript
                                </div>
                                <div style={{ color: dark ? 'rgba(226,232,240,0.88)' : '#32445d', lineHeight: 1.8, fontSize: '0.96rem', whiteSpace: 'pre-wrap' }}>
                                    {note.transcript}
                                </div>
                            </section>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
