import { Preferences } from '@capacitor/preferences';

export const useAICommands = (
    todos: any[],
    notes: any[],
    persistentMemories: string[],
    addTodo: (text: string, date: string) => Promise<void>,
    toggleTodo: (todo: any) => Promise<void>,
    deleteTodo: (id: string) => Promise<void>,
    addNote: (title: string, content: string) => Promise<any>,
    updateNote: (id: string, updates: any) => Promise<any>,
    deleteNote: (id: string) => Promise<any>,
    setPersistentMemories: React.Dispatch<React.SetStateAction<string[]>>,
    saveHourlyLog: (hour: number, content: string) => Promise<any>
) => {
    const parseCommands = async (text: string): Promise<string> => {
        let cleanedText = text;
        const finalBotText = text;
        let tm: RegExpExecArray | null;

        const isDev = localStorage.getItem('AI_DEV_MODE') === 'true';
        const devActionScript = localStorage.getItem('AI_DEV_ACTION_SCRIPT');

        if (isDev && devActionScript) {
            try {
                const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
                const actionFn = new AsyncFunction(
                    'finalBotText', 'todos', 'notes', 'persistentMemories',
                    'addTodo', 'toggleTodo', 'deleteTodo', 'addNote', 'updateNote', 'deleteNote',
                    'setPersistentMemories', 'saveHourlyLog', 'Preferences', 'window',
                    devActionScript
                );

                cleanedText = await actionFn(
                    finalBotText, todos, notes, persistentMemories,
                    addTodo, toggleTodo, deleteTodo, addNote, updateNote, deleteNote,
                    setPersistentMemories, saveHourlyLog, Preferences, window
                );
            } catch (actionErr) {
                console.error('AI Dev Action Script Compilation/Execution Failed:', actionErr);
            }
        } else {
            // [SAVEMEM]
            const memMatch = cleanedText.match(/\[SAVEMEM:\s*(.*?)\]/);
            if (memMatch && memMatch[1]) {
                const fact = memMatch[1].trim();
                setPersistentMemories(m => {
                    if (m.includes(fact)) return m;
                    const updated = [...m, fact];
                    Preferences.set({ key: 'ai_persistent_memories', value: JSON.stringify(updated) });
                    return updated;
                });
                cleanedText = cleanedText.replace(/\[SAVEMEM:.*?\]/g, '').trim();
            }

            // [CREATE_TASK]
            const taskRegex = /\[CREATE_TASK:\s*["'](.*?)["'](?:\s*date=["'](\d{4}-\d{2}-\d{2})["'])?\]/gi;
            while ((tm = taskRegex.exec(finalBotText)) !== null) {
                if (tm[1]) {
                    const dateStr = tm[2] || new Date().toISOString().split('T')[0];
                    await addTodo(tm[1], dateStr);
                    if ((window as any).showToast) (window as any).showToast(`Task created: ${tm[1]}`, 'success');
                    cleanedText = cleanedText.replace(tm[0], '').trim();
                }
            }

            // [COMPLETE_TASK]
            const completeRegex = /\[COMPLETE_TASK:\s*["'](.*?)["']\]/gi;
            while ((tm = completeRegex.exec(finalBotText)) !== null) {
                if (tm[1]) {
                    const target = tm[1].toLowerCase();
                    const todo = todos.find(t => t.text.toLowerCase().includes(target) && !t.completed);
                    if (todo) {
                        await toggleTodo(todo);
                        if ((window as any).showToast) (window as any).showToast(`Task completed: ${todo.text}`, 'success');
                    }
                    cleanedText = cleanedText.replace(tm[0], '').trim();
                }
            }

            // [DELETE_TASK]
            const deleteTaskRegex = /\[DELETE_TASK:\s*["'](.*?)["']\]/gi;
            while ((tm = deleteTaskRegex.exec(finalBotText)) !== null) {
                if (tm[1]) {
                    const target = tm[1].toLowerCase();
                    const todo = todos.find(t => t.text.toLowerCase().includes(target));
                    if (todo) {
                        await deleteTodo(todo.id);
                        if ((window as any).showToast) (window as any).showToast(`Task deleted: ${todo.text}`, 'success');
                    }
                    cleanedText = cleanedText.replace(tm[0], '').trim();
                }
            }

            // [CREATE_NOTE]
            const noteRegex = /\[CREATE_NOTE:\s*title=["'](.*?)["'],?\s*content=["'](.*?)["']\]/gis;
            while ((tm = noteRegex.exec(finalBotText)) !== null) {
                if (tm[1] && tm[2]) {
                    await addNote(tm[1], tm[2]);
                    if ((window as any).showToast) (window as any).showToast(`Note created: ${tm[1]}`, 'success');
                    cleanedText = cleanedText.replace(tm[0], '').trim();
                }
            }

            // [EDIT_NOTE]
            const editNoteRegex = /\[EDIT_NOTE:\s*title=["'](.*?)["'],?\s*content=["'](.*?)["']\]/gis;
            while ((tm = editNoteRegex.exec(finalBotText)) !== null) {
                if (tm[1] && tm[2]) {
                    const target = tm[1].toLowerCase();
                    const note = notes.find(n => !n.deleted && n.title.toLowerCase().includes(target));
                    if (note) {
                        await updateNote(note.id, { content: tm[2] });
                        if ((window as any).showToast) (window as any).showToast(`Note updated: ${note.title}`, 'success');
                    }
                    cleanedText = cleanedText.replace(tm[0], '').trim();
                }
            }

            // [DELETE_NOTE]
            const deleteNoteRegex = /\[DELETE_NOTE:\s*["'](.*?)["']\]/gi;
            while ((tm = deleteNoteRegex.exec(finalBotText)) !== null) {
                if (tm[1]) {
                    const target = tm[1].toLowerCase();
                    const note = notes.find(n => !n.deleted && n.title.toLowerCase().includes(target));
                    if (note) {
                        await deleteNote(note.id);
                        if ((window as any).showToast) (window as any).showToast(`Note deleted: ${note.title}`, 'success');
                    }
                    cleanedText = cleanedText.replace(tm[0], '').trim();
                }
            }

            // [TOGGLE_FAVORITE]
            const favRegex = /\[TOGGLE_FAVORITE:\s*["'](.*?)["']\]/gi;
            while ((tm = favRegex.exec(finalBotText)) !== null) {
                if (tm[1]) {
                    const target = tm[1].toLowerCase();
                    const note = notes.find(n => !n.deleted && n.title.toLowerCase().includes(target));
                    if (note) {
                        await updateNote(note.id, { isFavorite: !note.isFavorite });
                        if ((window as any).showToast) (window as any).showToast(`${note.isFavorite ? 'Unfavorited' : 'Favorited'}: ${note.title}`, 'success');
                    }
                    cleanedText = cleanedText.replace(tm[0], '').trim();
                }
            }

            // [LOG_HOUR]
            const logHourRegex = /\[LOG_HOUR:\s*hour=(\d{1,2})\s+content=["'](.*?)["']\]/gi;
            while ((tm = logHourRegex.exec(finalBotText)) !== null) {
                const hour = parseInt(tm[1]);
                const content = tm[2];
                if (!isNaN(hour) && hour >= 0 && hour <= 23 && content) {
                    await saveHourlyLog(hour, content);
                    if ((window as any).showToast) (window as any).showToast(`Logged ${String(hour).padStart(2, '0')}:00 \u2014 ${content}`, 'success');
                }
                cleanedText = cleanedText.replace(tm[0], '').trim();
            }
        }

        return cleanedText
            .replace(/\[\/?APP DATA CONTEXT\]/gi, '')
            .replace(/\[\/?SESSION_INFO\]/gi, '')
            .replace(/System Instructions:/gi, '')
            .replace(/\[SYSTEM_INSTRUCTION\]/gi, '')
            .replace(/\[\/SYSTEM_INSTRUCTION\]/gi, '')
            .trim();
    };

    return { parseCommands };
};
