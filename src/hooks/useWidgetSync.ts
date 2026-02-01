import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { storage } from '../lib/storage';
import { format } from 'date-fns';
import type { Todo } from '../types';

export function useWidgetSync() {
    useEffect(() => {
        const syncFromNative = async () => {
            try {
                const { value: needsSync } = await Preferences.get({ key: 'needs_native_sync' });
                if (needsSync === 'true') {
                    console.log("WidgetSync: Pulling changes from native widgets...");
                    const today = format(new Date(), 'yyyy-MM-dd');

                    // 1. Sync Todos
                    const { value: todosJson } = await Preferences.get({ key: 'widget_todos' });
                    if (todosJson) {
                        const nativeTodos: Todo[] = JSON.parse(todosJson);
                        // Save each (storage.saveTodo handles merging/updates)
                        for (const todo of nativeTodos) {
                            // Keep the original targetDate (usually empty for widget-added tasks)
                            await storage.saveTodo(todo);
                        }
                    }

                    // 2. Sync Hourly Log
                    const { value: hourlyJson } = await Preferences.get({ key: 'widget_hourly' });
                    if (hourlyJson) {
                        const nativeLogs = JSON.parse(hourlyJson);
                        await storage.saveHourlyLog(today, nativeLogs);
                    }

                    // Clear flag
                    await Preferences.set({ key: 'needs_native_sync', value: 'false' });
                    console.log("WidgetSync: Sync complete.");
                }
            } catch (e) {
                console.error("WidgetSync: Sync failed", e);
            }
        };

        // Run on mount and on app resume
        syncFromNative();

        const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                syncFromNative();
            }
        });

        return () => {
            listener.then(h => h.remove());
        };
    }, []);
}
