import { useState, useEffect, useCallback, useRef } from 'react';
import { storage } from '../lib/storage';

export function useHourlyLog(dateKey: string) {
    const [logs, setLogs] = useState<{ [hour: number]: string }>({});
    const [loading, setLoading] = useState(true);
    const [prevKey, setPrevKey] = useState(dateKey);
    const dateKeyRef = useRef(dateKey);

    // 1. Immediate Render-phase Reset
    // This wipes the state the instant the dateKey changes, before the component renders
    if (dateKey !== prevKey) {
        setLogs({});
        setLoading(true);
        setPrevKey(dateKey);
        dateKeyRef.current = dateKey;
    }

    const refreshLogs = useCallback(async (keyToFetch: string) => {
        try {
            const data = await storage.getHourlyLog(keyToFetch);

            // 2. Race Condition Guard
            // Only update state if this is still the active dateKey for this hook instance
            if (keyToFetch === dateKeyRef.current) {
                console.log(`[useHourlyLog] Loaded data for ${keyToFetch}:`, data?.logs);
                setLogs(data?.logs || {});
            } else {
                console.warn(`[useHourlyLog] Ignoring stale logs for ${keyToFetch}`);
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

        // 3. Functional Update Pattern
        // This ensures 'logs' is always the most current version from the state,
        // not a stale version from a previous day.
        setLogs(prev => {
            const updated = { ...prev, [hour]: text };
            // Save to DB in the background
            storage.saveHourlyLog(activeKey, updated);
            return updated;
        });
    }, []);

    return { logs, loading, saveLog, refreshLogs: () => refreshLogs(dateKeyRef.current) };
}
