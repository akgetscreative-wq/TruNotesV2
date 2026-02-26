import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Note } from '../types';
import {
    Save, ArrowLeft, Star, Tag, RotateCcw, RotateCw, List, PenTool, Bold,
    Highlighter, Type, Plus, Minus, Heading1, Heading2, Sparkles, Eraser,
    MousePointer2, ChevronDown, Settings2, Grid3X3, AlignJustify, FileText
} from 'lucide-react';
import { ColorPicker } from '../components/UI/ColorPicker';
import { useThemeContext } from '../context/ThemeContext';
import { AnimatePresence, motion } from 'framer-motion';
import AIBridge from './AI/AIBridge';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface JournalEditorProps {
    note?: Note;
    onSave: (title: string, content: string, data: Partial<Note>, shouldExit?: boolean) => Promise<void>;
    onBack: () => void;
    onDelete?: () => void;
}

interface TextBlock {
    id: string;
    x: number;
    y: number;
    content: string;
    width: number;
}

interface DrawStroke {
    points: { x: number; y: number }[];
    color: string;
    lineWidth: number;
}

interface Snapshot {
    title: string;
    mainContent: string;
    textBlocks: TextBlock[];
    strokes: DrawStroke[];
}

type ToolMode = 'write' | 'draw' | 'erase';
type PaperStyle = 'lined' | 'grid' | 'blank';
type PaperTexture = 'clean' | 'rough' | 'dots';

const FONT_OPTIONS = [
    { label: 'Fredoka', value: "'Fredoka', sans-serif" },
    { label: 'Wait.. (Caveat)', value: "'Caveat', cursive" },
    { label: 'Fancy (Dancing Script)', value: "'Dancing Script', cursive" },
    { label: 'Marker (Indie Flower)', value: "'Indie Flower', cursive" },
    { label: 'Brush (Pacifico)', value: "'Pacifico', cursive" },
    { label: 'Neat (Shadows)', value: "'Shadows Into Light', cursive" },
    { label: 'Serif (Lora)', value: "'Lora', serif" },
    { label: 'Sans (Inter)', value: "'Inter', system-ui, sans-serif" },
    { label: 'Monospace', value: "'Courier New', monospace" }
];

// Virtual page dimensions
const PAGE_WIDTH_DESKTOP = 900;
const PAGE_WIDTH_MOBILE = 360;
const PAGE_HEIGHT = 1200;
const LINE_HEIGHT_DESKTOP = 1.6;
const LINE_HEIGHT_MOBILE = 1.4;

