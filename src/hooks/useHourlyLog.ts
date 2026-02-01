import { useState, useEffect, useCallback } from 'react';
import { storage } from '../lib/storage';
import { format } from 'date-fns';

export function useHourlyLog(date: Date) {
    const [logs, setLogs] = useState<{ [hour: number]: string }>({});
    const [loading, setLoading] = useState(true);
    const dateKey = format(date, 'yyyy-MM-dd');

    const refreshLogs = useCallback(async () => {
        try {
            const data = await storage.getHourlyLog(dateKey);
            if (data) {
                setLogs(data.logs);
            } else {
                setLogs({});
            }
        } catch (err) {
            console.error('Failed to load hourly logs', err);
        } finally {
            setLoading(false);
        }
    }, [dateKey]);

    useEffect(() => {
        refreshLogs();

        const unsubscribe = storage.onDataChange(() => {
            refreshLogs();
        });

        return unsubscribe;
    }, [refreshLogs]);

    const saveLog = async (hour: number, text: string) => {
        const newLogs = { ...logs, [hour]: text };
        await storage.saveHourlyLog(dateKey, newLogs);
        setLogs(newLogs);
    };

    return { logs, loading, saveLog, refreshLogs };
}
