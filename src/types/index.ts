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
}

export interface Todo {
    id: string;
    text: string;
    completed: boolean;
    createdAt: number;
    updatedAt: number;
    targetDate: string; // YYYY-MM-DD
    deleted?: boolean;
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
