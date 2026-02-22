export const defaultContextScript = `// Variables provided to you:
// input (string)
// notes (Array of Note objects: {id, title, content, createdAt, deleted...})
// todos (Array of Todo objects: {id, text, completed, createdAt, deleted...})
// hourlyLogs (Object { [hour]: string })
// persistentMemories (Array of strings)
// now (Date object)
// timeStr (Formatted today date string)

const lowerInput = input.toLowerCase();
let historicalTitle = "";
let historicalNotes = "";
let historicalTodos = "";

const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const monthAbbrs = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

let targetDateStart = null;
let targetDateEnd = null;

if (lowerInput.includes('yesterday')) {
    const d = new Date(now); d.setDate(d.getDate() - 1);
    targetDateStart = new Date(d.setHours(0, 0, 0, 0)).getTime();
    targetDateEnd = new Date(d.setHours(23, 59, 59, 999)).getTime();
    historicalTitle = "YESTERDAY'S RECORDS";
} else if (lowerInput.includes('today')) {
    const d = new Date(now);
    targetDateStart = new Date(d.setHours(0, 0, 0, 0)).getTime();
    targetDateEnd = new Date(d.setHours(23, 59, 59, 999)).getTime();
    historicalTitle = "TODAY'S RECORDS";
} else if (lowerInput.includes('last week')) {
    const end = new Date(now);
    const start = new Date(now); start.setDate(start.getDate() - 7);
    targetDateStart = new Date(start.setHours(0, 0, 0, 0)).getTime();
    targetDateEnd = new Date(end.setHours(23, 59, 59, 999)).getTime();
    historicalTitle = "LAST WEEK'S RECORDS";
} else {
    let monthIdx = -1;
    let day = NaN;
    for (let i = 0; i < 12; i++) {
        const name = monthNames[i];
        const abbr = monthAbbrs[i];
        if (lowerInput.includes(name) || lowerInput.match(new RegExp('\\\\b' + abbr + '\\\\b'))) {
            monthIdx = i;
            break;
        }
    }

    if (monthIdx !== -1) {
        const name = monthNames[monthIdx];
        const abbr = monthAbbrs[monthIdx];
        const dayMatch = lowerInput.match(new RegExp('(?:' + name + '|' + abbr + ')\\\\s*(\\\\d{1,2})\\\\b')) || lowerInput.match(new RegExp('\\\\b(\\\\d{1,2})\\\\s*(?:' + name + '|' + abbr + ')'));
        if (dayMatch) {
            day = parseInt(dayMatch[1] || dayMatch[2]);
        }

        const d = new Date(now);
        d.setMonth(monthIdx);
        if (!isNaN(day)) {
            d.setDate(day);
            targetDateStart = new Date(d.setHours(0, 0, 0, 0)).getTime();
            targetDateEnd = new Date(d.setHours(23, 59, 59, 999)).getTime();
            historicalTitle = 'RECORDS FOR ' + monthNames[monthIdx].toUpperCase() + ' ' + day;
        } else {
            const currentYear = d.getFullYear();
            targetDateStart = new Date(currentYear, monthIdx, 1, 0, 0, 0, 0).getTime();
            targetDateEnd = new Date(currentYear, monthIdx + 1, 0, 23, 59, 59, 999).getTime();
            historicalTitle = 'RECORDS FOR ALL OF ' + monthNames[monthIdx].toUpperCase();
        }
    }
}

// Deep Scan for Historical Data
if (targetDateStart && targetDateEnd) {
    const hNotes = notes.filter(n => !n.deleted && n.createdAt >= targetDateStart && n.createdAt <= targetDateEnd);
    const hTodos = todos.filter(t => !t.deleted && t.createdAt >= targetDateStart && t.createdAt <= targetDateEnd);

    if (hNotes.length > 0) {
        historicalNotes = hNotes.slice(0, 25).map(n => {
            let textContent = '';
            try {
                if (n.content && n.content.trim().startsWith('{')) {
                    const parsed = JSON.parse(n.content);
                    if (parsed._journalV2) {
                        const mainPart = parsed.mainContent || '';
                        const blockPart = (parsed.textBlocks || []).map(b => b.content).join(' ');
                        textContent = mainPart + ' ' + blockPart;
                    } else {
                        textContent = n.content;
                    }
                } else {
                    textContent = n.content || '';
                }
            } catch (e) {
                textContent = n.content || '';
            }

            const clean = textContent
                .replace(/<[^>]*>/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/data:image\\\\/[^;]+;base64,[^\\\\s"']+/g, '[IMAGE]')
                .replace(/\\\\s+/g, ' ')
                .substring(0, 400)
                .trim();

            const dateString = new Date(n.createdAt).toLocaleDateString();
            return '> [' + dateString + '] ' + (n.title || 'Untitled') + ': ' + clean + '...';
        }).join('\\n');
    }
    if (hTodos.length > 0) historicalTodos = hTodos.slice(0, 15).map(t => '- [' + new Date(t.createdAt).toLocaleDateString() + '] ' + t.text + ' (' + (t.completed ? 'Done' : 'todo') + ')').join('\\n');
}

const isDeepScan = lowerInput.includes('history') || lowerInput.includes('all notes') || lowerInput.includes('everything') || lowerInput.includes('search');

const recentNoteResults = notes
    .filter(n => !n.deleted)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, isDeepScan ? 20 : 5);

const pendingTodos = todos.filter(t => !t.deleted && !t.completed);
const recentDoneTodos = todos
    .filter(t => !t.deleted && t.completed && (isDeepScan || t.createdAt > (now.getTime() - 2 * 24 * 60 * 60 * 1000)))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, isDeepScan ? 20 : 5);

const recentTodoResults = [...pendingTodos.slice(0, isDeepScan ? 30 : 15), ...recentDoneTodos];

const recentNotesStr = recentNoteResults
    .map(n => {
        let textContent = '';
        try {
            if (n.content && n.content.trim().startsWith('{')) {
                const parsed = JSON.parse(n.content);
                if (parsed._journalV2) {
                    const mainPart = parsed.mainContent || '';
                    const blockPart = (parsed.textBlocks || []).map(b => b.content).join(' ');
                    textContent = mainPart + ' ' + blockPart;
                } else {
                    textContent = n.content;
                }
            } else {
                textContent = n.content || '';
            }
        } catch (e) {
            textContent = n.content || '';
        }

        const clean = textContent
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/data:image\\\\/[^;]+;base64,[^\\\\s"']+/g, '[IMAGE]')
            .replace(/\\\\s+/g, ' ')
            .substring(0, 500)
            .trim();

        return '- ' + (n.title || 'Untitled') + ': ' + clean + '...';
    })
    .join('\\n');

const recentTodosStr = recentTodoResults
    .map(t => '- ' + t.text + ' (' + (t.completed ? 'Done' : 'Todo') + ')')
    .join('\\n');

let contextStr = "";
if (persistentMemories && persistentMemories.length > 0) {
    contextStr += 'USER MEMORIES:\\n' + persistentMemories.map(m => '- ' + m).join('\\n') + '\\n\\n';
}

if (recentNotesStr && !historicalTitle) {
    contextStr += 'LATEST NOTES:\\n' + recentNotesStr + '\\n\\n';
} else if (recentNotesStr) {
    contextStr += 'RECENT NOTES (For Context):\\n' + recentNotesStr + '\\n\\n';
}

if (historicalTitle) {
    contextStr += '--- ' + historicalTitle + ' ---\\n';
    if (historicalNotes) {
        contextStr += historicalNotes + '\\n';
    } else {
        contextStr += 'No notes found in this period.\\n';
    }
    if (historicalTodos) contextStr += historicalTodos + '\\n';
    contextStr += '\\n';
}

if (recentTodosStr) contextStr += 'RECENT TASKS (3 Days):\\n' + recentTodosStr + '\\n\\n';

const logEntries = Object.entries(hourlyLogs)
    .filter(([_, v]) => v && v.trim())
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([h, v]) => String(h).padStart(2, '0') + ':00 — ' + v)
    .join('\\n');
if (logEntries) contextStr += "TODAY'S HOURLY LOG:\\n" + logEntries + '\\n\\n';

contextStr += '[SESSION_INFO]\\nDate: ' + timeStr + '\\n[/SESSION_INFO]';

return contextStr;`;
