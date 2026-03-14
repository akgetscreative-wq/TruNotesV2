import { useState, useEffect, useRef } from 'react';
import { storage } from '../../lib/storage';
import type { Message, ChatSession } from '../../types';

let inMemorySessions: ChatSession[] | null = null;
let inMemoryLastSessionId: string | null = null;

export const resetAISessionHistory = () => {
    inMemorySessions = null;
    inMemoryLastSessionId = null;
};

export const useAISessions = (loadedModel: string | null) => {
    const [sessions, setSessions] = useState<ChatSession[]>(inMemorySessions || []);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(inMemoryLastSessionId);
    const [chatMessages, setChatMessages] = useState<Message[]>([]);
    const activeSessionRef = useRef<string | null>(activeSessionId);

    useEffect(() => {
        inMemorySessions = sessions;
    }, [sessions]);

    useEffect(() => {
        if (activeSessionId) {
            inMemoryLastSessionId = activeSessionId;
            activeSessionRef.current = activeSessionId;
        }
    }, [activeSessionId]);

    const persistSessions = async (specificSessions?: ChatSession[]) => {
        const currentToPersist = specificSessions || sessions;
        if (activeSessionId) {
            const active = currentToPersist.find(s => s.id === activeSessionId);
            if (active) await storage.saveAISession(active);
        }
    };

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
        await storage.saveAISession(newSession);
    };

    const handleSwitchSession = (sessionId: string) => {
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
            setActiveSessionId(session.id);
            setChatMessages(session.messages);
        }
    };

    const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = sessions.filter(s => s.id !== sessionId);
        setSessions(updated);
        if (activeSessionId === sessionId) {
            if (updated.length > 0) {
                setActiveSessionId(updated[0].id);
                setChatMessages(updated[0].messages);
            } else {
                handleNewChat();
            }
        }
        await storage.deleteAISession(sessionId);
    };

    return {
        sessions, setSessions,
        activeSessionId, setActiveSessionId,
        chatMessages, setChatMessages,
        activeSessionRef,
        persistSessions, handleNewChat, handleSwitchSession, handleDeleteSession
    };
};
