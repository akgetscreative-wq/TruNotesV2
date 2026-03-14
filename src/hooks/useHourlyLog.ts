import { useState, useEffect, useCallback, useRef } from 'react';
import { storage } from '../lib/storage';
import { generateEmbedding } from '../features/AI/embedding';

export function useHourlyLog(dateKey: string) {
    const [logs, setLogs] = useState<{ [hour: number]: string }>({});
    const [loading, setLoading] = useState(true);
    const [prevKey, setPrevKey] = useState(dateKey);
    const dateKeyRef = useRef(dateKey);

    if (dateKey !== prevKey) {
        setLogs({});
        setLoading(true);
        setPrevKey(dateKey);
        dateKeyRef.current = dateKey;
    }

    const refreshLogs = useCallback(async (keyToFetch: string) => {
        try {
            const data = await storage.getHourlyLog(keyToFetch);
            if (keyToFetch === dateKeyRef.current) {
                setLogs(data?.logs || {});
            }
        } catch (err) {
            console.error('[useHourlyLog] Fetch error:', err);
        } finally {
            if (keyToFetch === dateKeyRef.current) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        refreshLogs(dateKey);
        const unsubscribe = storage.onDataChange(() => {
            refreshLogs(dateKeyRef.current);
        });
        return unsubscribe;
    }, [dateKey, refreshLogs]);

    const saveLog = useCallback(async (hour: number, text: string) => {
        const activeKey = dateKeyRef.current;

        setLogs(prev => {
            const updated = { ...prev, [hour]: text };

            // Sync with DB using a separate async call to avoid blocking state update
            (async () => {
                const fullDayText = Object.values(updated).join(" ");
                const embedding = await generateEmbedding(fullDayText);
                await storage.saveHourlyLog(activeKey, updated, embedding || undefined);
            })();

            return updated;
        });
    }, []);

    return { logs, loading, saveLog, refreshLogs: () => refreshLogs(dateKeyRef.current) };
}
