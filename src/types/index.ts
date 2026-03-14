export interface Note {
    id: string;
    title: string;
    content: string;
    createdAt: number;
    updatedAt: number;
    folderId?: string; // For future organization
    tags?: string[];
    isFavorite?: boolean;
    color?: string; // One of the theme colors
    mood?: string; // Emoji character
    order?: number; // Manual sort order
    type?: 'text' | 'drawing';
    deleted?: boolean;
    embedding?: number[];
}

export interface Todo {
    id: string;
    text: string;
    completed: boolean;
    createdAt: number;
    updatedAt: number;
    targetDate: string; // YYYY-MM-DD or 'daily'
    deleted?: boolean;
    dailyParentId?: string;
    embedding?: number[];
}

export interface Folder {
    id: string;
    name: string;
}

export interface HourlyLog {
    date: string; // YYYY-MM-DD
    logs: { [hour: number]: string };
}
export interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    timestamp: number;
    msPerToken?: number;
}

export interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    lastModified: number;
    modelName?: string;
}

export interface Notebook {
    id: string;
    title: string;
    type: 'bubbles' | 'gradient-scribble' | 'mountains' | 'night' | 'geometric';
    content: string; // The text content of the lined notebook
    createdAt: number;
    updatedAt: number;
}
