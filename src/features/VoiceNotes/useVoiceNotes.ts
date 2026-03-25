import { useCallback, useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import type { VoiceNote } from './types';
import { loadVoiceNotes, saveVoiceNotes } from './storage';

export function useVoiceNotes() {
    const [notes, setNotes] = useState<VoiceNote[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshNotes = useCallback(async () => {
        const loaded = await loadVoiceNotes();
        setNotes(loaded);
        setLoading(false);
    }, []);

    useEffect(() => {
        refreshNotes();

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                refreshNotes();
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        const appStatePromise = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                refreshNotes();
            }
        });

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            appStatePromise.then(listener => listener.remove());
        };
    }, [refreshNotes]);

    const updateNotes = useCallback(async (updater: VoiceNote[] | ((current: VoiceNote[]) => VoiceNote[])) => {
        let nextValue: VoiceNote[] = [];

        setNotes(current => {
            nextValue = typeof updater === 'function' ? updater(current) : updater;
            return [...nextValue].sort((a, b) => b.createdAt - a.createdAt);
        });

        await saveVoiceNotes(nextValue);
    }, []);

    return {
        notes,
        loading,
        refreshNotes,
        updateNotes,
    };
}
