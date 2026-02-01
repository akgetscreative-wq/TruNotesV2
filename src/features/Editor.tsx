import React, { useState, useEffect, useRef } from 'react';
import type { Note } from '../types';
import { Save, ArrowLeft, Star, Tag, RotateCcw, RotateCw, List, PenTool, Bold, Highlighter, Type, Plus, Minus, Heading1, Heading2 } from 'lucide-react';
import { BookReader } from './Book/BookReader';
import { ColorPicker } from '../components/UI/ColorPicker';
import { MoodSelector } from '../components/UI/MoodSelector';
import { useThemeContext } from '../context/ThemeContext';
import { AnimatePresence, motion } from 'framer-motion';

interface EditorProps {
    note?: Note; // If undefined, creating new
    onSave: (title: string, content: string, data: Partial<Note>, shouldExit?: boolean) => Promise<void>;
    onBack: () => void;
    onDelete?: () => void;
    onScribble?: () => void;
}

interface Snapshot {
    title: string;
    content: string;
}

export const Editor: React.FC<EditorProps> = ({ note, onSave, onBack, onScribble }) => {
    const [title, setTitle] = useState(note?.title || '');
    const [content, setContent] = useState(note?.content || '');
    const [isFavorite, setIsFavorite] = useState(note?.isFavorite || false);
    const [color, setColor] = useState(note?.color || 'default');
    const [mood, setMood] = useState(note?.mood || '');
    const [tags, setTags] = useState<string[]>(note?.tags || []);
    const [tagInput, setTagInput] = useState('');

    const [isFocused] = useState(false);
    const [isBookMode, setIsBookMode] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

    const { theme } = useThemeContext();

    // Compute Page Background
    // Dark mode is ALWAYS pure grey #2c2c2c
    // Light mode uses a solid tint. I'll define these directly for maximum reliability.
    const getSolidTint = (c: string) => {
        if (theme === 'dark') return '#2c2c2c';
        switch (c) {
            case 'rose': return '#fff1f2';
            case 'sage': return '#f0fdf4';
            case 'sky': return '#f0f9ff';
            case 'lavender': return '#f5f3ff';
            case 'lemon': return '#fefce8';
            default: return '#ffffff';
        }
    };

    const pageBg = getSolidTint(color);

    // Animation State
    const [isExiting, setIsExiting] = useState(false);

    // Toolbar Icon Color (White in dark mode for visibility)
    const iconColor = theme === 'dark' ? '#ffffff' : 'var(--text-secondary)';

    // -- Rich Text Styling --
    const editorRef = useRef<HTMLDivElement>(null);

    const [showHighlightPalette, setShowHighlightPalette] = useState(false);

    const applyFormat = (command: string, value?: string) => {
        if (!editorRef.current) return;

        // Force focus before command
        editorRef.current.focus();

        try {
            // Restore selection if lost
            if (!document.getSelection()?.rangeCount) {
                editorRef.current.focus();
            }
            document.execCommand(command, false, value);
            setContent(editorRef.current.innerHTML);
            markUnsaved();
        } catch (err) {
            console.error("Format command failed", err);
        }
    };

    const toggleBold = () => applyFormat('bold');

    const toggleHighlight = (color: string) => {
        applyFormat('hiliteColor', color);
        applyFormat('foreColor', '#000000');
        setShowHighlightPalette(false);
    };

    const changeFontSize = (delta: number) => {
        const current = parseInt(document.queryCommandValue('fontSize') || '3');
        let next = current + delta;
        if (next < 1) next = 1;
        if (next > 7) next = 7;
        applyFormat('fontSize', next.toString());
    };

    const toggleHeading = (level: string) => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const parent = selection.anchorNode?.parentElement;
            if (parent && parent.closest(level)) {
                applyFormat('formatBlock', 'p');
            } else {
                applyFormat('formatBlock', level);
            }
        }
    };

    const highlightColors = [
        '#fef08a', '#a7f3d0', '#bae6fd', '#fbcfe8',
        '#ffff00', '#00ff00', '#00ffff', '#ff00ff'
    ];

    // Updated innerHTML only when content changes externally (e.g. Undo/Redo)
    useEffect(() => {
        if (editorRef.current && content !== editorRef.current.innerHTML) {
            // Check if deviation is significant (avoid cursor jump on simple text)
            // Ideally trigger only on non-input events.
            // For now, naive check:
            editorRef.current.innerHTML = content;
        }
    }, [content]);

    // -- Undo/Redo History --
    const [history, setHistory] = useState<Snapshot[]>([{ title: note?.title || '', content: note?.content || '' }]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const headersRef = useRef<Snapshot>({ title: note?.title || '', content: note?.content || '' });
    const isUndoRedoAction = useRef(false);

    // Debounced History Push
    useEffect(() => {
        if (isUndoRedoAction.current) {
            isUndoRedoAction.current = false;
            return;
        }

        const timeout = setTimeout(() => {
            if (title !== headersRef.current.title || content !== headersRef.current.content) {
                const newSnapshot = { title, content };
                const newHistory = history.slice(0, historyIndex + 1);
                newHistory.push(newSnapshot);

                // Limit history size to 50
                if (newHistory.length > 50) newHistory.shift();

                setHistory(newHistory);
                setHistoryIndex(newHistory.length - 1);
                headersRef.current = newSnapshot;
            }
        }, 1000); // Capture snapshot after 1s of inactivity

        return () => clearTimeout(timeout);
    }, [title, content, history, historyIndex]);

    const handleUndo = () => {
        if (historyIndex > 0) {
            isUndoRedoAction.current = true;
            const prev = history[historyIndex - 1];
            setTitle(prev.title);
            setContent(prev.content);
            setHistoryIndex(historyIndex - 1);
            headersRef.current = prev;
            markUnsaved();
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            isUndoRedoAction.current = true;
            const next = history[historyIndex + 1];
            setTitle(next.title);
            setContent(next.content);
            setHistoryIndex(historyIndex + 1);
            headersRef.current = next;
            markUnsaved();
        }
    };

    // -- Bullet Points Logic --
    const handleInsertBullet = () => applyFormat('insertUnorderedList');

    // -- Auto Save Logic --
    useEffect(() => {
        if (saveStatus === 'saved') return;

        const timeout = setTimeout(async () => {
            if (saveStatus === 'unsaved') {
                setSaveStatus('saving');
                try {
                    await onSave(title, content, { isFavorite, color, mood, tags }, false);
                    setSaveStatus('saved');
                } catch (err) {
                    console.error("Auto-save failed", err);
                    setSaveStatus('unsaved'); // Retry on next change
                }
            }
        }, 2000); // Auto-save after 2s

        return () => clearTimeout(timeout);
    }, [title, content, isFavorite, color, mood, tags, saveStatus, onSave]);

    const markUnsaved = () => {
        if (saveStatus !== 'unsaved') setSaveStatus('unsaved');
    };

    useEffect(() => {
        if (isFocused) {
            document.body.classList.add('focus-mode');
        } else {
            document.body.classList.remove('focus-mode');
        }
        return () => document.body.classList.remove('focus-mode');
    }, [isFocused]);

    // Animated Exit Helpers
    const handleBack = () => {
        setIsExiting(true);
        setTimeout(onBack, 400); // Match CSS transition
    };

    const handleManualSave = async () => {
        setSaveStatus('saving');
        setIsExiting(true); // Start fade out immediately while saving
        try {
            // Save WITHOUT exiting immediately (false flag)
            // Wait for 400ms animation to complete
            await Promise.all([
                onSave(title, content, { isFavorite, color, mood, tags }, false),
                new Promise(resolve => setTimeout(resolve, 400))
            ]);
            // Now exit manually
            onBack();
        } catch (e) {
            setIsExiting(false); // Cancel exit on error
            setSaveStatus('unsaved');
        }
    };

    // -- Keyboard Shortcuts (Ctrl+S) --
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                // Trigger manual save but with a twist: 
                // handleManualSave exits the app. 
                // For Ctrl+S, we usually want to save WITHOUT exiting.
                // Let's create a dedicated save logic or reuse onSave directly.
                onSave(title, content, { isFavorite, color, mood, tags }, false)
                    .then(() => setSaveStatus('saved'))
                    .catch(() => setSaveStatus('unsaved'));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [title, content, isFavorite, color, mood, tags, onSave]);

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!tags.includes(tagInput.trim())) {
                setTags([...tags, tagInput.trim()]);
                markUnsaved();
            }
            setTagInput('');
        }
    };

    const removeTag = (tagFn: string) => {
        setTags(tags.filter(t => t !== tagFn));
        markUnsaved();
    };


    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    return (
        <div className={`editor-container note-color-${color} ${isExiting ? 'fade-out' : 'fade-in'}`} style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'transparent',
            transition: 'background-color 0.4s ease, opacity 0.4s ease, transform 0.4s ease',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10,
            transform: isExiting ? 'scale(0.98)' : 'scale(1)',
            opacity: isExiting ? 0 : 1,
            overflowY: 'auto'
        }}>
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: isMobile ? '0.5rem 0.75rem' : '1rem 2rem',
                borderBottom: 'none',
                opacity: isFocused ? 0 : 1,
                pointerEvents: isFocused ? 'none' : 'auto',
                transition: 'opacity 0.3s ease, height 0.3s ease',
                height: isFocused ? 0 : 'auto',
                overflow: isFocused ? 'hidden' : 'visible',
                flexShrink: 0,
                background: 'transparent',
                backdropFilter: 'blur(20px)',
                width: '100%',
                position: 'sticky',
                top: 0,
                zIndex: 20
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.4rem' : '1rem' }}>
                    <button
                        onClick={handleBack}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            color: 'var(--text-secondary)',
                            fontWeight: 500,
                            padding: '0.4rem',
                            borderRadius: '8px',
                            backgroundColor: 'white',
                            boxShadow: 'var(--shadow-soft)',
                            border: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <ArrowLeft size={18} />
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.1rem' : '0.5rem' }}>
                        <button
                            onClick={handleUndo}
                            disabled={historyIndex <= 0}
                            style={{
                                padding: '0.4rem',
                                opacity: historyIndex <= 0 ? 0.3 : 1,
                                cursor: historyIndex <= 0 ? 'default' : 'pointer',
                                background: 'transparent',
                                border: 'none'
                            }}
                        >
                            <RotateCcw size={18} color={iconColor} />
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={historyIndex >= history.length - 1}
                            style={{
                                padding: '0.4rem',
                                opacity: historyIndex >= history.length - 1 ? 0.3 : 1,
                                cursor: historyIndex >= history.length - 1 ? 'default' : 'pointer',
                                background: 'transparent',
                                border: 'none'
                            }}
                        >
                            <RotateCw size={18} color={iconColor} />
                        </button>

                        <div style={{ width: '1px', height: '1.2rem', background: 'rgba(0,0,0,0.1)', margin: '0 0.5rem' }} />

                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleInsertBullet}
                            style={{ padding: '0.4rem', cursor: 'pointer', background: 'transparent', border: 'none' }}
                        >
                            <List size={18} color={iconColor} />
                        </button>

                        <div style={{ width: '1px', height: '1.2rem', background: 'rgba(0,0,0,0.1)', margin: '0 0.5rem' }} />

                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={toggleBold}
                            style={{ padding: '0.4rem', cursor: 'pointer', background: 'transparent', border: 'none' }}
                        >
                            <Bold size={18} color={iconColor} />
                        </button>

                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => toggleHeading('h1')}
                            style={{ padding: '0.4rem', cursor: 'pointer', background: 'transparent', border: 'none' }}
                        >
                            <Heading1 size={18} color={iconColor} />
                        </button>

                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => toggleHeading('h2')}
                            style={{ padding: '0.4rem', cursor: 'pointer', background: 'transparent', border: 'none' }}
                        >
                            <Heading2 size={18} color={iconColor} />
                        </button>

                        <div style={{ position: 'relative' }}>
                            <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setShowHighlightPalette(!showHighlightPalette)}
                                style={{ padding: '0.4rem', cursor: 'pointer', background: 'transparent', border: 'none', position: 'relative' }}
                            >
                                <Highlighter size={18} color={iconColor} />
                                {showHighlightPalette && !isMobile && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '-4px',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        width: '4px',
                                        height: '4px',
                                        borderRadius: '50%',
                                        background: 'var(--accent-primary)'
                                    }} />
                                )}
                            </button>

                            <AnimatePresence>
                                {showHighlightPalette && (
                                    <>
                                        {/* Mobile Overlay */}
                                        {isMobile && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                onClick={() => setShowHighlightPalette(false)}
                                                style={{
                                                    position: 'fixed',
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    bottom: 0,
                                                    background: 'rgba(0,0,0,0.4)',
                                                    backdropFilter: 'blur(4px)',
                                                    zIndex: 1000
                                                }}
                                            />
                                        )}

                                        <motion.div
                                            initial={{ y: -10, opacity: 0, x: '-50%' }}
                                            animate={{ y: 0, opacity: 1, x: '-50%' }}
                                            exit={{ y: -10, opacity: 0, x: '-50%' }}
                                            style={{
                                                position: 'absolute',
                                                top: 'calc(100% + 12px)',
                                                left: '50%',
                                                backgroundColor: theme === 'dark' ? '#333333' : '#ffffff',
                                                padding: '0.75rem',
                                                borderRadius: '16px',
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(4, 1fr)',
                                                gap: '0.6rem',
                                                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                                                zIndex: 3000, // Very high to beat everything
                                                border: '1px solid rgba(0,0,0,0.1)',
                                                width: 'max-content',
                                                minWidth: '160px'
                                            }}
                                        >
                                            {/* Small Arrow Pointer */}
                                            <div style={{
                                                position: 'absolute',
                                                top: '-6px',
                                                left: '50%',
                                                transform: 'translateX(-50%) rotate(45deg)',
                                                width: '12px',
                                                height: '12px',
                                                backgroundColor: theme === 'dark' ? '#333333' : '#ffffff',
                                                borderTop: '1px solid rgba(0,0,0,0.1)',
                                                borderLeft: '1px solid rgba(0,0,0,0.1)',
                                                zIndex: -1
                                            }} />
                                            {highlightColors.map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => toggleHighlight(c)}
                                                    style={{
                                                        width: isMobile ? '44px' : '32px',
                                                        height: isMobile ? '44px' : '32px',
                                                        background: c,
                                                        borderRadius: '50%',
                                                        cursor: 'pointer',
                                                        border: '2px solid white',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                        transition: 'transform 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                />
                                            ))}
                                            {/* Clear Highlight Option */}
                                            <button
                                                onClick={() => toggleHighlight('transparent')}
                                                style={{
                                                    gridColumn: 'span 4',
                                                    marginTop: '0.5rem',
                                                    padding: '0.5rem',
                                                    borderRadius: '10px',
                                                    background: 'var(--bg-app)',
                                                    border: '1px solid var(--border-subtle)',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    color: 'var(--text-secondary)'
                                                }}
                                            >
                                                Clear Highlight
                                            </button>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>

                        {!isMobile && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => changeFontSize(-1)} style={{ padding: '0.2rem' }}><Minus size={14} color={iconColor} /></button>
                                <Type size={16} color={iconColor} />
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => changeFontSize(1)} style={{ padding: '0.2rem' }}><Plus size={14} color={iconColor} /></button>
                            </div>
                        )}

                        {isMobile && onScribble && (
                            <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={onScribble}
                                style={{ padding: '0.4rem', cursor: 'pointer', background: 'transparent', border: 'none' }}
                            >
                                <PenTool size={18} color={iconColor} />
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {!isMobile && (
                        <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            marginRight: '1rem',
                            opacity: 0.8
                        }}>
                            <span>{content.replace(/<[^>]*>/g, '').length} chars • {content.trim().split(/\s+/).filter(Boolean).length} words</span>
                            <span>{Math.ceil(content.length / 500)} min read</span>
                        </div>
                    )}

                    <button
                        onClick={handleManualSave}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            backgroundColor: 'var(--accent-primary)',
                            color: 'white',
                            padding: isMobile ? '0.5rem 1rem' : '0.6rem 1.4rem',
                            borderRadius: '12px',
                            fontWeight: 700,
                            fontSize: isMobile ? '0.85rem' : '0.95rem',
                            boxShadow: '0 8px 20px -5px rgba(99, 102, 241, 0.4)',
                            border: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <Save size={18} />
                        Save
                    </button>

                    <button
                        onClick={() => { setIsFavorite(!isFavorite); markUnsaved(); }}
                        style={{
                            color: isFavorite ? '#f59e0b' : 'var(--text-muted)',
                            padding: '0.5rem',
                            borderRadius: '8px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <Star size={20} fill={isFavorite ? "#f59e0b" : "none"} />
                    </button>
                </div>
            </header>

            <div style={{
                flex: 1,
                width: '100%',
                maxWidth: '1000px',
                margin: '0 auto',
                padding: isFocused ? '0' : (isMobile ? '0.5rem 0.05rem' : '2rem'),
                transition: 'padding 0.3s ease',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div className="floating-page" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: isMobile ? '1rem' : '1.5rem',
                    position: 'relative',
                    width: '100%',
                    minHeight: isFocused ? '100%' : 'calc(100vh - 120px)',
                    backgroundColor: pageBg,
                    padding: isMobile ? '1.5rem 0.35rem' : '2rem',
                    borderRadius: isMobile ? '16px' : '24px',
                    boxShadow: 'var(--shadow-soft)',
                    marginBottom: '2rem'
                }}>

                    {!isFocused && (
                        <div className="tools-row" style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: isMobile ? '1.25rem' : '1rem'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: isMobile ? 'flex-start' : 'center',
                                flexDirection: isMobile ? 'column' : 'row',
                                gap: isMobile ? '1rem' : '0',
                                width: '100%'
                            }}>
                                <ColorPicker selectedColor={color} onSelect={(c) => { setColor(c); markUnsaved(); }} />

                                <div style={{
                                    display: 'flex',
                                    flexDirection: isMobile ? 'column' : 'row',
                                    alignItems: isMobile ? 'flex-start' : 'center',
                                    gap: isMobile ? '0.4rem' : '1rem',
                                    width: isMobile ? '100%' : 'auto'
                                }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', opacity: 0.8 }}>How are you feeling?</span>
                                    <MoodSelector currentMood={mood} onSelect={(m) => { setMood(m); markUnsaved(); }} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <Tag size={16} color="var(--text-muted)" />
                                {tags.map(tag => (
                                    <span key={tag} style={{
                                        fontSize: '0.75rem',
                                        padding: '0.15rem 0.6rem',
                                        borderRadius: '12px',
                                        background: 'var(--accent-subtle)',
                                        color: 'var(--text-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.25rem'
                                    }}>
                                        #{tag}
                                        <button onClick={() => removeTag(tag)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 2px', display: 'flex', fontSize: '1rem' }}>×</button>
                                    </span>
                                ))}
                                <input
                                    type="text"
                                    placeholder="Add tag..."
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={handleAddTag}
                                    style={{
                                        fontSize: '0.85rem',
                                        minWidth: '80px',
                                        border: 'none',
                                        background: 'transparent',
                                        outline: 'none',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    <input
                        type="text"
                        placeholder="Note Title"
                        value={title}
                        onChange={(e) => { setTitle(e.target.value); markUnsaved(); }}
                        style={{
                            fontSize: isMobile ? '1.8rem' : '2.5rem',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                            background: 'transparent',
                            fontFamily: 'var(--font-serif)',
                            paddingBottom: '0.5rem',
                            border: 'none',
                            borderBottom: '2px solid var(--border-subtle)',
                            outline: 'none',
                            width: '100%'
                        }}
                    />

                    <div
                        style={{ flex: 1, position: 'relative', cursor: 'text', display: 'flex', flexDirection: 'column', minHeight: '100%' }}
                        onClick={() => {
                            if (editorRef.current) {
                                editorRef.current.focus();
                                // Move cursor to end if empty
                                if (editorRef.current.innerHTML === '' || editorRef.current.innerHTML === '<br>') {
                                    const range = document.createRange();
                                    const sel = window.getSelection();
                                    range.selectNodeContents(editorRef.current);
                                    range.collapse(false);
                                    sel?.removeAllRanges();
                                    sel?.addRange(range);
                                }
                            }
                        }}
                    >
                        <div
                            ref={editorRef}
                            className="lined-paper"
                            contentEditable
                            suppressContentEditableWarning
                            onInput={(e) => {
                                setContent(e.currentTarget.innerHTML);
                                markUnsaved();
                            }}
                            style={{
                                width: '100%',
                                flex: 1,
                                minHeight: '100%',
                                height: '100%',
                                fontSize: isMobile ? '1rem' : '1.15rem',
                                lineHeight: isMobile ? '1.4rem' : '1.6rem', // Compact spacing (approx 22px / 26px)
                                color: 'var(--text-primary)',
                                fontFamily: 'var(--font-serif)',
                                backgroundColor: 'transparent',
                                // Line at the bottom of every line-height block
                                backgroundImage: `linear-gradient(transparent calc(100% - 1px), var(--ruled-line-color) calc(100% - 1px))`,
                                backgroundSize: `100% ${isMobile ? '1.4rem' : '1.6rem'}`,
                                // Reset position
                                backgroundPositionY: '0px',
                                backgroundAttachment: 'local',
                                border: 'none',
                                outline: 'none',
                                padding: '0',
                                // Push text down to sit on line
                                paddingTop: isMobile ? '3px' : '4px',
                                paddingLeft: '2px',
                                paddingBottom: '30vh',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                            }}
                        />
                    </div>
                </div>

                {isBookMode && (
                    <BookReader
                        title={title}
                        content={content}
                        theme={theme}
                        onClose={() => setIsBookMode(false)}
                    />
                )}
            </div>
        </div>
    );
};
