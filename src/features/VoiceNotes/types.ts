export type VoiceNoteStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type VoiceSummaryProvider = 'qwen' | 'fallback';

export interface VoiceNote {
    id: string;
    title: string;
    transcript: string;
    summary: string;
    excerpt: string;
    createdAt: number;
    updatedAt: number;
    durationMs: number;
    status: VoiceNoteStatus;
    audioDataUrl?: string;
    errorMessage?: string;
    summaryProvider?: VoiceSummaryProvider;
}

export interface SummarizedVoiceNote {
    title: string;
    summary: string;
    excerpt: string;
}
