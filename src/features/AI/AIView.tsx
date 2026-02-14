import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Cpu, MessageSquare, Settings, Download, Trash2, Play, Pause, Square, Bot, AlertCircle, Clock, Plus, X } from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import AIBridge from './AIBridge';
import { useNotes } from '../../hooks/useNotes';
import { useTodos } from '../../hooks/useTodos';
import { Preferences } from '@capacitor/preferences';
import { storage } from '../../lib/storage';
import type { Message, ChatSession } from '../../types';

interface Model {
    id: string;
    name: string;
    description: string;
    size: string;
    status: 'idle' | 'downloading' | 'downloaded' | 'loading' | 'loaded';
    progress?: number;
    url?: string;
    actualPath?: string;
}

// In-memory cache to persist chat during navigation but clear on app restart (Cold Start)
let inMemorySessions: ChatSession[] | null = null;
let inMemoryLastSessionId: string | null = null;
let inMemoryModels: Model[] | null = null;
let inMemoryLoadedModel: string | null = null;

/**
 * Resets the in-memory chat cache. 
 * Call this from App.tsx on mount to ensure fresh starts after app close.
 */
export const resetAIHistory = () => {
    inMemorySessions = null;
    inMemoryLastSessionId = null;
    inMemoryModels = null;
    inMemoryLoadedModel = null;
};

