import { Preferences } from '@capacitor/preferences';
import AIBridge from '../AI/AIBridge';
import { heuristicSummarizeTranscript, normalizeTranscript } from './mockAi';
import type { SummarizedVoiceNote } from './types';

type VoiceSummaryResult = SummarizedVoiceNote & {
    provider: 'qwen' | 'fallback';
};

type AIConfig = {
    threads?: number;
    n_predict?: number;
    temperature?: number;
    top_k?: number;
    top_p?: number;
    penalty?: number;
    n_ctx?: number;
};

function cleanModelResponse(response: string): string {
    return response
        .replace(/```json/gi, '```')
        .replace(/```/g, '')
        .trim();
}

function extractJsonObject(response: string): string | null {
    const cleaned = cleanModelResponse(response);
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) return null;
    return cleaned.slice(start, end + 1);
}

function normalizeField(input: unknown, fallback: string, maxLength?: number): string {
    const value = typeof input === 'string' ? input.replace(/\s+/g, ' ').trim() : '';
    const picked = value || fallback;
    if (!maxLength || picked.length <= maxLength) return picked;
    return `${picked.slice(0, maxLength - 1).trim()}…`;
}

function wrapPrompt(basePrompt: string, modelPath: string | null): string {
    const lowerPath = (modelPath || '').toLowerCase();

    if (lowerPath.includes('llama-3')) {
        return `<|start_header_id|>user<|end_header_id|>\n\n${basePrompt}<|eot_id|>\n<|start_header_id|>assistant<|end_header_id|>\n\n`;
    }

    if (lowerPath.includes('gemma')) {
        return `<start_of_turn>user\n${basePrompt}<end_of_turn>\n<start_of_turn>model\n`;
    }

    return `<|im_start|>user\n${basePrompt}<|im_end|>\n<|im_start|>assistant\n`;
}

async function getAIConfig(): Promise<AIConfig> {
    const { value } = await Preferences.get({ key: 'ai_engine_config' });
    if (!value) return {};

    try {
        return JSON.parse(value) as AIConfig;
    } catch {
        return {};
    }
}

async function ensureModelReady(modelPath: string | null, config: AIConfig) {
    if (!modelPath) return false;

    await AIBridge.loadModel({
        path: modelPath,
        threads: config.threads ?? 6,
        n_ctx: config.n_ctx ?? 1280,
    });

    return true;
}

function buildVoiceSummaryPrompt(transcript: string): string {
    return [
        'You are summarizing a voice note transcribed from speech to text.',
        'The transcript may contain filler words, repetition, or rough phrasing.',
        'Your job is to keep the meaning accurate, remove noise, and make it useful to review later.',
        'Do not invent facts or actions that are not present in the transcript.',
        'Return strict JSON only with this exact schema:',
        '{"title":"string","summary":"string","excerpt":"string"}',
        'Rules:',
        '- title: 4 to 8 words, specific and natural.',
        '- summary: 2 to 4 sentences, clean and useful, preserving decisions, plans, reminders, and intent.',
        '- excerpt: one short preview line under 120 characters.',
        '- no markdown, no code fences, no extra keys, no commentary.',
        '',
        `Transcript:\n${transcript}`,
    ].join('\n');
}

function parseVoiceSummary(response: string, transcript: string): SummarizedVoiceNote | null {
    const json = extractJsonObject(response);
    if (!json) return null;

    try {
        const parsed = JSON.parse(json) as Partial<SummarizedVoiceNote>;
        const fallbackTitle = transcript.split(/[.!?\n]/)[0]?.trim().split(/\s+/).slice(0, 6).join(' ') || 'Voice Note';
        const fallbackSummary = transcript.slice(0, 180).trim();
        const fallbackExcerpt = transcript.slice(0, 120).trim();

        return {
            title: normalizeField(parsed.title, fallbackTitle || 'Voice Note', 80),
            summary: normalizeField(parsed.summary, fallbackSummary || transcript, 260),
            excerpt: normalizeField(parsed.excerpt, fallbackExcerpt || fallbackSummary || transcript, 120),
        };
    } catch {
        return null;
    }
}

export async function summarizeTranscript(transcript: string): Promise<VoiceSummaryResult> {
    const normalized = normalizeTranscript(transcript);

    try {
        const config = await getAIConfig();
        const { path } = await AIBridge.getLastModelPath();
        const prompt = wrapPrompt(buildVoiceSummaryPrompt(normalized), path);
        const maxPredict = Math.min(Math.max(220, Math.ceil(normalized.length * 0.55)), config.n_predict ?? 420);

        let result = await AIBridge.generateSync({
            prompt,
            temperature: 0.25,
            n_predict: maxPredict,
            penalty: 1.12,
            top_k: config.top_k ?? 32,
            top_p: config.top_p ?? 0.88,
            threads: config.threads ?? 6,
        });

        if (result.response.includes('Error: Model not loaded')) {
            const loaded = await ensureModelReady(path, config);
            if (loaded) {
                result = await AIBridge.generateSync({
                    prompt,
                    temperature: 0.25,
                    n_predict: maxPredict,
                    penalty: 1.12,
                    top_k: config.top_k ?? 32,
                    top_p: config.top_p ?? 0.88,
                    threads: config.threads ?? 6,
                });
            }
        }

        const parsed = parseVoiceSummary(result.response, normalized);
        if (parsed) {
            return {
                ...parsed,
                provider: 'qwen',
            };
        }
    } catch (error) {
        console.error('Qwen voice summarization failed, falling back', error);
    }

    const fallback = await heuristicSummarizeTranscript(normalized);
    return {
        ...fallback,
        provider: 'fallback',
    };
}