export const JournalEditor: React.FC<JournalEditorProps> = ({ note, onSave, onBack }) => {
    const [title, setTitle] = useState(note?.title || '');
    const [isFavorite, setIsFavorite] = useState(note?.isFavorite || false);
    const [color, setColor] = useState(note?.color || 'default');
    const [tags, setTags] = useState<string[]>(note?.tags || []);
    const [tagInput, setTagInput] = useState('');
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
    const [isPolishing, setIsPolishing] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [toolMode, setToolMode] = useState<ToolMode>('write');

    const [showDropdown, setShowDropdown] = useState(false);
    const [paperStyle, setPaperStyle] = useState<PaperStyle>('lined');
    const [paperTexture, setPaperTexture] = useState<PaperTexture>('clean');
    const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
    const [isExporting, setIsExporting] = useState(false);

    // Drawing state
    const [drawColor, setDrawColor] = useState('#8b5cf6'); // Default to Purple
    const [drawLineWidth, setDrawLineWidth] = useState(3);
    const [strokes, setStrokes] = useState<DrawStroke[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const currentStrokeRef = useRef<DrawStroke | null>(null);
    const drawCanvasRef = useRef<HTMLCanvasElement>(null);

    // Text blocks for click-anywhere
    const [textBlocks, setTextBlocks] = useState<TextBlock[]>([]);
    const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

    // Main editor
    const editorRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const pageContainerRef = useRef<HTMLDivElement>(null);

    // Page state - infinite pages
    const [pageCount, setPageCount] = useState(3);
    const [contentTrigger, setContentTrigger] = useState(0);

    const { theme } = useThemeContext();
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    const lineHeightRem = isMobile ? LINE_HEIGHT_MOBILE : LINE_HEIGHT_DESKTOP;
    const lineHeightPx = lineHeightRem * 16;
    const pageWidth = isMobile ? PAGE_WIDTH_MOBILE : PAGE_WIDTH_DESKTOP;

    // Parse saved content
    useEffect(() => {
        if (note?.content) {
            try {
                const parsed = JSON.parse(note.content);
                if (parsed._journalV2) {
                    if (parsed.mainContent && editorRef.current) {
                        editorRef.current.innerHTML = parsed.mainContent;
                    }
                    if (parsed.textBlocks) setTextBlocks(parsed.textBlocks);
                    if (parsed.strokes) setStrokes(parsed.strokes);
                    if (parsed.pageCount) setPageCount(parsed.pageCount);
                    if (parsed.paperStyle) setPaperStyle(parsed.paperStyle);
                    if (parsed.fontFamily) setFontFamily(parsed.fontFamily);
                    return;
                }
            } catch { /* not JSON, treat as regular HTML */ }

            // Legacy content - load into main editor
            if (editorRef.current) {
                editorRef.current.innerHTML = note.content;
            }
        }
    }, []);

    // Serialize all content
    const serializeContent = useCallback(() => {
        const mainContent = editorRef.current?.innerHTML || '';
        const data = {
            _journalV2: true,
            mainContent,
            textBlocks,
            strokes,
            pageCount,
            paperStyle,
            paperTexture,
            fontFamily
        };
        return JSON.stringify(data);
    }, [textBlocks, strokes, pageCount, paperStyle, paperTexture, fontFamily]);

    const isDarkPaper = theme === 'dark' && color === 'default';
    const textColor = isDarkPaper ? '#f8fafc' : '#1e293b';

    // Page background - absolute colors ignoring dark/light mode
    const getSolidTint = (c: string) => {
        if (theme === 'dark' && c === 'default') return '#1e293b';
        switch (c) {
            case 'rose': return '#fff1f2';
            case 'sage': return '#f3fcf8';
            case 'sky': return '#f0f9ff';
            case 'lavender': return '#f5f3ff';
            case 'lemon': return '#fefce8';
            case 'default':
            default: return '#ffffff';
        }
    };
    const pageBg = getSolidTint(color);
    const iconColor = theme === 'dark' ? 'rgba(255,255,255,0.75)' : 'var(--text-secondary)';
    const ruledLineColor = isDarkPaper ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    // Paper background generator
    const getPaperBackground = () => {
        let images = [];
        let sizes = [];

        if (paperStyle === 'grid') {
            images.push(`linear-gradient(${ruledLineColor} 1px, transparent 1px)`);
            images.push(`linear-gradient(90deg, ${ruledLineColor} 1px, transparent 1px)`);
            sizes.push(`${lineHeightPx}px ${lineHeightPx}px`);
            sizes.push(`${lineHeightPx}px ${lineHeightPx}px`);
        } else if (paperStyle === 'lined') {
            images.push(`linear-gradient(transparent calc(100% - 1px), ${ruledLineColor} calc(100% - 1px))`);
            sizes.push(`100% ${lineHeightPx}px`);
        }

        if (paperTexture === 'rough') {
            images.push(`radial-gradient(rgba(0,0,0,0.04) 2px, transparent 2px)`);
            sizes.push(`14px 14px`);
            images.push(`radial-gradient(rgba(0,0,0,0.02) 1px, transparent 1px)`);
            sizes.push(`20px 20px`);
        } else if (paperTexture === 'dots') {
            images.push(`radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)`);
            sizes.push(`8px 8px`);
        }

        if (images.length === 0) return { backgroundImage: 'none', backgroundSize: 'auto' };

        return {
            backgroundImage: images.join(', '),
            backgroundSize: sizes.join(', '),
            backgroundColor: pageBg // Ensure the generated background color combines correctly
        };
    };

    const handleExportPDF = async () => {
        if (!pageContainerRef.current) return;
        setIsExporting(true);
        if ((window as any).showToast) (window as any).showToast("Exporting PDF...", "info");

        try {
            // Need a slight delay to ensure UI updates if we removed active classes, etc
            await new Promise(r => setTimeout(r, 100));

            // Increase scale for better resolution, capture page as-is
            const canvas = await html2canvas(pageContainerRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: pageBg
            });

            const imgData = canvas.toDataURL('image/png');
            // jsPDF setup
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            // Handle multi-page
            let heightLeft = pdfHeight;
            let position = 0;
            const pageHeight = pdf.internal.pageSize.getHeight();

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight, '', 'FAST');
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight, '', 'FAST');
                heightLeft -= pageHeight;
            }

            const fileName = `${title ? title.replace(/[^a-z0-9]/gi, '_') : 'trunotes'}_${Date.now()}.pdf`;
            const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

            if (isMobile) {
                const base64Pdf = pdf.output('datauristring').split(',')[1];
                try {
                    await Filesystem.writeFile({
                        path: `/storage/emulated/0/Download/${fileName}`,
                        data: base64Pdf
                    });
                    if ((window as any).showToast) (window as any).showToast("Saved to Downloads folder!", "success");
                } catch (e) {
                    const result = await Filesystem.writeFile({
                        path: fileName,
                        data: base64Pdf,
                        directory: Directory.Documents
                    });
                    if ((window as any).showToast) (window as any).showToast("Saved! Opening Share...", "success");
                    await Share.share({ url: result.uri, title: fileName, dialogTitle: 'Save PDF' });
                }
            } else {
                pdf.save(fileName);
                if ((window as any).showToast) (window as any).showToast("PDF Exported!", "success");
            }
        } catch (err) {
            console.error(err);
            if ((window as any).showToast) (window as any).showToast("Export Failed", "error");
        } finally {
            setIsExporting(false);
            setShowDropdown(false);
        }
    };

    // --- Undo/Redo ---
    const [history, setHistory] = useState<Snapshot[]>([{
        title: note?.title || '',
        mainContent: note?.content || '',
        textBlocks: [],
        strokes: []
    }]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const isUndoRedoAction = useRef(false);

    const pushSnapshot = useCallback(() => {
        if (isUndoRedoAction.current) {
            isUndoRedoAction.current = false;
            return;
        }
        const currentMainContent = editorRef.current?.innerHTML || '';
        const prevSnap = history[historyIndex];
        // Only push if there's a difference
        if (prevSnap && prevSnap.title === title && prevSnap.mainContent === currentMainContent && prevSnap.textBlocks === textBlocks && prevSnap.strokes === strokes) {
            return;
        }

        const snap: Snapshot = {
            title,
            mainContent: currentMainContent,
            textBlocks,
            strokes
        };
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(snap);
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [title, textBlocks, strokes, history, historyIndex]);

    const handleUndo = () => {
        if (historyIndex > 0) {
            isUndoRedoAction.current = true;
            const prev = history[historyIndex - 1];
            setTitle(prev.title);
            if (editorRef.current) editorRef.current.innerHTML = prev.mainContent;
            setTextBlocks(prev.textBlocks);
            setStrokes(prev.strokes);
            setHistoryIndex(historyIndex - 1);
            markUnsaved();
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            isUndoRedoAction.current = true;
            const next = history[historyIndex + 1];
            setTitle(next.title);
            if (editorRef.current) editorRef.current.innerHTML = next.mainContent;
            setTextBlocks(next.textBlocks);
            setStrokes(next.strokes);
            setHistoryIndex(historyIndex + 1);
            markUnsaved();
        }
    };

    // --- Rich Text ---
    const applyFormat = (command: string, value?: string) => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        try {
            if (!document.getSelection()?.rangeCount) {
                editorRef.current.focus();
            }
            document.execCommand(command, false, value);
            markUnsaved();
        } catch (err) {
            console.error("Format command failed", err);
        }
    };

    const toggleBold = () => applyFormat('bold');
    const toggleHighlight = (hlColor: string) => {
        const sel = window.getSelection();
        if (sel && sel.isCollapsed) {
            if ((window as any).showToast) (window as any).showToast("Select text first to highlight", "info");
            return;
        }

        applyFormat('hiliteColor', hlColor);
        // Force dark text color for contrast against neon highlighters
        applyFormat('foreColor', '#1e293b');

        // Prevent highlight from bleeding into next typed characters
        if (sel) {
            sel.collapseToEnd();
            applyFormat('hiliteColor', 'transparent');
            // Reset to paper color so they can keep typing normally on the paper
            applyFormat('foreColor', textColor);
        }
    };

    const applyTextColor = (c: string) => {
        const sel = window.getSelection();
        if (sel && sel.isCollapsed) {
            if ((window as any).showToast) (window as any).showToast("Select text first to set text color", "info");
            return;
        }
        applyFormat('foreColor', c);
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

    const handleInsertBullet = () => applyFormat('insertUnorderedList');

    const highlightColors = [
        '#fef08a', '#a7f3d0', '#bae6fd', '#fbcfe8',
        '#ffff00', '#00ff00', '#00ffff', '#ff00ff'
    ];

    // --- Auto-save ---
    const markUnsaved = () => {
        if (saveStatus !== 'unsaved') setSaveStatus('unsaved');
    };

    useEffect(() => {
        if (saveStatus === 'saved') return;
        const timeout = setTimeout(async () => {
            if (saveStatus === 'unsaved') {
                setSaveStatus('saving');
                try {
                    const content = serializeContent();
                    await onSave(title, content, { isFavorite, color, tags }, false);
                    setSaveStatus('saved');
                } catch (err) {
                    console.error("Auto-save failed", err);
                    setSaveStatus('unsaved');
                }
            }
        }, 2000);
        return () => clearTimeout(timeout);
    }, [title, saveStatus, onSave, isFavorite, color, tags, textBlocks, strokes, serializeContent]);

    // Debounced history push
    useEffect(() => {
        const timeout = setTimeout(pushSnapshot, 800);
        return () => clearTimeout(timeout);
    }, [title, textBlocks, strokes, contentTrigger, pushSnapshot]);

    // --- Navigation ---
    const handleBack = () => {
        setIsExiting(true);
        setTimeout(onBack, 400);
    };

    const handleManualSave = async () => {
        setSaveStatus('saving');
        setIsExiting(true);
        try {
            const content = serializeContent();
            await Promise.all([
                onSave(title, content, { isFavorite, color, tags }, false),
                new Promise(resolve => setTimeout(resolve, 400))
            ]);
            onBack();
        } catch {
            setIsExiting(false);
            setSaveStatus('unsaved');
        }
    };

    // --- Keyboard shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                const content = serializeContent();
                onSave(title, content, { isFavorite, color, tags }, false)
                    .then(() => setSaveStatus('saved'))
                    .catch(() => setSaveStatus('unsaved'));
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                if (e.shiftKey) { e.preventDefault(); handleRedo(); }
                else { e.preventDefault(); handleUndo(); }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [title, isFavorite, color, tags, onSave, serializeContent]);

    // --- Tags ---
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

    // --- Infinite scroll ---
    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const scrollBottom = container.scrollTop + container.clientHeight;
        const totalHeight = pageCount * PAGE_HEIGHT;

        // When near bottom, add more pages
        if (scrollBottom > totalHeight - 500) {
            setPageCount(prev => prev + 2);
        }
    }, [pageCount]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    // --- Drawing ---
    const redrawCanvas = useCallback(() => {
        const canvas = drawCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const stroke of strokes) {
            if (stroke.points.length < 2) continue;
            ctx.beginPath();
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.lineWidth;
            ctx.globalCompositeOperation = 'source-over';
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
        }

        // Draw current stroke in progress
        if (currentStrokeRef.current && currentStrokeRef.current.points.length > 1) {
            const s = currentStrokeRef.current;
            ctx.beginPath();
            ctx.strokeStyle = s.color;
            ctx.lineWidth = s.lineWidth;
            ctx.globalCompositeOperation = 'source-over';
            ctx.moveTo(s.points[0].x, s.points[0].y);
            for (let i = 1; i < s.points.length; i++) {
                ctx.lineTo(s.points[i].x, s.points[i].y);
            }
            ctx.stroke();
        }
    }, [strokes]);

    // Resize canvas when page count changes
    useEffect(() => {
        const canvas = drawCanvasRef.current;
        const container = pageContainerRef.current;
        if (!canvas || !container) return;

        try {
            const width = Math.max(1, container.clientWidth);
            const height = Math.max(1, pageCount * PAGE_HEIGHT);

            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }
            redrawCanvas();
        } catch (err) {
            console.warn('Canvas resize error:', err);
        }
    }, [pageCount, redrawCanvas]);

    // Redraw when strokes change
    useEffect(() => {
        redrawCanvas();
    }, [strokes, redrawCanvas]);

    const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
        try {
            const canvas = drawCanvasRef.current;
            if (!canvas) return { x: 0, y: 0 };
            const rect = canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return { x: 0, y: 0 };
            let clientX: number, clientY: number;
            if ('touches' in e) {
                const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
                if (!touch) return { x: 0, y: 0 };
                clientX = touch.clientX;
                clientY = touch.clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return {
                x: (clientX - rect.left) * (isFinite(scaleX) ? scaleX : 1),
                y: (clientY - rect.top) * (isFinite(scaleY) ? scaleY : 1)
            };
        } catch (err) {
            console.warn('getCanvasCoords error:', err);
            return { x: 0, y: 0 };
        }
    };

    const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
        try {
            if (toolMode !== 'draw' && toolMode !== 'erase') return;
            e.preventDefault();
            const coords = getCanvasCoords(e);
            const strokeColor = toolMode === 'erase' ? pageBg : drawColor;
            const strokeWidth = toolMode === 'erase' ? drawLineWidth * 3 : drawLineWidth;
            currentStrokeRef.current = {
                points: [coords],
                color: strokeColor,
                lineWidth: strokeWidth
            };
            setIsDrawing(true);
        } catch (err) {
            console.warn('startDraw error:', err);
        }
    };

    const continueDraw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !currentStrokeRef.current) return;
        try {
            e.preventDefault();
            const coords = getCanvasCoords(e);
            currentStrokeRef.current.points.push(coords);

            // Live preview
            const canvas = drawCanvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (ctx && currentStrokeRef.current.points.length > 1) {
                const pts = currentStrokeRef.current.points;
                ctx.beginPath();
                ctx.strokeStyle = currentStrokeRef.current.color;
                ctx.lineWidth = currentStrokeRef.current.lineWidth;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
                ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
                ctx.stroke();
            }
        } catch (err) {
            console.warn('continueDraw error:', err);
        }
    };

    const endDraw = () => {
        if (!isDrawing || !currentStrokeRef.current) return;
        try {
            setIsDrawing(false);
            if (currentStrokeRef.current.points.length > 1) {
                // Deep copy to prevent reference issues
                const finishedStroke: DrawStroke = {
                    points: currentStrokeRef.current.points.map(p => ({ x: p.x, y: p.y })),
                    color: currentStrokeRef.current.color,
                    lineWidth: currentStrokeRef.current.lineWidth
                };
                setStrokes(prev => [...prev, finishedStroke]);
                markUnsaved();
            }
            currentStrokeRef.current = null;
        } catch (err) {
            console.warn('endDraw error:', err);
            currentStrokeRef.current = null;
            setIsDrawing(false);
        }
    };

    const handlePageClick = () => {
        // Box creation feature intentionally removed
    };

    const updateTextBlock = (id: string, content: string) => {
        setTextBlocks(prev => prev.map(b =>
            b.id === id ? { ...b, content } : b
        ));
        markUnsaved();
    };

    const removeEmptyBlock = (id: string) => {
        // Delay to allow focus to transfer to another element first
        setTimeout(() => {
            setTextBlocks(prev => {
                const block = prev.find(b => b.id === id);
                if (block) {
                    // Strip HTML tags before checking emptiness
                    const plainText = block.content.replace(/<[^>]*>/g, '').trim();
                    if (!plainText) {
                        return prev.filter(b => b.id !== id);
                    }
                }
                return prev;
            });
        }, 200);
    };

    // --- TruPolish ---
    const handleTruPolish = async () => {
        const mainContent = editorRef.current?.innerHTML || '';
        const allBlockContent = textBlocks.map(b => b.content).join(' ');
        const allText = mainContent + ' ' + allBlockContent;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = allText;
        const plainText = tempDiv.textContent || tempDiv.innerText || '';

        if (!plainText.trim() || isPolishing) return;

        setIsPolishing(true);
        if ((window as any).showToast) (window as any).showToast("Polishing...", "info");

        try {
            const last = await AIBridge.getLastModelPath();
            const modelPath = last.path || "";
            const lowerPath = modelPath.toLowerCase();

            // Ultra-short instruction for speed
            const instruction = `Rewrite and improve the following text. Fix grammar, spelling, and clarity. Use bullet points if listing items. Keep it concise. Output ONLY the improved text, nothing else.\n\n`;

            let prompt = "";
            if (lowerPath.includes('llama-3')) {
                prompt = `<|start_header_id|>user<|end_header_id|>\n\n${instruction}${plainText}<|eot_id|>\n<|start_header_id|>assistant<|end_header_id|>\n\n`;
            } else if (lowerPath.includes('gemma')) {
                prompt = `<start_of_turn>user\n${instruction}${plainText}<end_of_turn>\n<start_of_turn>model\n`;
            } else {
                prompt = `<|im_start|>user\n${instruction}${plainText}<|im_end|>\n<|im_start|>assistant\n`;
            }

            // Aggressive speed cap
            const maxPredict = Math.min(Math.ceil(plainText.length * 1.3) + 80, 500);
            let result: any = await (AIBridge as any).generateSync({ prompt, temperature: 0.15, n_predict: maxPredict, penalty: 1.3, top_k: 30, top_p: 0.85 });

            if (result.response.includes("Error: Model not loaded")) {
                const loadLast = await AIBridge.getLastModelPath();
                if (loadLast.path) {
                    await AIBridge.loadModel({ path: loadLast.path, threads: 6 });
                    result = await (AIBridge as any).generateSync({ prompt, temperature: 0.15, n_predict: maxPredict, penalty: 1.3, top_k: 30, top_p: 0.85 });
                } else {
                    throw new Error("No model loaded. Go to Akitsu and load a model first.");
                }
            }

            if (result.response) {
                let text = result.response.trim();

                // Cut off garbage after end markers
                for (const marker of ['[AI_END]', '<|im_end|>', '<|eot_id|>', '<end_of_turn>', '---CONTENT END---', '---END---']) {
                    if (text.includes(marker)) text = text.split(marker)[0].trim();
                }

                // Strip preamble
                text = text.replace(/^(Here('s| is).*?:\s*\n?)/i, '');

                // Convert markdown bold
                text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

                // Convert markdown headers
                text = text.replace(/^###\s+(.+)$/gm, '<h3 style="margin:0.5em 0 0.3em;font-size:1.1em;color:var(--accent-primary)">$1</h3>');
                text = text.replace(/^##\s+(.+)$/gm, '<h2 style="margin:0.6em 0 0.3em;font-size:1.2em">$1</h2>');
                text = text.replace(/^#\s+(.+)$/gm, '<h2 style="margin:0.6em 0 0.3em;font-size:1.3em">$1</h2>');

                // Convert bullet lines
                const lines = text.split('\n');
                let html = '';
                let inList = false;

                for (const line of lines) {
                    const bulletMatch = line.match(/^\s*[-*•]\s+(.+)/);
                    if (bulletMatch) {
                        if (!inList) { html += '<ul style="margin:0.4em 0;padding-left:1.5em">'; inList = true; }
                        html += `<li style="margin:0.2em 0">${bulletMatch[1]}</li>`;
                    } else {
                        if (inList) { html += '</ul>'; inList = false; }
                        if (line.trim()) {
                            if (line.includes('<h2') || line.includes('<h3')) {
                                html += line;
                            } else {
                                html += `<p style="margin:0.3em 0">${line}</p>`;
                            }
                        }
                    }
                }
                if (inList) html += '</ul>';

                // Auto-highlight bold phrases
                html = html.replace(/<b>(.*?)<\/b>/g,
                    '<b style="background:rgba(99,102,241,0.12);padding:1px 4px;border-radius:4px">$1</b>');

                if (editorRef.current) editorRef.current.innerHTML = html;
                markUnsaved();
                if ((window as any).showToast) (window as any).showToast("Text polished! ✨", "success");
            }
        } catch (err: any) {
            console.error("AI Polish failed:", err);
            if ((window as any).showToast) (window as any).showToast(err.message || "Refinement failed.", "error");
        } finally {
            setIsPolishing(false);
        }
    };

    // --- Draw colors ---
    const drawColors = [
        '#1e293b', '#64748b', '#ef4444', '#f97316', '#eab308',
        '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'
    ];

    // Total height for all pages
    const totalHeight = pageCount * PAGE_HEIGHT;

    // Page separator lines
    const pageSeparators: number[] = [];
    for (let i = 1; i < pageCount; i++) {
        pageSeparators.push(i * PAGE_HEIGHT);
    }

    return (
        <div className={`editor-container note-color-${color} ${isExiting ? 'fade-out' : 'fade-in'}`} style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'transparent',
            transition: 'background-color 0.4s ease, opacity 0.4s ease, transform 0.4s ease',
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 10,
            transform: isExiting ? 'scale(0.98)' : 'scale(1)',
            opacity: isExiting ? 0 : 1,
        }}>
            {/* ===== HEADER / TOOLBAR ===== */}
            <header style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: isMobile ? 'calc(var(--safe-top) + 1px) 0.5rem 1px 0.5rem' : '2px 2rem',
                flexShrink: 0, background: 'transparent', backdropFilter: 'blur(25px)',
                width: '100%', position: 'sticky', top: 0, zIndex: 20,
                borderBottom: '1px solid rgba(128,128,128,0.15)',
                minHeight: isMobile ? '38px' : '48px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.25rem' : '0.75rem' }}>
                    <button onClick={handleBack} style={{
                        display: 'flex', alignItems: 'center', padding: '0.4rem', borderRadius: '8px',
                        backgroundColor: 'white', boxShadow: 'var(--shadow-soft)', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)'
                    }}><ArrowLeft size={18} /></button>

                    <button onClick={handleUndo} disabled={historyIndex <= 0}
                        style={{ padding: '0.35rem', opacity: historyIndex <= 0 ? 0.3 : 1, background: 'transparent', border: 'none', cursor: historyIndex <= 0 ? 'default' : 'pointer' }}>
                        <RotateCcw size={16} color={iconColor} />
                    </button>
                    <button onClick={handleRedo} disabled={historyIndex >= history.length - 1}
                        style={{ padding: '0.35rem', opacity: historyIndex >= history.length - 1 ? 0.3 : 1, background: 'transparent', border: 'none', cursor: historyIndex >= history.length - 1 ? 'default' : 'pointer' }}>
                        <RotateCw size={16} color={iconColor} />
                    </button>

                    <div style={{ width: '1px', height: '1rem', background: 'rgba(128,128,128,0.15)' }} />

                    {/* Mode Switcher - compact */}
                    <div style={{ display: 'flex', gap: '2px', background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderRadius: '10px', padding: '2px' }}>
                        {([['write', MousePointer2], ['draw', PenTool], ['erase', Eraser]] as const).map(([mode, Icon]) => (
                            <button key={mode} onClick={() => setToolMode(mode as ToolMode)} style={{
                                padding: '0.3rem 0.5rem', borderRadius: '8px',
                                background: toolMode === mode ? 'var(--accent-primary)' : 'transparent',
                                color: toolMode === mode ? 'white' : iconColor,
                                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem',
                                fontSize: '0.7rem', fontWeight: 600, transition: 'all 0.2s'
                            }}>
                                <Icon size={14} />
                                {!isMobile && <span style={{ textTransform: 'capitalize' }}>{mode}</span>}
                            </button>
                        ))}
                    </div>

                    <div style={{ width: '1px', height: '1rem', background: 'rgba(128,128,128,0.15)' }} />



                    <button onClick={() => setShowDropdown(!showDropdown)} style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem',
                        borderRadius: '10px', border: '1px solid var(--border-subtle)', cursor: 'pointer',
                        background: showDropdown ? 'var(--accent-primary)' : (theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'),
                        color: showDropdown ? 'white' : iconColor, fontSize: '0.7rem', fontWeight: 600,
                        transition: 'all 0.2s'
                    }}>
                        <Settings2 size={14} />
                        {!isMobile && 'Tools'}
                        <ChevronDown size={12} style={{ transition: 'transform 0.2s', transform: showDropdown ? 'rotate(180deg)' : 'none' }} />
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button onClick={handleTruPolish} disabled={isPolishing} title="Tru Polish" style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isPolishing ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)', color: 'var(--accent-primary)',
                        width: '34px', height: '34px', borderRadius: '50%',
                        border: isPolishing ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                        cursor: isPolishing ? 'default' : 'pointer', padding: 0, transition: 'all 0.3s',
                        boxShadow: isPolishing ? '0 0 15px rgba(99,102,241,0.3)' : 'var(--shadow-soft)'
                    }}>
                        {isPolishing ? (
                            <motion.div animate={{ rotate: 360, scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}>
                                <Sparkles size={16} fill="var(--accent-primary)" />
                            </motion.div>
                        ) : <Sparkles size={16} />}
                    </button>
                    <button onClick={handleManualSave} style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: 'var(--accent-primary)', color: 'white',
                        padding: isMobile ? '0.35rem 0.7rem' : '0.45rem 1rem', borderRadius: '10px', fontWeight: 700,
                        fontSize: isMobile ? '0.75rem' : '0.85rem', boxShadow: '0 6px 16px -4px rgba(99,102,241,0.4)',
                        border: 'none', cursor: 'pointer'
                    }}><Save size={14} /> Save</button>
                    <button onClick={() => { setIsFavorite(!isFavorite); markUnsaved(); }} style={{
                        color: isFavorite ? '#f59e0b' : 'var(--text-muted)', padding: '0.35rem', borderRadius: '8px',
                        backgroundColor: 'transparent', border: 'none', cursor: 'pointer'
                    }}><Star size={16} fill={isFavorite ? "#f59e0b" : "none"} /></button>
                </div>
            </header>

            {/* ===== DROPDOWN PANEL ===== */}
            <AnimatePresence>
                {showDropdown && (
                    <>
                        {isMobile && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowDropdown(false)}
                            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: 9 }} />}
                        <motion.div
                            initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -50, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0, right: 0,
                                zIndex: 100, // Cover everything when open
                                background: theme === 'dark' ? 'rgba(30,30,30,0.98)' : 'rgba(255,255,255,0.98)',
                                backdropFilter: 'blur(30px)',
                                borderBottom: '1px solid var(--border-subtle)',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                                overflow: 'hidden'
                            }}
                        >
                            <div style={{ padding: isMobile ? `calc(var(--safe-top) + 0.5rem) 0.6rem 0.5rem 0.6rem` : '1rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {/* Row 1: Paper Style + Font */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paper Style</span>
                                            <div style={{ display: 'flex', gap: '4px', background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderRadius: '10px', padding: '3px', border: '1px solid var(--border-subtle)' }}>
                                                {([['lined', AlignJustify, 'Lines'], ['grid', Grid3X3, 'Grid'], ['blank', FileText, 'Blank']] as const).map(([ps, Icon, label]) => (
                                                    <button key={ps} onClick={() => { setPaperStyle(ps as PaperStyle); markUnsaved(); }} style={{
                                                        padding: '0.4rem 0.75rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                                        background: paperStyle === ps ? 'var(--accent-primary)' : 'transparent',
                                                        color: paperStyle === ps ? 'white' : 'var(--text-secondary)',
                                                        display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.2s',
                                                        boxShadow: paperStyle === ps ? '0 4px 12px rgba(99,102,241,0.3)' : 'none'
                                                    }}><Icon size={14} /> {label}</button>
                                                ))}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Color</span>
                                            <ColorPicker selectedColor={color} onSelect={(c) => { setColor(c); markUnsaved(); }} />
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Font</span>
                                            <select value={fontFamily} onChange={e => { setFontFamily(e.target.value); markUnsaved(); }}
                                                style={{
                                                    fontSize: '0.8rem', padding: '0.4rem 0.6rem', borderRadius: '10px',
                                                    border: '1px solid var(--border-subtle)', background: theme === 'dark' ? '#333' : '#fff',
                                                    color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontFamily: fontFamily, width: isMobile ? '130px' : '170px',
                                                    height: '36px'
                                                }}>
                                                {FONT_OPTIONS.map(f => (
                                                    <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Texture</span>
                                            <select value={paperTexture} onChange={e => { setPaperTexture(e.target.value as PaperTexture); markUnsaved(); }}
                                                style={{
                                                    fontSize: '0.8rem', padding: '0.4rem 0.6rem', borderRadius: '10px',
                                                    border: '1px solid var(--border-subtle)', background: theme === 'dark' ? '#333' : '#fff',
                                                    color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', width: isMobile ? '110px' : '120px',
                                                    height: '36px'
                                                }}>
                                                <option value="clean">Clean</option>
                                                <option value="rough">Rough</option>
                                                <option value="dots">Dots</option>
                                            </select>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
                                            <button onClick={handleExportPDF} disabled={isExporting} style={{
                                                padding: '0.4rem 0.8rem', borderRadius: '10px', border: '1px solid var(--accent-primary)',
                                                background: isExporting ? 'transparent' : 'var(--accent-subtle)',
                                                color: 'var(--accent-primary)', cursor: isExporting ? 'default' : 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.2s',
                                                opacity: isExporting ? 0.6 : 1
                                            }}>
                                                {isExporting ? 'Exporting...' : 'Export PDF'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Row 2: Text formatting (write mode) OR Draw tools */}
                                {toolMode === 'write' ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.3rem' }}>Format</span>
                                        <button onMouseDown={e => e.preventDefault()} onClick={toggleBold}
                                            style={{ padding: '0.35rem', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                                            <Bold size={16} color={iconColor} />
                                        </button>
                                        <button onMouseDown={e => e.preventDefault()} onClick={handleInsertBullet}
                                            style={{ padding: '0.35rem', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                                            <List size={16} color={iconColor} />
                                        </button>
                                        <button onMouseDown={e => e.preventDefault()} onClick={() => toggleHeading('h1')}
                                            style={{ padding: '0.35rem', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                                            <Heading1 size={16} color={iconColor} />
                                        </button>
                                        <button onMouseDown={e => e.preventDefault()} onClick={() => toggleHeading('h2')}
                                            style={{ padding: '0.35rem', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                                            <Heading2 size={16} color={iconColor} />
                                        </button>
                                        <div style={{ width: '1px', height: '1.2rem', background: 'rgba(128,128,128,0.15)' }} />
                                        <button onMouseDown={e => e.preventDefault()} onClick={() => changeFontSize(-1)}
                                            style={{ padding: '0.3rem', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                                            <Minus size={14} color={iconColor} />
                                        </button>
                                        <Type size={15} color={iconColor} />
                                        <button onMouseDown={e => e.preventDefault()} onClick={() => changeFontSize(1)}
                                            style={{ padding: '0.3rem', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                                            <Plus size={14} color={iconColor} />
                                        </button>
                                        <div style={{ width: '1px', height: '1.2rem', background: 'rgba(128,128,128,0.15)' }} />
                                        {/* Highlight swatches inline */}
                                        <Highlighter size={14} color={iconColor} />
                                        {highlightColors.map(c => (
                                            <button key={c} onClick={() => toggleHighlight(c)} style={{
                                                width: '20px', height: '20px', borderRadius: '50%', background: c, cursor: 'pointer',
                                                border: '1.5px solid rgba(128,128,128,0.2)', padding: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                            }} />
                                        ))}
                                        <button onClick={() => { applyFormat('removeFormat'); applyFormat('hiliteColor', 'transparent'); }} style={{
                                            fontSize: '0.65rem', padding: '0.2rem 0.4rem', borderRadius: '6px',
                                            border: '1px solid var(--border-subtle)', background: 'transparent',
                                            color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem'
                                        }}> <Eraser size={12} /> Clear Formatting</button>
                                        <div style={{ width: '1px', height: '1.2rem', background: 'rgba(128,128,128,0.15)', margin: '0 0.2rem' }} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginRight: '0.2rem' }}>Color</span>
                                            {drawColors.slice(2, 7).map(c => (
                                                <button key={c} onClick={() => applyTextColor(c)} style={{
                                                    width: '18px', height: '18px', borderRadius: '50%', background: c, cursor: 'pointer',
                                                    border: '1px solid rgba(128,128,128,0.2)', padding: 0
                                                }} />
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.2rem' }}>Brush</span>
                                        {drawColors.map(c => (
                                            <button key={c} onClick={() => { setDrawColor(c); if (toolMode === 'erase') setToolMode('draw'); }}
                                                style={{
                                                    width: '22px', height: '22px', borderRadius: '50%', background: c, cursor: 'pointer', padding: 0,
                                                    border: drawColor === c && toolMode === 'draw' ? '2.5px solid var(--accent-primary)' : '1px solid rgba(128,128,128,0.25)',
                                                    transform: drawColor === c && toolMode === 'draw' ? 'scale(1.15)' : 'scale(1)', transition: 'all 0.15s'
                                                }} />
                                        ))}
                                        <div style={{ width: '1px', height: '1.2rem', background: 'rgba(128,128,128,0.15)' }} />
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{drawLineWidth}px</span>
                                        <input type="range" min="1" max="20" value={drawLineWidth}
                                            onChange={e => setDrawLineWidth(Number(e.target.value))}
                                            style={{ width: isMobile ? '60px' : '90px', cursor: 'pointer' }} />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ===== SCROLL CONTAINER (Infinite) ===== */}
            <div
                ref={scrollContainerRef}
                className="dashboard-scrollbar"
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    position: 'relative',
                }}
            >
                <div style={{
                    width: '100%',
                    maxWidth: `${pageWidth + 80}px`,
                    margin: '0 auto',
                    padding: isMobile ? '0.5rem 0.5rem' : '2rem',
                    position: 'relative',
                }}>
                    {/* Floating Page */}
                    <div
                        ref={pageContainerRef}
                        className="floating-page"
                        onClick={handlePageClick}
                        style={{
                            position: 'relative',
                            width: '100%',
                            minHeight: `${totalHeight}px`,
                            backgroundColor: pageBg,
                            padding: isMobile ? '1rem 0.5rem' : '2rem 2.5rem',
                            borderRadius: isMobile ? '16px' : '24px',
                            boxShadow: 'var(--shadow-soft)',
                            cursor: toolMode === 'write' ? 'text' : (toolMode === 'draw' ? 'crosshair' : 'cell'),
                            overflow: 'hidden',
                        }}
                    >
                        {/* Tools Row (Color, Mood, Tags) */}
                        <div className="tools-row" style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            gap: '0.75rem', marginBottom: '1rem', position: 'relative', zIndex: 5,
                            width: '100%', flexWrap: 'wrap'
                        }}>
                            <ColorPicker selectedColor={color} onSelect={(c) => { setColor(c); markUnsaved(); }} />

                            {/* Tags - Parallel to Color Picker */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1 }}>
                                <Tag size={15} color="var(--text-muted)" />
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    {tags.map(tag => (
                                        <span key={tag} style={{
                                            fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: '10px',
                                            background: 'var(--accent-subtle)', color: 'var(--text-secondary)',
                                            display: 'flex', alignItems: 'center', gap: '0.2rem', border: '1px solid rgba(99,102,241,0.1)'
                                        }}>
                                            #{tag}
                                            <button onClick={() => removeTag(tag)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 2px', display: 'flex', fontSize: '1rem', color: 'var(--text-muted)' }}>×</button>
                                        </span>
                                    ))}
                                </div>
                                <input type="text" placeholder="+ Tag" value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleAddTag}
                                    style={{ fontSize: '0.8rem', width: '70px', border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', textAlign: 'right' }} />
                            </div>
                        </div>

                        {/* Title */}
                        <input type="text" placeholder="Note Title" value={title}
                            onChange={(e) => { setTitle(e.target.value); markUnsaved(); }}
                            style={{
                                fontSize: isMobile ? '1.8rem' : '2.5rem', fontWeight: 800,
                                color: textColor, background: 'transparent',
                                fontFamily: fontFamily, paddingBottom: '0.5rem',
                                border: 'none', borderBottom: `2px solid ${isDarkPaper ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                outline: 'none', width: '100%', position: 'relative', zIndex: 5
                            }}
                        />

                        {/* Paper lines background (lined / grid / blank) */}
                        <div style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0,
                            height: `${totalHeight}px`,
                            ...getPaperBackground(),
                            backgroundAttachment: 'local',
                            pointerEvents: 'none',
                            zIndex: 0
                        }} />

                        {/* Page separators */}
                        {pageSeparators.map((y, i) => (
                            <div key={i} style={{
                                position: 'absolute',
                                left: '5%', right: '5%',
                                top: `${y}px`,
                                height: '0',
                                borderTop: '2px dashed rgba(128,128,128,0.2)',
                                zIndex: 1,
                                pointerEvents: 'none'
                            }}>
                                <span style={{
                                    position: 'absolute', right: 0, top: '-12px',
                                    fontSize: '0.6rem', color: 'var(--text-muted)', opacity: 0.5
                                }}>Page {i + 2}</span>
                            </div>
                        ))}

                        {/* Main editor area */}
                        <div
                            className="main-editor-area"
                            style={{
                                position: 'relative',
                                zIndex: 3,
                                cursor: toolMode === 'write' ? 'text' : undefined,
                                marginTop: '0.5rem',
                                pointerEvents: toolMode === 'write' ? 'auto' : 'none'
                            }}
                            onClick={() => {
                                if (toolMode === 'write' && editorRef.current) {
                                    editorRef.current.focus();
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
                                onInput={() => { markUnsaved(); setContentTrigger(c => c + 1); }}
                                style={{
                                    width: '100%',
                                    minHeight: '20vh',
                                    fontSize: isMobile ? '1rem' : '1.15rem',
                                    lineHeight: `${lineHeightRem}rem`,
                                    color: textColor,
                                    fontFamily: fontFamily,
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    padding: '0',
                                    paddingTop: isMobile ? '3px' : '4px',
                                    paddingLeft: '2px',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    caretColor: 'var(--accent-primary)',
                                    backgroundImage: 'none' // ruled lines handled by parent now
                                }}
                            />
                        </div>

                        {/* Floating text blocks (click-anywhere) */}
                        {textBlocks.map(block => (
                            <div
                                key={block.id}
                                className="text-block-wrapper"
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: `${block.y}px`,
                                    width: '100%',
                                    zIndex: 4,
                                    pointerEvents: toolMode === 'write' ? 'auto' : 'none'
                                }}
                            >
                                <div
                                    id={`text-block-${block.id}`}
                                    contentEditable
                                    suppressContentEditableWarning
                                    onFocus={() => setActiveBlockId(block.id)}
                                    onBlur={() => {
                                        setActiveBlockId(null);
                                        removeEmptyBlock(block.id);
                                    }}
                                    onInput={(e) => updateTextBlock(block.id, e.currentTarget.innerHTML)}
                                    ref={(el) => {
                                        // Set initial content only once on mount
                                        if (el && !el.dataset.initialized) {
                                            el.innerHTML = block.content || '';
                                            el.dataset.initialized = 'true';
                                        }
                                    }}
                                    style={{
                                        minHeight: `${lineHeightPx}px`,
                                        fontSize: isMobile ? '1rem' : '1.15rem',
                                        lineHeight: `${lineHeightRem}rem`,
                                        color: 'var(--text-primary)',
                                        fontFamily: fontFamily,
                                        textIndent: `${block.x}px`,
                                        backgroundColor: activeBlockId === block.id
                                            ? (theme === 'dark' ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)')
                                            : 'transparent',
                                        border: activeBlockId === block.id ? '1px dashed var(--accent-primary)' : '1px dashed transparent',
                                        borderRadius: '4px',
                                        outline: 'none',
                                        padding: '2px 4px',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        caretColor: 'var(--accent-primary)',
                                        textAlign: 'left',
                                        transition: 'border-color 0.2s, background-color 0.2s'
                                    }}
                                />
                            </div>
                        ))}

                        {/* Drawing canvas overlay */}
                        <canvas
                            ref={drawCanvasRef}
                            onMouseDown={startDraw}
                            onMouseMove={continueDraw}
                            onMouseUp={endDraw}
                            onMouseLeave={endDraw}
                            onTouchStart={startDraw}
                            onTouchMove={continueDraw}
                            onTouchEnd={endDraw}
                            style={{
                                position: 'absolute',
                                top: 0, left: 0,
                                width: '100%',
                                height: `${totalHeight}px`,
                                pointerEvents: (toolMode === 'draw' || toolMode === 'erase') ? 'auto' : 'none',
                                zIndex: (toolMode === 'draw' || toolMode === 'erase') ? 10 : 2,
                                cursor: toolMode === 'draw' ? 'crosshair' : (toolMode === 'erase' ? 'cell' : 'default'),
                                touchAction: 'none'
                            }}
                        />

                        {/* Scroll sentinel for infinite scroll */}
                        <div style={{
                            position: 'absolute',
                            bottom: 0, left: 0, right: 0,
                            height: '200px',
                            pointerEvents: 'none'
                        }} />
                    </div>

                    {/* Bottom padding */}
                    <div style={{ height: '100px' }} />
                </div>
            </div>

            {/* ===== BOTTOM STATUS BAR ===== */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: isMobile ? '0.3rem 0.75rem' : '0.4rem 2rem',
                borderTop: '1px solid rgba(128,128,128,0.1)',
                background: theme === 'dark' ? 'rgba(30,30,30,0.5)' : 'rgba(255,255,255,0.5)',
                backdropFilter: 'blur(10px)',
                flexShrink: 0,
                zIndex: 20,
                fontSize: '0.7rem',
                color: 'var(--text-muted)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                    }}>
                        <div style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: saveStatus === 'saved' ? '#22c55e' : saveStatus === 'saving' ? '#f59e0b' : '#ef4444',
                            animation: saveStatus === 'saving' ? 'pulse-slow 1.5s ease-in-out infinite' : 'none'
                        }} />
                        {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
                    </span>
                    <span>Page {Math.max(1, Math.ceil(((scrollContainerRef.current?.scrollTop || 0) + 1) / PAGE_HEIGHT))} of {pageCount}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ textTransform: 'capitalize' }}>
                        {toolMode === 'write' ? '✏️ Write' : toolMode === 'draw' ? '🖌 Draw' : '🧹 Erase'}
                    </span>
                    <span>{strokes.length} strokes</span>
                    <span>{textBlocks.length} blocks</span>
                </div>
            </div>
        </div>
    );
};
