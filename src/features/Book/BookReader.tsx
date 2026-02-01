import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface BookReaderProps {
    title: string;
    content: string;
    onClose: () => void;
    theme: 'light' | 'dark';
}

export const BookReader: React.FC<BookReaderProps> = ({ title, content, onClose, theme }) => {
    const [currentPage, setCurrentPage] = useState(0);
    const [direction, setDirection] = useState(0); // 1 for next, -1 for prev

    // --- Content Pagination Logic ---
    // A simple heuristic to split content into "pages"
    const CHARS_PER_PAGE = 500; // Reduced for safety with newlines
    const pages = React.useMemo(() => {
        // Manual parsing to guarantee robust newline handling (innerText can be flaky on detached nodes)
        let clean = content;

        // 1. Force newlines at block boundaries BEFORE stripping tags
        clean = clean.replace(/<\/div>/gi, '\n');
        clean = clean.replace(/<\/p>/gi, '\n');
        clean = clean.replace(/<br\s*\/?>/gi, '\n');
        clean = clean.replace(/<li>/gi, '\n• '); // Handle bullet points nicely
        clean = clean.replace(/<\/li>/gi, '');

        // 2. Strip all remaining HTML tags
        clean = clean.replace(/<[^>]+>/g, '');

        // 3. Decode HTML entities (e.g. &nbsp;, &amp;)
        const txt = document.createElement("textarea");
        txt.innerHTML = clean;
        clean = txt.value;

        // 4. Split using capturing group to keep delimiters (newlines/spaces)
        const words = clean.split(/(\s+)/);

        const tempPages: string[] = [];
        let currentString = '';
        let currentLength = 0;

        for (const word of words) {
            // Calculate a "visual weight" for the token.
            // Newlines are heavy (force vertical space), regular chars are light.
            const newlineCount = (word.match(/\n/g) || []).length;

            // If it's a pure newline token, it takes zero "horizontal" space but moves cursor down.
            // But we are limited by "CHARS_PER_PAGE" (a proxy for height).
            // So we treat \n as expensive.
            const weight = word.length + (newlineCount * 40);

            if (currentLength + weight > CHARS_PER_PAGE) {
                // Page full, push and start new
                tempPages.push(currentString);
                currentString = word;
                // If we start a fresh page with a newline, it might look empty at top, 
                // but that's acceptable preservation of spacing.
                currentLength = weight;
            } else {
                currentString += word;
                currentLength += weight;
            }
        }
        if (currentString) tempPages.push(currentString);

        return tempPages.length > 0 ? tempPages : [''];
    }, [content]);

    const totalPages = pages.length;
    // We show pages: currentPage (Left) and currentPage + 1 (Right)
    // currentPage must always be even (0, 2, 4...)

    const nextPage = () => {
        if (currentPage + 2 < totalPages) {
            setDirection(1);
            setCurrentPage(prev => prev + 2);
        }
    };

    const prevPage = () => {
        if (currentPage - 2 >= 0) {
            setDirection(-1);
            setCurrentPage(prev => prev - 2);
        }
    };



    // Paper Texture
    const paperBg = theme === 'dark' ? '#1e293b' : '#fdfbf7'; // Warm paper in light
    const paperColor = theme === 'dark' ? '#e2e8f0' : '#1e1e1e';
    const lineColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const linedBg = `repeating-linear-gradient(transparent 0px, transparent 31px, ${lineColor} 32px)`;

    return createPortal(
        <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: theme === 'dark' ? '#0f172a' : '#d1d5db', // Desk background
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            perspective: '1500px', // Crucial for 3D effect
            overflow: 'hidden'
        }}>
            {/* Header / Controls */}
            <div style={{
                position: 'absolute', top: '1rem', right: '2rem', zIndex: 1002,
                display: 'flex', gap: '1rem'
            }}>
                <button onClick={onClose} style={{ padding: '0.8rem', borderRadius: '50%', background: 'rgba(255,0,0,0.1)', color: '#ef4444' }}>
                    <X size={24} />
                </button>
            </div>

            {/* Title (Floating above book) */}
            <h2 style={{
                marginBottom: '2rem', fontSize: '2rem', fontWeight: 600,
                color: theme === 'dark' ? '#fff' : '#333',
                fontFamily: 'var(--font-serif)',
                textShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
                {title || 'Untitled Book'}
            </h2>

            {/* The Book Container */}
            <div style={{
                display: 'flex',
                width: '90vw', maxWidth: '1400px',
                height: '80vh',
                position: 'relative',
                transformStyle: 'preserve-3d'
            }}>

                {/* Realistic 3D Page Flip -- The "Leaf" Architecture */}
                <AnimatePresence mode="popLayout" custom={direction}>
                    <motion.div
                        key={currentPage}
                        custom={direction}
                        variants={{
                            // The entering component (New Page) sits at the bottom static
                            enter: { zIndex: 0, opacity: 1 },
                            // The active component sits static
                            center: { zIndex: 1, opacity: 1 },
                            // The exiting component (Old Page) sits ON TOP and performs the flip animation
                            exit: { zIndex: 10, opacity: 1 }
                        }}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        style={{
                            position: 'absolute', inset: 0,
                            display: 'flex',
                            width: '100%', height: '100%',
                            perspective: '2000px', // Global perspective
                            transformStyle: 'preserve-3d',
                        }}
                    >
                        {/* --- Base Static Layer --- */}
                        {/* Left Static Page (Always Visible unless flipping this side) */}
                        <motion.div
                            style={{
                                flex: 1, background: paperBg, color: paperColor, backgroundImage: linedBg,
                                borderRadius: '12px 0 0 12px', padding: '3rem', whiteSpace: 'pre-wrap', overflow: 'hidden',
                                boxShadow: 'inset -10px 0 20px rgba(0,0,0,0.1)', borderRight: '1px solid rgba(0,0,0,0.1)',
                                fontFamily: 'var(--font-serif)', fontSize: '1.2rem', lineHeight: '2rem'
                            }}
                            // Hide this static base if we are flipping it (Prev Direction) to avoid z-fighting
                            variants={{
                                exit: (d: number) => ({ opacity: d < 0 ? 0 : 1 })
                            }}
                        >
                            <div style={{ opacity: 0.5, position: 'absolute', bottom: '2rem', left: '4rem', fontSize: '0.9rem' }}>{currentPage + 1}</div>
                            {pages[currentPage]}
                        </motion.div>

                        {/* Right Static Page */}
                        <motion.div
                            style={{
                                flex: 1, background: paperBg, color: paperColor, backgroundImage: linedBg,
                                borderRadius: '0 12px 12px 0', padding: '3rem', whiteSpace: 'pre-wrap', overflow: 'hidden',
                                boxShadow: 'inset 10px 0 20px rgba(0,0,0,0.1)', borderLeft: '1px solid rgba(0,0,0,0.05)',
                                fontFamily: 'var(--font-serif)', fontSize: '1.2rem', lineHeight: '2rem'
                            }}
                            // Hide this static base if we are flipping it (Next Direction) to reveail new page below
                            variants={{
                                exit: (d: number) => ({ opacity: d > 0 ? 0 : 1 })
                            }}
                        >
                            <div style={{ opacity: 0.5, position: 'absolute', bottom: '2rem', right: '4rem', fontSize: '0.9rem' }}>{currentPage + 2}</div>
                            {pages[currentPage + 1]}
                        </motion.div>


                        {/* --- Dynamic Flipping Leaves --- */}

                        {/* Right Leaf (Flips Left on NEXT) */}
                        <motion.div
                            style={{
                                position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%',
                                transformStyle: 'preserve-3d', transformOrigin: 'left center',
                                pointerEvents: 'none' // Let clicks pass through
                            }}
                            variants={{
                                enter: { rotateY: 0 },
                                center: { rotateY: 0 },
                                exit: (d: number) => ({
                                    rotateY: d > 0 ? -180 : 0,
                                    transition: { duration: 0.9, ease: [0.15, 0.45, 0.15, 1.0] } // Realistic smooth-snap
                                })
                            }}
                        >
                            {/* Front of Right Leaf (Current P+1) */}
                            <div style={{
                                position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                                background: paperBg, color: paperColor, backgroundImage: linedBg,
                                borderRadius: '0 12px 12px 0', padding: '3rem', whiteSpace: 'pre-wrap', overflow: 'hidden',
                                boxShadow: 'inset 10px 0 20px rgba(0,0,0,0.1)',
                                borderLeft: '1px solid rgba(0,0,0,0.05)',
                                fontFamily: 'var(--font-serif)', fontSize: '1.2rem', lineHeight: '2rem'
                            }}>
                                <div style={{ opacity: 0.5, position: 'absolute', bottom: '2rem', right: '4rem', fontSize: '0.9rem' }}>{currentPage + 2}</div>
                                {pages[currentPage + 1]}
                                {/* Gradient Overlay for shadow during turn */}
                                <motion.div
                                    style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,0), rgba(0,0,0,0.2))' }}
                                    variants={{ exit: { opacity: 1 }, center: { opacity: 0 } }}
                                />
                            </div>

                            {/* Back of Right Leaf (Becomes New Left: P+2) */}
                            <div style={{
                                position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                                background: paperBg, color: paperColor, backgroundImage: linedBg,
                                borderRadius: '12px 0 0 12px', padding: '3rem', whiteSpace: 'pre-wrap', overflow: 'hidden',
                                transform: 'rotateY(180deg)', // Pre-rotated to show when flipped
                                boxShadow: 'inset -10px 0 20px rgba(0,0,0,0.1)',
                                borderRight: '1px solid rgba(0,0,0,0.1)',
                                fontFamily: 'var(--font-serif)', fontSize: '1.2rem', lineHeight: '2rem'
                            }}>
                                <div style={{ opacity: 0.5, position: 'absolute', bottom: '2rem', left: '4rem', fontSize: '0.9rem' }}>{currentPage + 3}</div>
                                {pages[currentPage + 2] || ""}
                            </div>
                        </motion.div>


                        {/* Left Leaf (Flips Right on PREV) */}
                        <motion.div
                            style={{
                                position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%',
                                transformStyle: 'preserve-3d', transformOrigin: 'right center',
                                pointerEvents: 'none'
                            }}
                            variants={{
                                enter: { rotateY: 0 },
                                center: { rotateY: 0 },
                                exit: (d: number) => ({
                                    rotateY: d < 0 ? 180 : 0,
                                    transition: { duration: 0.9, ease: [0.15, 0.45, 0.15, 1.0] }
                                })
                            }}
                        >
                            {/* Front of Left Leaf (Current P) */}
                            <div style={{
                                position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                                background: paperBg, color: paperColor, backgroundImage: linedBg,
                                borderRadius: '12px 0 0 12px', padding: '3rem', whiteSpace: 'pre-wrap', overflow: 'hidden',
                                boxShadow: 'inset -10px 0 20px rgba(0,0,0,0.1)',
                                borderRight: '1px solid rgba(0,0,0,0.1)',
                                fontFamily: 'var(--font-serif)', fontSize: '1.2rem', lineHeight: '2rem'
                            }}>
                                <div style={{ opacity: 0.5, position: 'absolute', bottom: '2rem', left: '4rem', fontSize: '0.9rem' }}>{currentPage + 1}</div>
                                {pages[currentPage]}
                                <motion.div
                                    style={{ position: 'absolute', inset: 0, background: 'linear-gradient(-90deg, rgba(0,0,0,0), rgba(0,0,0,0.2))' }}
                                    variants={{ exit: { opacity: 1 }, center: { opacity: 0 } }}
                                />
                            </div>

                            {/* Back of Left Leaf (Becomes New Right: P-1) */}
                            <div style={{
                                position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                                background: paperBg, color: paperColor, backgroundImage: linedBg,
                                borderRadius: '0 12px 12px 0', padding: '3rem', whiteSpace: 'pre-wrap', overflow: 'hidden',
                                transform: 'rotateY(180deg)',
                                boxShadow: 'inset 10px 0 20px rgba(0,0,0,0.1)',
                                borderLeft: '1px solid rgba(0,0,0,0.05)',
                                fontFamily: 'var(--font-serif)', fontSize: '1.2rem', lineHeight: '2rem'
                            }}>
                                <div style={{ opacity: 0.5, position: 'absolute', bottom: '2rem', right: '4rem', fontSize: '0.9rem' }}>{currentPage}</div>
                                {pages[currentPage - 1] || ""}
                            </div>
                        </motion.div>

                        {/* Center Spine */}
                        <div style={{
                            position: 'absolute', left: '50%', top: 20, bottom: 20, width: '2px', marginLeft: '-1px',
                            background: 'rgba(0,0,0,0.2)', boxShadow: '0 0 10px 2px rgba(0,0,0,0.1)', zIndex: 100
                        }} />

                    </motion.div>
                </AnimatePresence>

            </div>

            {/* Navigation Arrows */}
            {currentPage > 0 && (
                <button onClick={prevPage} style={{
                    position: 'absolute', left: '2rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'rgba(255,255,255,0.2)', padding: '1rem', borderRadius: '50%',
                    cursor: 'pointer', backdropFilter: 'blur(5px)', border: '1px solid rgba(255,255,255,0.3)'
                }}>
                    <ChevronLeft size={32} color={theme === 'dark' ? 'white' : 'black'} />
                </button>
            )}

            {currentPage + 2 < totalPages && (
                <button onClick={nextPage} style={{
                    position: 'absolute', right: '2rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'rgba(255,255,255,0.2)', padding: '1rem', borderRadius: '50%',
                    cursor: 'pointer', backdropFilter: 'blur(5px)', border: '1px solid rgba(255,255,255,0.3)'
                }}>
                    <ChevronRight size={32} color={theme === 'dark' ? 'white' : 'black'} />
                </button>
            )}

            <div style={{ position: 'absolute', bottom: '2rem', color: '#94a3b8' }}>
                Page {currentPage + 1} - {Math.min(currentPage + 2, totalPages)} of {totalPages}
            </div>
        </div>,
        document.body
    );
};
