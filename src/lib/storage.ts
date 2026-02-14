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
            updatedAt?: number;
        };
    };
}

const dbPromise = openDB<TruNotesDB>('trunotes-db', 6, {
    upgrade(db, oldVersion, _newVersion, transaction) {
        let noteStore;
        if (oldVersion < 1) {
            noteStore = db.createObjectStore('notes', { keyPath: 'id' });
            noteStore.createIndex('by-date', 'updatedAt');
        } else {
            noteStore = transaction.objectStore('notes');
        }

        if (oldVersion < 2 && !noteStore.indexNames.contains('by-tags')) {
            noteStore.createIndex('by-tags', 'tags', { multiEntry: true });
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

        if (oldVersion < 5 && !db.objectStoreNames.contains('hourly_logs')) {
            db.createObjectStore('hourly_logs', { keyPath: 'date' });
        }
    },
});

export const storage = {
    // ... preceding methods ...
    async getAllNotes(): Promise<Note[]> {
        const db = await dbPromise;
        const all = await db.getAll('notes');
        return all.filter(n => !n.deleted);
    },

    async getNote(id: string): Promise<Note | undefined> {
        const db = await dbPromise;
        const note = await db.get('notes', id);
        return note?.deleted ? undefined : note;
    },

    async saveNote(note: Note): Promise<string> {
        const db = await dbPromise;
        const updatedNote = { ...note, updatedAt: note.updatedAt || Date.now() };
        await db.put('notes', updatedNote);
        this.notifyListeners();
        return updatedNote.id;
    },

    async deleteNote(id: string): Promise<void> {
        const db = await dbPromise;
        const note = await db.get('notes', id);
        if (note) {
            note.deleted = true;
            note.updatedAt = Date.now();
            await db.put('notes', note);
            this.notifyListeners();
        }
    },

    async getTodos(): Promise<Todo[]> {
        const db = await dbPromise;
        const all = await db.getAll('todos');
        return all.filter(t => !t.deleted);
    },

    async getTodosByDate(date: string): Promise<Todo[]> {
        const db = await dbPromise;
        const all = await db.getAllFromIndex('todos', 'by-target-date', date);
        return all.filter(t => !t.deleted);
    },

    async getAllTodos(): Promise<Todo[]> {
        const db = await dbPromise;
        const all = await db.getAll('todos');
        return all.filter(t => !t.deleted);
    },

    async saveTodo(todo: Todo): Promise<void> {
        const db = await dbPromise;
        const updatedTodo = { ...todo, updatedAt: todo.updatedAt || Date.now() };
        await db.put('todos', updatedTodo);
        this.notifyListeners();
    },

    async deleteTodo(id: string): Promise<void> {
        const db = await dbPromise;
        const todo = await db.get('todos', id);
        if (todo) {
            todo.deleted = true;
            todo.updatedAt = Date.now();
            await db.put('todos', todo);
            this.notifyListeners();
        }
    },

    async getHourlyLog(date: string) {
        const db = await dbPromise;
        return db.get('hourly_logs', date);
    },

    async getAllHourlyLogs() {
        const db = await dbPromise;
        return db.getAll('hourly_logs');
    },

    async updateHourlyLogEntry(date: string, hour: number, text: string) {
        const db = await dbPromise;
        const existing = await this.getHourlyLog(date);
        const logs = existing ? { ...existing.logs } : {};
        logs[hour] = text;
        await db.put('hourly_logs', { date, logs, updatedAt: Date.now() });
        this.notifyListeners();
    },

    async saveHourlyLog(date: string, logs: { [hour: number]: string }) {
        const db = await dbPromise;
        await db.put('hourly_logs', { date, logs, updatedAt: Date.now() });
        this.notifyListeners();
    },

    async exportDatabase() {
        const db = await dbPromise;
        const notes = await db.getAll('notes');
        const todos = await db.getAll('todos');
        const hourlyLogs = await db.getAll('hourly_logs');
        // NOTE: activity_sessions is intentionally excluded from export for privacy
        // Activity data stays 100% local and is never backed up to cloud
        return { notes, todos, hourlyLogs, timestamp: Date.now() };
    },

    async importDatabase(data: { notes: Note[], todos: Todo[], hourlyLogs?: any[] }) {
        console.log("storage: Performing smart merge...");
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
                noteMap.set(cloudNote.id, cloudNote);
            } else {
                const cloudTime = cloudNote.updatedAt || cloudNote.createdAt || 0;
                const localTime = localNote.updatedAt || localNote.createdAt || 0;
                if (cloudTime > localTime) {
                    noteMap.set(cloudNote.id, cloudNote);
                }
            }
        }
        for (const note of noteMap.values()) {
            await noteStore.put(note);
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
                    const cloudUpdated = (cloudLog as any).updatedAt || 0;
                    const localUpdated = (localLog as any).updatedAt || 0;
                    if (cloudUpdated > localUpdated) {
                        logMap.set(cloudLog.date, cloudLog);
                    }
                }
            }
            for (const log of logMap.values()) {
                await hourlyStore.put(log);
            }
        }


        // NOTE: Activity sessions are intentionally NOT synced for privacy
        // They remain 100% local to each device

        await tx.done;
        this.notifyListeners();
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
        this.triggerWidgetSync();
    },

    async triggerWidgetSync() {
        // Sync to Widget (Android Native Bridge)
        try {
            const today = format(new Date(), 'yyyy-MM-dd');

            // Get ALL incomplete todos for the widget (pending tasks)
            const allTodos = await this.getAllTodos();
            const pendingTodos = allTodos.filter(t => !t.completed);

            const hourlyLog = await this.getHourlyLog(today);

            // Save to Capacitor Preferences (which maps to Android SharedPreferences)
            const data = [
                { key: 'widget_todos', value: JSON.stringify(pendingTodos) },
                { key: 'widget_hourly', value: JSON.stringify(hourlyLog?.logs || {}) },
                { key: 'widget_hourly_date', value: today },
                { key: 'needs_native_sync', value: 'false' } // Reset flag after app-to-widget sync
            ];

            for (const item of data) {
                await Preferences.set({
                    key: item.key,
                    value: item.value
                });
            }

            console.log("storage: Widget data updated - ", pendingTodos.length, "pending tasks");
        } catch (e) {
            console.warn('Widget sync failed:', e);
        }
    }
};

// Global hourly trigger to ensure widget/UI updates for new day/hour
if (typeof window !== 'undefined') {
    (window as any).triggerWidgetSync = () => storage.triggerWidgetSync();
    setInterval(() => {
        storage.notifyListeners();
    }, 60000 * 30); // Every 30 minutes, force a state refresh and widget sync
}
