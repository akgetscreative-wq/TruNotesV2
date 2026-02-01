import React from 'react';
import { Check } from 'lucide-react';

interface ColorPickerProps {
    selectedColor?: string;
    onSelect: (color: string) => void;
}

const COLORS = [
    { id: 'default', bg: '#ffffff', border: '#e6e2da' },
    { id: 'rose', bg: '#fff1f2', border: '#fda4af' },
    { id: 'sage', bg: '#f3fcf8', border: '#8da399' },
    { id: 'sky', bg: '#f0f9ff', border: '#7dd3fc' },
    { id: 'lavender', bg: '#f5f3ff', border: '#c4b5fd' },
    { id: 'lemon', bg: '#fefce8', border: '#fde047' },
];

export const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColor = 'default', onSelect }) => {
    return (
        <div style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem 0' }}>
            {COLORS.map((c) => (
                <button
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: c.bg,
                        border: `2px solid ${selectedColor === c.id ? 'var(--text-primary)' : c.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'transform 0.2s'
                    }}
                    title={c.id}
                >
                    {selectedColor === c.id && <Check size={16} color="var(--text-primary)" />}
                </button>
            ))}
        </div>
    );
};
