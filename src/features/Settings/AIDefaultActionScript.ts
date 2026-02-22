export const defaultActionScript = `// Variables provided:
// finalBotText (string)
// todos (Array), notes (Array), persistentMemories (Array)
// addTodo, toggleTodo, deleteTodo (Async Functions)
// addNote, updateNote, deleteNote (Async Functions)
// setPersistentMemories (State Setter Function)
// saveHourlyLog (Async Function)
// Preferences (Capacitor Key-Value Store)
// Return: The cleaned text to display to the user.

let cleanedText = finalBotText;
let tm;

// [SAVEMEM]
const memMatch = cleanedText.match(/\\[SAVEMEM:\\s*(.*?)\\]/);
if (memMatch && memMatch[1]) {
    const fact = memMatch[1].trim();
    console.log("AI Command: Saving memory ->", fact);
    setPersistentMemories(m => {
        if (m.includes(fact)) return m;
        const updated = [...m, fact];
        Preferences.set({ key: 'ai_persistent_memories', value: JSON.stringify(updated) });
        return updated;
    });
    cleanedText = cleanedText.replace(/\\[SAVEMEM:.*?\\]/g, '').trim();
}

// [CREATE_TASK]
const taskRegex = /\\[CREATE_TASK:\\s*["'](.*?)["'](?:\\s*date=["'](\\d{4}-\\d{2}-\\d{2})["'])?\\]/gi;
while ((tm = taskRegex.exec(finalBotText)) !== null) {
    if (tm[1]) {
        const dateStr = tm[2] || new Date().toISOString().split('T')[0];
        console.log("AI Command: Creating task ->", tm[1], "for date:", dateStr);
        await addTodo(tm[1], dateStr);
        if (window.showToast) window.showToast(\`Task created: \${tm[1]}\`, 'success');
        cleanedText = cleanedText.replace(tm[0], '').trim();
    }
}

// [COMPLETE_TASK]
const completeRegex = /\\[COMPLETE_TASK:\\s*["'](.*?)["']\\]/gi;
while ((tm = completeRegex.exec(finalBotText)) !== null) {
    if (tm[1]) {
        const target = tm[1].toLowerCase();
        console.log("AI Command: Completing task ->", target);
        const todo = todos.find(t => t.text.toLowerCase().includes(target) && !t.completed);
        if (todo) {
            await toggleTodo(todo);
            if (window.showToast) window.showToast(\`Task completed: \${todo.text}\`, 'success');
        }
        cleanedText = cleanedText.replace(tm[0], '').trim();
    }
}

// [DELETE_TASK]
const deleteTaskRegex = /\\[DELETE_TASK:\\s*["'](.*?)["']\\]/gi;
while ((tm = deleteTaskRegex.exec(finalBotText)) !== null) {
    if (tm[1]) {
        const target = tm[1].toLowerCase();
        console.log("AI Command: Deleting task ->", target);
        const todo = todos.find(t => t.text.toLowerCase().includes(target));
        if (todo) {
            await deleteTodo(todo.id);
            if (window.showToast) window.showToast(\`Task deleted: \${todo.text}\`, 'success');
        }
        cleanedText = cleanedText.replace(tm[0], '').trim();
    }
}

// [CREATE_NOTE]
const noteRegex = /\\[CREATE_NOTE:\\s*title=["'](.*?)["'],?\\s*content=["'](.*?)["']\\]/gis;
while ((tm = noteRegex.exec(finalBotText)) !== null) {
    if (tm[1] && tm[2]) {
        console.log("AI Command: Creating note ->", tm[1]);
        await addNote(tm[1], tm[2]);
        if (window.showToast) window.showToast(\`Note created: \${tm[1]}\`, 'success');
        cleanedText = cleanedText.replace(tm[0], '').trim();
    }
}

// [EDIT_NOTE]
const editNoteRegex = /\\[EDIT_NOTE:\\s*title=["'](.*?)["'],?\\s*content=["'](.*?)["']\\]/gis;
while ((tm = editNoteRegex.exec(finalBotText)) !== null) {
    if (tm[1] && tm[2]) {
        const target = tm[1].toLowerCase();
        console.log("AI Command: Editing note ->", target);
        const note = notes.find(n => !n.deleted && n.title.toLowerCase().includes(target));
        if (note) {
            await updateNote(note.id, { content: tm[2] });
            if (window.showToast) window.showToast(\`Note updated: \${note.title}\`, 'success');
        }
        cleanedText = cleanedText.replace(tm[0], '').trim();
    }
}

// [DELETE_NOTE]
const deleteNoteRegex = /\\[DELETE_NOTE:\\s*["'](.*?)["']\\]/gi;
while ((tm = deleteNoteRegex.exec(finalBotText)) !== null) {
    if (tm[1]) {
        const target = tm[1].toLowerCase();
        console.log("AI Command: Deleting note ->", target);
        const note = notes.find(n => !n.deleted && n.title.toLowerCase().includes(target));
        if (note) {
            await deleteNote(note.id);
            if (window.showToast) window.showToast(\`Note deleted: \${note.title}\`, 'success');
        }
        cleanedText = cleanedText.replace(tm[0], '').trim();
    }
}

// [TOGGLE_FAVORITE]
const favRegex = /\\[TOGGLE_FAVORITE:\\s*["'](.*?)["']\\]/gi;
while ((tm = favRegex.exec(finalBotText)) !== null) {
    if (tm[1]) {
        const target = tm[1].toLowerCase();
        console.log("AI Command: Toggling favorite ->", target);
        const note = notes.find(n => !n.deleted && n.title.toLowerCase().includes(target));
        if (note) {
            await updateNote(note.id, { isFavorite: !note.isFavorite });
            if (window.showToast) window.showToast(\`\${note.isFavorite ? 'Unfavorited' : 'Favorited'}: \${note.title}\`, 'success');
        }
        cleanedText = cleanedText.replace(tm[0], '').trim();
    }
}

// [LOG_HOUR]
const logHourRegex = /\\[LOG_HOUR:\\s*hour=(\\d{1,2})\\s+content=["'](.*?)["']\\]/gi;
while ((tm = logHourRegex.exec(finalBotText)) !== null) {
    const hour = parseInt(tm[1]);
    const content = tm[2];
    if (!isNaN(hour) && hour >= 0 && hour <= 23 && content) {
        console.log("AI Command: Logging hour", hour, "->", content);
        await saveHourlyLog(hour, content);
        if (window.showToast) window.showToast(\`Logged \${String(hour).padStart(2, '0')}:00 — \${content}\`, 'success');
    }
    cleanedText = cleanedText.replace(tm[0], '').trim();
}

return cleanedText;`;
