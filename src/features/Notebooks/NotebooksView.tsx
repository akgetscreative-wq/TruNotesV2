import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, ArrowLeft, Trash2, Check, Edit2 } from 'lucide-react';
import { useNotebooks } from '../../hooks/useNotebooks';
import type { Notebook } from '../../types';
import { useThemeContext } from '../../context/ThemeContext';

export const NotebooksView: React.FC = () => {
    const { notebooks, createNotebook, updateNotebook, deleteNotebook } = useNotebooks();
    const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
    const selectedNotebook = notebooks.find(n => n.id === selectedNotebookId);

    const handleCreate = async (type: Notebook['type']) => {
        const n = await createNotebook(type);
        setSelectedNotebookId(n.id);
    };

    if (selectedNotebook) {
        return (
            <LinedNotebookEditor
                notebook={selectedNotebook}
                onClose={() => setSelectedNotebookId(null)}
                onUpdate={(updates) => updateNotebook(selectedNotebook.id, updates)}
                onDelete={() => {
                    if (window.confirm("Delete this notebook forever?")) {
                        deleteNotebook(selectedNotebook.id);
                        setSelectedNotebookId(null);
                    }
                }}
            />
        );
    }

    return (
        <div style={{
            height: '100%',
            width: '100%',
            background: '#090C14',
            position: 'relative',
            overflowX: 'hidden',
            overflowY: 'auto',
            fontFamily: "'Inter', sans-serif",
            color: 'white'
        }}>
            {/* Background Decorations (Figma Ellipse 1 & 2) */}
            <div style={{
                position: 'fixed',
                width: '284px',
                height: '284px',
                left: '-156px',
                top: '49px',
                background: 'rgba(117, 76, 255, 0.72)',
                opacity: 0.3,
                filter: 'blur(40px)',
                borderRadius: '50%',
                pointerEvents: 'none',
                zIndex: 0
            }} />
            <div style={{
                position: 'fixed',
                width: '284px',
                height: '284px',
                left: '257px',
                top: '396px',
                background: 'rgba(117, 76, 255, 0.72)',
                opacity: 0.3,
                filter: 'blur(40px)',
                borderRadius: '50%',
                pointerEvents: 'none',
                zIndex: 0
            }} />

            <div style={{ position: 'relative', zIndex: 1, padding: 'calc(var(--safe-top) + 53px) 16px 100px' }}>
                {/* Title (Figma style) */}
                <h1 style={{
                    margin: 0,
                    fontWeight: 600,
                    fontSize: '26px',
                    lineHeight: '31px',
                    marginBottom: '43px',
                    color: '#FFFFFF'
                }}>Notebooks</h1>

                {/* Choose a cover Header (Figma style) */}
                <div style={{ marginBottom: '40px' }}>
                    <p style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'rgba(255,255,255,0.7)',
                        lineHeight: '2px', // Match Figma box height proxy
                        marginBottom: '33px'
                    }}>Choose a cover:</p>

                    <div style={{
                        display: 'flex',
                        gap: '16px',
                        overflowX: 'auto',
                        paddingBottom: '20px',
                        scrollbarWidth: 'none',
                        WebkitOverflowScrolling: 'touch'
                    }}>
                        {(['bubbles', 'gradient-scribble', 'mountains', 'night', 'geometric'] as Notebook['type'][]).map(type => (
                            <motion.div
                                key={type}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleCreate(type)}
                                style={{
                                    flexShrink: 0,
                                    width: '100px',
                                    height: '130px',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}
                            >
                                <CoverContent type={type} hideRings />
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'rgba(0,0,0,0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Plus size={24} color="white" />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Grid (User requested "lined notebook will open" implies these are the openable notebooks) */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(149px, 1fr))',
                    gap: '24px',
                    justifyContent: 'center'
                }}>
                    {notebooks.map(n => (
                        <NotebookCard key={n.id} notebook={n} onClick={() => setSelectedNotebookId(n.id)} />
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- Sub-Components ---

const NotebookCard: React.FC<{ notebook: Notebook; onClick: () => void }> = ({ notebook, onClick }) => {
    return (
        <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            onClick={onClick}
            style={{
                width: '149px',
                height: '184px',
                position: 'relative',
                cursor: 'pointer'
            }}
        >
            <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '12px',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0px 12px 24px rgba(0, 0, 0, 0.5)', // Match Figma style if applicable
                border: '1px solid rgba(0, 0, 0, 0.2)'
            }}>
                <CoverContent type={notebook.type} />
                <Rings color={notebook.type === 'bubbles' || notebook.type === 'mountains' || notebook.type === 'geometric' ? 'black' : 'white'} />

                {/* Title Overlay (Figma Untitled Notebook) */}
                <div style={{
                    position: 'absolute',
                    width: '138px',
                    height: '22px', // Proxy for Figma 2px box
                    left: '19px',
                    top: '36px',
                    zIndex: 30,
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center'
                }}>
                    <span style={{
                        fontFamily: "'Lalezar', cursive",
                        fontStyle: 'normal',
                        fontWeight: 400,
                        fontSize: '14px',
                        lineHeight: '2px', // Figma spec
                        color: '#FFFFFF'
                    }}>
                        {notebook.title}
                    </span>
                </div>
            </div>
        </motion.div>
    );
};

const Rings: React.FC<{ color: 'white' | 'black' }> = ({ color }) => {
    // Figma Ellipse 3-8
    const positions = [23, 49, 75, 101, 127, 153];
    return (
        <>
            {positions.map(p => (
                <div key={p} style={{
                    position: 'absolute',
                    width: '9px',
                    height: '9px',
                    left: '10px',
                    top: `${p}px`,
                    background: color === 'white' ? '#FFFFFF' : '#000000',
                    borderRadius: '50%',
                    zIndex: 40,
                    boxShadow: color === 'white' ? 'none' : '0 1px 2px rgba(255,255,255,0.1)'
                }} />
            ))}
        </>
    );
};

const CoverContent: React.FC<{ type: Notebook['type']; hideRings?: boolean }> = ({ type }) => {
    switch (type) {
        case 'bubbles':
            return (
                <div style={{ position: 'absolute', width: '155px', height: '184px', left: '-3px', top: '0px', background: '#19112D', opacity: 0.6, border: '1px solid #000000', backdropFilter: 'blur(20px)', borderRadius: '12px' }}>
                    <div style={{ position: 'absolute', width: '22px', height: '22px', right: '30px', top: 'calc(50% - 22px / 2 + 18px)', background: '#00FFE1', opacity: 0.87, borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', width: '61px', height: '62px', right: '-13px', top: 'calc(50% - 62px / 2 + 44px)', background: '#00E6FF', opacity: 0.74, borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', width: '61px', height: '62px', right: '-3px', top: 'calc(50% - 62px / 2 + 71px)', background: '#F3FF4F', opacity: 0.74, borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', width: '61px', height: '62px', right: '30px', top: 'calc(50% - 62px / 2 + 61px)', background: '#FFA600', opacity: 0.74, borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', width: '61px', height: '62px', right: '69px', top: 'calc(50% - 62px / 2 + 81px)', background: '#BFFF00', opacity: 0.74, borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', width: '61px', height: '62px', right: '100px', top: 'calc(50% - 62px / 2 + 66px)', background: '#603BC3', opacity: 0.74, borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', width: '51px', height: '52px', right: '75px', top: 'calc(50% - 52px / 2 + 39px)', background: '#00FFFF', opacity: 0.74, borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', width: '51px', height: '52px', right: '-24px', top: 'calc(50% - 52px / 2 + 55px)', background: '#FF5DB9', opacity: 0.72, borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', width: '43px', height: '42px', right: '41px', top: 'calc(50% - 42px / 2 + 76px)', background: '#00FFFF', opacity: 0.74, borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', width: '22px', height: '22px', right: '19px', top: 'calc(50% - 22px / 2 - 4px)', background: '#6FFF00', opacity: 0.83, borderRadius: '50%' }} />
                </div>
            );
        case 'gradient-scribble':
            return (
                <div style={{ position: 'absolute', width: '149px', height: '185px', left: '-2px', top: '0px', background: 'linear-gradient(180deg, #252525 25%, #8D0097 100%)', opacity: 0.6, backdropFilter: 'blur(20px)', borderRadius: '12px' }}>
                    {/* Vectors 52-57 (Decorative Frames and Scribbles) */}
                    <div style={{ position: 'absolute', width: '44px', height: '17px', left: '43px', top: '104px', border: '2px solid #FFFFFF', opacity: 0.4 }} />
                    <div style={{ position: 'absolute', width: '33px', height: '16px', left: '76px', top: '105px', border: '2px solid #FFFFFF', opacity: 0.4 }} />
                    <div style={{ position: 'absolute', width: '10px', height: '10px', left: '91px', top: '89px', border: '2px solid #FFFFFF', opacity: 0.4 }} />
                    <div style={{ position: 'absolute', width: '68px', height: '1px', left: '41px', top: '122px', border: '2px solid #FFFFFF', opacity: 0.4 }} />
                    <div style={{ position: 'absolute', width: '68px', height: '42px', left: '41px', top: '80px', border: '2px solid #FFFFFF', opacity: 0.4 }} />
                    <div style={{ position: 'absolute', left: '34.9%', right: '34.88%', top: '43.24%', bottom: '24.36%', border: '2px solid #FFFFFF' }} />
                </div>
            );
        case 'mountains':
            return (
                <div style={{ position: 'absolute', width: '154px', height: '188px', left: '-2px', top: '0px', background: 'linear-gradient(180deg, #00FFFF 0%, #00D0FF 59.62%)', opacity: 0.6, border: '1px solid #000000', backdropFilter: 'blur(20px)', borderRadius: '12px' }}>
                    <div style={{ position: 'absolute', width: '137px', height: '127px', left: '-36px', top: '94px', background: '#FF7F1D', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', borderRadius: '2px' }} />
                    <div style={{ position: 'absolute', width: '137px', height: '127px', left: '30px', top: '104px', background: '#FFAA42', opacity: 0.88, clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', borderRadius: '2px' }} />
                    <div style={{ position: 'absolute', width: '71px', height: '58px', left: '107px', top: '143px', background: '#FFAA42', opacity: 0.88, clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', borderRadius: '2px' }} />
                    {/* Vectors 47-51 (Bird-like accents) */}
                    <div style={{ position: 'absolute', width: '3.49px', height: '8.16px', left: '33.16px', top: '91.16px', border: '1px solid #FFFFFF' }} />
                    <div style={{ position: 'absolute', width: '3.94px', height: '5.49px', left: '33.74px', top: '95.71px', border: '1px solid #FFFFFF' }} />
                    <div style={{ position: 'absolute', width: '1.67px', height: '2.22px', left: '33.23px', top: '88.87px', border: '1px solid #FFFFFF' }} />
                    <div style={{ position: 'absolute', width: '4.11px', height: '3.33px', left: '29.47px', top: '89.12px', border: '1px solid #FFFFFF' }} />
                    <div style={{ position: 'absolute', width: '5.41px', height: '3.18px', left: '33.82px', top: '89.12px', border: '1px solid #FFFFFF' }} />
                </div>
            );
        case 'night':
            return (
                <div style={{ position: 'absolute', width: '154px', height: '188px', left: '-3px', top: '-5px', background: 'linear-gradient(180deg, #0A0480 0.01%, #000000 100%)', opacity: 0.6, border: '1px solid #000000', backdropFilter: 'blur(20px)', borderRadius: '12px' }}>
                    {/* Hills (Ellipse 19-20) */}
                    <div style={{ position: 'absolute', width: '190px', height: '98px', left: '-76px', top: '155px', background: '#F2B200', opacity: 0.94, borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', width: '282px', height: '122px', left: '15px', top: '146px', background: '#AB6402', opacity: 0.94, borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', width: '18px', height: '22px', left: '36px', top: '10px', background: '#FFFB00', clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }} />
                    {[123, 145, 62, 138, 116, 30].map((x, i) => (
                        <div key={i} style={{ position: 'absolute', width: '7px', height: '7px', left: `${x}px`, top: `${[62, 94, 46, 43, 9, -1][i]}px`, background: 'white', borderRadius: '50%', opacity: 0.9 }} />
                    ))}
                    {/* Tree vectors (11-17) */}
                    <div style={{ position: 'absolute', width: '97.31px', height: '94.06px', left: '-6.48px', top: '46px', border: '14px solid #028030', borderRadius: '50%', opacity: 0.7 }} />
                    <div style={{ position: 'absolute', width: '74.06px', height: '45.5px', left: '-8.44px', top: '64.66px', border: '14px solid #028030', borderRadius: '50%', opacity: 0.7 }} />
                    <div style={{ position: 'absolute', width: '13.16px', height: '52.06px', left: '70px', top: '65px', border: '14px solid #028030', borderRadius: '50%', opacity: 0.7 }} />
                    <div style={{ position: 'absolute', width: '28.06px', height: '76.98px', left: '12.36px', top: '106px', border: '16px solid #482100', borderRadius: '4px' }} />
                </div>
            );
        case 'geometric':
            return (
                <div style={{ position: 'absolute', width: '149px', height: '185px', left: '0px', top: '0px', background: '#000000', opacity: 0.6, border: '1px solid #000000', backdropFilter: 'blur(20px)', borderRadius: '12px' }}>
                    <div style={{ position: 'absolute', width: '78px', height: '55px', left: '3px', top: '134px', background: '#FF36C6', opacity: 0.86, borderRadius: '2px' }} />
                    <div style={{ position: 'absolute', width: '92px', height: '72px', left: '19px', top: '120px', background: '#FF3636', opacity: 0.86, borderRadius: '2px' }} />
                    <div style={{ position: 'absolute', width: '92px', height: '72px', left: '98px', top: '84px', background: '#5D5AFF', opacity: 0.86, borderRadius: '2px' }} />
                    <div style={{ position: 'absolute', width: '92px', height: '72px', left: '105px', top: '130px', background: '#D336FF', opacity: 0.86, borderRadius: '2px' }} />
                    <div style={{ position: 'absolute', width: '92px', height: '72px', left: '-36px', top: '114px', background: '#FF7105', opacity: 0.86, borderRadius: '2px' }} />
                    <div style={{ position: 'absolute', width: '58px', height: '44px', left: '81px', top: '140px', background: '#451E70', opacity: 0.86, borderRadius: '2px' }} />
                    {/* Vector Detail (39-46 stylized) */}
                    <div style={{ position: 'absolute', width: '1.98px', height: '5.33px', left: '48.8px', top: '108.47px', border: '1px solid #FFFFFF' }} />
                </div>
            );
        default: return null;
    }
};

const LinedNotebookEditor: React.FC<{
    notebook: Notebook;
    onClose: () => void;
    onUpdate: (updates: Partial<Notebook>) => void;
    onDelete: () => void;
}> = ({ notebook, onClose, onUpdate, onDelete }) => {
    const { theme } = useThemeContext();
    const isDark = theme === 'dark';

    const pageColor = isDark ? '#1e293b' : '#FDFBF7';
    const textColor = isDark ? '#f8fafc' : '#1e293b';
    const lineColor = isDark ? 'rgba(147, 197, 253, 0.1)' : 'rgba(147, 197, 253, 0.25)';
    const marginColor = isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.15)';
    const gapColor = isDark ? '#0f172a' : '#cbd5e1'; // Dark page gap shadow to separate pages

    const [title, setTitle] = useState(notebook.title);
    const [content, setContent] = useState(notebook.content);
    const [isRenaming, setIsRenaming] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-save title/content when they change (debounced for performance)
    useEffect(() => {
        const timer = setTimeout(() => {
            onUpdate({ title, content });
        }, 800);
        return () => clearTimeout(timer);
    }, [title, content]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            style={{
                position: 'fixed',
                inset: 0,
                background: '#090C14',
                color: 'white',
                zIndex: 2000,
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* Custom Interactive Header */}
            <div style={{
                padding: 'calc(var(--safe-top) + 16px) 20px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                background: '#090C14',
                borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', padding: '8px', cursor: 'pointer' }}>
                    <ArrowLeft size={24} />
                </button>

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isRenaming ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                            <input
                                autoFocus
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                onBlur={() => setIsRenaming(false)}
                                onKeyDown={(e) => e.key === 'Enter' && setIsRenaming(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid #2563EB',
                                    borderRadius: '8px',
                                    color: 'white',
                                    padding: '6px 12px',
                                    fontSize: '18px',
                                    fontWeight: 700,
                                    outline: 'none',
                                    width: '100%',
                                    maxWidth: '300px'
                                }}
                            />
                            <button onClick={() => setIsRenaming(false)} style={{ background: '#2563EB', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Check size={18} color="white" />
                            </button>
                        </div>
                    ) : (
                        <div onClick={() => setIsRenaming(true)} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{title}</h2>
                            <Edit2 size={16} color="rgba(255,255,255,0.4)" />
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={onDelete} style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '10px', color: '#ef4444', padding: '10px', cursor: 'pointer' }}>
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            {/* HIGH-FIDELITY LINED PAPER EDITOR */}
            <div style={{
                flex: 1,
                background: pageColor, // Theme-aware paper color
                color: textColor,
                position: 'relative',
                overflowY: 'auto',
                overflowX: 'hidden',
                boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.1)'
            }}>
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Click the title above to rename, or start writing here..."
                    style={{
                        width: '100%',
                        height: '100%',
                        background: 'transparent',
                        color: textColor,
                        backgroundImage: `
                            repeating-linear-gradient(to bottom, transparent, transparent 928px, ${gapColor} 928px, ${gapColor} 960px),
                            linear-gradient(to right, transparent 60px, ${marginColor} 60px, ${marginColor} 62px, transparent 62px),
                            repeating-linear-gradient(transparent, transparent 31px, ${lineColor} 32px)
                        `,
                        backgroundAttachment: 'local',
                        border: 'none',
                        outline: 'none',
                        padding: '1px 20px 32px 80px', // Adjusted top padding to precisely align text with the lines
                        fontSize: '16px',
                        lineHeight: '32px',
                        fontFamily: "'Inter', sans-serif",
                        resize: 'none',
                        position: 'relative',
                        zIndex: 2,
                        minHeight: '100%',
                        boxSizing: 'border-box'
                    }}
                />
            </div>
        </motion.div>
    );
};

export default NotebooksView;
