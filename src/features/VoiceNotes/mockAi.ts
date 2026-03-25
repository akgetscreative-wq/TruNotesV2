import type { SummarizedVoiceNote } from './types';

const FALLBACK_TRANSCRIPTS = [
    'Quick brain dump for today: I need to finish the onboarding polish, review the mobile spacing on the dashboard, and send the updated flow to the team before dinner. The main blocker is the empty state design, but I already know the direction I want.',
    'Reminder to myself: tomorrow should start with the grocery run, then I want to batch all my calls in the afternoon. I should also remember to stretch, drink more water, and clean up the ideas from the last sprint retro.',
    'Voice note about a product idea: people want a lighter way to capture thoughts fast, especially when they are walking or commuting. The experience should feel calm, summarize automatically, and make it easy to revisit the useful part later.',
    'Planning note: focus on the high impact tasks first, ignore small distractions, and finish one polished feature instead of juggling five half-complete ones. The goal is clarity, momentum, and a clean handoff.'
];

function splitSentences(input: string): string[] {
    return input
        .replace(/\s+/g, ' ')
        .trim()
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);
}

export function normalizeTranscript(input: string): string {
    const cleaned = input.replace(/\s+/g, ' ').trim();
    return cleaned.length > 0 ? cleaned : FALLBACK_TRANSCRIPTS[Math.floor(Math.random() * FALLBACK_TRANSCRIPTS.length)];
}

function buildTitle(source: string): string {
    const words = source
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 6);

    if (words.length === 0) return 'Voice Note';

    return words
        .map((word, index) => {
            if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            return word.toLowerCase();
        })
        .join(' ');
}

function shorten(input: string, maxLength: number): string {
    if (input.length <= maxLength) return input;
    return `${input.slice(0, maxLength - 1).trim()}…`;
}

export async function transcribeAudio(rawTranscript: string, durationMs: number): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, Math.min(1600, Math.max(700, durationMs * 0.18))));
    return normalizeTranscript(rawTranscript);
}

export async function heuristicSummarizeTranscript(transcript: string): Promise<SummarizedVoiceNote> {
    await new Promise(resolve => setTimeout(resolve, 900));

    const normalized = normalizeTranscript(transcript);
    const sentences = splitSentences(normalized);
    const title = buildTitle(sentences[0] || normalized);
    const summaryBase = sentences.slice(0, 2).join(' ');
    const summary = shorten(summaryBase || normalized, 180);
    const excerpt = shorten(summaryBase || normalized, 120);

    return {
        title,
        summary,
        excerpt,
    };
}
