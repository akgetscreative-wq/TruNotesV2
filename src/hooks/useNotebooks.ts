import { useState, useEffect, useCallback } from 'react';
import type { Notebook } from '../types';
import { storage } from '../lib/storage';

export function useNotebooks() {
    const [notebooks, setNotebooks] = useState<Notebook[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshNotebooks = useCallback(async () => {
        try {
            const all = await storage.getAllNotebooks();
            setNotebooks(all.sort((a, b) => b.updatedAt - a.updatedAt));
        } catch (error) {
            console.error('Failed to load notebooks:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshNotebooks();
        return storage.onDataChange(refreshNotebooks);
    }, [refreshNotebooks]);

    const createNotebook = async (type: Notebook['type']) => {
        const newNotebook: Notebook = {
            id: crypto.randomUUID(),
            title: 'Untitled Notebook',
            type,
            content: '',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        await storage.saveNotebook(newNotebook);
        await refreshNotebooks();
        return newNotebook;
    };

    const updateNotebook = async (id: string, updates: Partial<Notebook>) => {
        const existing = notebooks.find(n => n.id === id);
        if (!existing) return;
        const updated = { ...existing, ...updates, updatedAt: Date.now() };
        await storage.saveNotebook(updated);
        await refreshNotebooks();
    };

    const deleteNotebook = async (id: string) => {
        await storage.deleteNotebook(id);
        await refreshNotebooks();
    };

    return {
        notebooks,
        loading,
        createNotebook,
        updateNotebook,
        deleteNotebook,
        refreshNotebooks
    };
}
