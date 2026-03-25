import { Preferences } from '@capacitor/preferences';
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import type { Note } from '../../types';
import AIBridge from './AIBridge';

export type SummaryDigestPeriod = 'week' | 'month';

export interface SummaryDigest {
    id: string;
    period: SummaryDigestPeriod;
    label: string;
    title: string;
    summary: string;
    highlights: string[];
    chatPrompt: string;
    generatedAt: number;
    rangeStart: number;
    rangeEnd: number;
    noteCount: number;
    latestSourceUpdate: number;
}

interface SummaryWindowContext {
    id: string;
    period: SummaryDigestPeriod;
    label: string;
    rangeStart: number;
    rangeEnd: number;
    notes: Note[];
    noteCount: number;
    latestSourceUpdate: number;
}

const STORAGE_KEY = 'trunotes-ai-summary-digests';
const MAX_NOTES_IN_PROMPT = 16;
const MAX_NOTE_CHARS = 320;

function safeJsonParse<T>(value: string | null): T | null {
    if (!value) return null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

function compactText(value: string) {
    return value.replace(/\s+/g, ' ').trim();
}

function shorten(value: string, maxChars: number) {
    if (value.length <= maxChars) return value;
    return `${value.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
}

function extractJsonPayload(raw: string) {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return fenced[1].trim();

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
        return raw.slice(start, end + 1);
    }

    return raw;
}

function fallbackDigest(context: SummaryWindowContext): Omit<SummaryDigest, 'generatedAt'> {
    const sorted = [...context.notes].sort((a, b) => b.updatedAt - a.updatedAt);
    const highlights = sorted.slice(0, 3).map(note => note.title || shorten(compactText(note.content), 60) || 'Untitled note');
    const summary = context.noteCount === 0
        ? `No notes were written in ${context.label.toLowerCase()}, so there is nothing to condense yet.`
        : `You captured ${context.noteCount} note${context.noteCount === 1 ? '' : 's'} in ${context.label.toLowerCase()}. Recent focus areas included ${highlights.join(', ')}.`;

    return {
        id: context.id,
        period: context.period,
        label: context.label,
        title: `${context.label} Summary`,
        summary,
        highlights,
        chatPrompt: `Help me act on this ${context.period} summary and identify the most important next steps.`,
        rangeStart: context.rangeStart,
        rangeEnd: context.rangeEnd,
        noteCount: context.noteCount,
        latestSourceUpdate: context.latestSourceUpdate,
    };
}

function parseDigestResponse(raw: string, context: SummaryWindowContext): Omit<SummaryDigest, 'generatedAt'> {
    const payload = safeJsonParse<{
        title?: string;
        summary?: string;
        highlights?: string[];
        chatPrompt?: string;
    }>(extractJsonPayload(raw));

    if (!payload) {
        return fallbackDigest(context);
    }

    const base = fallbackDigest(context);
    const highlights = Array.isArray(payload.highlights)
        ? payload.highlights.map(item => compactText(String(item))).filter(Boolean).slice(0, 5)
        : base.highlights;

    return {
        ...base,
        title: compactText(payload.title || '') || base.title,
        summary: compactText(payload.summary || '') || base.summary,
        highlights: highlights.length > 0 ? highlights : base.highlights,
        chatPrompt: compactText(payload.chatPrompt || '') || base.chatPrompt,
    };
}

export function getSummaryWindowContext(period: SummaryDigestPeriod, notes: Note[], now = new Date()): SummaryWindowContext {
    const start = period === 'week'
        ? startOfWeek(now, { weekStartsOn: 1 })
        : startOfMonth(now);
    const end = period === 'week'
        ? endOfWeek(now, { weekStartsOn: 1 })
        : endOfMonth(now);

    const rangeStart = start.getTime();
    const rangeEnd = end.getTime();
    const scopedNotes = notes
        .filter(note => {
            const updatedAt = note.updatedAt || note.createdAt;
            return updatedAt >= rangeStart && updatedAt <= rangeEnd;
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);

    const latestSourceUpdate = scopedNotes.reduce((latest, note) => Math.max(latest, note.updatedAt || note.createdAt || 0), 0);
    const label = period === 'week'
        ? `Week of ${format(start, 'MMM d')}`
        : format(start, 'MMMM yyyy');

    return {
        id: `${period}-${format(start, 'yyyy-MM-dd')}`,
        period,
        label,
        rangeStart,
        rangeEnd,
        notes: scopedNotes,
        noteCount: scopedNotes.length,
        latestSourceUpdate,
    };
}

export function shouldRefreshDigest(digest: SummaryDigest | undefined, context: SummaryWindowContext) {
    if (!digest) return true;
    if (digest.id !== context.id) return true;
    if (digest.noteCount !== context.noteCount) return true;
    if (digest.latestSourceUpdate !== context.latestSourceUpdate) return true;
    return false;
}

export function canAutoGenerateDigest(notes: Note[], idleThresholdMs = 10 * 60 * 1000, now = Date.now()) {
    if (notes.length === 0) return true;
    const lastEdit = notes.reduce((latest, note) => Math.max(latest, note.updatedAt || note.createdAt || 0), 0);
    return now - lastEdit >= idleThresholdMs;
}

export async function loadSummaryDigests(): Promise<SummaryDigest[]> {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    return safeJsonParse<SummaryDigest[]>(value) || [];
}

export async function saveSummaryDigests(digests: SummaryDigest[]): Promise<void> {
    await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(digests) });
}

function buildDigestPrompt(context: SummaryWindowContext) {
    const noteLines = context.notes
        .slice(0, MAX_NOTES_IN_PROMPT)
        .map((note, index) => {
            const body = shorten(compactText(note.content || ''), MAX_NOTE_CHARS);
            return [
                `${index + 1}. Title: ${shorten(compactText(note.title || 'Untitled'), 80)}`,
                `Updated: ${format(note.updatedAt || note.createdAt, 'MMM d, yyyy h:mm a')}`,
                `Content: ${body || 'No body text.'}`,
            ].join('\n');
        })
        .join('\n\n');

    return [
        `Create a precise ${context.period} summary for personal notes.`,
        `Window: ${context.label}.`,
        `Notes in scope: ${context.noteCount}.`,
        'Output strict JSON with keys: title, summary, highlights, chatPrompt.',
        'Rules:',
        '- summary should be 120 to 190 words, plain text, no markdown.',
        '- highlights should be an array of 3 to 5 short strings.',
        '- focus on what was actually done, explored, decided, or progressed.',
        '- avoid fluff, repetition, and vague productivity language.',
        '- if the notes are sparse, say that honestly and keep the summary useful.',
        '- chatPrompt should be one sentence the user can send to continue the conversation.',
        '',
        context.noteCount === 0
            ? 'There are no notes in this window. Produce a graceful empty-state summary.'
            : `Notes:\n${noteLines}`,
    ].join('\n');
}

export async function generateSummaryDigest(
    context: SummaryWindowContext,
    aiConfig: {
        threads?: number;
        temperature?: number;
        top_k?: number;
        top_p?: number;
        penalty?: number;
        n_predict?: number;
    }
): Promise<SummaryDigest> {
    const fallback = fallbackDigest(context);

    try {
        const result = await AIBridge.generateSync({
            prompt: buildDigestPrompt(context),
            stop: ['```', '</s>', '<|im_end|>', '<|eot_id|>'],
            temperature: Math.min(aiConfig.temperature ?? 0.35, 0.45),
            n_predict: Math.max(aiConfig.n_predict ?? 256, 256),
            top_k: aiConfig.top_k ?? 20,
            top_p: Math.min(aiConfig.top_p ?? 0.85, 0.9),
            penalty: aiConfig.penalty ?? 1.15,
            threads: aiConfig.threads ?? 4,
        });

        return {
            ...parseDigestResponse(result.response, context),
            generatedAt: Date.now(),
        };
    } catch (error) {
        console.error('Summary digest generation failed', error);
        return {
            ...fallback,
            generatedAt: Date.now(),
        };
    }
}
