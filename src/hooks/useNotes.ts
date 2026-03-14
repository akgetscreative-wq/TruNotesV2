import { useState, useEffect, useCallback } from 'react';
import type { Note } from '../types';
import { storage } from '../lib/storage';
import { generateEmbedding } from '../features/AI/embedding';

const generateId = () => {
    try {
        return crypto.randomUUID();
    } catch (e) {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
};

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
        console.log("useNotes: addNote initiated", { title });
        const maxOrder = notes.length > 0 ? Math.max(...notes.map((n: Note) => n.order ?? 0)) : -1;

        const id = generateId();
        const now = Date.now();

        const newNote: Note = {
            id,
            title: title || 'Untitled',
            content,
            createdAt: now,
            updatedAt: now,
            order: maxOrder + 1,
            ...initialData
        };

        try {
            // SAVE IMMEDIATELY - Don't wait for AI
            await storage.saveNote(newNote);
            console.log("useNotes: Note saved to storage", id);
            await refreshNotes();

            // Generate embedding in the background
            setTimeout(async () => {
                try {
                    const vector = await generateEmbedding(`${title} ${content}`);
                    if (vector) {
                        const latestNote = await storage.getNote(id);
                        if (latestNote) {
                            await storage.saveNote({ ...latestNote, embedding: vector });
                            // No need to refreshNotes again, unless we want search to be instant
                        }
                    }
                } catch (e) {
                    console.error("Background embedding failed", e);
                }
            }, 100);

            return newNote;
        } catch (error) {
            console.error("useNotes: addNote failed", error);
            throw error;
        }
    };

    const updateNote = async (id: string, updates: Partial<Note>) => {
        console.log("useNotes: updateNote initiated", id);
        const oldNote = await storage.getNote(id);
        if (!oldNote) {
            console.warn("useNotes: updateNote failed - note not found", id);
            return;
        }

        const updatedNote: Note = {
            ...oldNote,
            ...updates,
            updatedAt: Date.now()
        };

        try {
            // SAVE IMMEDIATELY
            await storage.saveNote(updatedNote);
            console.log("useNotes: Note updated in storage", id);
            await refreshNotes();

            // Regenerate embedding in the background if title or content has changed
            if ((updates.title !== undefined && updates.title !== oldNote.title) ||
                (updates.content !== undefined && updates.content !== oldNote.content)) {

                setTimeout(async () => {
                    try {
                        const newTitle = updates.title !== undefined ? updates.title : oldNote.title;
                        const newContent = updates.content !== undefined ? updates.content : oldNote.content;
                        const vector = await generateEmbedding(`${newTitle} ${newContent}`);
                        if (vector) {
                            const latestNote = await storage.getNote(id);
                            if (latestNote) {
                                await storage.saveNote({ ...latestNote, embedding: vector });
                                console.log("useNotes: Background embedding updated (update)", id);
                            }
                        }
                    } catch (e) {
                        console.error("Background embedding update failed", e);
                    }
                }, 500);
            }
        } catch (error) {
            console.error("useNotes: updateNote failed", error);
            throw error;
        }
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
