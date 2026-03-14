import type { Message } from '../../types';

const ACTION_KEYWORDS = ['create', 'add', 'task', 'note', 'log', 'todo', 'manage', 'remind', 'save', 'remember', 'delete', 'edit', 'update', 'change', 'new'];
const APP_CONTEXT_KEYWORDS = ['note', 'notes', 'task', 'tasks', 'todo', 'todos', 'log', 'logs', 'journal', 'memory', 'memories', 'calendar', 'schedule', 'plan', 'summarise', 'summarize'];
const SMALL_TALK_PHRASES = [
    'hi', 'hello', 'hey', 'yo', 'sup', 'good morning', 'good afternoon', 'good evening',
    'how are you', 'whats up', "what's up", 'tell me a joke', 'joke', 'thanks', 'thank you',
    'lol', 'nice', 'cool', 'okay', 'ok'
];

export const isSmallTalkMessage = (userMsg: string) => {
    const normalized = userMsg.trim().toLowerCase();
    if (!normalized) return false;
    if (normalized.length <= 24 && SMALL_TALK_PHRASES.some(phrase => normalized === phrase || normalized.startsWith(`${phrase} `))) {
        return true;
    }

    const wordCount = normalized.split(/\s+/).filter(Boolean).length;
    const referencesAppData = APP_CONTEXT_KEYWORDS.some(keyword => normalized.includes(keyword));
    const requestsAction = ACTION_KEYWORDS.some(keyword => normalized.includes(keyword));

    return wordCount <= 8 && !referencesAppData && !requestsAction;
};

export const formatChatPrompt = (
    _modelId: string,
    history: Message[],
    userMsg: string,
    context?: string,
    aiConfig: any = {},
    onlySystem: boolean = false
) => {
    const smallTalk = isSmallTalkMessage(userMsg);
    const responseStyle = aiConfig.responseType === 'brief'
        ? "Keep replies short and punchy - 1-3 sentences max."
        : aiConfig.responseType === 'detailed'
            ? "Give detailed, well-structured replies using bullet points and headers when helpful."
            : "Reply conversationally - concise but complete.";

    // Akitsu personality + instructions
    const defaultIdentity = `You are Akitsu, a smart personal assistant inside TruNotes.
Warm, concise, and helpful. Talk like a close friend.

RULES:
1. USE the [APP DATA CONTEXT] below. If notes, tasks, or logs appear there, reference them accurately.
2. ONLY state facts from the context. If the data is not there, say "I don't have that info." NEVER guess or make up information.
3. When asked to summarize, list ALL items from the context clearly.
4. Respond in English. Answer once, then stop. Do not repeat yourself or rephrase the same point.
5. Give ONE direct answer. Do not simulate a conversation or generate follow-up questions unless the user asks.
{responseStyle}`;

    const defaultAppControlInstruction = `
APP COMMANDS (use ONLY when user asks to create/edit/delete data):
[CREATE_TASK: "<TEXT>"] | [COMPLETE_TASK: "<TEXT>"] | [CREATE_NOTE: title="<TITLE>" content="<CONTENT>"] | [LOG_HOUR: hour=<HOUR> content="<CONTENT>"] | [SAVEMEM: "<FACT>"]
Confirm briefly after using a command.`;

    const appControlInstruction = localStorage.getItem('AI_DEV_APP_CONTROL') || defaultAppControlInstruction;
    const rawIdentity = localStorage.getItem('AI_DEV_IDENTITY') || defaultIdentity;
    const identity = rawIdentity.replace('{responseStyle}', responseStyle);

    // Smartly include app instructions only if needed
    const needsActions = ACTION_KEYWORDS.some(k => userMsg.toLowerCase().includes(k));
    const finalInstructions = identity + (needsActions ? `\n\n${appControlInstruction}` : "");

    const now = new Date();
    const timeStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Context grounding
    const groundingBlock = `
[APP DATA CONTEXT]
Today's Date: ${timeStr}
Current Time: ${now.toLocaleTimeString()}
${context || "No notes or tasks available in the current search range."}
[/APP DATA CONTEXT]
`;

    const compactPrompt = `You are Akitsu, a friendly AI in TruNotes. Keep it brief and casual, 1-2 sentences. Answer once, then stop.`;

    const systemPrompt = smallTalk
        ? (aiConfig.customInstructions
            ? `${aiConfig.customInstructions}\n\n${compactPrompt}`
            : compactPrompt)
        : (aiConfig.customInstructions
            ? `${aiConfig.customInstructions}\n\n${finalInstructions}\n${groundingBlock}`
            : `${finalInstructions}\n${groundingBlock}`);

    // Chat History
    const recentHistory = history.slice(smallTalk ? -2 : -4).filter(m => m.text && m.text.trim());

    // Qwen / ChatML format (Universal for current models)
    const sysBlock = `<|im_start|>system\n${systemPrompt}<|im_end|>\n`;
    if (onlySystem) return sysBlock;

    let prompt = sysBlock;
    recentHistory.forEach(msg => {
        const role = msg.sender === 'user' ? 'user' : 'assistant';
        prompt += `<|im_start|>${role}\n${msg.text}<|im_end|>\n`;
    });

    return prompt + `<|im_start|>user\n${userMsg}<|im_end|>\n<|im_start|>assistant\n`;
};
