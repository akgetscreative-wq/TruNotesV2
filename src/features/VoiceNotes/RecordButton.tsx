import React from 'react';
import { motion } from 'framer-motion';
import { LoaderCircle, Mic, Pause } from 'lucide-react';

interface RecordButtonProps {
    isRecording: boolean;
    isDisabled: boolean;
    onClick: () => void;
    dark?: boolean;
}

export const RecordButton: React.FC<RecordButtonProps> = ({ isRecording, isDisabled, onClick, dark = false }) => {
    return (
        <motion.button
            type="button"
            onClick={onClick}
            whileHover={isDisabled ? undefined : { scale: 1.03 }}
            whileTap={isDisabled ? undefined : { scale: 0.96 }}
            disabled={isDisabled}
            style={{
                position: 'relative',
                width: '7.5rem',
                height: '7.5rem',
                borderRadius: '999px',
                border: 'none',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                background: isRecording
                    ? (dark ? 'linear-gradient(135deg, #fb7185 0%, #f472b6 100%)' : 'linear-gradient(135deg, #ff8ba7 0%, #ffb3c7 100%)')
                    : (dark ? 'linear-gradient(135deg, #4f46e5 0%, #60a5fa 100%)' : 'linear-gradient(135deg, #94b8ff 0%, #bfd2ff 100%)'),
                boxShadow: isRecording
                    ? (dark ? '0 24px 70px rgba(244, 114, 182, 0.26)' : '0 24px 70px rgba(255, 139, 167, 0.35)')
                    : (dark ? '0 24px 70px rgba(96, 165, 250, 0.22)' : '0 24px 70px rgba(148, 184, 255, 0.28)'),
                display: 'grid',
                placeItems: 'center',
                overflow: 'visible',
                opacity: isDisabled ? 0.75 : 1,
            }}
        >
            <motion.span
                aria-hidden
                animate={isRecording ? { scale: [1, 1.16, 1], opacity: [0.3, 0.55, 0.3] } : { scale: [1, 1.08, 1], opacity: [0.14, 0.28, 0.14] }}
                transition={{ duration: isRecording ? 1.3 : 2.2, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                    position: 'absolute',
                    inset: '-14px',
                    borderRadius: 'inherit',
                    border: `2px solid ${isRecording ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.45)'}`,
                }}
            />
            <motion.span
                animate={isRecording ? { scale: [1, 1.04, 1] } : { scale: [1, 1.02, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                    width: '5.6rem',
                    height: '5.6rem',
                    borderRadius: '999px',
                    background: dark ? 'rgba(15,23,42,0.34)' : 'rgba(255,255,255,0.35)',
                    backdropFilter: 'blur(18px)',
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: dark ? 'inset 0 1px 1px rgba(255,255,255,0.08)' : 'inset 0 1px 1px rgba(255,255,255,0.4)',
                }}
            >
                {isDisabled && !isRecording ? <LoaderCircle size={28} /> : isRecording ? <Pause size={28} /> : <Mic size={30} />}
            </motion.span>
        </motion.button>
    );
};
