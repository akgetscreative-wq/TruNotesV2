import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { storage } from '../lib/storage';
import { format } from 'date-fns';
import type { ActivitySession } from '../types';

export function useActivityTracker() {
    useEffect(() => {
        const syncActivity = async () => {
            const platform = Capacitor.getPlatform();
            const today = format(new Date(), 'yyyy-MM-dd');

            // 1. Handle Android Activity (Polled from Native)
            if (platform === 'android') {
                const { value } = await Preferences.get({ key: 'android_activity_stats' });
                if (value) {
                    try {
                        const sessions: ActivitySession[] = JSON.parse(value);
                        for (const s of sessions) {
                            // Enforce date and updatedAt for merging
                            s.date = today;
                            s.updatedAt = Date.now();
                            await storage.saveActivitySession(s);
                        }
                        // Clear the buffer since we ingested it
                        await Preferences.remove({ key: 'android_activity_stats' });
                    } catch (e) {
                        console.error("ActivityTracker: Android parse failed", e);
                    }
                }
            }

            // 2. Handle PC Activity (Electron pushes it)
            if (platform === 'web' && (window as any).electron) {
                (window as any).electron.onActivityEvent(async (session: any) => {
                    const activity: ActivitySession = {
                        ...session,
                        id: `pc_${session.startTime}_${session.appName}`,
                        date: format(new Date(session.startTime), 'yyyy-MM-dd'),
                        updatedAt: Date.now()
                    };
                    await storage.saveActivitySession(activity);
                });
            }
        };

        syncActivity();
        const interval = setInterval(syncActivity, 30000); // Check for new android data every 30s

        return () => clearInterval(interval);
    }, []);
}
