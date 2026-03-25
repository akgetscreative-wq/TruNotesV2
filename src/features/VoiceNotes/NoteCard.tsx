import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Clock3, Sparkles, Wand2 } from 'lucide-react';
import type { VoiceNote } from './types';

interface NoteCardProps {
    note: VoiceNote;
    onOpen: (note: VoiceNote) => void;
    onExtractNow: (noteId: string) => void;
    dark?: boolean;
}

function formatTimestamp(timestamp: number) {
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(timestamp);
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onOpen, onExtractNow, dark = false }) => {
    const isCompleted = note.status === 'completed';
    const isProcessing = note.status === 'processing';
    const isQwen = note.summaryProvider === 'qwen';

    return (
        <motion.article
            layout
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            whileHover={{ y: -4, scale: 1.01 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            onClick={() => onOpen(note)}
            style={{
                position: 'relative',
                padding: '1.15rem',
                borderRadius: '1.6rem',
                border: dark ? '1px solid rgba(148,163,184,0.12)' : '1px solid rgba(255,255,255,0.4)',
                background: dark ? 'linear-gradient(180deg, rgba(15,23,42,0.8) 0%, rgba(30,41,59,0.7) 100%)' : 'linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(247,245,255,0.88) 100%)',
                boxShadow: dark ? '0 18px 44px rgba(2,6,23,0.28)' : '0 18px 44px rgba(97, 76, 140, 0.1)',
                cursor: 'pointer',
                overflow: 'hidden',
                minHeight: '12rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.9rem',
            }}
        >
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    top: '-2.4rem',
                    right: '-1.8rem',
                    width: '7rem',
                    height: '7rem',
                    borderRadius: '999px',
                    background: isCompleted
                        ? isQwen
                            ? 'radial-gradient(circle, rgba(129, 156, 255, 0.34) 0%, transparent 70%)'
                            : 'radial-gradient(circle, rgba(152, 216, 200, 0.35) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(255, 207, 168, 0.4) 0%, transparent 70%)',
                }}
            />

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: dark ? '#f8fafc' : '#20324f', letterSpacing: '-0.02em' }}>
                        {isCompleted ? note.title : 'Transcript Ready'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: dark ? 'rgba(226,232,240,0.66)' : '#70819c', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                        <Clock3 size={14} />
                        {formatTimestamp(note.createdAt)}
                    </div>
                </div>
                <div
                    style={{
                        padding: '0.42rem 0.7rem',
                        borderRadius: '999px',
                        background: isCompleted ? (isQwen ? 'rgba(125, 156, 255, 0.18)' : 'rgba(126, 211, 174, 0.18)') : 'rgba(255, 182, 120, 0.18)',
                        color: isCompleted ? (isQwen ? '#4468d8' : '#197a57') : '#b8681f',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                    }}
                >
                    {isCompleted && isQwen ? <Bot size={13} /> : <Sparkles size={13} />}
                    {isCompleted ? (isQwen ? 'Qwen AI' : 'Basic Summary') : isProcessing ? 'AI Working' : 'Queued'}
                </div>
            </div>

            <div
                style={{
                    color: dark ? 'rgba(226,232,240,0.84)' : '#4f5f79',
                    fontSize: '0.92rem',
                    lineHeight: 1.6,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    minHeight: '4.45rem',
                }}
            >
                {isCompleted ? note.summary : note.transcript}
            </div>

            {!isCompleted && (
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: dark ? '#fbbf24' : '#8b6a40', fontSize: '0.78rem', fontWeight: 600 }}>
                        <motion.span
                            animate={isProcessing ? { opacity: [0.35, 1, 0.35] } : { opacity: 0.6 }}
                            transition={{ duration: 1.1, repeat: Infinity }}
                            style={{
                                width: '0.48rem',
                                height: '0.48rem',
                                borderRadius: '999px',
                                background: '#f5a25d',
                                boxShadow: '0 0 16px rgba(245, 162, 93, 0.7)',
                            }}
                        />
                        {isProcessing ? 'Summarizing now' : 'Waiting for AI extract'}
                    </div>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onExtractNow(note.id);
                        }}
                        disabled={isProcessing}
                        style={{
                            padding: '0.55rem 0.85rem',
                            borderRadius: '999px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #7d9cff 0%, #9db4ff 100%)',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            opacity: isProcessing ? 0.7 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                        }}
                    >
                        <Wand2 size={14} />
                        Extract now
                    </button>
                </div>
            )}
        </motion.article>
    );
};
