import AIBridge from './AIBridge';
import { cosineSimilarity } from '../../utils/vector';
import type { Note, Todo } from '../../types';

// STEP 1 - EMBEDDING MODEL
const EMBEDDING_MODEL_FILENAME = "bge-small-en-v1.5-q4_k_m.gguf";

export type SearchableItem = {
    id: string;
    title: string;
    content: string;
    type: 'note' | 'todo' | 'log';
    embedding?: number[];
    updatedAt: number;
    original: any;
};

let embeddingModelLoaded = false;

export async function ensureEmbeddingModelLoaded() {

    if (embeddingModelLoaded) return true;

    try {

        await AIBridge.loadModel({
            path: EMBEDDING_MODEL_FILENAME,
            threads: 4
        });

        embeddingModelLoaded = true;
        return true;

    } catch (err) {

        console.error("Embedding model load failed", err);
        return false;

    }

}

export async function generateEmbedding(text: string): Promise<number[] | null> {
    try {
        const loaded = await ensureEmbeddingModelLoaded();
        if (!loaded) return null;

        // Add a 5 second timeout to embedding to prevent world-hangs
        const timeoutPromise = new Promise<null>((_, reject) => {
            setTimeout(() => reject(new Error("Embedding timeout")), 5000);
        });

        const embeddingPromise = AIBridge.embed({ text });

        const result: any = await Promise.race([embeddingPromise, timeoutPromise]);
        return result?.vector || null;
    } catch (err) {
        console.error("Embedding generation failed:", err);
        return null;
    }
}

// STEP 6 - SEMANTIC SEARCH with RECENCY BOOST (Step 8)
export async function searchSimilarItems(query: string, items: SearchableItem[], limit: number = 5) {
    const queryVector = await generateEmbedding(query);
    if (!queryVector) return [];

    const ranked = items
        .filter(item => item.embedding && item.embedding.length > 0)
        .map(item => {
            const similarity = cosineSimilarity(queryVector, item.embedding!);

            // Recency Boost
            const daysSince = Math.max(1, (Date.now() - item.updatedAt) / (1000 * 60 * 60 * 24));
            const recencyScore = 1 / daysSince;

            return {
                item,
                score: similarity + (recencyScore * 0.15)
            };
        });

    ranked.sort((a, b) => b.score - a.score);
    return ranked.slice(0, limit).map(r => r.item);
}

// STEP 7 - KEYWORD SEARCH (split query into words for better matching)
export function keywordSearch(query: string, items: SearchableItem[], limit: number = 3) {
    const lowerQuery = query.toLowerCase();
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 2);

    const scored = items.map(item => {
        const titleLower = item.title.toLowerCase();
        const contentLower = item.content.toLowerCase();
        let score = 0;

        // Exact phrase match gets highest score
        if (titleLower.includes(lowerQuery) || contentLower.includes(lowerQuery)) {
            score += 10;
        }

        // Individual word matches
        for (const word of queryWords) {
            if (titleLower.includes(word)) score += 3;
            if (contentLower.includes(word)) score += 1;
        }

        return { item, score };
    });

    return scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(s => s.item);
}

// STEP 9 - HYBRID RETRIEVAL (keyword-first, skip embedding if model not loaded to avoid chat model swap)
export async function hybridSearch(query: string, items: SearchableItem[]) {
    const keywords = keywordSearch(query, items, 5);

    // Only do semantic search if embedding model is already loaded
    // This prevents swapping out the chat model mid-conversation
    if (embeddingModelLoaded) {
        try {
            const semantic = await searchSimilarItems(query, items, 5);
            const combined = [...semantic, ...keywords];
            const uniqueIds = new Set<string>();
            const result: SearchableItem[] = [];
            for (const item of combined) {
                if (!uniqueIds.has(item.id)) {
                    uniqueIds.add(item.id);
                    result.push(item);
                }
            }
            return result.slice(0, 7);
        } catch {
            // Fall through to keyword-only
        }
    }

    return keywords.slice(0, 7);
}

// STEP 10 - QUERY REWRITING
export async function rewriteQuery(query: string) {
    const prompt = `<|im_start|>system
Rewrite the user question into a concise search query for retrieving relevant notes.
User question:
${query}
Search query:<|im_end|>
<|im_start|>assistant
`;
    try {
        const res = await AIBridge.generateSync({
            prompt,
            n_predict: 20,
            temperature: 0.1,
            stop: ["<|im_end|>", "\n"]
        });
        return res.response.trim().replace(/^"|"$/g, '');
    } catch (e) {
        return query;
    }
}

// STEP 11 - MULTI-QUERY RETRIEVAL
export async function multiQueryRetrieval(query: string, items: SearchableItem[]) {
    const prompt = `<|im_start|>system
Generate 3 short search queries to retrieve relevant information for this question.
User question:
${query}
Queries:<|im_end|>
<|im_start|>assistant
1.`;
    try {
        const res = await AIBridge.generateSync({
            prompt,
            n_predict: 60,
            temperature: 0.3,
            stop: ["<|im_end|>"]
        });
        const queries = res.response.split('\n')
            .map(q => q.replace(/^\d+\.\s*/, '').trim())
            .filter(q => q.length > 0)
            .slice(0, 3);

        if (queries.length === 0) queries.push(query);

        let allResults: SearchableItem[] = [];
        for (const q of queries) {
            const results = await hybridSearch(q, items);
            allResults = [...allResults, ...results];
        }

        const uniqueIds = new Set<string>();
        const finalResults: SearchableItem[] = [];
        for (const item of allResults) {
            if (!uniqueIds.has(item.id)) {
                uniqueIds.add(item.id);
                finalResults.push(item);
            }
        }
        return finalResults.slice(0, 7);
    } catch (e) {
        return hybridSearch(query, items);
    }
}

// Helper to prepare data for search
export function prepareSearchItems(notes: Note[], todos: Todo[], hourlyLogs: any[]): SearchableItem[] {
    const items: SearchableItem[] = [];

    // Add Notes
    notes.filter(n => !n.deleted).forEach(n => {
        items.push({
            id: n.id,
            title: n.title || 'Untitled Note',
            content: n.content || '',
            type: 'note',
            embedding: n.embedding,
            updatedAt: n.updatedAt || n.createdAt,
            original: n
        });
    });

    // Add Todos
    todos.filter(t => !t.deleted).forEach(t => {
        items.push({
            id: t.id,
            title: 'Task',
            content: `${t.text} (${t.completed ? 'Completed' : 'Pending'})`,
            type: 'todo',
            embedding: t.embedding,
            updatedAt: t.updatedAt || t.createdAt,
            original: t
        });
    });

    // Add Logs
    hourlyLogs.forEach(l => {
        const fullText = Object.values(l.logs).join(' ');
        items.push({
            id: l.date,
            title: `Journal: ${l.date}`,
            content: fullText,
            type: 'log',
            embedding: l.embedding,
            updatedAt: l.updatedAt || Date.now(),
            original: l
        });
    });

    return items;
}
