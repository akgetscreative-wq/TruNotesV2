import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Trash2, Eraser, PenTool, Save, Undo, Redo, Download, Settings, Palette, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Note } from '../../types';
import { useTheme } from '../../hooks/useTheme';
import { PremiumColorPicker } from './PremiumColorPicker';

import { Filesystem, Directory } from '@capacitor/filesystem';
import { Toast } from '@capacitor/toast';
import { Share } from '@capacitor/share';

interface ScribbleEditorProps {
    note: Note;
    onSave: (note: Note) => void;
    onClose: () => void;
    onDelete: (id: string) => void;
}

export const ScribbleEditor: React.FC<ScribbleEditorProps> = ({ note, onSave, onClose, onDelete }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { theme } = useTheme();
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#000000');
    const [lineWidth, setLineWidth] = useState(3);
    const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
    const [title, setTitle] = useState(note.title || '');
    const [lastSaved, setLastSaved] = useState<string>('');
    const [history, setHistory] = useState<string[]>([]);
    const [currentStep, setCurrentStep] = useState(-1);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showBgColorPicker, setShowBgColorPicker] = useState(false);
    const [bgColor, setBgColor] = useState(theme === 'dark' ? '#2c2c2c' : '#ffffff');
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [showSettings, setShowSettings] = useState(false);

    // Zoom and Pan state
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
    const [lastTouchMidpoint, setLastTouchMidpoint] = useState<{ x: number, y: number } | null>(null);

    const saveToHistory = (dataUrl: string) => {
        const newHistory = history.slice(0, currentStep + 1);
        newHistory.push(dataUrl);
        setHistory(newHistory);
        setCurrentStep(newHistory.length - 1);
    };

    // Initialize canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const container = canvas.parentElement;
        if (container) {
            const w = container.clientWidth;
            const h = Math.max(container.clientHeight, 600);
            canvas.width = w;
            canvas.height = h;
            setCanvasSize({ width: w, height: h });
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Load existing content if available
            if (note.content && note.content.startsWith('data:image')) {
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                    saveToHistory(canvas.toDataURL());
                };
                img.src = note.content;
            } else {
                // Clear canvas for new notes (transparent background)
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                saveToHistory(canvas.toDataURL());
            }
        }
    }, []); // Run once on mount

    const handleCanvasResize = (width: number, height: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Save current content
        const tempImage = new Image();
        tempImage.src = canvas.toDataURL();

        tempImage.onload = () => {
            canvas.width = width;
            canvas.height = height;
            setCanvasSize({ width, height });

            // Restore context settings
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Fill background
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw old content (centered or top-left)
            ctx.drawImage(tempImage, 0, 0);

            saveToHistory(canvas.toDataURL());
            autoSave();
        };
    };

    const handleBgColorChange = (newColor: string) => {
        setBgColor(newColor);
        // We don't bake it into the canvas anymore!
        // Just trigger an auto-save so the preference is remembered (if we improved the note model to store metadata)
        // For now, autoSave will just re-save the current canvas state.
        autoSave();
    };

    const getCompositeDataUrl = useCallback((): string => {
        const canvas = canvasRef.current;
        if (!canvas) return '';

        // Create a temporary canvas to composite background + drawing
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tCtx = tempCanvas.getContext('2d');
        if (!tCtx) return '';

        // 1. Fill background
        tCtx.fillStyle = bgColor;
        tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // 2. Draw the transparent sketch on top
        // We need to wait for the canvas image to be ready if it's dirty? No, drawImage(canvas) is synchronous.
        tCtx.drawImage(canvas, 0, 0);

        return tempCanvas.toDataURL('image/png');
    }, [bgColor]);

    const handleExport = async () => {
        try {
            const dataUrl = getCompositeDataUrl();
            const base64Data = dataUrl.split(',')[1];
            const fileName = `${title.replace(/[^a-z0-9]/gi, '_') || 'scribble'}_${Date.now()}.png`;

            if (isMobile) {
                // Save to Documents folder on device
                const result = await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: Directory.Documents,
                    // encoding: Encoding.UTF8 // Not needed for base64 data usually, but creates string
                });

                // Get the full URI to share or show
                const uri = result.uri;

                await Toast.show({
                    text: `Saved to Documents as ${fileName}`,
                    duration: 'long',
                    position: 'bottom'
                });

                // Option to share immediately
                await Share.share({
                    title: 'Share Scribble',
                    text: 'Check out my scribble!',
                    url: uri,
                    dialogTitle: 'Share your masterpiece'
                });

            } else {
                // Desktop / Browser download
                const link = document.createElement('a');
                link.download = `${title || 'scribble'}.png`;
                link.href = dataUrl;
                link.click();
            }
        } catch (error) {
            console.error('Export failed:', error);
            if (isMobile) {
                await Toast.show({
                    text: 'Failed to export image',
                    duration: 'short'
                });
            }
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = -e.deltaY;
            const factor = Math.pow(1.1, delta / 100);
            applyZoom(factor, e.clientX, e.clientY);
        } else {
            // Normal scroll pans if canvas is larger
            setOffset(prev => ({
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY
            }));
        }
    };

    const applyZoom = (factor: number, clientX: number, clientY: number) => {
        const canvasContainer = canvasRef.current?.parentElement;
        if (!canvasContainer) return;

        const rect = canvasContainer.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        setScale(prevScale => {
            const newScale = Math.max(0.1, Math.min(10, prevScale * factor));

            // Adjust offset to zoom into mouse position
            setOffset(prevOffset => ({
                x: x - (x - prevOffset.x) * (newScale / prevScale),
                y: y - (y - prevOffset.y) * (newScale / prevScale)
            }));

            return newScale;
        });
    };

    const getTouchDistance = (touches: React.TouchList) => {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const getTouchMidpoint = (touches: React.TouchList) => {
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if ('touches' in e && e.touches.length === 2) {
            setIsPanning(true);
            setLastTouchDistance(getTouchDistance(e.touches));
            setLastTouchMidpoint(getTouchMidpoint(e.touches));
            return;
        }

        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCoordinates(e, canvas);
        ctx.beginPath();
        ctx.moveTo(x, y);

        // Paint a dot immediately on start (for taps)
        ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,0)' : color;
        if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
        } else {
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.lineWidth = lineWidth * (tool === 'eraser' ? 2 : 1);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        if ('touches' in e && e.touches.length === 2 && isPanning) {
            // ... (keep zoom/pan logic)
            const distance = getTouchDistance(e.touches);
            const midpoint = getTouchMidpoint(e.touches);

            if (lastTouchDistance && lastTouchMidpoint) {
                // Handle Zoom
                const zoomFactor = distance / lastTouchDistance;
                if (Math.abs(zoomFactor - 1) > 0.01) {
                    applyZoom(zoomFactor, midpoint.x, midpoint.y);
                }

                // Handle Pan
                setOffset(prev => ({
                    x: prev.x + (midpoint.x - lastTouchMidpoint.x),
                    y: prev.y + (midpoint.y - lastTouchMidpoint.y)
                }));
            }

            setLastTouchDistance(distance);
            setLastTouchMidpoint(midpoint);
            return;
        }

        if (!isDrawing) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCoordinates(e, canvas);

        ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,0)' : color;
        if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
        } else {
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.lineWidth = lineWidth;

        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsPanning(false);
        setLastTouchDistance(null);
        setLastTouchMidpoint(null);

        if (!isDrawing) return;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.closePath();
            saveToHistory(canvas.toDataURL());
            autoSave();
        }
    };

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        // Adjust for scale and offset
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const autoSave = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Save the transparent canvas state so it can be edited later
        const dataUrl = canvas.toDataURL();

        // Update note with new content
        const updatedNote = {
            ...note,
            title,
            content: dataUrl,
            updatedAt: Date.now()
        };
        onSave(updatedNote);
        setLastSaved(new Date().toLocaleTimeString());
    }, [note, title, onSave, bgColor]);

    const restoreState = (dataUrl: string) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            const img = new Image();
            img.src = dataUrl;
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                autoSave();
            }
        }
    };

    const handleUndo = () => {
        if (currentStep > 0) {
            const newStep = currentStep - 1;
            setCurrentStep(newStep);
            restoreState(history[newStep]);
        }
    };

    const handleRedo = () => {
        if (currentStep < history.length - 1) {
            const newStep = currentStep + 1;
            setCurrentStep(newStep);
            restoreState(history[newStep]);
        }
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isCtrl = e.ctrlKey || e.metaKey;

            if (isCtrl && e.key === 's') {
                e.preventDefault();
                autoSave();
            } else if (isCtrl && e.key === 'z') {
                if (e.shiftKey) {
                    e.preventDefault();
                    handleRedo();
                } else {
                    e.preventDefault();
                    handleUndo();
                }
            } else if (isCtrl && e.key === 'y') {
                e.preventDefault();
                handleRedo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [autoSave, history, currentStep]); // Re-bind when history/step changes

    // Auto-save title changes
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (title !== note.title) {
                autoSave();
            }
        }, 1000);
        return () => clearTimeout(timeout);
    }, [title, note.title, autoSave]);

    const handleClear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        saveToHistory(canvas.toDataURL());
        autoSave();
    };

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const colors = [
        '#000000', '#4B5563', '#9CA3AF', '#FFFFFF',
        '#EF4444', '#F97316', '#F59E0B', '#FACC15',
        '#84CC16', '#10B981', '#06B6D4', '#3B82F6',
        '#6366F1', '#8B5CF6', '#D946EF', '#EC4899',
        '#92400E', '#78350F'
    ];

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isMobile ? 0 : '2rem',
                backgroundColor: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(5px)'
            }}
        >
            <div style={{
                width: '100%',
                maxWidth: isMobile ? 'none' : '1200px',
                height: isMobile ? '100dvh' : '90vh',
                background: 'var(--bg-card)',
                borderRadius: isMobile ? 0 : '24px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: isMobile ? 'none' : 'var(--shadow-3d)'
            }}>
                <div style={{
                    padding: isMobile ? 'calc(var(--safe-top) + 0.5rem) 1rem 0.5rem 1rem' : '1rem 2rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--dashboard-header-bg)',
                    backdropFilter: 'blur(10px)',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '1rem' }}>
                        <button onClick={onClose} style={{ color: 'var(--text-secondary)', padding: '0.5rem', borderRadius: '50%', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer' }}>
                            <ArrowLeft size={isMobile ? 18 : 20} />
                        </button>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Scribble..."
                            style={{
                                fontSize: isMobile ? '1.1rem' : '1.5rem',
                                fontWeight: 600,
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                width: isMobile ? '100px' : 'auto'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.4rem' : '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.2rem' : '0.5rem' }}>
                            <button
                                onClick={handleUndo}
                                disabled={currentStep <= 0}
                                style={{
                                    color: currentStep > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                                    padding: '0.4rem',
                                    borderRadius: '8px',
                                    display: 'flex', alignItems: 'center',
                                    cursor: currentStep > 0 ? 'pointer' : 'default',
                                    background: 'transparent',
                                    border: 'none'
                                }}
                            >
                                <Undo size={isMobile ? 18 : 20} />
                            </button>
                            <button
                                onClick={handleRedo}
                                disabled={currentStep >= history.length - 1}
                                style={{
                                    color: currentStep < history.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)',
                                    padding: '0.4rem',
                                    borderRadius: '8px',
                                    display: 'flex', alignItems: 'center',
                                    cursor: currentStep < history.length - 1 ? 'pointer' : 'default',
                                    background: 'transparent',
                                    border: 'none'
                                }}
                            >
                                <Redo size={isMobile ? 18 : 20} />
                            </button>
                        </div>

                        {!isMobile && <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)' }} />}

                        {!isMobile && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {lastSaved ? `Saved ${lastSaved}` : 'Unsaved'}
                            </span>
                        )}

                        <button
                            onClick={() => { autoSave(); }}
                            style={{
                                color: 'var(--accent-primary)',
                                padding: isMobile ? '0.5rem' : '0.5rem 0.75rem',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: 'rgba(99, 102, 241, 0.1)',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <Save size={18} />
                            {!isMobile && 'Save'}
                        </button>

                        <button
                            onClick={handleExport}
                            style={{
                                color: 'var(--text-secondary)',
                                padding: '0.5rem',
                                borderRadius: '8px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                            title="Export as PNG"
                        >
                            <Download size={18} />
                        </button>

                        <button
                            onClick={() => onDelete(note.id)}
                            style={{
                                color: '#ef4444',
                                padding: '0.5rem',
                                borderRadius: '8px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>

                {/* Toolbar & Canvas Container */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

                    {/* Toolbar Sidebar */}
                    <div style={{
                        width: isMobile ? '60px' : '80px',
                        padding: isMobile ? '0.5rem' : '1rem',
                        borderRight: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: isMobile ? '1rem' : '1.5rem',
                        backgroundColor: 'var(--bg-secondary)',
                        overflowY: 'auto',
                        zIndex: 10
                    }} className="dashboard-scrollbar">

                        {/* Tool Selection */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <button
                                onClick={() => setTool('pen')}
                                style={{
                                    padding: isMobile ? '0.5rem' : '0.75rem',
                                    borderRadius: '12px',
                                    background: tool === 'pen' ? 'var(--accent-primary)' : 'transparent',
                                    color: tool === 'pen' ? 'white' : 'var(--text-secondary)',
                                    transition: 'all 0.2s',
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <PenTool size={isMobile ? 20 : 24} />
                            </button>
                            <button
                                onClick={() => setTool('eraser')}
                                style={{
                                    padding: isMobile ? '0.5rem' : '0.75rem',
                                    borderRadius: '12px',
                                    background: tool === 'eraser' ? 'var(--accent-primary)' : 'transparent',
                                    color: tool === 'eraser' ? 'white' : 'var(--text-secondary)',
                                    transition: 'all 0.2s',
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <Eraser size={isMobile ? 20 : 24} />
                            </button>
                        </div>

                        <div style={{ width: '100%', height: '1px', background: 'var(--border-subtle)' }} />

                        {/* Colors Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(2, 1fr)',
                            gap: isMobile ? '0.4rem' : '0.5rem',
                            alignItems: 'center'
                        }}>
                            {colors.map(c => (
                                <button
                                    key={c}
                                    onClick={() => { setColor(c); setTool('pen'); }}
                                    style={{
                                        width: isMobile ? '18px' : '20px',
                                        height: isMobile ? '18px' : '20px',
                                        borderRadius: '50%',
                                        background: c,
                                        border: color === c && tool === 'pen' ? (c === '#FFFFFF' || c === '#9CA3AF' ? '2px solid #000' : '2px solid var(--text-primary)') : '1px solid rgba(255,255,255,0.1)',
                                        cursor: 'pointer',
                                        padding: 0,
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                    }}
                                />
                            ))}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', position: 'relative' }}>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Custom</span>
                            <button
                                onClick={() => setShowColorPicker(!showColorPicker)}
                                style={{
                                    width: isMobile ? '32px' : '36px',
                                    height: isMobile ? '24px' : '28px',
                                    padding: 0,
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    background: color,
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                            />
                        </div>

                        <div style={{ width: '100%', height: '1px', background: 'var(--border-subtle)' }} />

                        {/* Line Width */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Size</span>
                            <div style={{ height: isMobile ? '80px' : '100px', display: 'flex', alignItems: 'center' }}>
                                <input
                                    type="range"
                                    min="1"
                                    max="20"
                                    value={lineWidth}
                                    onChange={(e) => setLineWidth(Number(e.target.value))}
                                    style={{
                                        width: isMobile ? '80px' : '100px',
                                        transform: 'rotate(-90deg)',
                                        cursor: 'pointer'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ width: '100%', height: '1px', background: 'var(--border-subtle)' }} />

                        {/* Background Color */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Bg</span>
                            <button
                                onClick={() => setShowBgColorPicker(true)}
                                style={{
                                    width: isMobile ? '32px' : '36px',
                                    height: isMobile ? '24px' : '28px',
                                    padding: 0,
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                    background: bgColor,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: bgColor === '#ffffff' ? '#000' : '#fff'
                                }}
                            >
                                <Palette size={14} />
                            </button>
                        </div>

                        {/* Zoom Controls */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{Math.round(scale * 100)}%</span>
                            <button
                                onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
                                style={{
                                    padding: '0.5rem',
                                    borderRadius: '8px',
                                    color: 'var(--text-secondary)',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                                title="Reset View"
                            >
                                <Maximize2 size={20} />
                            </button>
                        </div>

                        {/* Canvas Settings */}
                        <button
                            onClick={() => setShowSettings(true)}
                            style={{
                                padding: '0.5rem',
                                borderRadius: '8px',
                                color: 'var(--text-secondary)',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <Settings size={20} />
                        </button>

                        <div style={{ marginTop: 'auto' }}>
                            <button
                                onClick={handleClear}
                                style={{
                                    padding: '0.5rem',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.7rem',
                                    textAlign: 'center',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    <div
                        onWheel={handleWheel}
                        style={{
                            flex: 1,
                            position: 'relative',
                            background: theme === 'dark' ? '#1a1a1a' : '#f5f5f5',
                            overflow: 'hidden',
                            touchAction: 'none'
                        }}
                    >
                        <canvas
                            ref={canvasRef}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            style={{
                                display: 'block',
                                touchAction: 'none',
                                cursor: tool === 'pen' ? `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewport='0 0 16 16' fill='black'><circle cx='8' cy='8' r='4'/></svg>") 8 8, crosshair` : 'crosshair',
                                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                                transformOrigin: '0 0',
                                width: canvasSize.width || '100%',
                                height: canvasSize.height || '100%',
                                backgroundColor: bgColor,
                                transition: 'background-color 0.3s'
                            }}
                        />
                    </div>
                </div>

                {/* Custom Color Pickers */}
                <AnimatePresence>
                    {showColorPicker && (
                        <div style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            zIndex: 10000,
                            display: 'flex',
                            alignItems: isMobile ? 'center' : 'flex-start',
                            justifyContent: isMobile ? 'center' : 'flex-start',
                            padding: isMobile ? '1rem' : '100px 0 0 100px'
                        }} onClick={() => setShowColorPicker(false)}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                onClick={(e) => e.stopPropagation()}
                                style={{ boxShadow: '0 30px 60px rgba(0,0,0,0.4)' }}
                            >
                                <PremiumColorPicker
                                    color={color}
                                    onChange={(c) => { setColor(c); setTool('pen'); }}
                                    onClose={() => setShowColorPicker(false)}
                                />
                            </motion.div>
                        </div>
                    )}

                    {showBgColorPicker && (
                        <div style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            zIndex: 10000,
                            display: 'flex',
                            alignItems: isMobile ? 'center' : 'flex-start',
                            justifyContent: isMobile ? 'center' : 'flex-start',
                            padding: isMobile ? '1rem' : '100px 0 0 100px'
                        }} onClick={() => setShowBgColorPicker(false)}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                onClick={(e) => e.stopPropagation()}
                                style={{ boxShadow: '0 30px 60px rgba(0,0,0,0.4)' }}
                            >
                                <div style={{ padding: '1rem', background: '#fff', borderRadius: '16px' }}>
                                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#333' }}>Page Background</h3>
                                    <PremiumColorPicker
                                        color={bgColor}
                                        onChange={handleBgColorChange}
                                        onClose={() => setShowBgColorPicker(false)}
                                    />
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {showSettings && (
                        <div style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            zIndex: 10000,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '1rem',
                            background: 'rgba(0,0,0,0.5)'
                        }} onClick={() => setShowSettings(false)}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    background: 'var(--bg-card)',
                                    padding: '2rem',
                                    borderRadius: '24px',
                                    width: '100%',
                                    maxWidth: '400px',
                                    boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
                                }}
                            >
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Canvas Settings</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Width (px)</label>
                                        <input
                                            type="number"
                                            value={canvasSize.width}
                                            onChange={(e) => setCanvasSize({ ...canvasSize, width: Number(e.target.value) })}
                                            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Height (px)</label>
                                        <input
                                            type="number"
                                            value={canvasSize.height}
                                            onChange={(e) => setCanvasSize({ ...canvasSize, height: Number(e.target.value) })}
                                            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                        <button
                                            onClick={() => setShowSettings(false)}
                                            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => {
                                                handleCanvasResize(canvasSize.width, canvasSize.height);
                                                setShowSettings(false);
                                            }}
                                            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', background: 'var(--accent-primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                                        >
                                            Apply
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};
