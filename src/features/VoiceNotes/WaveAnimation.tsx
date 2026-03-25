import React from 'react';
import { motion } from 'framer-motion';

interface WaveAnimationProps {
    active: boolean;
    color: string;
}

export const WaveAnimation: React.FC<WaveAnimationProps> = ({ active, color }) => {
    const bars = [0.45, 0.8, 0.55, 1, 0.6, 0.9, 0.5];

    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.32rem', height: '3rem' }}>
            {bars.map((height, index) => (
                <motion.span
                    key={index}
                    animate={active ? { scaleY: [0.35, height, 0.45] } : { scaleY: 0.35, opacity: 0.45 }}
                    transition={{
                        duration: 1.1,
                        repeat: Infinity,
                        delay: index * 0.08,
                        ease: 'easeInOut',
                    }}
                    style={{
                        width: '0.34rem',
                        height: '100%',
                        borderRadius: '999px',
                        transformOrigin: 'bottom',
                        background: color,
                        boxShadow: `0 0 18px ${color}55`,
                    }}
                />
            ))}
        </div>
    );
};
