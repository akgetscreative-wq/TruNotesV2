import { useState, useEffect, useCallback } from 'react';
import type { Note } from '../types';
import { storage } from '../lib/storage';

export function useNotes() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshNotes = useCallback(async () => {
        try {
            const allNotes = await storage.getAllNotes();

            // Sort by Creation Date (Newest created first, edits don't move it)
            const sorted = allNotes.sort((a, b) => b.createdAt - a.createdAt);

            setNotes([...sorted]);
        } catch (error) {
            console.error('Failed to load notes:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshNotes();
        // Subscribe to changes (Sync merges, deletions, etc)
        const unsubscribe = storage.onDataChange(() => {
            console.log("useNotes: Data change detected, refreshing...");
            refreshNotes();
        });
        return unsubscribe;
    }, [refreshNotes]);

    const addNote = async (title: string, content: string, initialData?: Partial<Note>) => {
        // Find highest order to place new note at the end (or top if preferred)
        // User said: "keep the note tile in that area only when it was first writen"
        // This implies new notes should likely be added with a unique order that doesn't conflict.
        // If we want new notes at the end of the manual list:
        const maxOrder = notes.length > 0 ? Math.max(...notes.map(n => n.order ?? 0)) : -1;

        const newNote: Note = {
            id: crypto.randomUUID(),
            title: title || 'Untitled',
            content,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            order: maxOrder + 1,
            ...initialData
        };
        await storage.saveNote(newNote);
        await refreshNotes();
        return newNote; // Return full object so UI can switch to "Edit Mode" immediately
    };

    const updateNote = async (id: string, updates: Partial<Note>) => {
        const oldNote = await storage.getNote(id);
        if (!oldNote) return;

        const updatedNote: Note = {
            ...oldNote,
            ...updates,
            updatedAt: Date.now(),
        };
        await storage.saveNote(updatedNote);
        await refreshNotes();
    };

    const saveReorder = async (reorderedNotes: Note[]) => {
        // Update the order property for each note based on its index
        const updates = reorderedNotes.map((note, index) => ({
            ...note,
            order: index
        }));

        // Save all updated notes to storage
        for (const note of updates) {
            await storage.saveNote(note);
        }

        // Update local state immediately for snappy feel
        setNotes(updates);
    };

    const deleteNote = async (id: string) => {
        await storage.deleteNote(id);
        await refreshNotes();
    };

    return {
        notes,
        loading,
        addNote,
        updateNote,
        deleteNote,
        saveReorder,
        refreshNotes
    };
}
