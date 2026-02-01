import { openDB, type DBSchema } from 'idb';
import type { Note, Todo } from '../types';
import { Preferences } from '@capacitor/preferences';
import { format } from 'date-fns';

interface TruNotesDB extends DBSchema {
    notes: {
        key: string;
        value: Note;
        indexes: { 'by-date': number; 'by-tags': string[] };
    };
    todos: {
        key: string;
        value: Todo;
        indexes: { 'by-date': number; 'by-target-date': string };
    };
    hourly_logs: {
        key: string; // date string (YYYY-MM-DD)
        value: {
            date: string;
            logs: { [hour: number]: string };
        };
    };
}

const dbPromise = openDB<TruNotesDB>('trunotes-db', 5, {
    upgrade(db, oldVersion, _newVersion, transaction) {
        let noteStore;
        if (oldVersion < 1) {
            noteStore = db.createObjectStore('notes', { keyPath: 'id' });
            noteStore.createIndex('by-date', 'updatedAt');
        } else {
            noteStore = transaction.objectStore('notes');
        }

        if (oldVersion < 2) {
            if (!noteStore.indexNames.contains('by-tags')) {
                noteStore.createIndex('by-tags', 'tags', { multiEntry: true });
            }
        }

        if (oldVersion < 3) {
            const todoStore = db.createObjectStore('todos', { keyPath: 'id' });
            todoStore.createIndex('by-date', 'createdAt');
        }

        if (oldVersion < 4) {
            const todoStore = transaction.objectStore('todos');
            if (!todoStore.indexNames.contains('by-target-date')) {
                todoStore.createIndex('by-target-date', 'targetDate');
            }
        }

        if (oldVersion < 5) {
            if (!db.objectStoreNames.contains('hourly_logs')) {
                db.createObjectStore('hourly_logs', { keyPath: 'date' });
            }
        }
    },
});

