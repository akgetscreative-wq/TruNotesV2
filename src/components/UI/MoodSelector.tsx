import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MoodSelectorProps {
    currentMood?: string;
    onSelect: (mood: string) => void;
}

const MOODS = ['☀️', '☁️', '🌧️', '⚡', '🌙', '☕', '🌱', '✨'];

export const MoodSelector: React.FC<MoodSelectorProps> = ({ currentMood, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div style={{ position: 'relative', zIndex: 10 }}>
            {/* Trigger Button */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                whileTap={{ scale: 0.95 }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-soft)'
                }}
            >
                <span style={{ fontSize: '1.2rem' }}>{currentMood || '✨'}</span>
                <span>{currentMood ? 'Change Mood' : 'How are you?'}</span>
            </motion.button>

            {/* Expanding Emojis Grid */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Invisible Backdrop to close */}
                        <div
                            onClick={() => setIsOpen(false)}
                            style={{ position: 'fixed', inset: 0, zIndex: 9 }}
                        />

                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            style={{
                                position: 'absolute',
                                top: 'calc(100% + 0.5rem)',
                                left: 0,
                                background: 'var(--bg-card)',
                                padding: '0.75rem',
                                borderRadius: '16px',
                                border: '1px solid var(--border-subtle)',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: '0.5rem',
                                zIndex: 10,
                                width: '200px',
                                backdropFilter: 'blur(12px)'
                            }}
                        >
                            {MOODS.map((mood) => (
                                <button
                                    key={mood}
                                    onClick={() => {
                                        onSelect(mood);
                                        setIsOpen(false);
                                    }}
                                    style={{
                                        fontSize: '1.4rem',
                                        padding: '0.5rem',
                                        borderRadius: '10px',
                                        backgroundColor: currentMood === mood ? 'var(--accent-subtle)' : 'transparent',
                                        border: 'none',
                                        transition: 'background 0.2s',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {mood}
                                </button>
                            ))}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
