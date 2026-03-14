import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bot, Clock, Settings, Cpu, Plus, Square, X, MessageSquare, Send
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useThemeContext } from '../../context/ThemeContext';
import { useNotes } from '../../hooks/useNotes';
import { useTodos } from '../../hooks/useTodos';
import { useHourlyLog } from '../../hooks/useHourlyLog';
import { Preferences } from '@capacitor/preferences';
import { storage } from '../../lib/storage';

import { useAISessions, resetAISessionHistory } from './useAISessions';
import { useAIModels } from './useAIModels';
import { useAICommands } from './useAICommands';
import { useAIEngine } from './useAIEngine';
import { formatChatPrompt } from './promptBuilder';
import { getRelevantContext } from './contextBuilder';

export const resetAIHistory = () => {
    resetAISessionHistory();
};

export const AIView: React.FC = () => {
    const { theme } = useThemeContext();
    const dark = theme === 'dark';

    const { notes } = useNotes();
    const { todos, addTodo, toggleTodo, deleteTodo } = useTodos();
    const { addNote, updateNote, deleteNote } = useNotes();
    const todayKey = new Date().toISOString().split('T')[0];
    const { logs: hourlyLogs, saveLog: saveHourlyLog } = useHourlyLog(todayKey);
    const [activeTab, setActiveTab] = useState<'chat' | 'models' | 'settings'>('chat');
    const [inputText, setInputText] = useState('');
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [persistentMemories, setPersistentMemories] = useState<string[]>([]);
    const [aiConfig, setAiConfig] = useState({
        threads: 6,
        use_mmap: true,
        responseType: 'standard' as 'brief' | 'standard' | 'detailed',
        customInstructions: '',
        n_predict: 256,
        temperature: 0.5,
        top_k: 20,
        top_p: 0.85,
        penalty: 1.2,
        disableContext: false,
        directMode: false,
        n_gpu_layers: 0,
        n_ctx: 1280
    });

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const configLoadedRef = useRef(false);
    useEffect(() => {
        Preferences.get({ key: 'ai_persistent_memories' }).then(res => {
            if (res.value) setPersistentMemories(JSON.parse(res.value));
        });
        Preferences.get({ key: 'ai_engine_config' }).then(res => {
            if (res.value) setAiConfig(prev => ({ ...prev, ...JSON.parse(res.value!) }));
            configLoadedRef.current = true;
        });
    }, []);

    useEffect(() => {
        if (!configLoadedRef.current) return;
        Preferences.set({ key: 'ai_engine_config', value: JSON.stringify(aiConfig) });
    }, [aiConfig]);

    const {
        models, loadedModel, isDetecting, handleLoadModel, handleAutoLoad, handleDownload, handleDelete, handleOffload
    } = useAIModels((err: string | null) => console.error("Model Error:", err));

    useEffect(() => {
        if (!isDetecting && !loadedModel && models.some(m => m.status === 'downloaded')) {
            handleAutoLoad(aiConfig);
        }
    }, [isDetecting, loadedModel, models.length]);

    const {
        sessions, setSessions, activeSessionId,
        chatMessages, setChatMessages, activeSessionRef,
        persistSessions, handleNewChat, handleSwitchSession, handleDeleteSession
    } = useAISessions(loadedModel);

    const { parseCommands } = useAICommands(
        todos, notes, persistentMemories,
        addTodo, toggleTodo, deleteTodo,
        addNote, updateNote, deleteNote,
        setPersistentMemories, saveHourlyLog
    );

    useEffect(() => {
        storage.getAISessions().then((loaded: any[]) => {
            if (loaded.length > 0) {
                setSessions(loaded);
                handleNewChat();
            } else {
                handleNewChat();
            }
        });
    }, []);

    const {
        isGenerating, isThinking,
        handleSendMessage, handleStopGeneration
    } = useAIEngine(
        loadedModel, aiConfig, chatMessages, setChatMessages,
        activeSessionId, setSessions, activeSessionRef,
        (input) => getRelevantContext(input, { notes, todos, hourlyLogs, persistentMemories, aiConfig }),
        formatChatPrompt,
        parseCommands,
        persistSessions
    );

    const scrollRef = useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
        }
    };

    useEffect(() => {
        const lastMsg = chatMessages[chatMessages.length - 1];
        if (lastMsg?.sender === 'user') { scrollToBottom('instant'); return; }
        if (isAtBottom) scrollToBottom();
    }, [chatMessages]);

    useEffect(() => {
        if (!isGenerating) scrollToBottom();
    }, [isGenerating]);

    // Settings card shared style
    const settingsCard: React.CSSProperties = {
        padding: '1rem',
        background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.9)',
        borderRadius: '16px',
        border: `1px solid ${dark ? 'rgba(129,140,248,0.1)' : 'rgba(99,102,241,0.1)'}`,
        boxShadow: dark ? '0 2px 16px rgba(0,0,0,0.25)' : '0 4px 20px rgba(99,102,241,0.06)',
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ai-container"
            style={{ position: 'fixed', inset: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                background: dark ? '#070b12' : '#f5f4ff' }}
        >
            {/* Ambient background blobs */}
            <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
                <div style={{
                    position: 'absolute', top: '-80px', right: '-80px', width: '480px', height: '480px', borderRadius: '50%',
                    background: dark ? 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 65%)' : 'radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 65%)',
                    filter: 'blur(72px)'
                }} />
                <div style={{
                    position: 'absolute', bottom: '60px', left: '-80px', width: '380px', height: '380px', borderRadius: '50%',
                    background: dark ? 'radial-gradient(circle, rgba(6,182,212,0.13) 0%, transparent 65%)' : 'radial-gradient(circle, rgba(56,189,248,0.1) 0%, transparent 65%)',
                    filter: 'blur(72px)'
                }} />
            </div>

            {/* Header */}
            <header style={{
                padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(99,102,241,0.1)'}`,
                background: dark ? 'rgba(7,11,18,0.88)' : 'rgba(255,255,255,0.88)',
                backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                zIndex: 50, position: 'relative'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={() => setIsHistoryOpen(true)} style={{
                        background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.08)',
                        border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.12)'}`,
                        padding: '7px', borderRadius: '10px',
                        color: dark ? 'rgba(255,255,255,0.55)' : '#6366f1',
                        cursor: 'pointer', display: 'flex'
                    }}>
                        <Clock size={17} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <h1 style={{
                            margin: 0, fontSize: '1.2rem', fontWeight: 900, letterSpacing: '-0.3px',
                            background: dark ? 'linear-gradient(135deg, #a78bfa 0%, #38bdf8 100%)' : 'linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                        }}>Akitsu</h1>
                        <span style={{
                            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                            background: loadedModel ? '#22c55e' : dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
                            boxShadow: loadedModel ? '0 0 8px rgba(34,197,94,0.75)' : 'none'
                        }} />
                    </div>
                    <button onClick={() => { handleNewChat(); setActiveTab('chat'); }} style={{
                        border: 'none', background: dark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.08)', color: '#22c55e',
                        width: '24px', height: '24px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}>
                        <Plus size={14} />
                    </button>
                </div>

                <div style={{
                    display: 'flex', padding: '3px', borderRadius: '13px',
                    background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.06)',
                    border: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(99,102,241,0.1)'}`
                }}>
                    <TabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={MessageSquare} label="Chat" dark={dark} />
                    <TabButton active={activeTab === 'models'} onClick={() => setActiveTab('models')} icon={Cpu} label="Models" dark={dark} />
                    <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={Settings} label="Engine" dark={dark} />
                </div>
            </header>

            <main style={{ flex: 1, position: 'relative', overflow: 'hidden', zIndex: 1 }}>
                <AnimatePresence mode="wait">

                    {/* ── CHAT TAB ── */}
                    {activeTab === 'chat' && (
                        <motion.div key="chat" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <div
                                ref={scrollRef}
                                onScroll={(e) => {
                                    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                                    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50);
                                }}
                                className="chat-messages dashboard-scrollbar"
                                style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '1rem',
                                    touchAction: 'pan-y', overscrollBehavior: 'contain' }}
                            >
                                {chatMessages.length === 0 ? (
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.1rem' }}>
                                        <div style={{
                                            width: 70, height: 70, borderRadius: '50%',
                                            background: dark ? 'rgba(124,58,237,0.1)' : 'rgba(99,102,241,0.08)',
                                            border: `1.5px solid ${dark ? 'rgba(167,139,250,0.22)' : 'rgba(99,102,241,0.18)'}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: dark ? '0 0 32px rgba(124,58,237,0.22)' : '0 0 24px rgba(99,102,241,0.1)'
                                        }}>
                                            <Bot size={30} color={dark ? '#a78bfa' : '#6366f1'} strokeWidth={1.5} />
                                        </div>
                                        <div style={{ textAlign: 'center', gap: '4px', display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: dark ? 'rgba(255,255,255,0.65)' : '#374151' }}>
                                                Ask Akitsu anything
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: dark ? 'rgba(255,255,255,0.28)' : '#9ca3af' }}>
                                                Notes, tasks, logs — all on-device
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    chatMessages.map((msg) => (
                                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                                            <div style={{
                                                maxWidth: '82%', padding: '11px 16px',
                                                borderRadius: msg.sender === 'user' ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
                                                background: msg.sender === 'user'
                                                    ? 'linear-gradient(135deg, #6366f1, #0ea5e9)'
                                                    : dark ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.96)',
                                                color: msg.sender === 'user' ? 'white' : dark ? 'rgba(255,255,255,0.88)' : '#1e293b',
                                                border: msg.sender === 'user' ? 'none' : `1px solid ${dark ? 'rgba(167,139,250,0.14)' : 'rgba(226,232,240,0.9)'}`,
                                                boxShadow: msg.sender === 'user'
                                                    ? '0 4px 22px rgba(99,102,241,0.38)'
                                                    : dark ? '0 2px 16px rgba(0,0,0,0.32)' : '0 4px 18px rgba(0,0,0,0.06)',
                                                fontSize: '0.92rem', lineHeight: 1.6
                                            }}>
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                                            </div>
                                            <div style={{ fontSize: '0.67rem', color: dark ? 'rgba(255,255,255,0.22)' : '#94a3b8', marginTop: '4px', paddingLeft: '4px', paddingRight: '4px', display: 'flex', gap: '8px' }}>
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {msg.msPerToken && <span style={{ color: dark ? '#38bdf8' : '#0ea5e9', fontWeight: 700 }}>{msg.msPerToken} ms/tok</span>}
                                            </div>
                                        </div>
                                    ))
                                )}
                                {(isGenerating || isThinking) && <TypingIndicator isThinking={isThinking} dark={dark} />}
                            </div>

                            {/* Input bar */}
                            <div style={{
                                padding: '10px 12px',
                                background: dark ? 'rgba(7,11,18,0.75)' : 'rgba(245,244,255,0.92)',
                                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                                borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.1)'}`
                            }}>
                                <div style={{
                                    maxWidth: '800px', margin: '0 auto',
                                    background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.98)',
                                    padding: '5px 5px 5px 18px', borderRadius: '28px',
                                    border: `1px solid ${dark ? 'rgba(129,140,248,0.22)' : 'rgba(99,102,241,0.18)'}`,
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    boxShadow: dark ? '0 0 0 1px rgba(129,140,248,0.07), 0 8px 28px rgba(0,0,0,0.35)' : '0 4px 28px rgba(99,102,241,0.12)'
                                }}>
                                    <input
                                        type="text" value={inputText} onChange={e => setInputText(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSendMessage(inputText, setInputText)}
                                        placeholder={loadedModel ? "Message Akitsu..." : "Load a model to start..."}
                                        style={{
                                            flex: 1, background: 'transparent', border: 'none',
                                            padding: '10px 0',
                                            color: dark ? 'rgba(255,255,255,0.88)' : '#1e293b',
                                            fontSize: '0.92rem', outline: 'none'
                                        }}
                                    />
                                    <AnimatePresence mode="wait">
                                        {isGenerating ? (
                                            <motion.button key="stop" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
                                                onClick={handleStopGeneration}
                                                style={{
                                                    width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
                                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                                    color: 'white', border: 'none', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    boxShadow: '0 4px 16px rgba(239,68,68,0.45)'
                                                }}>
                                                <Square size={14} fill="white" />
                                            </motion.button>
                                        ) : (
                                            <motion.button key="send" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
                                                onClick={() => handleSendMessage(inputText, setInputText)}
                                                disabled={!inputText.trim() || !loadedModel}
                                                style={{
                                                    width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
                                                    border: 'none',
                                                    background: (inputText.trim() && loadedModel)
                                                        ? 'linear-gradient(135deg, #818cf8, #38bdf8)'
                                                        : dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                                                    color: (inputText.trim() && loadedModel) ? 'white' : dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)',
                                                    cursor: (inputText.trim() && loadedModel) ? 'pointer' : 'default',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    boxShadow: (inputText.trim() && loadedModel) ? '0 4px 18px rgba(129,140,248,0.5)' : 'none',
                                                    transition: 'all 0.2s ease'
                                                }}>
                                                <Send size={16} style={{ transform: 'translateX(1px)' }} />
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── MODELS TAB ── */}
                    {activeTab === 'models' && (
                        <motion.div key="models" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            style={{ height: '100%', overflowY: 'auto', padding: '1.5rem' }} className="dashboard-scrollbar">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: '10px',
                                    background: dark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
                                    border: `1px solid ${dark ? 'rgba(129,140,248,0.2)' : 'rgba(99,102,241,0.15)'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Cpu size={18} color={dark ? '#a78bfa' : '#6366f1'} />
                                </div>
                                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: dark ? 'rgba(255,255,255,0.88)' : '#1e293b' }}>AI Models</h2>
                            </div>
                            {isDetecting ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: dark ? 'rgba(255,255,255,0.35)' : '#94a3b8', gap: '0.6rem' }}>
                                    <div className="spinner-small" style={{ borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderTopColor: dark ? '#a78bfa' : '#6366f1' }} />
                                    <span style={{ fontSize: '0.88rem' }}>Verifying local models...</span>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                                    {models.map((m: any) => (
                                        <ModelCard key={m.id} model={m} dark={dark}
                                            onLoad={() => handleLoadModel(m, aiConfig)} onDownload={() => handleDownload(m)}
                                            onDelete={() => handleDelete(m)} onOffload={() => handleOffload()}
                                        />
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ── ENGINE TAB ── */}
                    {activeTab === 'settings' && (
                        <motion.div key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            style={{ height: '100%', overflowY: 'auto', padding: '1.5rem' }} className="dashboard-scrollbar">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: '10px',
                                    background: dark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
                                    border: `1px solid ${dark ? 'rgba(129,140,248,0.2)' : 'rgba(99,102,241,0.15)'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Settings size={18} color={dark ? '#a78bfa' : '#6366f1'} />
                                </div>
                                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: dark ? 'rgba(255,255,255,0.88)' : '#1e293b' }}>Engine Config</h2>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', maxWidth: '600px' }}>

                                {/* Performance Preset */}
                                <div style={{ ...settingsCard, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: dark ? 'rgba(255,255,255,0.8)' : '#1e293b' }}>Performance Preset</div>
                                    <div style={{ fontSize: '0.73rem', color: dark ? 'rgba(255,255,255,0.32)' : '#94a3b8' }}>Reload model after switching for full effect.</div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {[
                                            { label: 'Lite', desc: 'Old device', cfg: { threads: 4, n_gpu_layers: 0, n_predict: 128, temperature: 0.4, top_k: 10, top_p: 0.8, penalty: 1.15, n_ctx: 768 } },
                                            { label: 'Balanced', desc: 'Default', cfg: { threads: 6, n_gpu_layers: 0, n_predict: 256, temperature: 0.5, top_k: 20, top_p: 0.85, penalty: 1.2, n_ctx: 1280 } },
                                            { label: 'Max', desc: 'New device', cfg: { threads: 8, n_gpu_layers: 10, n_predict: 512, temperature: 0.6, top_k: 40, top_p: 0.9, penalty: 1.1, n_ctx: 1280 } },
                                        ].map(({ label, desc, cfg }) => {
                                            const isActive = aiConfig.threads === cfg.threads && aiConfig.n_predict === cfg.n_predict && aiConfig.n_ctx === cfg.n_ctx;
                                            return (
                                                <button key={label} onClick={() => setAiConfig(prev => ({ ...prev, ...cfg }))} style={{
                                                    flex: 1, padding: '10px 4px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                                    fontWeight: 700, fontSize: '0.85rem',
                                                    background: isActive ? 'linear-gradient(135deg, #818cf8, #38bdf8)' : dark ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.07)',
                                                    color: isActive ? 'white' : dark ? 'rgba(255,255,255,0.55)' : '#64748b',
                                                    boxShadow: isActive ? '0 4px 14px rgba(129,140,248,0.35)' : 'none',
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', transition: 'all 0.2s ease'
                                                }}>
                                                    <span>{label}</span>
                                                    <span style={{ fontSize: '0.63rem', opacity: 0.7, fontWeight: 400 }}>{desc}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Direct Mode */}
                                <div style={{ ...settingsCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: dark ? 'rgba(255,255,255,0.8)' : '#1e293b' }}>Direct Mode</div>
                                        <div style={{ fontSize: '0.78rem', color: dark ? 'rgba(255,255,255,0.32)' : '#94a3b8', marginTop: '2px' }}>Bypass personality for maximum raw speed</div>
                                    </div>
                                    <button onClick={() => setAiConfig(prev => ({ ...prev, directMode: !prev.directMode }))} style={{
                                        padding: '6px 14px', borderRadius: '10px', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                                        background: aiConfig.directMode ? 'linear-gradient(135deg, #22c55e, #16a34a)' : dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
                                        color: aiConfig.directMode ? 'white' : dark ? 'rgba(255,255,255,0.4)' : '#94a3b8',
                                        boxShadow: aiConfig.directMode ? '0 4px 12px rgba(34,197,94,0.3)' : 'none'
                                    }}>{aiConfig.directMode ? 'ON' : 'OFF'}</button>
                                </div>

                                {/* Context RAG */}
                                <div style={{ ...settingsCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: dark ? 'rgba(255,255,255,0.8)' : '#1e293b' }}>Enable Context (RAG)</div>
                                        <div style={{ fontSize: '0.78rem', color: dark ? 'rgba(255,255,255,0.32)' : '#94a3b8', marginTop: '2px' }}>Read your notes and tasks</div>
                                    </div>
                                    <button onClick={() => setAiConfig(prev => ({ ...prev, disableContext: !prev.disableContext }))} style={{
                                        padding: '6px 14px', borderRadius: '10px', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                                        background: !aiConfig.disableContext ? 'linear-gradient(135deg, #818cf8, #38bdf8)' : dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
                                        color: !aiConfig.disableContext ? 'white' : dark ? 'rgba(255,255,255,0.4)' : '#94a3b8',
                                        boxShadow: !aiConfig.disableContext ? '0 4px 12px rgba(129,140,248,0.3)' : 'none'
                                    }}>{!aiConfig.disableContext ? 'ON' : 'OFF'}</button>
                                </div>

                                {/* CPU Threads */}
                                <div style={{ ...settingsCard, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: dark ? 'rgba(255,255,255,0.8)' : '#1e293b' }}>CPU Threads</div>
                                        <div style={{ fontWeight: 900, color: dark ? '#38bdf8' : '#0ea5e9', fontSize: '0.95rem' }}>{aiConfig.threads}</div>
                                    </div>
                                    <input type="range" min="1" max="16" value={aiConfig.threads} onChange={e => setAiConfig(prev => ({ ...prev, threads: parseInt(e.target.value) }))} style={{ width: '100%' }} />
                                </div>

                                {/* GPU Layers */}
                                <div style={{ ...settingsCard, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: dark ? 'rgba(255,255,255,0.8)' : '#1e293b' }}>GPU Layers (VRAM)</div>
                                        <div style={{ fontWeight: 900, color: '#22c55e', fontSize: '0.95rem' }}>{aiConfig.n_gpu_layers}</div>
                                    </div>
                                    <input type="range" min="0" max="35" value={aiConfig.n_gpu_layers} onChange={e => setAiConfig(prev => ({ ...prev, n_gpu_layers: parseInt(e.target.value) }))} style={{ width: '100%' }} />
                                    <div style={{ fontSize: '0.7rem', color: dark ? 'rgba(255,255,255,0.28)' : '#94a3b8' }}>Try 4-10 for speed boost. 0 = CPU only. Reload model to apply.</div>
                                </div>

                                {/* Context Window */}
                                <div style={{ ...settingsCard, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: dark ? 'rgba(255,255,255,0.8)' : '#1e293b' }}>Context Window</div>
                                        <div style={{ fontWeight: 900, color: dark ? '#f59e0b' : '#d97706', fontSize: '0.95rem' }}>{aiConfig.n_ctx} tok</div>
                                    </div>
                                    <input type="range" min="512" max="2048" step="128" value={aiConfig.n_ctx} onChange={e => setAiConfig(prev => ({ ...prev, n_ctx: parseInt(e.target.value) }))} style={{ width: '100%' }} />
                                    <div style={{ fontSize: '0.7rem', color: dark ? 'rgba(255,255,255,0.28)' : '#94a3b8' }}>Lower = faster decode. 768 old devices, 1280+ new. Reload to apply.</div>
                                </div>

                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* History drawer */}
            <AnimatePresence>
                {isHistoryOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setIsHistoryOpen(false)}
                            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 100 }} />
                        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                            style={{
                                position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(300px, 85vw)',
                                background: dark ? 'rgba(8,12,20,0.97)' : 'rgba(255,255,255,0.97)',
                                backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                                zIndex: 101, display: 'flex', flexDirection: 'column',
                                borderLeft: `1px solid ${dark ? 'rgba(129,140,248,0.12)' : 'rgba(99,102,241,0.1)'}`
                            }}>
                            <div style={{
                                padding: '1.2rem 1.4rem', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.08)'}`,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: dark ? 'rgba(255,255,255,0.85)' : '#1e293b' }}>History</h2>
                                <button onClick={() => setIsHistoryOpen(false)} style={{
                                    background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                                    border: 'none', borderRadius: '8px', padding: '6px',
                                    color: dark ? 'rgba(255,255,255,0.5)' : '#94a3b8', cursor: 'pointer', display: 'flex'
                                }}>
                                    <X size={18} />
                                </button>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }} className="dashboard-scrollbar">
                                {sessions.map(s => (
                                    <div key={s.id} onClick={() => handleSwitchSession(s.id)} style={{
                                        padding: '10px 12px', borderRadius: '12px', marginBottom: '6px', cursor: 'pointer',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        background: activeSessionId === s.id
                                            ? dark ? 'rgba(129,140,248,0.12)' : 'rgba(99,102,241,0.08)'
                                            : 'transparent',
                                        border: `1px solid ${activeSessionId === s.id ? dark ? 'rgba(129,140,248,0.18)' : 'rgba(99,102,241,0.12)' : 'transparent'}`
                                    }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.87rem', color: dark ? 'rgba(255,255,255,0.75)' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{s.title}</div>
                                        <button onClick={(e) => handleDeleteSession(s.id, e)} style={{
                                            background: 'transparent', border: 'none', color: dark ? 'rgba(239,68,68,0.6)' : '#ef4444',
                                            cursor: 'pointer', padding: '2px', flexShrink: 0
                                        }}>
                                            <X size={15} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

const TabButton = ({ active, onClick, icon: Icon, label, dark }: any) => (
    <button onClick={onClick} style={{
        display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '10px',
        border: 'none',
        background: active ? dark ? 'rgba(129,140,248,0.16)' : 'rgba(99,102,241,0.1)' : 'transparent',
        color: active ? dark ? '#a78bfa' : '#6366f1' : dark ? 'rgba(255,255,255,0.38)' : '#94a3b8',
        cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', transition: 'all 0.18s ease'
    }}>
        <Icon size={15} /> {active && label}
    </button>
);

const ModelCard = ({ model, onLoad, onDownload, onDelete, onOffload, dark }: any) => (
    <div style={{
        background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.95)',
        padding: '1.2rem', borderRadius: '20px',
        border: `1px solid ${dark ? 'rgba(129,140,248,0.12)' : 'rgba(99,102,241,0.12)'}`,
        display: 'flex', flexDirection: 'column', gap: '0.8rem',
        boxShadow: dark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(99,102,241,0.08)'
    }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: dark ? 'rgba(255,255,255,0.88)' : '#1e293b' }}>{model.name}</h3>
            <span style={{
                fontSize: '0.62rem', fontWeight: 800, padding: '3px 8px', borderRadius: '20px',
                background: model.status === 'loaded' ? 'rgba(34,197,94,0.14)' : dark ? 'rgba(129,140,248,0.12)' : 'rgba(99,102,241,0.08)',
                color: model.status === 'loaded' ? '#22c55e' : dark ? '#a78bfa' : '#6366f1'
            }}>{model.status.toUpperCase()}</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.78rem', color: dark ? 'rgba(255,255,255,0.38)' : '#64748b' }}>{model.description} ({model.size})</p>
        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
            {model.status === 'idle' && <button onClick={onDownload} style={{ flex: 1, padding: '8px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #0ea5e9)', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.85rem', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}>Download</button>}
            {model.status === 'downloading' && (
                <div style={{ flex: 1, padding: '8px', borderRadius: '12px', background: dark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.08)', color: dark ? '#a78bfa' : '#6366f1', fontWeight: 700, textAlign: 'center', fontSize: '0.85rem' }}>
                    {(model.progress * 100).toFixed(1)}%
                </div>
            )}
            {model.status === 'downloaded' && <button onClick={onLoad} style={{ flex: 1, padding: '8px', borderRadius: '12px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.85rem', boxShadow: '0 4px 14px rgba(34,197,94,0.3)' }}>Load</button>}
            {model.status === 'loaded' && <button onClick={onOffload} style={{ flex: 1, padding: '8px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 700, fontSize: '0.85rem' }}>Offload</button>}
            <button onClick={onDelete} style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', border: 'none', padding: '8px', borderRadius: '12px', color: dark ? 'rgba(255,255,255,0.45)' : '#94a3b8', cursor: 'pointer' }}>
                <X size={16} />
            </button>
        </div>
    </div>
);

const TypingIndicator = ({ isThinking, dark }: any) => (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{
        padding: '12px 16px',
        background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.95)',
        borderRadius: '20px 20px 20px 5px',
        border: `1px solid ${dark ? 'rgba(167,139,250,0.13)' : 'rgba(99,102,241,0.12)'}`,
        width: 'fit-content',
        boxShadow: dark ? '0 2px 16px rgba(0,0,0,0.3)' : '0 4px 18px rgba(0,0,0,0.06)'
    }}>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
                <motion.div key={i}
                    animate={{ scale: [1, 1.45, 1], opacity: [0.35, 1, 0.35] }}
                    transition={{ repeat: Infinity, duration: 0.85, delay: i * 0.17 }}
                    style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: dark ? 'linear-gradient(135deg, #a78bfa, #38bdf8)' : '#6366f1'
                    }}
                />
            ))}
            {isThinking && <span style={{ fontSize: '0.69rem', color: dark ? 'rgba(255,255,255,0.3)' : '#94a3b8', marginLeft: '5px' }}>thinking...</span>}
        </div>
    </motion.div>
);

export default AIView;