export const AIView: React.FC = () => {
    const { theme } = useThemeContext();
    const { bgDarknessLight, bgDarknessDark, bgBlurLight, bgBlurDark } = useSettings();
    const [activeTab, setActiveTab] = useState<'chat' | 'models' | 'settings'>('chat');

    const [models, setModels] = useState<Model[]>(inMemoryModels || [
        { id: 'gemma-2-2b', name: 'Gemma 2 2B', description: 'Google\'s lightweight champion', size: '1.7 GB', status: 'idle', url: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf' },
        { id: 'llama-3.2-1b', name: 'Llama 3.2 1B', description: 'Meta\'s ultra-fast mobile model', size: '0.7 GB', status: 'idle', url: 'https://huggingface.co/unsloth/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf' },
        { id: 'qwen-2.5-0.5b', name: 'Qwen 2.5 0.5B', description: 'Tiny but incredibly smart', size: '0.4 GB', status: 'idle', url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf' },
        { id: 'tinyllama-1.1b', name: 'TinyLlama 1.1B', description: 'Classic lightweight favorite', size: '0.7 GB', status: 'idle', url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf' },
        { id: 'qwen-2.5-1.5b', name: 'Qwen 2.5 1.5B', description: 'Exceptional 1.5B all-rounder', size: '1.2 GB', status: 'idle', url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf' },
        { id: 'llama-3.2-3b', name: 'Llama 3.2 3B', description: 'Meta\'s powerful 3B model', size: '2.2 GB', status: 'idle', url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf' },
        { id: 'phi-3-mini', name: 'Phi-3 Mini', description: 'Microsoft\'s efficient model', size: '2.2 GB', status: 'idle', url: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf' },
        { id: 'qwen-2.5-3b', name: 'Qwen 2.5 3B', description: 'Powerful 3B reasoning model', size: '1.9 GB', status: 'idle', url: 'https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf' },
        { id: 'danube-3-500m', name: 'Danube 3 500M', description: 'Ultra-efficient mobile model', size: '0.3 GB', status: 'idle', url: 'https://huggingface.co/h2oai/h2o-danube3-500m-chat-GGUF/resolve/main/h2o-danube3-500m-chat-Q4_K_M.gguf' },
        { id: 'smollm2-135m', name: 'SmolLM2 135M', description: 'Tiny but capable assistant', size: '0.1 GB', status: 'idle', url: 'https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q4_K_M.gguf' },
        { id: 'mistral-7b-v0.3', name: 'Mistral 7B v0.3', description: 'Powerful high-end model', size: '4.4 GB', status: 'idle', url: 'https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf' },
    ]);

    const [chatMessages, setChatMessages] = useState<Message[]>([]);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [inputText, setInputText] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [loadedModel, setLoadedModel] = useState<string | null>(inMemoryLoadedModel);
    const [error, setError] = useState<string | null>(null);
    const [aiConfig, setAiConfig] = useState({
        threads: 6, // Increased for faster prefill on 8-core mobile chips
        use_mmap: true,
        responseType: 'standard' as 'brief' | 'standard' | 'detailed',
        customInstructions: '',
        // Advanced Generation Params
        n_predict: 512,
        temperature: 0.7,
        top_k: 40,
        top_p: 0.9,
        penalty: 1.1,
        disableContext: false,
        directMode: false // NEW: Direct AI Mode for max speed
    });
    const isInitialLoad = useRef(true);
    const [persistentMemories, setPersistentMemories] = useState<string[]>([]);

    const { notes, addNote } = useNotes();
    const { todos, addTodo, toggleTodo } = useTodos();
    const getRelevantContext = (userInput: string) => {
        if (aiConfig.directMode) return "";

        try {
            const now = new Date();
            const lowerInput = userInput.toLowerCase();
            const timeStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            let historicalTitle = "";
            let historicalNotes = "";
            let historicalTodos = "";

            // Simple Pattern Detection for Dates
            const dateMatch = lowerInput.match(/(\d{1,2}) (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/) ||
                lowerInput.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec) (\d{1,2})/);

            let targetDateStart: number | null = null;
            let targetDateEnd: number | null = null;

            if (lowerInput.includes('yesterday')) {
                const d = new Date(); d.setDate(d.getDate() - 1);
                targetDateStart = new Date(d.setHours(0, 0, 0, 0)).getTime();
                targetDateEnd = new Date(d.setHours(23, 59, 59, 999)).getTime();
                historicalTitle = "YESTERDAY'S RECORDS";
            } else if (dateMatch) {
                const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                const monthStr = dateMatch[1].length > 2 ? dateMatch[1] : dateMatch[2];
                const day = parseInt(dateMatch[1].length <= 2 ? dateMatch[1] : dateMatch[2]);
                const monthIdx = months.findIndex(m => monthStr.startsWith(m));

                if (monthIdx !== -1) {
                    const d = new Date();
                    d.setMonth(monthIdx);
                    d.setDate(day);
                    targetDateStart = new Date(d.setHours(0, 0, 0, 0)).getTime();
                    targetDateEnd = new Date(d.setHours(23, 59, 59, 999)).getTime();
                    historicalTitle = `RECORDS FOR ${monthStr.toUpperCase()} ${day}`;
                }
            }

            // Deep Scan for Historical Data
            if (targetDateStart && targetDateEnd) {
                const hNotes = notes.filter(n => !n.deleted && n.createdAt >= targetDateStart! && n.createdAt <= targetDateEnd!);
                const hTodos = todos.filter(t => !t.deleted && t.createdAt >= targetDateStart! && t.createdAt <= targetDateEnd!);

                if (hNotes.length > 0) {
                    historicalNotes = hNotes.slice(0, 10).map(n => {
                        // Strip HTML and Base64 images
                        const clean = n.content
                            .replace(/<[^>]*>/g, '') // Strip HTML
                            .replace(/data:image\/[^;]+;base64,[^\s"']+/g, '[IMAGE]') // Strip Base64
                            .substring(0, 300)
                            .replace(/\n/g, ' ');
                        return `> ${n.title}: ${clean}`;
                    }).join('\n');
                }
                if (hTodos.length > 0) historicalTodos = hTodos.slice(0, 10).map(t => `- ${t.text} (${t.completed ? 'Done' : 'todo'})`).join('\n');
            }

            const isDeepScan = lowerInput.includes('history') || lowerInput.includes('all notes') || lowerInput.includes('everything') || lowerInput.includes('search');

            // SPEED OPTIMIZATION: Default to 5 Notes (not 10) for instant startup
            const recentNoteResults = notes
                .filter(n => !n.deleted)
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, isDeepScan ? 20 : 5);

            // TASK CONTEXT OPTIMIZATION: Prioritize Pending Tasks so AI doesn't think they're done.
            const pendingTodos = todos.filter(t => !t.deleted && !t.completed);
            const recentDoneTodos = todos
                .filter(t => !t.deleted && t.completed && (isDeepScan || t.createdAt > (now.getTime() - 2 * 24 * 60 * 60 * 1000)))
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, isDeepScan ? 20 : 5); // Only show a few recent "Done" items

            const recentTodoResults = [...pendingTodos.slice(0, isDeepScan ? 30 : 15), ...recentDoneTodos];

            const recentNotesStr = recentNoteResults
                .map(n => {
                    const clean = n.content
                        .replace(/<[^>]*>/g, '') // Strip HTML
                        .replace(/data:image\/[^;]+;base64,[^\s"']+/g, '[IMAGE]') // Strip Base64
                        .substring(0, 60)
                        .trim();
                    return `${n.title}: ${clean}`;
                })
                .join('\n');

            const recentTodosStr = recentTodoResults
                .map(t => `- ${t.text} (${t.completed ? 'Done' : 'Todo'})`)
                .join('\n');

            let contextStr = "";
            if (persistentMemories.length > 0) {
                contextStr += `USER MEMORIES:\n${persistentMemories.map(m => `- ${m}`).join('\n')}\n\n`;
            }

            if (recentNotesStr) contextStr += `LATEST 10 NOTES:\n${recentNotesStr}\n\n`;

            if (historicalTitle) {
                contextStr += `--- ${historicalTitle} ---\n`;
                if (historicalNotes) contextStr += `${historicalNotes}\n`;
                if (historicalTodos) contextStr += `${historicalTodos}\n`;
                contextStr += `\n`;
            }

            if (recentTodosStr) contextStr += `RECENT TASKS (3 Days):\n${recentTodosStr}\n\n`;

            // Date is dynamic (changes daily), keep it at the end of grounding to avoid invalidating the notes prefix!
            contextStr += `[SESSION_INFO]\nDate: ${timeStr}\n[/SESSION_INFO]`;

            return contextStr;
        } catch (e) {
            console.error("Context retrieval failed:", e);
            return '';
        }
    };

    // Auto-dismiss error after 5 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const tokenCountRef = useRef(0);
    const generationStartTimeRef = useRef(0);
    const tokenBufferRef = useRef<string>("");
    const lastUpdateRef = useRef<number>(0);

    const getDownloadErrorReason = (reason?: number) => {
        if (!reason) return "Unknown error";
        switch (reason) {
            case 1001: return "File already exists";
            case 1002: return "Unsupported URI";
            case 1004: return "Not enough storage space";
            case 1005: return "External storage not mounted";
            case 1006: return "System error";
            case 1007: return "Too many redirects";
            case 1008: return "Unhandled HTTP code";
            case 1009: return "Request timed out";
            default: return `Error code ${reason}`;
        }
    };

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const currentBgDarkness = theme === 'dark' ? bgDarknessDark : bgDarknessLight;
    const currentBlur = theme === 'dark' ? bgBlurDark : bgBlurLight;

    useEffect(() => {
        const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior });
            }
        };

        scrollToBottom('auto');

        // Listen for window resize (keyboard opening/closing)
        const handleResize = () => scrollToBottom('auto');
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [chatMessages]);

    const handleLoadModel = async (model: Model) => {
        try {
            setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'loading' } : m));

            // 1. Try actualPath first (the verified path from DownloadManager)
            // 2. Fall back to guessing via filename
            const filename = `${model.id}.gguf`;
            let finalizedPath = model.actualPath;

            if (!finalizedPath) {
                const pathInfo = await AIBridge.getModelPath({ filename });
                if (pathInfo.exists && pathInfo.size > 100 * 1024 * 1024) {
                    finalizedPath = pathInfo.path;
                } else if (pathInfo.exists) {
                    // Delete partial download
                    await AIBridge.deleteModel({ filename });
                }
            }

            if (!finalizedPath) {
                throw new Error("Model file not found. Please download it again.");
            }

            // POCKETPAL OPTIMIZATION: Check if this model is ALREADY loaded in native memory
            if (model.name === inMemoryLoadedModel) {
                console.log("Model already loaded in native memory, skipping initialization.");
                setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'loaded' } : m));
                setLoadedModel(model.name);
                setActiveTab('chat');
                return;
            }

            await AIBridge.loadModel({
                path: finalizedPath,
                use_mmap: aiConfig.use_mmap,
                threads: aiConfig.threads
            });

            setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'loaded', actualPath: finalizedPath } : m.status === 'loaded' ? { ...m, status: 'downloaded' } : m));

            // RESTORED: These lines were accidentally deleted, causing UI to stay "Offline"
            setLoadedModel(model.name);
            setActiveTab('chat');
            // STARTUP SPEED OPTIMIZATION
            // We only warm up the STATIC system instructions. 
            // We do NOT pre-digest notes here because it slows down the model loading experience.
            // Notes will be digested automatically on the first user message.
            if (!aiConfig.directMode) {
                setTimeout(async () => {
                    try {
                        console.log("Warming up static engine instructions...");
                        // Pass empty context to only warm up the "Identity" part of the prompt
                        const systemPromptOnly = formatChatPrompt(model.id, [], "", "", true);
                        await AIBridge.generate({
                            prompt: systemPromptOnly,
                            n_predict: 0,
                            temperature: 0.1
                        });
                        console.log("Static prompt cached. Model is ready for interaction.");
                    } catch (e) {
                        console.warn("Warmup error:", e);
                    }
                }, 100);
            }
        } catch (err) {
            console.error("Failed to load model:", err);
            setError("Failed to load model: " + err);
            setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'downloaded' } : m));
        }
    };

    useEffect(() => {
        // Initialize Chat Sessions
        const loadChatSessions = async () => {
            try {
                // Load Engine Config & Memories
                const { value: memValue } = await Preferences.get({ key: 'ai_persistent_memories' });
                if (memValue) setPersistentMemories(JSON.parse(memValue));

                const { value: configValue } = await Preferences.get({ key: 'ai_engine_config' });
                if (configValue) {
                    const parsedConfig = JSON.parse(configValue);
                    setAiConfig(prev => ({ ...prev, ...parsedConfig }));
                }

                // Restore from In-Memory Cache (High-Speed Navigation) or Database (Cold Start)
                if (inMemorySessions && inMemorySessions.length > 0) {
                    setSessions(inMemorySessions);
                    const lastId = inMemoryLastSessionId || inMemorySessions[0].id;
                    setActiveSessionId(lastId);
                    setChatMessages(inMemorySessions.find((s: any) => s.id === lastId)?.messages || []);
                } else {
                    const dbSessions = await storage.getAISessions();
                    if (dbSessions && dbSessions.length > 0) {
                        const sorted = dbSessions.sort((a: any, b: any) => (b.lastModified || 0) - (a.lastModified || 0));
                        setSessions(sorted);
                        inMemorySessions = sorted;
                        const lastId = inMemoryLastSessionId || sorted[0].id;
                        setActiveSessionId(lastId);
                        setChatMessages(sorted.find((s: any) => s.id === lastId)?.messages || []);
                    } else {
                        // Fresh start
                        const newId = Date.now().toString();
                        const newSession: ChatSession = {
                            id: newId,
                            title: 'New Conversation',
                            messages: [],
                            lastModified: Date.now()
                        };
                        setSessions([newSession]);
                        setActiveSessionId(newId);
                        await storage.saveAISession(newSession);
                        inMemorySessions = [newSession];
                    }
                }

                isInitialLoad.current = false;
            } catch (e) {
                console.error("Failed to load sessions:", e);
                isInitialLoad.current = false;
            }
        };
        loadChatSessions();

        // Autoload check: ONLY trigger if no model is currently active in memory
        if (!inMemoryLoadedModel) {
            AIBridge.getLastModelPath().then(res => {
                if (res.path) {
                    const modelId = res.path.split('/').pop()?.replace('.gguf', '') || '';
                    const modelToLoad = models.find(m => m.id === modelId || m.name === modelId);
                    if (modelToLoad) {
                        console.log("Auto-loading last used model from disk:", modelToLoad.name);
                        handleLoadModel(modelToLoad);
                    }
                }
            });
        }

        // Setup listener with throttling to prevent React render-flood (Major speed boost)
        const listener = AIBridge.addListener('token', (data) => {
            tokenBufferRef.current += data.token;
            tokenCountRef.current++;

            if (tokenCountRef.current === 1) {
                generationStartTimeRef.current = Date.now();
            }

            const now = Date.now();
            // Batch updates every 80ms for snappy UI performance
            if (now - lastUpdateRef.current > 80) {
                const elapsed = now - generationStartTimeRef.current;
                const msPerToken = tokenCountRef.current > 0 ? (elapsed / tokenCountRef.current).toFixed(1) : 0;
                const bufferedText = tokenBufferRef.current;
                tokenBufferRef.current = ""; // Flush buffer
                lastUpdateRef.current = now;

                setChatMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last && last.sender === 'bot') {
                        return [...prev.slice(0, -1), {
                            ...last,
                            text: last.text + bufferedText,
                            msPerToken: Number(msPerToken)
                        }];
                    }
                    return [...prev, {
                        id: Date.now().toString(),
                        text: bufferedText,
                        sender: 'bot',
                        timestamp: Date.now(),
                        msPerToken: Number(msPerToken)
                    }];
                });
            }
        });

        return () => {
            listener.then(h => h.remove());
        };
    }, []);

    // Save Sessions to Persistent Storage
    const persistSessions = async (specificSessions?: ChatSession[]) => {
        const currentToPersist = specificSessions || sessions;
        inMemorySessions = currentToPersist;

        // Save ACTIVE session to DB
        if (activeSessionId) {
            const active = currentToPersist.find(s => s.id === activeSessionId);
            if (active) {
                await storage.saveAISession(active);
            }
        }
    };

    // Save Engine Config whenever it changes
    useEffect(() => {
        if (isInitialLoad.current) return;
        Preferences.set({
            key: 'ai_engine_config',
            value: JSON.stringify(aiConfig)
        });
    }, [aiConfig]);

    // Sync last active ID and loaded model to cache
    useEffect(() => {
        if (activeSessionId) {
            inMemoryLastSessionId = activeSessionId;
        }
    }, [activeSessionId]);

    useEffect(() => {
        inMemoryLoadedModel = loadedModel;
    }, [loadedModel]);

    useEffect(() => {
        inMemoryModels = models;
    }, [models]);

    const handleNewChat = async () => {
        const newId = Date.now().toString();
        const newSession: ChatSession = {
            id: newId,
            title: 'New Conversation',
            messages: [],
            lastModified: Date.now(),
            modelName: loadedModel || undefined
        };
        const updated = [newSession, ...sessions];
        setSessions(updated);
        setActiveSessionId(newId);
        setChatMessages([]);
        setActiveTab('chat');
        await storage.saveAISession(newSession);
        inMemorySessions = updated;
    };

    const handleSwitchSession = (sessionId: string) => {
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
            setActiveSessionId(session.id);
            setChatMessages(session.messages);
            setIsHistoryOpen(false);
            setActiveTab('chat');
        }
    };
    const handleDeleteMemory = async (index: number) => {
        const updated = persistentMemories.filter((_, i) => i !== index);
        setPersistentMemories(updated);
        await Preferences.set({ key: 'ai_persistent_memories', value: JSON.stringify(updated) });
    };

    const handleClearMemories = async () => {
        setPersistentMemories([]);
        await Preferences.remove({ key: 'ai_persistent_memories' });
    };


    const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = sessions.filter(s => s.id !== sessionId);
        setSessions(updated);
        await storage.deleteAISession(sessionId);
        if (activeSessionId === sessionId) {
            if (updated.length > 0) {
                setActiveSessionId(updated[0].id);
                setChatMessages(updated[0].messages);
            } else {
                handleNewChat();
            }
        }
        inMemorySessions = updated;
    };

    const formatChatPrompt = (modelId: string, history: Message[], userMsg: string, context?: string, onlySystem: boolean = false) => {
        // DIRECT MODE OPTIMIZATION: Zero system prompt for max speed and unfiltered output
        if (aiConfig.directMode) {
            if (onlySystem) return ""; // No system prompt to prefill

            if (modelId.includes('gemma')) {
                let p = "";
                history.forEach(m => p += `<start_of_turn>${m.sender === 'user' ? 'user' : 'model'}\n${m.text}<end_of_turn>\n`);
                return p + `<start_of_turn>user\n${userMsg}<end_of_turn>\n<start_of_turn>model\n`;
            }
            if (modelId.includes('llama-3')) {
                let p = "";
                history.forEach(m => p += `<|start_header_id|>${m.sender === 'user' ? 'user' : 'assistant'}<|end_header_id|>\n\n${m.text}<|eot_id|>\n`);
                return p + `<|start_header_id|>user<|end_header_id|>\n\n${userMsg}<|eot_id|>\n<|start_header_id|>assistant<|end_header_id|>\n\n`;
            }
            // Fallback for Qwen/ChatML
            let p = "";
            history.forEach(m => p += `<|im_start|>${m.sender === 'user' ? 'user' : 'assistant'}\n${m.text}<|im_end|>\n`);
            return p + `<|im_start|>user\n${userMsg}<|im_end|>\n<|im_start|>assistant\n`;
        }

        const responseInstruction = aiConfig.responseType === 'brief'
            ? "Reply briefly."
            : aiConfig.responseType === 'detailed'
                ? "Reply in detail using Markdown."
                : "Reply balanced.";

        const memoryInstruction = " Remember: [SAVEMEM: info].";
        const appControlInstruction = ' Cmds: [CREATE_TASK: "T"], [COMPLETE_TASK: "T"], [CREATE_NOTE: title="T", content="C"].';

        const now = new Date();
        const timeStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        // STATIC PREFIX (Identity) - Always Cached
        const staticPrefix = `Helpful assistant.${responseInstruction}${memoryInstruction}${appControlInstruction}`;

        // SEMI-STATIC GROUNDING (Date + Facts) - Cached across the whole chat session
        const groundingBlock = `[CONTEXT GROUNDING]\nDate: ${timeStr}\n${context || "No current notes."}\n[/CONTEXT_GROUNDING]`;

        const systemPrompt = aiConfig.customInstructions
            ? `${aiConfig.customInstructions}\n\n${staticPrefix}\n\n${groundingBlock}`
            : `${staticPrefix}\n\n${groundingBlock}`;

        // Chat History - Evaluated incrementally (Speed!)
        const recentHistory = history.slice(-30);

        // Check specific formats first
        if (modelId.includes('gemma')) {
            const sysBlock = `< start_of_turn > user\nSystem: ${systemPrompt} <end_of_turn>\n`;
            if (onlySystem) return sysBlock;

            let prompt = sysBlock;
            recentHistory.forEach(msg => {
                const role = msg.sender === 'user' ? 'user' : 'model';
                prompt += `<start_of_turn>${role}\n${msg.text}<end_of_turn>\n`;
            });
            return prompt + `<start_of_turn>user\n${userMsg}<end_of_turn>\n<start_of_turn>model\n`;
        }

        // Llama 3 Family
        else if (modelId.includes('llama-3')) {
            const sysBlock = `<|start_header_id|>system<|end_header_id|>\n\n${systemPrompt}<|eot_id|>\n`;
            if (onlySystem) return sysBlock;

            let prompt = sysBlock;
            recentHistory.forEach(msg => {
                const role = msg.sender === 'user' ? 'user' : 'assistant';
                prompt += `<|start_header_id|>${role}<|end_header_id|>\n\n${msg.text}<|eot_id|>\n`;
            });
            return prompt + `<|start_header_id|>user<|end_header_id|>\n\n${userMsg}<|eot_id|>\n<|start_header_id|>assistant<|end_header_id|>\n\n`;
        }

        // ChatML Support (Qwen, SmolLM, etc.)
        else if (modelId.includes('qwen') || modelId.includes('smollm') || modelId.includes('danube')) {
            const sysBlock = `<|im_start|>system\n${systemPrompt}<|im_end|>\n`;
            if (onlySystem) return sysBlock;

            let prompt = sysBlock;
            recentHistory.forEach(msg => {
                const role = msg.sender === 'user' ? 'user' : 'assistant';
                prompt += `<|im_start|>${role}\n${msg.text}<|im_end|>\n`;
            });
            return prompt + `<|im_start|>user\n${userMsg}<|im_end|>\n<|im_start|>assistant\n`;
        }

        // Generic Fallback
        else {
            const sysBlock = `System: ${systemPrompt}\n`;
            if (onlySystem) return sysBlock;

            let prompt = sysBlock;
            recentHistory.forEach(msg => {
                prompt += `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}\n`;
            });
            return prompt + `User: ${userMsg}\nAssistant: `;
        }
    };

    const handleSendMessage = async () => {
        if (!inputText.trim() || isGenerating) return;

        if (!loadedModel) {
            setError("Please load a model first");
            setTimeout(() => setError(null), 3000);
            return;
        }

        const userMsg: Message = {
            id: Date.now().toString(),
            text: inputText,
            sender: 'user',
            timestamp: Date.now()
        };

        if (chatMessages.length === 0) {
            // Update title based on first message
            const title = inputText.length > 30 ? inputText.substring(0, 27) + '...' : inputText;
            setSessions(prev => prev.map(s =>
                s.id === activeSessionId ? { ...s, title } : s
            ));
        }

        setChatMessages(prev => [...prev, userMsg]);
        setInputText('');
        setIsGenerating(true);
        tokenCountRef.current = 0; // Reset for new message
        generationStartTimeRef.current = Date.now(); // Initial start

        // Local variable to ensure we use the correct session ID in this turn (handles new session creation)
        let turnSessionId = activeSessionId;

        // Ensure we HAVE a session if sending a message
        if (!turnSessionId) {
            turnSessionId = Date.now().toString();
            const newSession: ChatSession = {
                id: turnSessionId,
                title: inputText.length > 30 ? inputText.substring(0, 27) + '...' : inputText,
                messages: [userMsg],
                lastModified: Date.now(),
                modelName: loadedModel || undefined
            };
            setSessions(prev => [newSession, ...prev]);
            setActiveSessionId(turnSessionId);
        }

        try {
            const modelObj = models.find(m => m.name === loadedModel);
            const modelId = modelObj ? modelObj.id : 'unknown';

            const contextGrounding = aiConfig.disableContext ? "" : getRelevantContext(userMsg.text);
            const prompt = formatChatPrompt(modelId, chatMessages, userMsg.text, contextGrounding);

            await AIBridge.generate({
                prompt: prompt,
                n_predict: aiConfig.n_predict,
                temperature: aiConfig.temperature,
                top_k: aiConfig.top_k,
                top_p: aiConfig.top_p,
                penalty: aiConfig.penalty
            });

            // 1. Flush any remaining tokens in the buffer
            let finalBotText = "";
            if (tokenBufferRef.current) {
                const remaining = tokenBufferRef.current;
                tokenBufferRef.current = "";
                setChatMessages(prev => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.sender === 'bot') {
                        last.text += remaining;
                        finalBotText = last.text;
                    }
                    return updated;
                });
            } else {
                // If no buffer, get current text from state
                setChatMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last && last.sender === 'bot') finalBotText = last.text;
                    return prev;
                });
            }

            // Small delay to ensure state update for finalBotText is captured if needed, 
            // though the functional setter above is synchronous in the closure.

            // 2. Process App Control Commands (Tasks/Notes/Memories)
            if (finalBotText) {
                let cleanedText = finalBotText;

                // [SAVEMEM]
                const memMatch = cleanedText.match(/\[SAVEMEM:\s*(.*?)\]/);
                if (memMatch && memMatch[1]) {
                    const fact = memMatch[1].trim();
                    console.log("AI Command: Saving memory ->", fact);
                    setPersistentMemories(m => {
                        if (m.includes(fact)) return m;
                        const updated = [...m, fact];
                        Preferences.set({ key: 'ai_persistent_memories', value: JSON.stringify(updated) });
                        return updated;
                    });
                    cleanedText = cleanedText.replace(/\[SAVEMEM:.*?\]/g, '').trim();
                }

                // [CREATE_TASK]
                const taskRegex = /\[CREATE_TASK:\s*["'](.*?)["']\]/gi;
                let tm;
                while ((tm = taskRegex.exec(finalBotText)) !== null) {
                    if (tm[1]) {
                        console.log("AI Command (Storage): Creating task ->", tm[1]);
                        const dateStr = new Date().toISOString().split('T')[0];
                        await addTodo(tm[1], dateStr);
                        cleanedText = cleanedText.replace(tm[0], '').trim();
                    }
                }

                // [COMPLETE_TASK]
                const completeRegex = /\[COMPLETE_TASK:\s*["'](.*?)["']\]/gi;
                while ((tm = completeRegex.exec(finalBotText)) !== null) {
                    if (tm[1]) {
                        const target = tm[1].toLowerCase();
                        console.log("AI Command (Storage): Completing task ->", target);
                        const todo = todos.find(t => t.text.toLowerCase().includes(target) && !t.completed);
                        if (todo) await toggleTodo(todo);
                        cleanedText = cleanedText.replace(tm[0], '').trim();
                    }
                }

                // [CREATE_NOTE]
                const noteRegex = /\[CREATE_NOTE:\s*title=["'](.*?)["'],\s*content=["'](.*?)["']\]/gis;
                while ((tm = noteRegex.exec(finalBotText)) !== null) {
                    if (tm[1] && tm[2]) {
                        console.log("AI Command (Storage): Creating note ->", tm[1]);
                        await addNote(tm[1], tm[2]);
                        cleanedText = cleanedText.replace(tm[0], '').trim();
                    }
                }

                // Final cleanup: Update chat message to remove the technical tags
                if (cleanedText !== finalBotText) {
                    setChatMessages(prev => {
                        const updated = [...prev];
                        if (updated.length > 0) {
                            const last = updated[updated.length - 1];
                            if (last.sender === 'bot') last.text = cleanedText;
                        }
                        // Trigger session sync with DEFINITIVE messages
                        setSessions(currS => {
                            const updatedSessions = currS.map(s =>
                                s.id === turnSessionId ? { ...s, messages: updated, lastModified: Date.now() } : s
                            );
                            persistSessions(updatedSessions);
                            return updatedSessions;
                        });
                        return updated;
                    });
                } else {
                    // Even if no cleanup, sync sessions to save the bot's raw text
                    setChatMessages(prev => {
                        setSessions(currS => {
                            const updatedSessions = currS.map(s =>
                                s.id === turnSessionId ? { ...s, messages: prev, lastModified: Date.now() } : s
                            );
                            persistSessions(updatedSessions);
                            return updatedSessions;
                        });
                        return prev;
                    });
                }
            }
        } catch (err) {
            setError("Generation failed: " + err);
        } finally {
            setIsGenerating(false);
            if (inputRef.current) inputRef.current.focus();
        }
    };

    // Initial check for existing models
    useEffect(() => {
        const checkExisting = async () => {
            models.forEach(async (model) => {
                if (model.status === 'idle') {
                    try {
                        const filename = `${model.id}.gguf`;
                        const res = await AIBridge.getModelPath({ filename });
                        if (res.exists && res.size > 0) {
                            setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'downloaded' } : m));
                        }
                    } catch (e) { }
                }
            });
        };
        checkExisting();
    }, []);

    // Poll for active download progress
    useEffect(() => {
        const interval = setInterval(() => {
            models.forEach(async (model) => {
                // Only poll provided we have a downloadId and are in downloading state
                if (model.status === 'downloading' && model.downloadId) {
                    try {
                        const progressRes = await AIBridge.getDownloadProgress({ downloadId: model.downloadId });
                        // Status 8 is STATUS_SUCCESSFUL
                        if (progressRes.status === 8) {
                            // Convert content:// or file:// URI to a standard path if needed, 
                            // but DownloadManager's COLUMN_LOCAL_URI is usually what loadModel needs.
                            const cleanPath = progressRes.path?.replace('file://', '');
                            setModels(prev => prev.map(m => m.id === model.id ? {
                                ...m,
                                status: 'downloaded',
                                progress: 1,
                                actualPath: cleanPath
                            } : m));
                        } else if (progressRes.status === 16) { // STATUS_FAILED
                            const errorMsg = getDownloadErrorReason(progressRes.reason);
                            setError(`Download failed for ${model.name}: ${errorMsg}`);
                            setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'idle', progress: 0 } : m));
                        } else {
                            setModels(prev => prev.map(m => m.id === model.id ? { ...m, progress: progressRes.progress } : m));
                        }
                    } catch (e) {
                        // If download not found in manager, check file size one last time
                        const filename = `${model.id}.gguf`;
                        try {
                            const res = await AIBridge.getModelPath({ filename });
                            if (res.exists && res.size > 0) {
                                setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'downloaded' } : m));
                            } else {
                                setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'idle' } : m));
                            }
                        } catch (err) { }
                    }
                }
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [models]);


    const handleDownload = async (model: Model) => {
        console.log("handleDownload called for:", model.id);
        if (!model.url) {
            console.error("No URL for model:", model.id);
            setError("No URL for this model");
            return;
        }
        try {
            console.log("Setting status to downloading...");
            setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'downloading', progress: 0 } : m));

            console.log("Calling AIBridge.downloadModel with:", model.url);
            const res = await AIBridge.downloadModel({ url: model.url, filename: `${model.id}.gguf` });
            console.log("AIBridge.downloadModel returned:", res);

            setModels(prev => prev.map(m => m.id === model.id ? { ...m, downloadId: res.downloadId } : m));
            // alert(`Download started! ID: ${res.downloadId}`);
        } catch (err: any) {
            console.error("Download error:", err);
            setError(`Download failed: ${err.message || err}`);
            setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'idle' } : m));
        }
    };

    const handleDelete = async (model: Model) => {
        try {
            console.log("Deleting model:", model.id, "DownloadID:", model.downloadId);
            await AIBridge.deleteModel({
                filename: `${model.id}.gguf`,
                downloadId: model.downloadId
            });
            setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'idle', progress: 0, downloadId: undefined } : m));
            if (loadedModel === model.name) {
                setLoadedModel(null);
            }
        } catch (err: any) {
            setError(`Delete failed: ${err.message || err}`);
        }
    };

    const handleOffload = async (model: Model) => {
        try {
            // This unloads the model from native memory without deleting the file
            await AIBridge.unloadModel();

            setModels(prev => prev.map(m =>
                m.id === model.id ? { ...m, status: 'downloaded' } : m
            ));

            if (loadedModel === model.name) {
                setLoadedModel(null);
            }
        } catch (err: any) {
            setError(`Offload failed: ${err.message || err}`);
        }
    };

    const handleImportModel = async () => {
        try {
            const res = await (AIBridge as any).pickModel();
            if (res && res.path) {
                const newModel: Model = {
                    id: res.name.toLowerCase().replace(/\s+/g, '-'),
                    name: res.name,
                    description: "Imported local model",
                    size: "Local",
                    status: 'downloaded', // It's already there
                    actualPath: res.path
                };
                setModels(prev => {
                    if (prev.find(m => m.id === newModel.id)) return prev;
                    return [...prev, newModel];
                });
                setActiveTab('models');
            }
        } catch (err: any) {
            setError("Import failed: " + err.message || err);
        }
    };


    return (
        <motion.div
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100vw',
                position: 'fixed',
                top: 0,
                bottom: 0,
                left: 0,
                color: 'var(--text-primary)',
                background: 'var(--bg-primary)',
                overflow: 'hidden'
            }}
        >
            <div style={{
                padding: isMobile ? '3.5rem 1rem 1rem 1rem' : '1.5rem 2rem',
                flexShrink: 0,
                zIndex: 10,
                background: theme === 'dark' ? `rgba(15, 23, 42, ${currentBgDarkness})` : `rgba(255, 255, 255, ${currentBgDarkness})`,
                borderBottom: '1px solid var(--border-subtle)',
                backdropFilter: `blur(${currentBlur}px)`
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                        <Brain className="text-accent" size={isMobile ? 22 : 32} />
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <h1 style={{ fontSize: isMobile ? '1.4rem' : '2.2rem', fontWeight: 800, margin: 0, whiteSpace: 'nowrap' }}>Tru Assist</h1>
                                <button
                                    onClick={handleNewChat}
                                    style={{
                                        background: 'rgba(34, 197, 94, 0.1)',
                                        border: '1px solid rgba(34, 197, 94, 0.2)',
                                        borderRadius: '50%',
                                        width: '28px',
                                        height: '28px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        color: '#22c55e'
                                    }}
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div style={{
                        display: 'flex',
                        background: 'rgba(0,0,0,0.08)',
                        padding: '3px',
                        borderRadius: '14px',
                        border: '1px solid var(--border-subtle)',
                        flexShrink: 0
                    }}>
                        <TabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={MessageSquare} label={isMobile ? "" : "Chat"} />
                        <TabButton active={activeTab === 'models'} onClick={() => setActiveTab('models')} icon={Cpu} label={isMobile ? "" : "Models"} />
                        <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={Settings} label={isMobile ? "" : "Config"} />
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <motion.div
                style={{ flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
            >
                <AnimatePresence mode="wait">
                    {activeTab === 'chat' && (
                        <motion.div
                            key="chat"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
                        >
                            {/* Messages Container */}
                            <div
                                ref={scrollRef}
                                style={{
                                    flex: 1,
                                    overflowY: 'auto',
                                    padding: '1.5rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflowAnchor: 'auto',
                                    WebkitOverflowScrolling: 'touch',
                                    backgroundImage: theme === 'light'
                                        ? 'radial-gradient(circle, rgba(0,0,0,0.03) 1px, transparent 1px)'
                                        : 'none',
                                    backgroundSize: '24px 24px'
                                }}
                                className="dashboard-scrollbar"
                            >
                                {chatMessages.length === 0 && (
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center' }}>
                                        <div style={{ maxWidth: '280px' }}>
                                            <div className="pulse-slow" style={{
                                                background: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)',
                                                width: '100px', height: '100px', borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                margin: '0 auto 1.5rem', boxShadow: '0 10px 30px rgba(220, 39, 67, 0.4)'
                                            }}>
                                                <Bot size={50} color="white" />
                                            </div>
                                            <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                                                {models.some(m => m.status === 'loading') ? 'Initializing Brain...' : (loadedModel ? `Chatting with ${loadedModel}` : 'AI Assist Offline')}
                                            </h3>
                                            <p style={{ opacity: 0.7 }}>
                                                {models.some(m => m.status === 'loading')
                                                    ? `Loading ${models.find(m => m.status === 'loading')?.name}... Please wait.`
                                                    : (loadedModel ? 'Experience AI with a premium, sleek interface. Generating the first response may take a moment.' : 'Select a model in the "Models" tab to begin.')}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Spacer to push messages to the bottom */}
                                <div style={{ flex: 1 }} />

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {chatMessages.map((msg, index) => {
                                        const nextMsg = chatMessages[index + 1];
                                        const isLastInGroup = !nextMsg || nextMsg.sender !== msg.sender;

                                        return (
                                            <motion.div
                                                key={msg.id}
                                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                                                    marginBottom: isLastInGroup ? '12px' : '2px',
                                                    maxWidth: '85%',
                                                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                                                }}
                                            >
                                                <div style={{
                                                    background: msg.sender === 'user'
                                                        ? 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)'
                                                        : (theme === 'dark' ? '#262626' : '#EFEFEF'),
                                                    color: msg.sender === 'user' ? 'white' : 'var(--text-primary)',
                                                    padding: '10px 16px',
                                                    borderRadius: msg.sender === 'user'
                                                        ? '22px 22px 4px 22px'
                                                        : '22px 22px 22px 4px',
                                                    fontSize: '0.95rem',
                                                    lineHeight: 1.5,
                                                    whiteSpace: 'pre-wrap',
                                                    overflowWrap: 'anywhere',
                                                    wordBreak: 'break-word',
                                                    boxShadow: msg.sender === 'user' ? '0 4px 15px rgba(220, 39, 67, 0.2)' : 'none'
                                                }}>
                                                    {msg.text}
                                                </div>
                                                {isLastInGroup && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', padding: '0 8px' }}>
                                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        {msg.sender === 'bot' && msg.msPerToken && (
                                                            <span style={{
                                                                fontSize: '0.65rem',
                                                                color: '#0095f6',
                                                                fontWeight: 600,
                                                                background: 'rgba(0,149,246,0.1)',
                                                                padding: '2px 6px',
                                                                borderRadius: '6px'
                                                            }}>
                                                                {msg.msPerToken} ms/tok
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                    {isGenerating && chatMessages[chatMessages.length - 1]?.sender === 'user' && (
                                        <TypingIndicator theme={theme} />
                                    )}
                                </div>
                                {models.some(m => m.status === 'loading') && (
                                    <div style={{ padding: '0 1rem', marginBottom: '1rem' }}>
                                        <div style={{
                                            background: 'rgba(59, 130, 246, 0.1)',
                                            border: '1px solid rgba(59, 130, 246, 0.2)',
                                            borderRadius: '12px',
                                            padding: '0.75rem 1rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px'
                                        }}>
                                            <div className="pulse-slow" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                                            <span style={{ fontSize: '0.85rem', color: '#3b82f6', fontWeight: 600 }}>
                                                Loading {models.find(m => m.status === 'loading')?.name}...
                                            </span>
                                        </div>
                                    </div>
                                )}
                                {/* Scroll Sentinel */}
                                <div ref={messagesEndRef} style={{ height: '1px' }} />
                            </div>

                            {/* Instagram Style Input Area */}
                            <div style={{
                                padding: '1rem',
                                background: 'var(--bg-primary)',
                                borderTop: '1px solid var(--border-subtle)',
                                flexShrink: 0,
                                zIndex: 100,
                                paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    background: theme === 'dark' ? '#121212' : '#f8f8f8',
                                    borderRadius: '26px',
                                    padding: '4px 6px 4px 16px',
                                    border: '1px solid var(--border-subtle)',
                                    minHeight: '44px'
                                }}>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        placeholder={loadedModel ? "Message AI..." : "Model not loaded"}
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !isGenerating && inputText.trim() && loadedModel) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        disabled={!loadedModel}
                                        style={{
                                            flex: 1,
                                            background: 'transparent',
                                            border: 'none',
                                            padding: '8px 0',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.95rem',
                                            outline: 'none'
                                        }}
                                    />
                                    <AnimatePresence mode="wait">
                                        {isGenerating ? (
                                            <motion.button
                                                key="stop"
                                                initial={{ scale: 0.8, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0.8, opacity: 0 }}
                                                onPointerDown={(e) => {
                                                    e.preventDefault();
                                                    AIBridge.stopGenerate();
                                                    setIsGenerating(false);
                                                }}
                                                style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '50%',
                                                    background: '#ef4444',
                                                    color: 'white',
                                                    border: 'none',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Square size={14} fill="white" />
                                            </motion.button>
                                        ) : (
                                            <motion.button
                                                key="send"
                                                initial={{ scale: 0.8, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0.8, opacity: 0 }}
                                                onPointerDown={(e) => {
                                                    e.preventDefault();
                                                    handleSendMessage();
                                                }}
                                                disabled={!inputText.trim() || !loadedModel}
                                                style={{
                                                    color: (inputText.trim() && loadedModel) ? '#0095f6' : 'rgba(0,149,246,0.3)',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    fontWeight: 700,
                                                    fontSize: '0.9rem',
                                                    padding: '0 10px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Send
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'models' && (
                        <motion.div
                            key="models"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden' }}
                        >
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }} className="dashboard-scrollbar">
                                <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Cpu className="text-accent" /> Available Models
                                    </h2>
                                    <button
                                        onClick={handleImportModel}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '8px 16px',
                                            borderRadius: '12px',
                                            background: 'rgba(0,149,246,0.1)',
                                            color: '#0095f6',
                                            border: 'none',
                                            fontWeight: 700,
                                            fontSize: '0.85rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Plus size={16} /> Import GGUF
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                                    {models.map(model => (
                                        <ModelCard
                                            key={model.id}
                                            model={model}
                                            onLoad={() => handleLoadModel(model)}
                                            onDownload={() => handleDownload(model)}
                                            onDelete={() => handleDelete(model)}
                                            onOffload={() => handleOffload(model)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'settings' && (
                        <motion.div
                            key="settings"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden' }}
                        >
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }} className="dashboard-scrollbar">
                                <h2 style={{ marginBottom: '1.5rem' }}>Engine Configuration</h2>
                                <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 700 }}>Zero-Copy Memory Mapping</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Map file directly for instant loading</div>
                                            </div>
                                            <button
                                                onClick={() => setAiConfig(prev => ({ ...prev, use_mmap: !prev.use_mmap }))}
                                                style={{
                                                    padding: '6px 14px',
                                                    borderRadius: '10px',
                                                    background: aiConfig.use_mmap ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                    color: aiConfig.use_mmap ? '#22c55e' : '#ef4444',
                                                    border: 'none',
                                                    fontWeight: 800,
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {aiConfig.use_mmap ? 'ENABLED' : 'DISABLED'}
                                            </button>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 700 }}>Hardware Threads</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>More threads = faster inference</div>
                                            </div>
                                            <select
                                                value={aiConfig.threads}
                                                onChange={(e) => setAiConfig(prev => ({ ...prev, threads: parseInt(e.target.value) }))}
                                                style={{
                                                    padding: '6px 10px',
                                                    borderRadius: '10px',
                                                    background: 'rgba(0,149,246,0.1)',
                                                    color: '#0095f6',
                                                    border: 'none',
                                                    fontWeight: 800,
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer',
                                                    outline: 'none'
                                                }}
                                            >
                                                {[2, 4, 6, 8, 10, 12].map(t => (
                                                    <option key={t} value={t} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>{t} THREADS</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontWeight: 700 }}>Response Verbosity</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>How detailed should the AI be?</div>
                                                </div>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0095f6', textTransform: 'uppercase' }}>
                                                    {aiConfig.responseType}
                                                </div>
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                                padding: '4px',
                                                borderRadius: '14px',
                                                position: 'relative'
                                            }}>
                                                {(['brief', 'standard', 'detailed'] as const).map(type => (
                                                    <button
                                                        key={type}
                                                        onClick={() => setAiConfig(prev => ({ ...prev, responseType: type }))}
                                                        style={{
                                                            flex: 1,
                                                            padding: '8px 0',
                                                            borderRadius: '10px',
                                                            background: aiConfig.responseType === type ? (theme === 'dark' ? '#333' : 'white') : 'transparent',
                                                            color: aiConfig.responseType === type ? 'var(--text-primary)' : 'var(--text-muted)',
                                                            border: 'none',
                                                            fontWeight: 700,
                                                            fontSize: '0.75rem',
                                                            textTransform: 'capitalize',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s ease',
                                                            boxShadow: aiConfig.responseType === type ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                                                            zIndex: 2
                                                        }}
                                                    >
                                                        {type}
                                                    </button>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
                                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600 }}>FAST & SHORT</span>
                                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600 }}>BALANCED</span>
                                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600 }}>COMPREHENSIVE</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 700 }}>Auto-Offload</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Free RAM when app moves to background</div>
                                            </div>
                                            <div style={{ color: '#22c55e', fontWeight: 600 }}>ON</div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                                            <div>
                                                <div style={{ fontWeight: 700 }}>Custom AI Personality</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Tell the AI how to behave (e.g. "Talk like a pirate")</div>
                                            </div>
                                            <textarea
                                                value={aiConfig.customInstructions}
                                                onChange={(e) => setAiConfig(prev => ({ ...prev, customInstructions: e.target.value }))}
                                                placeholder="Enter custom instructions here..."
                                                style={{
                                                    width: '100%',
                                                    minHeight: '80px',
                                                    padding: '12px',
                                                    borderRadius: '14px',
                                                    background: 'rgba(0,0,0,0.05)',
                                                    border: '1px solid var(--border-subtle)',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '0.85rem',
                                                    outline: 'none',
                                                    resize: 'vertical'
                                                }}
                                            />
                                        </div>

                                        {/* Advanced Tuning Section */}
                                        <h3 style={{ marginTop: '1.5rem', marginBottom: '0.5rem', fontSize: '1rem' }}>Advanced Tuning</h3>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.03)', borderRadius: '12px' }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>Speed / Output Length</div>
                                                <input
                                                    type="range" min="128" max="2048" step="128"
                                                    value={aiConfig.n_predict}
                                                    onChange={(e) => setAiConfig(prev => ({ ...prev, n_predict: parseInt(e.target.value) }))}
                                                    style={{ width: '100%' }}
                                                />
                                                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{aiConfig.n_predict} tokens</div>
                                            </div>

                                            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.03)', borderRadius: '12px' }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>Creativity (Temp)</div>
                                                <input
                                                    type="range" min="0.1" max="2.0" step="0.1"
                                                    value={aiConfig.temperature}
                                                    onChange={(e) => setAiConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                                                    style={{ width: '100%' }}
                                                />
                                                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{aiConfig.temperature}</div>
                                            </div>

                                            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.03)', borderRadius: '12px' }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>Top K</div>
                                                <input
                                                    type="range" min="10" max="100" step="5"
                                                    value={aiConfig.top_k}
                                                    onChange={(e) => setAiConfig(prev => ({ ...prev, top_k: parseInt(e.target.value) }))}
                                                    style={{ width: '100%' }}
                                                />
                                                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{aiConfig.top_k}</div>
                                            </div>

                                            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.03)', borderRadius: '12px' }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>Penalty</div>
                                                <input
                                                    type="range" min="1.0" max="1.5" step="0.05"
                                                    value={aiConfig.penalty}
                                                    onChange={(e) => setAiConfig(prev => ({ ...prev, penalty: parseFloat(e.target.value) }))}
                                                    style={{ width: '100%' }}
                                                />
                                                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{aiConfig.penalty}</div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                            <div>
                                                <div style={{ fontWeight: 800, color: '#3b82f6' }}>Direct Mode (RAW & INSTANT)</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Unfiltered output. Zero memory overhead.</div>
                                            </div>
                                            <button
                                                onClick={() => setAiConfig(prev => ({ ...prev, directMode: !prev.directMode }))}
                                                style={{
                                                    padding: '8px 16px',
                                                    borderRadius: '10px',
                                                    background: aiConfig.directMode ? '#3b82f6' : 'rgba(0,0,0,0.05)',
                                                    color: aiConfig.directMode ? 'white' : 'var(--text)',
                                                    border: 'none',
                                                    fontWeight: 800,
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {aiConfig.directMode ? 'ENABLED' : 'DISABLED'}
                                            </button>
                                        </div>

                                        <div style={{ display: aiConfig.directMode ? 'none' : 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', padding: '1rem', background: 'rgba(0,0,0,0.03)', borderRadius: '12px' }}>
                                            <div>
                                                <div style={{ fontWeight: 700 }}>Enable Context (RAG)</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Read notes/tasks. Slows down first response.</div>
                                            </div>
                                            <button
                                                onClick={() => setAiConfig(prev => ({ ...prev, disableContext: !prev.disableContext }))}
                                                style={{
                                                    padding: '6px 14px',
                                                    borderRadius: '10px',
                                                    background: !aiConfig.disableContext ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                    color: !aiConfig.disableContext ? '#22c55e' : '#ef4444',
                                                    border: 'none',
                                                    fontWeight: 800,
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {!aiConfig.disableContext ? 'ENABLED' : 'DISABLED'}
                                            </button>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
                                            <button
                                                onClick={() => {
                                                    setAiConfig({
                                                        threads: 6,
                                                        use_mmap: true,
                                                        responseType: 'standard',
                                                        customInstructions: '',
                                                        n_predict: 512,
                                                        temperature: 0.7,
                                                        top_k: 40,
                                                        top_p: 0.9,
                                                        penalty: 1.1,
                                                        disableContext: false,
                                                        directMode: false
                                                    });
                                                }}
                                                style={{
                                                    padding: '10px 20px',
                                                    borderRadius: '12px',
                                                    background: 'rgba(0, 149, 246, 0.1)',
                                                    color: '#0095f6',
                                                    border: '1px solid rgba(0, 149, 246, 0.2)',
                                                    fontWeight: 700,
                                                    fontSize: '0.8rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Restore Engine Defaults
                                            </button>
                                        </div>

                                        <div style={{ marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                <div>
                                                    <div style={{ fontWeight: 700 }}>Persistent AI Memory</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Facts the AI has learned about you</div>
                                                </div>
                                                {persistentMemories.length > 0 && (
                                                    <button
                                                        onClick={handleClearMemories}
                                                        style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                                                    >
                                                        CLEAR ALL
                                                    </button>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                                                <input
                                                    type="text"
                                                    id="manual-memory-input"
                                                    placeholder="Add a fact (e.g. My name is Alex)"
                                                    style={{
                                                        flex: 1,
                                                        padding: '10px 14px',
                                                        borderRadius: '12px',
                                                        background: 'rgba(0,0,0,0.05)',
                                                        border: '1px solid var(--border-subtle)',
                                                        color: 'var(--text-primary)',
                                                        fontSize: '0.85rem',
                                                        outline: 'none'
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const input = e.currentTarget;
                                                            if (input.value.trim()) {
                                                                const newFact = input.value.trim();
                                                                setPersistentMemories(prev => {
                                                                    const updated = [...prev, newFact];
                                                                    Preferences.set({ key: 'ai_persistent_memories', value: JSON.stringify(updated) });
                                                                    return updated;
                                                                });
                                                                input.value = '';
                                                            }
                                                        }
                                                    }}
                                                />
                                                <button
                                                    onClick={() => {
                                                        const input = document.getElementById('manual-memory-input') as HTMLInputElement;
                                                        if (input && input.value.trim()) {
                                                            const newFact = input.value.trim();
                                                            setPersistentMemories(prev => {
                                                                const updated = [...prev, newFact];
                                                                Preferences.set({ key: 'ai_persistent_memories', value: JSON.stringify(updated) });
                                                                return updated;
                                                            });
                                                            input.value = '';
                                                        }
                                                    }}
                                                    style={{
                                                        padding: '10px 16px',
                                                        borderRadius: '12px',
                                                        background: 'var(--accent-primary)',
                                                        color: 'white',
                                                        border: 'none',
                                                        fontWeight: 700,
                                                        fontSize: '0.8rem',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Add
                                                </button>
                                            </div>

                                            {persistentMemories.length === 0 ? (
                                                <div style={{ padding: '1.5rem', textAlign: 'center', background: 'rgba(0,0,0,0.03)', borderRadius: '16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                    AI hasn't remembered anything yet.<br />
                                                    Try: "Remember my favorite color is blue"
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {persistentMemories.map((fact, i) => (
                                                        <div key={i} style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            padding: '0.75rem 1rem',
                                                            background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                                            borderRadius: '12px',
                                                            fontSize: '0.85rem'
                                                        }}>
                                                            <span style={{ flex: 1, paddingRight: '1rem' }}>{fact}</span>
                                                            <button
                                                                onClick={() => handleDeleteMemory(i)}
                                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div >

            {/* Overlays (Error Toast & History Drawer) */}
            <AnimatePresence>
                {
                    error && (
                        <motion.div
                            initial={{ opacity: 0, y: 50, x: '-50%' }}
                            animate={{ opacity: 1, y: 0, x: '-50%' }}
                            exit={{ opacity: 0, y: 50, x: '-50%' }}
                            style={{
                                position: 'fixed', bottom: '100px', left: '50%',
                                background: '#ef4444', color: 'white', padding: '0.75rem 1.25rem',
                                borderRadius: '12px', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '0.5rem',
                                boxShadow: '0 10px 20px rgba(0,0,0,0.2)'
                            }}
                        >
                            <AlertCircle size={18} /> {error}
                        </motion.div>
                    )
                }
            </AnimatePresence >

            <AnimatePresence>
                {isHistoryOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsHistoryOpen(false)}
                            style={{
                                position: 'fixed',
                                inset: 0,
                                background: 'rgba(0,0,0,0.6)',
                                backdropFilter: 'blur(4px)',
                                zIndex: 1000
                            }}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            style={{
                                position: 'fixed',
                                top: 0,
                                right: 0,
                                bottom: 0,
                                width: 'min(320px, 85vw)',
                                background: 'var(--bg-primary)',
                                borderLeft: '1px solid var(--border-subtle)',
                                zIndex: 1001,
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: '-10px 0 30px rgba(0,0,0,0.3)'
                            }}
                        >
                            <div style={{ padding: '2rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>History</h2>
                                <button
                                    onClick={() => setIsHistoryOpen(false)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                >
                                    <X size={24} />
                                </button>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }} className="dashboard-scrollbar">
                                {sessions.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '3rem' }}>
                                        <Clock size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                        <p>No previous chats</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {sessions.map(session => (
                                            <div
                                                key={session.id}
                                                onClick={() => handleSwitchSession(session.id)}
                                                style={{
                                                    padding: '1rem',
                                                    borderRadius: '16px',
                                                    background: activeSessionId === session.id ? 'rgba(0, 149, 246, 0.1)' : 'rgba(0,0,0,0.05)',
                                                    border: `1px solid ${activeSessionId === session.id ? '#0095f6' : 'var(--border-subtle)'}`,
                                                    cursor: 'pointer',
                                                    position: 'relative',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px', paddingRight: '24px' }}>
                                                    {session.title}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span>{new Date(session.lastModified).toLocaleDateString()}</span>
                                                    {session.modelName && <span>{session.modelName}</span>}
                                                </div>
                                                <button
                                                    onClick={(e) => handleDeleteSession(session.id, e)}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '50%',
                                                        right: '12px',
                                                        transform: 'translateY(-50%)',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: 'var(--text-muted)',
                                                        opacity: 0.5,
                                                        padding: '4px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                                <button
                                    onClick={handleNewChat}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        borderRadius: '12px',
                                        background: '#0095f6',
                                        color: 'white',
                                        border: 'none',
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Plus size={18} /> New Chat
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </motion.div >
    );
};

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
    <button
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '12px',
            border: 'none',
            background: active ? 'var(--bg-card)' : 'transparent',
            color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontWeight: active ? 600 : 500,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
    >
        <Icon size={18} />
        {!active ? null : <span>{label}</span>}
    </button>
);

interface Model {
    id: string;
    name: string;
    description: string;
    size: string;
    status: 'idle' | 'downloading' | 'downloaded' | 'loading' | 'loaded';
    progress?: number;
    url?: string;
    downloadId?: number;
}

const ModelCard = ({ model, onLoad, onDownload, onDelete, onOffload }: { model: Model, onLoad: () => void, onDownload: () => void, onDelete: () => void, onOffload: () => void }) => (
    <div style={{
        background: 'var(--bg-card)',
        padding: '1.5rem',
        borderRadius: '24px',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: 'var(--shadow-soft)'
    }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{model.name}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{model.size} • GGUF</span>
            </div>
            <div style={{
                padding: '4px 10px',
                borderRadius: '10px',
                background: model.status === 'loaded' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(0,0,0,0.1)',
                color: model.status === 'loaded' ? '#22c55e' : 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase'
            }}>
                {model.status}
            </div>
        </div>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{model.description}</p>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {model.status === 'downloading' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Downloading...</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 800 }}>{Math.round((model.progress || 0) * 100)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                        <div style={{
                            width: `${(model.progress || 0) * 100}%`,
                            height: '100%',
                            background: 'var(--accent-primary)',
                            borderRadius: '3px',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                {model.status === 'idle' && (
                    <button onClick={onDownload} style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', background: 'var(--accent-primary)', color: 'white', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <Download size={18} /> Fetch
                    </button>
                )}
                {model.status === 'downloaded' && (
                    <button onClick={onLoad} style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', background: '#22c55e', color: 'white', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <Play size={18} /> Load
                    </button>
                )}
                {model.status === 'loading' && (
                    <button disabled style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', background: 'rgba(127,127,127,0.2)', color: 'white', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <div className="spinner-small" /> Loading...
                    </button>
                )}
                {model.status === 'loaded' && (
                    <button
                        onClick={onOffload}
                        style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}
                    >
                        <Pause size={18} /> Offload
                    </button>
                )}
                {(model.status === 'downloaded' || model.status === 'idle') && (
                    <button onClick={onDelete} style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
                        <Trash2 size={18} />
                    </button>
                )}
            </div>
        </div>
    </div>
);

const TypingIndicator = ({ theme }: { theme: string }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '12px 18px',
            background: theme === 'dark' ? '#262626' : '#EFEFEF',
            borderRadius: '22px 22px 22px 4px',
            alignSelf: 'flex-start',
            marginBottom: '12px',
            width: 'fit-content'
        }}
    >
        {[0, 1, 2].map((i) => (
            <motion.div
                key={i}
                animate={{ y: [0, -6, 0] }}
                transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: "easeInOut"
                }}
                style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)'
                }}
            />
        ))}
    </motion.div>
);

export default AIView;