export const storage = {
    async getAllNotes(): Promise<Note[]> {
        const db = await dbPromise;
        return db.getAll('notes');
    },

    async getNote(id: string): Promise<Note | undefined> {
        const db = await dbPromise;
        return db.get('notes', id);
    },

    async saveNote(note: Note): Promise<string> {
        const db = await dbPromise;
        await db.put('notes', note);
        this.notifyListeners();
        return note.id;
    },

    async deleteNote(id: string): Promise<void> {
        const db = await dbPromise;
        await db.delete('notes', id);
        this.notifyListeners();
    },

    async getTodos(): Promise<Todo[]> {
        const db = await dbPromise;
        return db.getAll('todos');
    },

    async getTodosByDate(date: string): Promise<Todo[]> {
        const db = await dbPromise;
        return db.getAllFromIndex('todos', 'by-target-date', date);
    },

    async getAllTodos(): Promise<Todo[]> {
        const db = await dbPromise;
        return db.getAll('todos');
    },

    async saveTodo(todo: Todo): Promise<void> {
        const db = await dbPromise;
        // Ensure updatedAt is present if missing (backwards compatibility)
        const updatedTodo = { ...todo, updatedAt: todo.updatedAt || Date.now() };
        await db.put('todos', updatedTodo);
        this.notifyListeners();
    },

    async deleteTodo(id: string): Promise<void> {
        const db = await dbPromise;
        await db.delete('todos', id);
        this.notifyListeners();
    },

    async getHourlyLog(date: string) {
        const db = await dbPromise;
        return db.get('hourly_logs', date);
    },

    async saveHourlyLog(date: string, logs: { [hour: number]: string }) {
        const db = await dbPromise;
        await db.put('hourly_logs', { date, logs });
        this.notifyListeners();
    },

    async exportDatabase() {
        const db = await dbPromise;
        const notes = await db.getAll('notes');
        const todos = await db.getAll('todos');
        const hourlyLogs = await db.getAll('hourly_logs');
        return { notes, todos, hourlyLogs, timestamp: Date.now() };
    },

    async importDatabase(data: { notes: Note[], todos: Todo[], hourlyLogs?: any[] }) {
        // ALWAYS ADDITIVE - Do not clear local data anymore
        console.log("storage: Performing additive import (merge)...");
        await this.mergeDatabase(data);
        this.notifyListeners();
    },

    async mergeDatabase(cloudData: { notes: Note[], todos: Todo[], hourlyLogs?: any[] }) {
        const db = await dbPromise;
        const tx = db.transaction(['notes', 'todos', 'hourly_logs'], 'readwrite');

        // 1. Merge Notes
        const noteStore = tx.objectStore('notes');
        const localNotes = await noteStore.getAll();
        const noteMap = new Map<string, Note>();

        localNotes.forEach(n => noteMap.set(n.id, n));

        for (const cloudNote of cloudData.notes) {
            const localNote = noteMap.get(cloudNote.id);
            if (!localNote) {
                // New from cloud
                noteMap.set(cloudNote.id, cloudNote);
            } else {
                // Conflict: Keep newer
                const cloudTime = cloudNote.updatedAt || cloudNote.createdAt || 0;
                const localTime = localNote.updatedAt || localNote.createdAt || 0;
                if (cloudTime > localTime) {
                    noteMap.set(cloudNote.id, cloudNote);
                }
            }
        }

        // Save merged notes
        for (const note of noteMap.values()) {
            await noteStore.put(note); // overwrites or adds
        }

        // 2. Merge Todos
        const todoStore = tx.objectStore('todos');
        const localTodos = await todoStore.getAll();
        const todoMap = new Map<string, Todo>();

        localTodos.forEach(t => todoMap.set(t.id, t));

        for (const cloudTodo of cloudData.todos) {
            const localTodo = todoMap.get(cloudTodo.id);
            if (!localTodo) {
                todoMap.set(cloudTodo.id, cloudTodo);
            } else {
                // Conflict: Keep newer if updatedAt exists, otherwise keep cloud
                const cloudUpdated = cloudTodo.updatedAt || cloudTodo.createdAt || 0;
                const localUpdated = localTodo.updatedAt || localTodo.createdAt || 0;
                if (cloudUpdated > localUpdated) {
                    todoMap.set(cloudTodo.id, cloudTodo);
                }
            }
        }

        for (const todo of todoMap.values()) {
            await todoStore.put(todo);
        }

        // 3. Merge Hourly Logs
        if (cloudData.hourlyLogs) {
            const hourlyStore = tx.objectStore('hourly_logs');
            const localLogs = await hourlyStore.getAll();
            const logMap = new Map<string, any>();

            localLogs.forEach(l => logMap.set(l.date, l));

            for (const cloudLog of cloudData.hourlyLogs) {
                const localLog = logMap.get(cloudLog.date);
                if (!localLog) {
                    logMap.set(cloudLog.date, cloudLog);
                } else {
                    // Merge internal logs object: { "9": "foo", "10": "bar" }
                    const mergedInternal = { ...localLog.logs, ...cloudLog.logs };
                    logMap.set(cloudLog.date, { ...localLog, logs: mergedInternal });
                }
            }

            for (const log of logMap.values()) {
                await hourlyStore.put(log);
            }
        }

        await tx.done;
        storage.notifyListeners();
    },

    listeners: [] as (() => void)[],

    onDataChange(callback: () => void) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    },

    async notifyListeners() {
        this.listeners.forEach(cb => cb());
        // Sync to Widget (Android Native Bridge)
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const todos = await this.getTodosByDate(today);
            const hourlyLog = await this.getHourlyLog(today);

            // Save to Capacitor Preferences (which maps to Android SharedPreferences)
            await Preferences.set({
                key: 'widget_todos',
                value: JSON.stringify(todos)
            });
            await Preferences.set({
                key: 'widget_hourly',
                value: JSON.stringify(hourlyLog?.logs || {})
            });
        } catch (e) {
            console.warn('Widget sync failed:', e);
        }
    }
};
