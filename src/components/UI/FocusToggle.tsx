import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface FocusToggleProps {
    isFocused: boolean;
    onToggle: () => void;
}

export const FocusToggle: React.FC<FocusToggleProps> = ({ isFocused, onToggle }) => {
    return (
        <button
            onClick={onToggle}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem',
                borderRadius: '8px',
                color: isFocused ? 'var(--accent-primary)' : 'var(--text-muted)',
                backgroundColor: isFocused ? 'var(--bg-secondary)' : 'transparent',
                cursor: 'pointer'
            }}
            title={isFocused ? "Exit Focus Mode" : "Enter Focus Mode"}
        >
            {isFocused ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
    );
};
